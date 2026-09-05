export type SplitMethod = 'even' | 'custom';

export type ShareStatus = 'pending' | 'paid' | 'disputed';

export type SplitStatus = 'collecting' | 'released' | 'disputed';

export interface SplitShare {
  participant: string; // Stellar public key
  amount: number;
  status: ShareStatus;
  paidAt?: string;
  transactionHash?: string;
  disputeReason?: string;
}

export interface SplitBill {
  id: string;
  creator: string; // Stellar public key
  description: string;
  totalAmount: number;
  asset: 'XLM' | 'USDC' | 'EURC';
  method: SplitMethod;
  shares: SplitShare[];
  status: SplitStatus;
  escrowAccount?: string;
  createdAt: string;
  releasedAt?: string;
  releaseTransactionHash?: string;
}

export interface CreateSplitInput {
  description: string;
  totalAmount: number;
  asset: 'XLM' | 'USDC' | 'EURC';
  method: SplitMethod;
  participants: Array<{ address: string; amount: number }>;
}
