/**
 * lib/stellar/budgetContract.ts
 *
 * Client for the on-chain budget Soroban contract. Provides CRUD operations
 * for user budgets backed by a deployed Soroban contract when
 * NEXT_PUBLIC_BUDGET_CONTRACT_ID is configured, falling back to a
 * localStorage-backed mock for offline/testnet usage.
 */

import {
  Contract,
  TransactionBuilder,
  Account,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
  rpc as SorobanRpc,
  Transaction,
} from '@stellar/stellar-sdk';
import { getSorobanServer, getNetworkPassphrase } from '@/lib/api/stellar/client';
import { Budget } from '@/lib/api/client';

const BUDGET_CONTRACT_ID = process.env.NEXT_PUBLIC_BUDGET_CONTRACT_ID || '';
const LOCAL_BUDGETS_KEY = 'stellarspend_local_budgets';

/**
 * Dispatches a custom DOM notification event for UI feedback.
 * @param type - The notification severity: 'success', 'error', or 'info'.
 * @param message - The human-readable message to display.
 */
export function triggerNotification(type: 'success' | 'error' | 'info', message: string): void {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('stellarspend_notification', {
      detail: { type, message },
    });
    window.dispatchEvent(event);
  }
}

/**
 * Loads mock budgets from localStorage (used as fallback when no contract is deployed).
 * @returns An array of Budget objects, or an empty array if none are stored.
 */
export function getMockBudgetsFallback(): Budget[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(LOCAL_BUDGETS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse mock budgets', e);
    }
  }
  return [];
}

/**
 * Persists mock budgets to localStorage.
 * @param budgets - The array of Budget objects to store.
 */
export function setMockBudgetsFallback(budgets: Budget[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_BUDGETS_KEY, JSON.stringify(budgets));
  }
}

function toScVal(value: unknown): xdr.ScVal {
  if (typeof value === 'string' && value.startsWith('G') && value.length === 56) {
    return new Address(value).toScVal();
  }
  if (typeof value === 'number') {
    return nativeToScVal(value, { type: 'u64' });
  }
  return nativeToScVal(value);
}

/**
 * Simulates a read-only Soroban contract call and returns the decoded result.
 * @param publicKey - The account to use as the simulation source (for sequence numbers).
 * @param contractId - The deployed Soroban contract address.
 * @param method - The contract method name to invoke.
 * @param args - Arguments to pass to the contract method.
 * @returns The decoded return value of type T.
 */
export async function callContractView<T>(
    publicKey: string,
    contractId: string,
    method: string,
    args: unknown[]
): Promise<T> {
  const server = getSorobanServer();
  const networkPassphrase = getNetworkPassphrase();
  const contract = new Contract(contractId);
  const sourceAccountResp = await server.getAccount(publicKey);
  const sourceAccount = new Account(publicKey, sourceAccountResp.sequenceNumber());
  const scArgs = args.map((arg) => toScVal(arg));

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase,
  })
      .addOperation(contract.call(method, ...scArgs))
      .setTimeout(30)
      .build();

  const sim = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation error: ${sim.error}`);
  }

  if (!sim.result?.retval) {
    throw new Error(`No return value from view method: ${method}`);
  }

  return scValToNative(sim.result.retval) as T;
}

/**
 * Builds, simulates, signs (via Freighter), and submits a Soroban contract transaction.
 * Polls for on-chain confirmation after submission.
 * @param publicKey - The account that will sign and submit the transaction.
 * @param contractId - The deployed Soroban contract address.
 * @param method - The contract method name to invoke.
 * @param args - Arguments to pass to the contract method.
 * @param statusCallback - Optional callback for progress updates (e.g. UI spinner).
 * @returns The transaction hash on success, or null if no return value.
 */
export async function submitContractTx(
    publicKey: string,
    contractId: string,
    method: string,
    args: unknown[],
    statusCallback?: (status: string) => void
): Promise<string | null> {
  const server = getSorobanServer();
  const networkPassphrase = getNetworkPassphrase();
  const contract = new Contract(contractId);
  const scArgs = args.map((arg) => toScVal(arg));

  if (statusCallback) statusCallback('Preparing transaction...');
  triggerNotification('info', `Preparing transaction for ${method}...`);

  const sourceAccountResp = await server.getAccount(publicKey);
  const sourceAccount = new Account(publicKey, sourceAccountResp.sequenceNumber());

  let tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase,
  })
      .addOperation(contract.call(method, ...scArgs))
      .setTimeout(30)
      .build() as Transaction;

  if (statusCallback) statusCallback('Simulating transaction...');
  const sim = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  tx = SorobanRpc.assembleTransaction(tx, sim).build();

  if (statusCallback) statusCallback('Awaiting wallet signature...');
  if (typeof window === 'undefined' || !window.freighter) {
    throw new Error('Freighter wallet not connected or available.');
  }

  const freighter = window.freighter as unknown as {
    signTransaction: (xdr: string, opts?: string | { network?: string }) => Promise<string | { signedTxXdr?: string }>;
  };
  const networkArg = networkPassphrase.includes('Test') ? 'TESTNET' : 'PUBLIC';
  const signResult = await freighter.signTransaction(tx.toXDR(), networkArg);
  const signedTxXdr = typeof signResult === 'string' ? signResult : (signResult?.signedTxXdr || signResult);

  if (!signedTxXdr) {
    throw new Error('Transaction signing rejected by user.');
  }

  if (statusCallback) statusCallback('Submitting to network...');
  const signedTx = TransactionBuilder.fromXDR(signedTxXdr as string, networkPassphrase) as Transaction;
  const submitResp = await server.sendTransaction(signedTx);

  if (submitResp.status === 'ERROR') {
    throw new Error(`Submission failed: ${submitResp.errorResult || JSON.stringify(submitResp)}`);
  }

  const txHash = submitResp.hash;
  let attempts = 0;
  const maxAttempts = 15;

  while (attempts < maxAttempts) {
    if (statusCallback) {
      statusCallback(`Confirming transaction (Attempt ${attempts + 1}/${maxAttempts})...`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const txStatus = await server.getTransaction(txHash);

    if (txStatus.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      if (statusCallback) statusCallback('Transaction completed successfully!');
      triggerNotification('success', `Transaction for ${method} completed successfully!`);
      if (txStatus.returnValue) {
        return scValToNative(txStatus.returnValue) as string;
      }
      return txHash;
    } else if (txStatus.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction processing failed: ${JSON.stringify(txStatus.resultXdr)}`);
    }
    attempts++;
  }

  throw new Error('Transaction confirmation timed out.');
}

/**
 * Fetches all budgets for the given account from the Soroban contract.
 * Falls back to localStorage mock data if the contract is not configured or the call fails.
 * @param publicKey - The Stellar public key of the budget owner.
 * @returns An array of Budget objects.
 */
export async function fetchBudgets(publicKey: string): Promise<Budget[]> {
  if (!BUDGET_CONTRACT_ID) {
    return getMockBudgetsFallback();
  }
  try {
    const raw = await callContractView<Array<{
      id: string;
      name: string;
      amount: string | number;
      category: string;
      asset: string;
      start_date: string;
      end_date: string;
    }>>(publicKey, BUDGET_CONTRACT_ID, 'get_budgets', [publicKey]);

    return raw.map((b) => ({
      id: b.id,
      name: b.name,
      amount: Number(b.amount),
      category: b.category,
      asset: b.asset as 'XLM' | 'USDC' | 'EURC',
      startDate: b.start_date,
      endDate: b.end_date,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  } catch (e) {
    console.error('Failed to fetch budgets on-chain. Falling back to local storage.', e);
    return getMockBudgetsFallback();
  }
}

/**
 * Creates a new budget on-chain (or locally if no contract is configured).
 * @param publicKey - The Stellar public key of the budget owner.
 * @param budgetData - The budget details (name, amount, category, asset, dates).
 * @param statusCallback - Optional callback for progress updates.
 * @returns The newly created Budget object.
 */
export async function createBudget(
    publicKey: string,
    budgetData: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>,
    statusCallback?: (status: string) => void
): Promise<Budget> {
  const newId = `budget_${Date.now()}`;
  if (!BUDGET_CONTRACT_ID) {
    const mockBudgets = getMockBudgetsFallback();
    const newBudget: Budget = {
      ...budgetData,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockBudgets.push(newBudget);
    setMockBudgetsFallback(mockBudgets);
    return newBudget;
  }
  try {
    const result = await submitContractTx(
        publicKey,
        BUDGET_CONTRACT_ID,
        'create_budget',
        [
          publicKey,
          newId,
          budgetData.name,
          budgetData.amount,
          budgetData.category,
          budgetData.asset,
          budgetData.startDate,
          budgetData.endDate,
        ],
        statusCallback
    );

    const newBudget: Budget = {
      ...budgetData,
      id: result || newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return newBudget;
  } catch (e: unknown) {
    const errMessage = e instanceof Error ? e.message : String(e);
    triggerNotification('error', `Failed to create budget: ${errMessage}`);
    throw e;
  }
}

/**
 * Updates an existing budget on-chain (or locally if no contract is configured).
 * @param publicKey - The Stellar public key of the budget owner.
 * @param id - The ID of the budget to update.
 * @param budgetData - Partial budget fields to merge into the existing record.
 * @param statusCallback - Optional callback for progress updates.
 * @returns The updated Budget object.
 */
export async function updateBudget(
    publicKey: string,
    id: string,
    budgetData: Partial<Omit<Budget, 'id' | 'createdAt'>>,
    statusCallback?: (status: string) => void
): Promise<Budget> {
  if (!BUDGET_CONTRACT_ID) {
    const mockBudgets = getMockBudgetsFallback();
    const index = mockBudgets.findIndex((b) => b.id === id);
    if (index === -1) throw new Error('Budget not found');
    mockBudgets[index] = {
      ...mockBudgets[index],
      ...budgetData,
      updatedAt: new Date().toISOString(),
    };
    setMockBudgetsFallback(mockBudgets);
    return mockBudgets[index];
  }
  try {
    const fullMock = getMockBudgetsFallback();
    const existing = fullMock.find((b) => b.id === id);

    await submitContractTx(
        publicKey,
        BUDGET_CONTRACT_ID,
        'update_budget',
        [
          publicKey,
          id,
          budgetData.name || existing?.name || '',
          budgetData.amount || existing?.amount || 0,
          budgetData.category || existing?.category || '',
          budgetData.asset || existing?.asset || 'XLM',
          budgetData.startDate || existing?.startDate || '',
          budgetData.endDate || existing?.endDate || '',
        ],
        statusCallback
    );

    const mockBudgets = getMockBudgetsFallback();
    const index = mockBudgets.findIndex((b) => b.id === id);
    if (index !== -1) {
      mockBudgets[index] = {
        ...mockBudgets[index],
        ...budgetData,
        updatedAt: new Date().toISOString(),
      };
      return mockBudgets[index];
    }

    return {
      id,
      name: budgetData.name || '',
      amount: budgetData.amount || 0,
      category: budgetData.category || '',
      asset: (budgetData.asset as Budget['asset']) || 'XLM',
      startDate: budgetData.startDate || '',
      endDate: budgetData.endDate || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (e: unknown) {
    const errMessage = e instanceof Error ? e.message : String(e);
    triggerNotification('error', `Failed to update budget: ${errMessage}`);
    throw e;
  }
}

/**
 * Deletes a budget from the Soroban contract (or locally if no contract is configured).
 * @param publicKey - The Stellar public key of the budget owner.
 * @param id - The ID of the budget to delete.
 * @param statusCallback - Optional callback for progress updates.
 */
export async function deleteBudget(
    publicKey: string,
    id: string,
    statusCallback?: (status: string) => void
): Promise<void> {
  if (!BUDGET_CONTRACT_ID) {
    const mockBudgets = getMockBudgetsFallback();
    const filtered = mockBudgets.filter((b) => b.id !== id);
    setMockBudgetsFallback(filtered);
    return;
  }
  try {
    await submitContractTx(
        publicKey,
        BUDGET_CONTRACT_ID,
        'delete_budget',
        [publicKey, id],
        statusCallback
    );

    const mockBudgets = getMockBudgetsFallback();
    const filtered = mockBudgets.filter((b) => b.id !== id);
    setMockBudgetsFallback(filtered);
  } catch (e: unknown) {
    const errMessage = e instanceof Error ? e.message : String(e);
    triggerNotification('error', `Failed to delete budget: ${errMessage}`);
    throw e;
  }
}