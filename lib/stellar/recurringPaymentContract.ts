/**
 * lib/stellar/recurringPaymentContract.ts
 *
 * Client for the recurring-payment Soroban contract.  Provides functions
 * for creating, querying, and manually executing recurring payment
 * schedules.
 *
 * Falls back to localStorage mock data when the contract is not
 * configured, consistent with every other contract wrapper in this repo.
 */


import {
  callContractView,
  submitContractTx,
  triggerNotification,
} from './budgetContract';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ScheduleStatus = 'active' | 'paused' | 'cancelled' | 'completed';

export type ExecutionResult = 'success' | 'skipped' | 'failed';

export interface RecurringPayment {
  id: string;
  owner: string;
  recipient: string;
  amount: number;
  asset: 'XLM' | 'USDC' | 'EURC';
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  maxExecutions?: number;
  executionCount: number;
  nextDueDate: string;
  status: ScheduleStatus;
  createdAt: number;
}

export interface ExecutionRecord {
  scheduleId: string;
  result: ExecutionResult;
  transactionHash?: string;
  executedAt: string;
  errorMessage?: string;
}

// ── Contract config ───────────────────────────────────────────────────────────

const RECURRING_CONTRACT_ID =
  process.env.NEXT_PUBLIC_RECURRING_CONTRACT_ID ?? '';
const LOCAL_SCHEDULES_KEY = 'stellarspend_recurring_schedules';
const LOCAL_EXECUTIONS_KEY = 'stellarspend_recurring_executions';

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Mock / fallback storage ───────────────────────────────────────────────────

function getMockSchedules(): RecurringPayment[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(LOCAL_SCHEDULES_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      /* ignore */
    }
  }
  return [];
}

function setMockSchedules(schedules: RecurringPayment[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_SCHEDULES_KEY, JSON.stringify(schedules));
  }
}

function getMockExecutions(): ExecutionRecord[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(LOCAL_EXECUTIONS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      /* ignore */
    }
  }
  return [];
}

function setMockExecutions(executions: ExecutionRecord[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_EXECUTIONS_KEY, JSON.stringify(executions));
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Contract methods ──────────────────────────────────────────────────────────

/**
 * Creates a new recurring payment schedule on-chain (or locally).
 */
export async function createRecurringPayment(
  publicKey: string,
  params: {
    recipient: string;
    amount: number;
    asset: 'XLM' | 'USDC' | 'EURC';
    frequency: Frequency;
    startDate: string;
    endDate?: string;
    maxExecutions?: number;
  },
  statusCallback?: (status: string) => void,
): Promise<RecurringPayment> {
  const id = `recurring_${Date.now()}`;

  if (!RECURRING_CONTRACT_ID) {
    const schedules = getMockSchedules();
    const schedule: RecurringPayment = {
      id,
      owner: publicKey,
      recipient: params.recipient,
      amount: params.amount,
      asset: params.asset,
      frequency: params.frequency,
      startDate: params.startDate,
      endDate: params.endDate,
      maxExecutions: params.maxExecutions,
      executionCount: 0,
      nextDueDate: params.startDate,
      status: 'active',
      createdAt: Date.now(),
    };
    schedules.push(schedule);
    setMockSchedules(schedules);
    triggerNotification('success', 'Recurring payment created (local mode).');
    return schedule;
  }

  try {
    await submitContractTx(
      publicKey,
      RECURRING_CONTRACT_ID,
      'create_schedule',
      [
        publicKey,
        id,
        params.recipient,
        params.amount,
        params.asset,
        params.frequency,
        params.startDate,
        params.endDate ?? '',
        params.maxExecutions ?? 0,
      ],
      statusCallback,
    );

    const schedule: RecurringPayment = {
      id,
      owner: publicKey,
      recipient: params.recipient,
      amount: params.amount,
      asset: params.asset,
      frequency: params.frequency,
      startDate: params.startDate,
      endDate: params.endDate,
      maxExecutions: params.maxExecutions,
      executionCount: 0,
      nextDueDate: params.startDate,
      status: 'active',
      createdAt: Date.now(),
    };

    triggerNotification('success', 'Recurring payment created successfully.');
    return schedule;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    triggerNotification('error', `Failed to create recurring payment: ${msg}`);
    throw e;
  }
}

/**
 * Fetches all recurring payment schedules for the given account.
 */
export async function fetchRecurringPayments(
  publicKey: string,
): Promise<RecurringPayment[]> {
  if (!RECURRING_CONTRACT_ID) {
    return getMockSchedules().filter((s) => s.owner === publicKey);
  }

  try {
    const raw = await callContractView<
      Array<{
        id: string;
        owner: string;
        recipient: string;
        amount: string | number;
        asset: string;
        frequency: string;
        start_date: string;
        end_date: string;
        max_executions: string | number;
        execution_count: string | number;
        next_due_date: string;
        status: string;
        created_at: string | number;
      }>
    >(publicKey, RECURRING_CONTRACT_ID, 'get_due_schedules', [publicKey]);

    return raw.map((r) => ({
      id: r.id,
      owner: r.owner,
      recipient: r.recipient,
      amount: Number(r.amount),
      asset: r.asset as RecurringPayment['asset'],
      frequency: r.frequency as Frequency,
      startDate: r.start_date,
      endDate: r.end_date || undefined,
      maxExecutions: r.max_executions ? Number(r.max_executions) : undefined,
      executionCount: Number(r.execution_count),
      nextDueDate: r.next_due_date,
      status: r.status as ScheduleStatus,
      createdAt: Number(r.created_at),
    }));
  } catch (e) {
    console.error('Failed to fetch recurring payments on-chain. Using local data.', e);
    return getMockSchedules().filter((s) => s.owner === publicKey);
  }
}

/**
 * Manually triggers execution of a due schedule (calls `execute_due`).
 * This is permissionless per the contract design.
 */
export async function executeScheduleNow(
  publicKey: string,
  scheduleId: string,
  statusCallback?: (status: string) => void,
): Promise<ExecutionRecord> {
  const executedAt = new Date().toISOString();

  if (!RECURRING_CONTRACT_ID) {
    // Local mock execution
    const schedules = getMockSchedules();
    const idx = schedules.findIndex((s) => s.id === scheduleId);
    if (idx === -1) throw new Error('Schedule not found.');

    const schedule = schedules[idx];
    const mockTxHash = `mock_tx_${Date.now()}`;
    const record: ExecutionRecord = {
      scheduleId,
      result: 'success',
      transactionHash: mockTxHash,
      executedAt,
    };

    // Update schedule
    schedule.executionCount += 1;
    schedule.nextDueDate = computeNextDueDate(schedule.nextDueDate, schedule.frequency);

    if (schedule.maxExecutions && schedule.executionCount >= schedule.maxExecutions) {
      schedule.status = 'completed';
    }

    schedules[idx] = schedule;
    setMockSchedules(schedules);

    const executions = getMockExecutions();
    executions.push(record);
    setMockExecutions(executions);

    triggerNotification('success', 'Payment executed (local mode).');
    return record;
  }

  try {
    const txHash = await submitContractTx(
      publicKey,
      RECURRING_CONTRACT_ID,
      'execute_due',
      [scheduleId],
      statusCallback,
    );

    const record: ExecutionRecord = {
      scheduleId,
      result: 'success',
      transactionHash: txHash ?? undefined,
      executedAt,
    };

    triggerNotification('success', 'Payment executed successfully.');
    return record;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const record: ExecutionRecord = {
      scheduleId,
      result: 'failed',
      executedAt,
      errorMessage: msg,
    };

    // Store failed execution locally too
    const executions = getMockExecutions();
    executions.push(record);
    setMockExecutions(executions);

    triggerNotification('error', `Payment execution failed: ${msg}`);
    return record;
  }
}

/**
 * Pauses a recurring payment schedule.
 */
export async function pauseSchedule(
  publicKey: string,
  scheduleId: string,
): Promise<void> {
  if (!RECURRING_CONTRACT_ID) {
    const schedules = getMockSchedules();
    const idx = schedules.findIndex((s) => s.id === scheduleId);
    if (idx !== -1) {
      schedules[idx].status = 'paused';
      setMockSchedules(schedules);
    }
    triggerNotification('info', 'Schedule paused.');
    return;
  }

  await submitContractTx(
    publicKey,
    RECURRING_CONTRACT_ID,
    'pause_schedule',
    [scheduleId],
  );
  triggerNotification('info', 'Schedule paused.');
}

/**
 * Resumes a paused recurring payment schedule.
 */
export async function resumeSchedule(
  publicKey: string,
  scheduleId: string,
): Promise<void> {
  if (!RECURRING_CONTRACT_ID) {
    const schedules = getMockSchedules();
    const idx = schedules.findIndex((s) => s.id === scheduleId);
    if (idx !== -1) {
      schedules[idx].status = 'active';
      setMockSchedules(schedules);
    }
    triggerNotification('info', 'Schedule resumed.');
    return;
  }

  await submitContractTx(
    publicKey,
    RECURRING_CONTRACT_ID,
    'resume_schedule',
    [scheduleId],
  );
  triggerNotification('info', 'Schedule resumed.');
}

/**
 * Cancels a recurring payment schedule.
 */
export async function cancelSchedule(
  publicKey: string,
  scheduleId: string,
): Promise<void> {
  if (!RECURRING_CONTRACT_ID) {
    const schedules = getMockSchedules();
    const idx = schedules.findIndex((s) => s.id === scheduleId);
    if (idx !== -1) {
      schedules[idx].status = 'cancelled';
      setMockSchedules(schedules);
    }
    triggerNotification('info', 'Schedule cancelled.');
    return;
  }

  await submitContractTx(
    publicKey,
    RECURRING_CONTRACT_ID,
    'cancel_schedule',
    [scheduleId],
  );
  triggerNotification('info', 'Schedule cancelled.');
}

/**
 * Fetches execution history for a given schedule.
 */
export async function fetchExecutionHistory(
  scheduleId: string,
): Promise<ExecutionRecord[]> {
  if (!RECURRING_CONTRACT_ID) {
    return getMockExecutions().filter((e) => e.scheduleId === scheduleId);
  }

  try {
    // Use a dummy public key for view calls; the contract should filter by scheduleId.
    const raw = await callContractView<
      Array<{
        schedule_id: string;
        result: string;
        transaction_hash?: string;
        executed_at: string;
        error_message?: string;
      }>
    >(
      'GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO', // dummy key for view
      RECURRING_CONTRACT_ID,
      'get_execution_history',
      [scheduleId],
    );

    return raw.map((r) => ({
      scheduleId: r.schedule_id,
      result: r.result as ExecutionResult,
      transactionHash: r.transaction_hash,
      executedAt: r.executed_at,
      errorMessage: r.error_message,
    }));
  } catch {
    return getMockExecutions().filter((e) => e.scheduleId === scheduleId);
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function computeNextDueDate(currentDue: string, frequency: Frequency): string {
  switch (frequency) {
    case 'daily':
      return addDays(currentDue, 1);
    case 'weekly':
      return addDays(currentDue, 7);
    case 'monthly':
      return addDays(currentDue, 30);
    case 'yearly':
      return addDays(currentDue, 365);
  }
}
