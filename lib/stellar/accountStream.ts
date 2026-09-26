"use client";

/**
 * lib/stellar/accountStream.ts
 *
 * Wraps Stellar Horizon's Server-Sent Events (SSE) streaming for the
 * currently selected wallet so the dashboard updates live as new activity
 * happens on-chain instead of waiting for a manual refresh.
 *
 * Two Horizon streams are opened for the active account:
 *   - `operations().forAccount(account)`  – every operation touching the wallet
 *   - `payments().forAccount(account)`    – the payment subset of the above
 *
 * The streams are owned by a module-level singleton. Subscribers receive
 * emitted events and status changes. Reconnect with exponential backoff is
 * handled internally, and a health watchdog force-reconnects a stream that
 * silently goes stale (e.g. backgrounded tabs on mobile).
 */

import { getConnectedPublicKey } from "@/lib/api/client";
import { getHorizon } from "@/lib/api/horizon";

// ── Tunables ────────────────────────────────────────────────────────────────

/** How long to wait without any SSE message before forcing a reconnect. */
export const ACCOUNT_STREAM_HEALTH_CHECK_MS = 45_000;

/** Base delay for the first reconnect attempt (1s → 2s → 4s … capped). */
const RECONNECT_BASE_MS = 1_000;

/** 2^6 = 64s is the longest reconnect backoff delay. */
const RECONNECT_MAX_EXPONENT = 6;

// ── Public types ────────────────────────────────────────────────────────────

export type AccountStreamStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

/** Minimal shape of a streamed Horizon operation/payment record. */
export interface StreamedOperation {
  id: string;
  type: string;
  transaction_hash: string;
  paging_token: string;
  created_at: string;
  source_account: string;
  amount?: string;
  asset_code?: string;
  asset_type?: string;
  from?: string;
  to?: string;
  _embedded?: {
    transaction?: {
      successful?: boolean;
      memo?: unknown;
      memo_type?: string;
      fee_charged?: string;
      ledger?: number;
    };
  };
}

export interface AccountStreamOperationEvent {
  kind: "operation";
  account: string;
  operation: StreamedOperation;
  receivedAt: number;
}

export interface AccountStreamPaymentEvent {
  kind: "payment";
  account: string;
  payment: StreamedOperation;
  receivedAt: number;
}

export type AccountStreamEvent =
  | AccountStreamOperationEvent
  | AccountStreamPaymentEvent;

export interface AccountStreamState {
  status: AccountStreamStatus;
  account: string | null;
}

export type AccountStreamListener = (event: AccountStreamEvent) => void;
export type AccountStreamStatusListener = (state: AccountStreamState) => void;

// ── Manager ─────────────────────────────────────────────────────────────────

class AccountStreamManager {
  private activeAccount: string | null = null;
  private generation = 0;
  private status: AccountStreamStatus = "idle";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private healthTimer: ReturnType<typeof setTimeout> | null = null;
  private stopOperations: (() => void) | null = null;
  private stopPayments: (() => void) | null = null;
  private readonly listeners = new Set<AccountStreamListener>();
  private readonly statusListeners = new Set<AccountStreamStatusListener>();

  getState(): AccountStreamState {
    return { status: this.status, account: this.activeAccount };
  }

  subscribe(listener: AccountStreamListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeStatus(listener: AccountStreamStatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Open (or reopen) streams for `account`. Passing `null` stops and clears
   * any active stream. Calling with the already-active account is a no-op.
   */
  start(account: string | null): void {
    if (
      account === this.activeAccount &&
      (this.status === "connected" || this.status === "connecting")
    ) {
      return;
    }

    this.teardown();
    this.activeAccount = account;

    if (!account || typeof window === "undefined") {
      this.setStatus("idle");
      return;
    }

    this.reconnectAttempts = 0;
    this.openStreams(account);
  }

  /** Resolve the currently selected wallet and keep the stream in sync. */
  sync(): void {
    this.start(getConnectedPublicKey());
  }

  /** Tear down all streams and timers; resets to an idle state. */
  stop(): void {
    this.teardown();
    this.activeAccount = null;
    this.setStatus("idle");
  }

  private teardown(): void {
    // Bump the generation so any callback from a previous stream cycle is
    // treated as stale and ignored.
    this.generation += 1;
    this.clearTimers();
    this.stopOperations?.();
    this.stopOperations = null;
    this.stopPayments?.();
    this.stopPayments = null;
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.healthTimer) {
      clearTimeout(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private openStreams(account: string): void {
    const generation = this.generation;
    this.setStatus("connecting");

    try {
      const server = getHorizon();

      this.stopOperations = server
        .operations()
        .forAccount(account)
        .cursor("now")
        .stream({
          onmessage: (record) =>
            this.handleStreamMessage(
              account,
              record as StreamedOperation,
              generation,
              "operation",
            ),
          onerror: () => this.handleStreamError(account, generation),
        });

      this.stopPayments = server
        .payments()
        .forAccount(account)
        .cursor("now")
        .stream({
          onmessage: (record) =>
            this.handleStreamMessage(
              account,
              record as StreamedOperation,
              generation,
              "payment",
            ),
          onerror: () => this.handleStreamError(account, generation),
        });
    } catch (err) {
      console.error("AccountStream: failed to open Horizon streams:", err);
      this.handleStreamError(account, generation);
    }
  }

  private handleStreamMessage(
    account: string,
    record: StreamedOperation,
    generation: number,
    kind: "operation" | "payment",
  ): void {
    if (generation !== this.generation) return;

    this.reconnectAttempts = 0;
    this.setStatus("connected");
    this.scheduleHealthCheck(account, generation);

    this.notify(
      kind === "payment"
        ? { kind, account, payment: record, receivedAt: Date.now() }
        : { kind, account, operation: record, receivedAt: Date.now() },
    );
  }

  private handleStreamError(account: string, generation: number): void {
    if (generation !== this.generation) return;

    this.closeStreams();

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, then capped at 64s.
    const delay =
      RECONNECT_BASE_MS *
      2 ** Math.min(this.reconnectAttempts, RECONNECT_MAX_EXPONENT);
    this.reconnectAttempts += 1;
    this.setStatus("reconnecting");

    this.reconnectTimer = setTimeout(() => {
      if (generation !== this.generation) return;
      this.openStreams(account);
    }, delay);
  }

  /** Force a fresh stream when the connection goes silent on a live tab. */
  private scheduleHealthCheck(account: string, generation: number): void {
    if (this.healthTimer) clearTimeout(this.healthTimer);
    this.healthTimer = setTimeout(() => {
      if (generation !== this.generation) return;
      if (this.status === "connected") {
        this.handleStreamError(account, generation);
      }
    }, ACCOUNT_STREAM_HEALTH_CHECK_MS);
  }

  private closeStreams(): void {
    this.stopOperations?.();
    this.stopOperations = null;
    this.stopPayments?.();
    this.stopPayments = null;
  }

  private setStatus(status: AccountStreamStatus): void {
    if (this.status === status) return;
    this.status = status;
    const state: AccountStreamState = {
      status,
      account: this.activeAccount,
    };
    this.statusListeners.forEach((listener) => listener(state));
  }

  private notify(event: AccountStreamEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

// ── Singleton + exported helpers ────────────────────────────────────────────

let manager: AccountStreamManager | null = null;

function getManager(): AccountStreamManager {
  if (!manager) manager = new AccountStreamManager();
  return manager;
}

/** Subscribe to streamed account events; returns an unsubscribe function. */
export function subscribeAccountStream(
  listener: AccountStreamListener,
): () => void {
  return getManager().subscribe(listener);
}

/** Subscribe to stream lifecycle status changes; returns an unsubscribe fn. */
export function subscribeAccountStreamStatus(
  listener: AccountStreamStatusListener,
): () => void {
  return getManager().subscribeStatus(listener);
}

/**
 * Start (or keep) the live stream for `account`. When omitted, the stream
 * resolves the currently selected wallet itself.
 */
export function startAccountStream(account?: string | null): void {
  const managerInstance = getManager();
  if (account === undefined) {
    managerInstance.sync();
  } else {
    managerInstance.start(account);
  }
}

/** Tear down the live stream(s) for the current account. */
export function stopAccountStream(): void {
  getManager().stop();
}

/** Current stream status and active account (for tests / debug UI). */
export function getAccountStreamState(): AccountStreamState {
  return getManager().getState();
}

/** Internal, for tests. */
export function _resetAccountStreamForTests(): void {
  getManager().stop();
  manager = null;
}