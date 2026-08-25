/// <reference types="cypress" />

/**
 * Multisig approval flow (Issue #11).
 *
 * ⚠️ BLOCKED: Issue #11 (multisig) is not yet implemented anywhere in the
 * codebase — there is no multisig UI, contract wiring, or pending-approval
 * state to exercise. Writing a test against a feature that does not exist
 * would either silently pass or fail for the wrong reason, so this spec is
 * intentionally skipped until #11 lands.
 *
 * When #11 ships, implement a 2-signer scenario here:
 *   1. Create a wallet with 2 signers (via the multisig setup UI).
 *   2. Initiate a transaction that requires both signatures.
 *   3. Sign with signer A → assert "1 of 2 signatures" / pending state.
 *   4. Sign with signer B → assert the transaction is submitted and the
 *      pending approval clears.
 *   5. Assert the submitted transaction appears in Recent Transactions.
 *
 * The suite must FAIL (not silently pass) if this flow regresses, so remove
 * `it.skip` and wire the real assertions when the feature exists.
 */
describe("Multisig Approval (#11)", () => {
  it.skip("supports a 2-signer approval flow", () => {
    // See file header — blocked on Issue #11 implementation.
    expect(true).to.equal(true);
  });
});
