import {
  _resetAccountStreamForTests,
  startAccountStream,
  stopAccountStream,
  subscribeAccountStream,
  subscribeAccountStreamStatus,
  getAccountStreamState,
} from "../accountStream";
import { getHorizon } from "@/lib/api/horizon";
import { getConnectedPublicKey } from "@/lib/api/client";

jest.mock("@/lib/api/horizon", () => ({
  getHorizon: jest.fn(),
}));

jest.mock("@/lib/api/client", () => ({
  getConnectedPublicKey: jest.fn(),
}));

const mockGetHorizon = getHorizon as jest.MockedFunction<typeof getHorizon>;
const mockGetConnectedPublicKey = getConnectedPublicKey as jest.MockedFunction<
  typeof getConnectedPublicKey
>;

interface StreamOptions {
  onmessage?: (record: unknown) => void;
  onerror?: (event?: unknown) => void;
}

function createFakeServer() {
  const opened: StreamOptions[] = [];
  const closeHandles: jest.Mock[] = [];
  const accountsForAccount: string[] = [];

  const makeBuilder = () => ({
    forAccount: jest.fn((account: string) => {
      accountsForAccount.push(account);
      return {
        cursor: jest.fn(() => ({
          stream: jest.fn((opts: StreamOptions) => {
            opened.push(opts);
            const close = jest.fn();
            closeHandles.push(close);
            return close;
          }),
        })),
      };
    }),
  });

  const operations = jest.fn(() => makeBuilder());
  const payments = jest.fn(() => makeBuilder());

  mockGetHorizon.mockReturnValue({ operations, payments } as never);

  const closedCount = () =>
    closeHandles.filter((handle) => handle.mock.calls.length > 0).length;

  return {
    opened,
    closeHandles,
    closedCount,
    operations,
    payments,
    accountsForAccount,
  };
}

const ACCOUNT_A = "GAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ACCOUNT_B = "GBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function makeRecord(id: string, account: string) {
  return {
    id,
    type: "payment",
    transaction_hash: `hash_${id}`,
    paging_token: `token_${id}`,
    created_at: "2026-09-24T00:00:00Z",
    source_account: account,
    amount: "5.00",
    asset_code: "XLM",
  };
}

describe("accountStream", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetAccountStreamForTests();
  });

  afterAll(() => {
    _resetAccountStreamForTests();
  });

  it("opens operations and payments streams for the given account", () => {
    const fake = createFakeServer();

    startAccountStream(ACCOUNT_A);

    expect(mockGetHorizon).toHaveBeenCalledTimes(1);
    expect(fake.operations).toHaveBeenCalledTimes(1);
    expect(fake.payments).toHaveBeenCalledTimes(1);
    expect(fake.opened).toHaveLength(2);
    expect(getAccountStreamState()).toEqual({
      status: "connecting",
      account: ACCOUNT_A,
    });
  });

  it("resolves the selected wallet when no account is passed", () => {
    const fake = createFakeServer();
    mockGetConnectedPublicKey.mockReturnValue(ACCOUNT_A);

    startAccountStream();

    expect(fake.opened).toHaveLength(2);
    expect(getAccountStreamState().account).toBe(ACCOUNT_A);
  });

  it("emits operation events to subscribers", () => {
    const fake = createFakeServer();
    const listener = jest.fn();
    subscribeAccountStream(listener);

    startAccountStream(ACCOUNT_A);

    const record = makeRecord("op-1", ACCOUNT_A);
    fake.opened[0].onmessage?.(record);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "operation",
        account: ACCOUNT_A,
        operation: record,
      }),
    );
    expect(getAccountStreamState().status).toBe("connected");
  });

  it("emits payment events from the payments stream", () => {
    const fake = createFakeServer();
    const listener = jest.fn();
    subscribeAccountStream(listener);

    startAccountStream(ACCOUNT_A);

    const record = makeRecord("op-pay", ACCOUNT_A);
    fake.opened[1].onmessage?.(record);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "payment",
        account: ACCOUNT_A,
        payment: record,
      }),
    );
  });

  it("reports connecting -> connected -> idle according to lifecycle", () => {
    const fake = createFakeServer();
    const statuses: string[] = [];
    subscribeAccountStreamStatus((state) => statuses.push(state.status));

    startAccountStream(ACCOUNT_A);
    fake.opened[0].onmessage?.(makeRecord("op-1", ACCOUNT_A));
    stopAccountStream();

    expect(statuses).toContain("connecting");
    expect(statuses).toContain("connected");
    expect(statuses).toContain("idle");
  });

  it("switching accounts tears down old streams and opens new ones", () => {
    const fake = createFakeServer();

    startAccountStream(ACCOUNT_A);
    expect(fake.closedCount()).toBe(0);

    const listener = jest.fn();
    subscribeAccountStream(listener);

    startAccountStream(ACCOUNT_B);

    // Old operations + payments streams both closed.
    expect(fake.closedCount()).toBe(2);
    // Two fresh streams opened for the new account.
    expect(fake.opened).toHaveLength(4);

    // Events from the old (stale) generation are ignored.
    fake.opened[0].onmessage?.(makeRecord("op-stale-A", ACCOUNT_A));
    expect(listener).not.toHaveBeenCalled();

    // New stream events flow through.
    fake.opened[2].onmessage?.(makeRecord("op-b", ACCOUNT_B));
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ account: ACCOUNT_B }),
    );
  });

  it("no cross-wallet leakage: teardown closes both old streams", () => {
    const fake = createFakeServer();
    startAccountStream(ACCOUNT_A);
    startAccountStream(ACCOUNT_B);

    expect(fake.closedCount()).toBe(2);
  });

  it("reconnects with exponential backoff after a stream error", () => {
    jest.useFakeTimers();
    try {
      const fake = createFakeServer();

      startAccountStream(ACCOUNT_A);
      expect(fake.opened).toHaveLength(2);

      // First error → reconnecting.
      fake.opened[0].onerror?.();
      expect(getAccountStreamState().status).toBe("reconnecting");
      expect(fake.opened).toHaveLength(2); // nothing reopened yet

      // Backoff base 1s elapses → streams reopen.
      jest.advanceTimersByTime(1000);
      expect(fake.opened).toHaveLength(4);

      // Second error → 2s backoff.
      fake.opened[2].onerror?.();
      jest.advanceTimersByTime(1999);
      expect(fake.opened).toHaveLength(4);
      jest.advanceTimersByTime(1);
      expect(fake.opened).toHaveLength(6);

      // A successful message stops further reconnects and resets backoff.
      fake.opened[4].onmessage?.(makeRecord("op-ok", ACCOUNT_A));
      expect(getAccountStreamState().status).toBe("connected");
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not reconnect after stop()", () => {
    jest.useFakeTimers();
    try {
      const fake = createFakeServer();

      startAccountStream(ACCOUNT_A);
      fake.opened[0].onerror?.();
      stopAccountStream();

      // Back-off would have fired, but the manager is stopped.
      jest.advanceTimersByTime(10000);
      expect(fake.opened).toHaveLength(2);
      expect(getAccountStreamState()).toEqual({
        status: "idle",
        account: null,
      });
    } finally {
      jest.useRealTimers();
    }
  });
});