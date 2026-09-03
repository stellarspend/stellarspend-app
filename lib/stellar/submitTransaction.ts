import {
  Horizon,
  NotFoundError,
  StrKey,
  TransactionBuilder,
  TransactionFailedError,
} from "@stellar/stellar-sdk";
import {
  buildPaymentTransaction,
  getPaymentAsset,
  type BuildPaymentTransactionOptions,
  type PaymentAsset,
  type PaymentAssetIssuers,
} from "@/lib/stellar/buildPaymentTransaction";

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ??
  "Test SDF Network ; September 2015";
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_MAX_POLL_ATTEMPTS = 15;
export const PAYMENT_SUBMITTED_EVENT = "stellarspend:payment-submitted";
export const PAYMENT_CONFIRMED_EVENT = "stellarspend:payment-confirmed";

export interface SubmitPaymentOptions {
  source: string;
  destination: string;
  amount: string;
  asset: PaymentAsset;
  memo?: string;
  assetIssuers?: PaymentAssetIssuers;
  networkPassphrase?: string;
  horizonUrl?: string;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  onStatus?: (status: PaymentStatus) => void;
  onSubmitted?: (payment: PendingPayment) => void;
}

export type PaymentStatus =
  | "validating"
  | "building"
  | "signing"
  | "submitting"
  | "confirming"
  | "confirmed";

export interface PendingPayment {
  hash: string;
  feeCharged: string;
  createdAt: string;
  source: string;
  destination: string;
  amount: string;
  asset: PaymentAsset;
  memo?: string;
}

export interface SubmittedPayment extends PendingPayment {
  ledger: number;
}

function createHorizonServer(url = HORIZON_URL) {
  return new Horizon.Server(url);
}

export function toTransactionRecord(
  payment: SubmittedPayment | PendingPayment,
  status: "pending" | "confirmed" = "confirmed",
) {
  return {
    id: payment.hash,
    hash: payment.hash,
    created_at: payment.createdAt,
    memo: payment.memo ?? "Direct Payment",
    memo_type: payment.memo ? "text" : "none",
    successful: true,
    fee_charged: payment.feeCharged,
    max_fee: payment.feeCharged,
    operation_count: 1,
    source_account: payment.source,
    ledger: "ledger" in payment ? payment.ledger : 0,
    status,
    operations: [
      {
        id: `${payment.hash}-payment`,
        type: "payment",
        amount: payment.amount,
        asset_code: payment.asset,
        from: payment.source,
        to: payment.destination,
      },
    ],
  };
}

export async function fetchPaymentFee(horizonUrl = HORIZON_URL): Promise<string> {
  const fee = await createHorizonServer(horizonUrl).fetchBaseFee();
  return String(Math.max(100, fee));
}

function isCreditBalance(balance: Horizon.HorizonApi.BalanceLine) {
  return "asset_code" in balance && "asset_issuer" in balance;
}

function hasTrustline(
  account: { balances: Horizon.HorizonApi.BalanceLine[] },
  assetCode: PaymentAsset,
  issuer: string,
) {
  return account.balances.some(
    (balance) =>
      isCreditBalance(balance) &&
      balance.asset_code === assetCode &&
      balance.asset_issuer === issuer,
  );
}

function mapStellarError(error: unknown): Error {
  if (error instanceof Error) {
    if (error instanceof TransactionFailedError) {
      const resultCodes = error.getResultCodes();
      const code = resultCodes.operations[0] ?? resultCodes.transaction;

      if (code === "op_no_destination" || code === "tx_no_source_account") {
        return new Error(
          "The destination account does not exist on Stellar. Fund it first, then try again.",
        );
      }
      if (code === "op_no_trust" || code === "op_not_authorized") {
        return new Error(
          "The destination has not established a trustline for this asset.",
        );
      }
      if (code === "op_underfunded" || code === "tx_insufficient_balance") {
        return new Error("The wallet does not have enough funds for this payment and fee.");
      }
      if (code === "tx_bad_seq") {
        return new Error("The wallet sequence changed. Please try the payment again.");
      }
      return new Error("Stellar rejected the payment. Check the amount and destination, then try again.");
    }

    return error;
  }

  return new Error("The payment could not be completed. Please try again.");
}

async function validatePayment(
  server: Horizon.Server,
  options: SubmitPaymentOptions,
  networkPassphrase: string,
) {
  if (!StrKey.isValidEd25519PublicKey(options.source)) {
    throw new Error("Connect a valid Freighter wallet before sending.");
  }
  if (!StrKey.isValidEd25519PublicKey(options.destination)) {
    throw new Error("Destination must be a valid Stellar public key.");
  }

  let sourceAccount: Awaited<ReturnType<Horizon.Server["loadAccount"]>>;
  try {
    sourceAccount = await server.loadAccount(options.source);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new Error("The connected source account does not exist on this Stellar network.");
    }
    throw error;
  }

  try {
    const destinationAccount = await server.loadAccount(options.destination);
    if (options.asset !== "XLM") {
      const asset = getPaymentAsset(options.asset, options.assetIssuers);
      if (!asset.issuer || !hasTrustline(destinationAccount, options.asset, asset.issuer)) {
        throw new Error(
          "The destination has not established a trustline for this asset.",
        );
      }
    }
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new Error(
        "The destination account does not exist on Stellar. Fund it first, then try again.",
      );
    }
    throw error;
  }

  const asset = getPaymentAsset(options.asset, options.assetIssuers);
  const sourceBalance = sourceAccount.balances.find((balance) =>
    asset.isNative()
      ? !isCreditBalance(balance)
      : isCreditBalance(balance) &&
        balance.asset_code === asset.code &&
        balance.asset_issuer === asset.issuer,
  );
  const amount = Number(options.amount);
  if (!sourceBalance || Number(sourceBalance.balance) < amount) {
    throw new Error(`The wallet does not have enough ${options.asset} for this payment.`);
  }

  const fee = await server.fetchBaseFee();
  if (asset.isNative() && Number(sourceBalance.balance) < amount + fee / 10_000_000) {
    throw new Error("The wallet does not have enough XLM for the payment and network fee.");
  }

  return {
    sourceAccount,
    fee: String(Math.max(100, fee)),
    networkPassphrase,
  };
}

function getFreighterNetwork(networkPassphrase: string) {
  return networkPassphrase.includes("Test") ? "TESTNET" : "PUBLIC";
}

/**
 * Validates, builds, signs through Freighter, submits to Horizon, and polls
 * until the payment is confirmed on-chain.
 */
export async function submitPaymentTransaction(
  options: SubmitPaymentOptions,
): Promise<SubmittedPayment> {
  const networkPassphrase = options.networkPassphrase ?? NETWORK_PASSPHRASE;
  const server = createHorizonServer(options.horizonUrl);
  const onStatus = options.onStatus;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxPollAttempts = options.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;

  try {
    onStatus?.("validating");
    const { sourceAccount, fee } = await validatePayment(
      server,
      options,
      networkPassphrase,
    );

    onStatus?.("building");
    const builderOptions: BuildPaymentTransactionOptions = {
      source: options.source,
      destination: options.destination,
      amount: options.amount,
      asset: options.asset,
      sequence: sourceAccount.sequence,
      fee,
      memo: options.memo,
      networkPassphrase,
      assetIssuers: options.assetIssuers,
    };
    const transaction = buildPaymentTransaction(builderOptions);

    if (typeof window === "undefined" || !window.freighter) {
      throw new Error("Freighter wallet is not available. Connect Freighter before sending.");
    }

    onStatus?.("signing");
    const signedResult = await window.freighter.signTransaction(
      transaction.toXDR(),
      getFreighterNetwork(networkPassphrase),
    );
    const signedXdr =
      typeof signedResult === "string" ? signedResult : signedResult?.signedTxXdr;
    if (!signedXdr) {
      throw new Error("Transaction signing was cancelled in Freighter.");
    }

    onStatus?.("submitting");
    const signedTransaction = TransactionBuilder.fromXDR(
      signedXdr,
      networkPassphrase,
    );
    const response = await server.submitTransaction(signedTransaction);
    const pendingPayment: PendingPayment = {
      hash: response.hash,
      feeCharged: fee,
      createdAt: new Date().toISOString(),
      source: options.source,
      destination: options.destination,
      amount: options.amount,
      asset: options.asset,
      memo: options.memo,
    };
    options.onSubmitted?.(pendingPayment);

    for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
      onStatus?.("confirming");
      try {
        const confirmed = await server.transactions().transaction(response.hash).call();
        if (!confirmed.successful) {
          throw new Error("Stellar reported that the payment failed.");
        }
        onStatus?.("confirmed");
        return {
          hash: confirmed.hash,
          ledger: confirmed.ledger_attr,
          feeCharged: String(confirmed.fee_charged),
          createdAt: confirmed.created_at,
          source: options.source,
          destination: options.destination,
          amount: options.amount,
          asset: options.asset,
          memo: options.memo,
        };
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
        if (attempt === maxPollAttempts - 1) break;
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }

    throw new Error("The payment was submitted but confirmation timed out. Check Horizon with the transaction hash.");
  } catch (error) {
    throw mapStellarError(error);
  }
}
