# Cypress E2E Tests

End-to-end tests for StellarSpend covering the critical user journeys:
wallet connection, send-and-confirm payments, offline queueing, budget/goal
persistence, language switching / RTL, and (when implemented) multisig.

## Running Tests

### Interactive Mode (Development)
```bash
npm run cypress:open
```

### Headless Mode (CI)
```bash
npm run test:e2e
```

### With Dev Server
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run cypress:open
```

## Test Coverage

| Spec | Covers | Issue |
| ---- | ------ | ----- |
| `user-journey.cy.ts` | Landing page, mocked wallet + Horizon, budget form, navigation | — |
| `wallet-connection.cy.ts` | Connect / disconnect Freighter from the navbar, full public key, "not installed" error | #2 |
| `send-payment.cy.ts` | Send modal validation, successful payment confirmation, ZK-gate warning UI | #3 |
| `offline-sync.cy.ts` | Offline banner, queueing a payment while offline, persistence across reload, retry/clear | #6 |
| `budgets-goals-persistence.cy.ts` | Budget creation + reload persistence, savings goal creation + reload persistence | #5 |
| `multisig-approval.cy.ts` | Placeholder — **skipped** until Issue #11 (multisig) is implemented | #11 |
| `i18n-rtl.cy.ts` | Language switching, Arabic RTL `dir`/`lang` attributes, persistence, RTL screenshot | #17 |

## Test-Environment Strategy

The app's production data layer falls back to deterministic local storage when
no Soroban contract addresses are configured, so the suite runs against a
**mocked Freighter + local-storage fixture** in CI:

- **Freighter** is stubbed via `cy.mockFreighter()` — `requestAccess()`,
  `getPublicKey()`, `isConnected()`, `getNetwork()` and `signTransaction()`
  all return deterministic values from `cypress/fixtures/wallet.json`.
- **Stellar/Horizon** calls are intercepted via `cy.mockStellarAPI()` for the
  mocked-data specs (accounts, transactions, submission).
- **Offline** is simulated by firing the window `offline`/`online` events
  (`cy.goOffline()` / `cy.goOnline()`), which is exactly what the app's
  `OfflineProvider` listens for.
- No live testnet dependency — runs are repeatable and never flaky due to
  network state. When the real contracts are wired (testnet fixture), the
  same specs exercise the on-chain path without changes because the app falls
  back to local storage when contract addresses are absent.

## Custom Commands (`cypress/support/commands.ts`)

- `cy.mockFreighter()` — install the deterministic Freighter extension mock.
- `cy.connectWallet()` — mock Freighter + click the navbar connect button.
- `cy.disconnectWallet()` — open the wallet menu and disconnect.
- `cy.mockStellarAPI()` — intercept Horizon accounts/transactions calls.
- `cy.goOffline()` / `cy.goOnline()` — toggle the app's connectivity state.

## Fixtures

- `wallet.json` — mock wallet connection data (public key, network).
- `transaction.json` — sample Stellar payment transaction.

## CI Integration

Tests run automatically in GitHub Actions on every PR (see
`.github/workflows/ci.yml`). The e2e job builds the app, starts the production
server, waits for it, and runs the suite sharded across two runners. Screenshots
and videos from failures are uploaded as artifacts. The config enables one
headless retry per test to absorb transient flakiness.
