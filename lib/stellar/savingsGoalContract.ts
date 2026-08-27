/**
 * lib/stellar/savingsGoalContract.ts
 *
 * Client for the on-chain savings-goal Soroban contract. Provides CRUD operations
 * for savings goals, scheduled contributions, and round-up rules backed by a
 * deployed Soroban contract when NEXT_PUBLIC_SAVINGS_CONTRACT_ID is configured,
 * falling back to localStorage mock data for offline/testnet usage.
 */

import {
  Contract,
  TransactionBuilder,
  Account,
  scValToNative,
  nativeToScVal,
  Address,
  rpc as SorobanRpc,
} from '@stellar/stellar-sdk';

import { getSorobanServer, getNetworkPassphrase } from '@/lib/api/stellar/client';
import type { Goal, GoalSchedule, RoundUpRule, Contribution } from '@/lib/types/savings';
export type { Goal, GoalSchedule, RoundUpRule, Contribution };
import { callContractView, submitContractTx, triggerNotification } from './budgetContract';

const SAVINGS_CONTRACT_ID = process.env.NEXT_PUBLIC_SAVINGS_CONTRACT_ID ?? '';
const LOCAL_GOALS_KEY = 'stellarspend_local_goals';

async function callSavingsContract<T>(
  method: string,
  args: unknown[],
  sourcePublicKey: string,
): Promise<T> {
  if (!SAVINGS_CONTRACT_ID) {
    throw new Error(
      'NEXT_PUBLIC_SAVINGS_CONTRACT_ID is not configured. Set it to the ' +
      'deployed savings goal contract address.',
    );
  }

  const server = getSorobanServer();
  const networkPassphrase = getNetworkPassphrase();
  const contract = new Contract(SAVINGS_CONTRACT_ID);

  const sourceAccountResp = await server.getAccount(sourcePublicKey);
  const sourceAccount = new Account(
    sourcePublicKey,
    sourceAccountResp.sequenceNumber(),
  );

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
    throw new Error(`Savings contract call "${method}" failed: ${sim.error}`);
  }

  if (!sim.result?.retval) {
    throw new Error(`Savings contract call "${method}" returned no value.`);
  }

  return scValToNative(sim.result.retval) as T;
}

function toScVal(value: unknown) {
  if (
    typeof value === 'string' &&
    value.startsWith('G') &&
    value.length === 56
  ) {
    return new Address(value).toScVal();
  }
  if (typeof value === 'number') {
    return nativeToScVal(value, { type: 'u64' });
  }
  if (typeof value === 'boolean') {
    return nativeToScVal(value ? 1 : 0, { type: 'u32' });
  }
  return nativeToScVal(value);
}

/**
 * Creates a new savings goal on the Soroban contract.
 * @param goalId - A unique identifier for the goal.
 * @param ownerPublicKey - The Stellar public key of the goal owner.
 * @param targetAmount - The target savings amount.
 * @param deadline - The deadline date as a string.
 * @param recurrence - The contribution recurrence type.
 * @returns The contract-assigned goal ID or transaction hash.
 */
export async function createGoalOnChain(
  goalId: string,
  ownerPublicKey: string,
  targetAmount: number,
  deadline: string,
  recurrence: string,
): Promise<string> {
  const result = await callSavingsContract<string>(
    'create_goal',
    [goalId, ownerPublicKey, targetAmount, deadline, recurrence],
    ownerPublicKey,
  );
  return result;
}

/**
 * Records a contribution to a savings goal on the Soroban contract.
 * @param goalId - The ID of the savings goal.
 * @param amount - The contribution amount.
 * @param source - The contribution source (e.g. 'manual', 'round-up').
 * @param accountPublicKey - The contributor's Stellar public key.
 * @returns A confirmation string from the contract.
 */
export async function contributeToGoalOnChain(
  goalId: string,
  amount: number,
  source: string,
  accountPublicKey: string,
): Promise<string> {
  const result = await callSavingsContract<string>(
    'contribute',
    [goalId, amount, source],
    accountPublicKey,
  );
  return result;
}

/**
 * Fetches the contribution schedule for a savings goal from the Soroban contract.
 * @param goalId - The ID of the savings goal.
 * @param accountPublicKey - The owner's Stellar public key.
 * @returns The GoalSchedule for the given goal.
 */
export async function getGoalScheduleOnChain(
  goalId: string,
  accountPublicKey: string,
): Promise<GoalSchedule> {
  const result = await callSavingsContract<GoalSchedule>(
    'get_schedule',
    [goalId],
    accountPublicKey,
  );
  return result;
}

/**
 * Configures the round-up rule for a savings goal on the Soroban contract.
 * @param goalId - The ID of the savings goal.
 * @param enabled - Whether round-up is enabled.
 * @param nearestUnit - The rounding unit (e.g. 1 or 5).
 * @param accountPublicKey - The owner's Stellar public key.
 */
export async function setRoundUpRuleOnChain(
  goalId: string,
  enabled: boolean,
  nearestUnit: number,
  accountPublicKey: string,
): Promise<void> {
  await callSavingsContract(
    'set_round_up_rule',
    [goalId, enabled, nearestUnit],
    accountPublicKey,
  );
}

/**
 * Fetches the current round-up rule for a savings goal from the Soroban contract.
 * @param goalId - The ID of the savings goal.
 * @param accountPublicKey - The owner's Stellar public key.
 * @returns The RoundUpRule configuration for the goal.
 */
export async function getRoundUpRuleOnChain(
  goalId: string,
  accountPublicKey: string,
): Promise<RoundUpRule> {
  const result = await callSavingsContract<RoundUpRule>(
    'get_round_up_rule',
    [goalId],
    accountPublicKey,
  );
  return result;
}

/**
 * Applies a round-up contribution to a savings goal on the Soroban contract.
 * @param goalId - The ID of the savings goal.
 * @param transactionHash - The hash of the originating transaction.
 * @param roundUpAmount - The round-up amount to contribute.
 * @param accountPublicKey - The contributor's Stellar public key.
 */
export async function applyRoundUpOnChain(
  goalId: string,
  transactionHash: string,
  roundUpAmount: number,
  accountPublicKey: string,
): Promise<void> {
  await callSavingsContract(
    'apply_round_up',
    [goalId, transactionHash, roundUpAmount],
    accountPublicKey,
  );
}

/**
 * Pauses the contribution schedule for a savings goal on the Soroban contract.
 * @param goalId - The ID of the savings goal.
 * @param accountPublicKey - The owner's Stellar public key.
 */
export async function pauseScheduleOnChain(
  goalId: string,
  accountPublicKey: string,
): Promise<void> {
  await callSavingsContract(
    'pause_schedule',
    [goalId],
    accountPublicKey,
  );
}

/**
 * Resumes a paused contribution schedule on the Soroban contract.
 * @param goalId - The ID of the savings goal.
 * @param accountPublicKey - The owner's Stellar public key.
 */
export async function resumeScheduleOnChain(
  goalId: string,
  accountPublicKey: string,
): Promise<void> {
  await callSavingsContract(
    'resume_schedule',
    [goalId],
    accountPublicKey,
  );
}

/**
 * Permanently cancels the contribution schedule for a savings goal on the Soroban contract.
 * @param goalId - The ID of the savings goal.
 * @param accountPublicKey - The owner's Stellar public key.
 */
export async function cancelScheduleOnChain(
  goalId: string,
  accountPublicKey: string,
): Promise<void> {
  await callSavingsContract(
    'cancel_schedule',
    [goalId],
    accountPublicKey,
  );
}

/**
 * Fetches the full contribution history for a savings goal from the Soroban contract.
 * @param goalId - The ID of the savings goal.
 * @param accountPublicKey - The owner's Stellar public key.
 * @returns An array of Contribution records.
 */
export async function getContributionHistoryOnChain(
  goalId: string,
  accountPublicKey: string,
): Promise<Contribution[]> {
  const result = await callSavingsContract<Contribution[]>(
    'get_contribution_history',
    [goalId],
    accountPublicKey,
  );
  return result;
}

/**
 * Loads mock savings goals from localStorage (fallback for offline/testnet usage).
 * Returns a default "New Laptop" goal if nothing is stored.
 * @returns An array of Goal objects.
 */
export function getMockGoalsFallback(): Goal[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(LOCAL_GOALS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.map((g: Goal) => ({
        ...g,
        createdAt: new Date(g.createdAt),
      }));
    } catch (e) {
      console.error('Failed to parse mock goals', e);
    }
  }
  // Default mock savings goal
  return [
    {
      id: '1',
      name: 'New Laptop',
      targetAmount: 1200,
      currentAmount: 300,
      deadline: '2024-12-31',
      recurrence: 'once',
      createdAt: new Date(),
    },
  ];
}

/**
 * Persists mock savings goals to localStorage.
 * @param goals - The array of Goal objects to store.
 */
export function setMockGoalsFallback(goals: Goal[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_GOALS_KEY, JSON.stringify(goals));
  }
}

/**
 * Fetches all savings goals for the given account from the Soroban contract.
 * Falls back to localStorage mock data if the contract is not configured.
 * @param publicKey - The Stellar public key of the goal owner.
 * @returns An array of Goal objects.
 */
export async function fetchGoals(publicKey: string): Promise<Goal[]> {
  if (!SAVINGS_CONTRACT_ID) {
    return getMockGoalsFallback();
  }
  try {
    const raw = await callContractView<Array<{
      id: string;
      name: string;
      target_amount: string | number;
      current_amount: string | number;
      deadline: string;
      recurrence: string;
      created_at: string | number;
    }>>(publicKey, SAVINGS_CONTRACT_ID, 'get_goals', [publicKey]);

    return raw.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: Number(g.target_amount),
      currentAmount: Number(g.current_amount || 0),
      deadline: g.deadline,
      recurrence: (g.recurrence as 'once' | 'monthly' | 'yearly') || 'once',
      createdAt: new Date(g.created_at),
    }));
  } catch (e) {
    console.error('Failed to fetch goals on-chain. Falling back to local storage.', e);
    return getMockGoalsFallback();
  }
}

/**
 * Creates a new savings goal on-chain (or locally if no contract is configured).
 * @param publicKey - The Stellar public key of the goal owner.
 * @param goalData - The goal details (title, target amount, deadline, recurrence).
 * @param statusCallback - Optional callback for progress updates.
 * @returns The newly created Goal object.
 */
export async function createGoal(
  publicKey: string,
  goalData: { title: string; targetAmount: number; deadline: string; recurrence: 'once' | 'monthly' | 'yearly' },
  statusCallback?: (status: string) => void
): Promise<Goal> {
  const newId = `goal_${Date.now()}`;
  if (!SAVINGS_CONTRACT_ID) {
    const mockGoals = getMockGoalsFallback();
    const newGoal: Goal = {
      id: newId,
      name: goalData.title,
      targetAmount: goalData.targetAmount,
      currentAmount: 0,
      deadline: goalData.deadline,
      recurrence: goalData.recurrence,
      createdAt: new Date(),
    };
    mockGoals.push(newGoal);
    setMockGoalsFallback(mockGoals);
    return newGoal;
  }
  try {
    const result = await submitContractTx(
      publicKey,
      SAVINGS_CONTRACT_ID,
      'create_goal',
      [
        publicKey,
        newId,
        goalData.title,
        goalData.targetAmount,
        goalData.deadline,
        goalData.recurrence,
      ],
      statusCallback
    );

    const newGoal: Goal = {
      id: result || newId,
      name: goalData.title,
      targetAmount: goalData.targetAmount,
      currentAmount: 0,
      deadline: goalData.deadline,
      recurrence: goalData.recurrence,
      createdAt: new Date(),
    };
    return newGoal;
  } catch (e: unknown) {
    const errMessage = e instanceof Error ? e.message : String(e);
    triggerNotification('error', `Failed to create goal: ${errMessage}`);
    throw e;
  }
}

/**
 * Contributes funds to a savings goal on-chain (or locally if no contract is configured).
 * @param publicKey - The contributor's Stellar public key.
 * @param goalId - The ID of the savings goal to contribute to.
 * @param amount - The amount to contribute.
 * @param statusCallback - Optional callback for progress updates.
 */
export async function contributeToGoal(
  publicKey: string,
  goalId: string,
  amount: number,
  statusCallback?: (status: string) => void
): Promise<void> {
  if (!SAVINGS_CONTRACT_ID) {
    const mockGoals = getMockGoalsFallback();
    const index = mockGoals.findIndex((g) => g.id === goalId);
    if (index !== -1) {
      mockGoals[index].currentAmount += amount;
      setMockGoalsFallback(mockGoals);
    }
    return;
  }
  try {
    await submitContractTx(
      publicKey,
      SAVINGS_CONTRACT_ID,
      'contribute_to_goal',
      [publicKey, goalId, amount],
      statusCallback
    );

    const mockGoals = getMockGoalsFallback();
    const index = mockGoals.findIndex((g) => g.id === goalId);
    if (index !== -1) {
      mockGoals[index].currentAmount += amount;
      setMockGoalsFallback(mockGoals);
    }
  } catch (e: unknown) {
    const errMessage = e instanceof Error ? e.message : String(e);
    triggerNotification('error', `Failed to contribute to goal: ${errMessage}`);
    throw e;
  }
}
