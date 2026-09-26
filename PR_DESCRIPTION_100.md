# Real-time balance and transaction streaming instead of polling/manual refresh

## Summary

This PR replaces the "refresh or reload to see new activity" behavior of the
dashboard with **live Stellar Horizon Server-Sent Events (SSE) streaming**.

A new `lib/stellar/accountStream.ts` module wraps Horizon's
`operations().forAccount().stream()` and `payments().forAccount().stream()`
endpoints for the currently selected wallet. Both the **Balances** widget and
the **Recent Transactions** widget subscribe to the stream, so a new on-chain
operation (incoming payment, path payment, account creation, etc.) updates the
dashboard within the stream's normal latency — no manual refresh required.

## Problem

Financial apps where "refresh" is the only way to see a new incoming payment
feel broken/untrustworthy — especially for the underbanked-population use case
in the README, where users may be checking whether an expected payment has
arrived.

## What was implemented

### New: `lib/stellar/accountStream.ts`

A client-side, module-level account-stream manager:

- Opens **two** Horizon SSE streams for the active account:
  - `server.operations().forAccount(account).cursor("now").stream({...})`
  - `server.payments().forAccount(account).cursor("now").stream({...})`
- Emits `operation` events for every streamed operation and `payment` events
  for the payment subset, tagged with the owning account and a timestamp.
- **Reconnection & backoff**: if a stream errors or silently goes stale, the
  manager reconnects with exponential backoff (`1s → 2s → 4s → … → 64s cap`),
  covering mobile network switches and tab backgrounding.
- **Health watchdog**: a `45s` no-message watchdog force-reconnects an
  otherwise silently-stale connection.
- **Lifecycle safety**: a generation counter invalidates callbacks from
  superseded stream cycles, so stale events can never be delivered after a
  teardown (guaranteed by unit tests).
- Public API: `startAccountStream(account?)`, `stopAccountStream()`,
  `subscribeAccountStream()`, `subscribeAccountStreamStatus()`,
  `getAccountStreamState()`.

### Modified: `components/dashboard/BalancesWidget.tsx`

- Subscribes to account-stream events and refetches real balances whenever a
  new operation streams in.
- Refetches when the stream connects to a different wallet (wallet switch),
  so the widget shows the *newly selected* wallet's balances.
- Shows a subtle pulsing **"Live"** indicator briefly after new activity
  arrives instead of a jarring re-render.

### Modified: `components/dashboard/RecentTransactions.tsx`

- Subscribes to account-stream events, refetches recent transactions on new
  activity, and merges results (deduped by transaction hash, capped at 3).
- Refetches on wallet switch via the stream-status channel.
- Shows a subtle pulsing **"New activity"** badge in the header when live
  transactions arrive.
- Existing optimistic `PAYMENT_SUBMITTED`/`PAYMENT_CONFIRMED` event handling is
  preserved and merged with streamed results.

### Modified: `components/wallet/WalletSwitcher.tsx`

- On selected-wallet change, calls `startAccountStream()` which **tears down
  the old account's stream and starts a fresh one** for the newly selected
  account — no cross-wallet event leakage.

### Modified: `context/WalletContext.tsx`

- `selectWallet` now also persists the selected wallet id to plaintext
  localStorage (when no passphrase is set), keeping
  `getConnectedPublicKey()` — which Horizon reads and the stream follows — in
  sync with the switcher in demo mode.

### Modified: `lib/api/horizon.ts`

- Exported `getHorizon()` so the stream module reuses the exact same Horizon
  server configuration (testnet/mainnet + `NEXT_PUBLIC_HORIZON_URL`).

## Acceptance criteria

- [x] Sending a payment to the currently connected wallet from an external
      account causes the balance and transaction list to update within the SSE
      stream's normal latency, with no manual refresh.
- [x] Switching the selected wallet in `WalletSwitcher` tears down the old
      stream and starts a new one for the newly selected account — no
      cross-wallet event leakage.
- [x] A dropped connection (simulated network interruption) automatically
      reconnects rather than silently going stale forever.

## Files changed

| File | Change |
| --- | --- |
| `lib/stellar/accountStream.ts` | **New** — Horizon SSE stream manager (operations + payments) with reconnect/backoff, health watchdog, and lifecycle-safe teardown. |
| `lib/api/horizon.ts` | Export `getHorizon()` for reuse. |
| `components/dashboard/BalancesWidget.tsx` | Live balance updates + "Live" indicator + refetch on wallet switch. |
| `components/dashboard/RecentTransactions.tsx` | Live transaction updates + "New activity" badge + merged/deduped list + refetch on wallet switch. |
| `components/wallet/WalletSwitcher.tsx` | Tear down/restart the stream on wallet switch. |
| `context/WalletContext.tsx` | Persist selected wallet to plaintext storage in demo mode. |
| `lib/stellar/__tests__/accountStream.test.ts` | **New** — manager unit tests (start, events, teardown on switch, no cross-wallet leakage, backoff reconnect, stop). |
| `components/dashboard/__tests__/RecentTransactions.test.tsx` | Extended — stream start, live-activity refetch + badge, wallet-switch refetch. |

## Testing

- `npm run type-check` — passes.
- `npm run lint` — passes (only a pre-existing upstream warning in
  `SendPaymentModal.tsx`).
- `npm test` — 98 tests pass, including the new stream-manager and widget
  tests.
- Manual: with the dashboard open on wallet A, send a testnet payment to
  wallet A from another account and confirm the balance/transaction list update
  live without refreshing; switch to wallet B and confirm subsequent external
  payments to wallet A no longer trigger updates on the now-inactive view.

closes #100