import { describe, expect, jest, test, afterEach } from "@jest/globals";
import { Horizon, NotFoundError, StrKey } from "@stellar/stellar-sdk";
import {
  PAYMENT_CONFIRMED_EVENT,
  PAYMENT_SUBMITTED_EVENT,
  submitPaymentTransaction,
  toTransactionRecord,
  type PendingPayment,
  type SubmittedPayment,
} from "../submitTransaction";

const source = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(1));
const destination = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(2));
const issuer = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(3));
const confirmedPayment: SubmittedPayment = {
  hash: "confirmed-hash",
  ledger: 123,
  feeCharged: "100",
  createdAt: "2026-08-26T12:00:00.000Z",
  source,
  destination,
  amount: "1.25",
  asset: "XLM",
  memo: "Test payment",
};

const sourceAccount = {
  sequence: "7",
  balances: [{ asset_type: "native", balance: "100.0000000" }],
};

afterEach(() => {
  jest.restoreAllMocks();
  delete window.freighter;
});

describe("submitPaymentTransaction", () => {
  test("signs, submits, reports pending, and returns the confirmed payment", async () => {
    const loadAccount = jest
      .spyOn(Horizon.Server.prototype, "loadAccount")
      .mockResolvedValue(sourceAccount as never);
    jest
      .spyOn(Horizon.Server.prototype, "fetchBaseFee")
      .mockResolvedValue(100);
    jest
      .spyOn(Horizon.Server.prototype, "submitTransaction")
      .mockResolvedValue({ hash: confirmedPayment.hash } as never);
    jest
      .spyOn(Horizon.Server.prototype, "transactions")
      .mockReturnValue({
        transaction: () => ({
          call: jest.fn().mockResolvedValue({
            hash: confirmedPayment.hash,
            ledger_attr: confirmedPayment.ledger,
            fee_charged: confirmedPayment.feeCharged,
            created_at: confirmedPayment.createdAt,
            successful: true,
          }),
        }),
      } as never);

    const signedXdrs: string[] = [];
    window.freighter = {
      isConnected: jest.fn().mockResolvedValue(true),
      getPublicKey: jest.fn().mockResolvedValue(source),
      requestAccess: jest.fn().mockResolvedValue(source),
      signTransaction: jest.fn(async (xdr: string) => {
        signedXdrs.push(xdr);
        return xdr;
      }),
    };

    const statuses: string[] = [];
    const submitted: PendingPayment[] = [];
    const payment = await submitPaymentTransaction({
      source,
      destination,
      amount: confirmedPayment.amount,
      asset: "XLM",
      memo: confirmedPayment.memo,
      horizonUrl: "https://horizon-testnet.stellar.org",
      pollIntervalMs: 0,
      maxPollAttempts: 1,
      onStatus: (status) => statuses.push(status),
      onSubmitted: (pending) => submitted.push(pending),
    });

    expect(loadAccount).toHaveBeenCalledTimes(2);
    expect(signedXdrs).toHaveLength(1);
    expect(submitted).toEqual([
      expect.objectContaining({ hash: confirmedPayment.hash }),
    ]);
    expect(payment).toEqual(confirmedPayment);
    expect(statuses).toEqual([
      "validating",
      "building",
      "signing",
      "submitting",
      "confirming",
      "confirmed",
    ]);
  });

  test("maps an unfunded destination to a clear account error", async () => {
    jest
      .spyOn(Horizon.Server.prototype, "loadAccount")
      .mockResolvedValueOnce(sourceAccount as never)
      .mockRejectedValueOnce(new NotFoundError("not found", {} as never));

    await expect(
      submitPaymentTransaction({
        source,
        destination,
        amount: "1",
        asset: "XLM",
        horizonUrl: "https://horizon-testnet.stellar.org",
      }),
    ).rejects.toThrow(
      "The destination account does not exist on Stellar. Fund it first, then try again.",
    );
  });

  test("rejects a credit-asset payment when the destination lacks a trustline", async () => {
    jest
      .spyOn(Horizon.Server.prototype, "loadAccount")
      .mockResolvedValue(sourceAccount as never);

    await expect(
      submitPaymentTransaction({
        source,
        destination,
        amount: "1",
        asset: "USDC",
        assetIssuers: { USDC: issuer },
        horizonUrl: "https://horizon-testnet.stellar.org",
      }),
    ).rejects.toThrow("The destination has not established a trustline for this asset.");
  });
});

describe("transaction reconciliation records", () => {
  test("preserves a pending record and marks the confirmed replacement", () => {
    const pending: PendingPayment = {
      hash: confirmedPayment.hash,
      feeCharged: confirmedPayment.feeCharged,
      createdAt: confirmedPayment.createdAt,
      source: confirmedPayment.source,
      destination: confirmedPayment.destination,
      amount: confirmedPayment.amount,
      asset: confirmedPayment.asset,
      memo: confirmedPayment.memo,
    };

    expect(toTransactionRecord(pending, "pending")).toMatchObject({
      id: confirmedPayment.hash,
      status: "pending",
      ledger: 0,
      successful: true,
    });
    expect(toTransactionRecord(confirmedPayment, "confirmed")).toMatchObject({
      id: confirmedPayment.hash,
      status: "confirmed",
      ledger: confirmedPayment.ledger,
    });
  });

  test("exports stable event names for list reconciliation", () => {
    expect(PAYMENT_SUBMITTED_EVENT).toBe("stellarspend:payment-submitted");
    expect(PAYMENT_CONFIRMED_EVENT).toBe("stellarspend:payment-confirmed");
  });
});
