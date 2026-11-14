/**
 * lib/zk/generateSpendingProof.ts
 *
 * Client-side ZK spending-proof generation.
 * Takes the private inputs (paymentAmount and spendingLimit) and executes
 * the Noir spending_proof circuit constraints.
 */

// Loads and initializes the WASM modules needed for proving (returns true when ready)
import { initZkToolchain } from './wasmLoader';
// Compiled Noir circuit (JSON with the bytecode and ABI), produced by `nargo compile`
import spendingProofCircuit from '../../circuits/spending_proof/target/spending_proof.json';

// Shape of what the function returns to the caller
export interface SpendingProofResult {
  proof: Uint8Array; // the raw proof bytes to send to a verifier
  publicInputs: Uint8Array[]; // values the verifier needs to check the proof, as 32-byte field elements
}

/**
 * Helper to encode an integer value into a 32-byte big-endian field element array.
 */
function numberToFieldBytes(num: number): Uint8Array {
  // 32 zero-filled bytes, the size of one field element
  const buf = Buffer.alloc(32);
  // Write the number into the last 4 bytes (offset 28), big-endian.
  // Note: this only supports whole numbers from 0 to 4,294,967,295 (unsigned 32-bit).
  buf.writeUInt32BE(num, 28);
  // Convert the Node Buffer into a plain Uint8Array
  return new Uint8Array(buf);
}

/**
 * Generates a zero-knowledge spending proof in the browser.
 * Ensures the paymentAmount does not exceed the spendingLimit.
 *
 * @param paymentAmount The payment amount (private input)
 * @param spendingLimit The spending limit threshold (private input)
 * @param statusCallback Optional callback to broadcast proving stages to the UI
 */
export async function generateSpendingProof(
  paymentAmount: number,
  spendingLimit: number,
  statusCallback?: (status: string) => void // e.g. used to update a progress message in the UI
): Promise<SpendingProofResult> {
  // 1. Enforce constraints immediately
  // Fail fast in plain JS before doing any expensive proving work;
  // the circuit enforces the same rule, so an invalid proof couldn't be made anyway
  if (paymentAmount > spendingLimit) {
    throw new Error(
      `Constraint Validation Failed: Payment amount (${paymentAmount}) exceeds spending limit (${spendingLimit}).`
    );
  }

  // 2. Initialize WASM proving system
  // (only calls the callback if the caller provided one)
  if (statusCallback) statusCallback('Initializing Proving Engine (WASM)...');
  const wasmReady = await initZkToolchain();

  // Stop with a clear message if the WASM modules couldn't be loaded
  if (!wasmReady) {
    throw new Error(
      'ZK proving engine failed to initialize. The Barretenberg WASM modules could not be loaded.'
    );
  }

  // Dynamic imports of NoirJS components to prevent server-side crashes
  // (these libraries need browser features, so they are loaded only when this function runs)
  const { Noir } = await import('@noir-lang/noir_js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AztecBb = (await import('@aztec/bb.js')) as any; // cast to any because export names differ between versions
  // Pick whichever backend class this version of bb.js exports (newest name first)
  const UltraHonkBackend = AztecBb.UltraHonkBackend || AztecBb.BarretenbergBackend || AztecBb.Barretenberg;

  if (statusCallback) statusCallback('Preparing Noir circuit bytecode...');

  // Create a Noir instance from the compiled circuit; it runs the circuit logic and builds the witness
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noir = new Noir(spendingProofCircuit as any);

  // Evaluation & Witness simulation
  if (statusCallback) statusCallback('Compiling witness inputs...');
  // Input names must match the parameter names declared in the Noir circuit (snake_case)
  const inputs = {
    payment_amount: paymentAmount,
    spending_limit: spendingLimit
  };

  // Execute circuit with ACVM
  // (ACVM = the Noir virtual machine; it checks the constraints and produces the witness)
  if (statusCallback) statusCallback('Simulating witness execution (ACVM)...');
  const witness = await noir.execute(inputs);

  // Turn the witness into an actual proof using the UltraHonk proving system (the slow step)
  if (statusCallback) statusCallback('Synthesizing UltraHonk spending proof...');
  const backend = new UltraHonkBackend(spendingProofCircuit.bytecode);
  const proofData = await backend.generateProof(witness);

  // Sanity check: verify the proof right away to catch problems before sending it anywhere
  if (statusCallback) statusCallback('Verifying proof locally...');
  const isValid = await backend.verifyProof(proofData);

  if (!isValid) {
    throw new Error('Local verification of generated ZK proof failed.');
  }

  // Return the proof plus the public input (the spending limit) encoded as a 32-byte field element
  return {
    proof: proofData.proof,
    publicInputs: [numberToFieldBytes(spendingLimit)]
  };
}