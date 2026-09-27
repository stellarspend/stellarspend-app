export type Recurrence = 'once' | 'monthly' | 'yearly';

export type ContributionSource = 'manual' | 'scheduled' | 'round-up';

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  recurrence: Recurrence;
  createdAt: Date;
  /** Last-modified marker used to detect edits made on multiple devices. */
  updatedAt?: string;
  schedule?: GoalSchedule;
  roundUpRule?: RoundUpRule;
}

export interface GoalSchedule {
  nextDueDate: string;
  lastExecutedAt?: string;
  amount: number;
  paused: boolean;
}

export interface RoundUpRule {
  enabled: boolean;
  nearestUnit: number;
  paused: boolean;
}

export interface Contribution {
  id: string;
  goalId: string;
  amount: number;
  source: ContributionSource;
  transactionHash?: string;
  createdAt: Date;
}

export interface GoalFormData {
  title: string;
  targetAmount: number;
  deadline: string;
  recurrence: Recurrence;
}
