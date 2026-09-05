import {
  Account,
  Asset,
  Memo,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

export type PaymentAsset = "XLM" | "USDC" | "EURC";

export interface PaymentAssetIssuers {
  USDC?: string;
  EURC?: string;
}

export interface BuildPaymentTransactionOptions {
  source: string;
  destination: string;
  amount: string;
  asset: PaymentAsset;
  sequence: string;
  fee: string;
  memo?: string;
  networkPassphrase: string;
  assetIssuers?: PaymentAssetIssuers;
  timeoutSeconds?: number;
}

const DEFAULT_ASSET_ISSUERS: PaymentAssetIssuers = {
  USDC: process.env.NEXT_PUBLIC_STELLAR_USDC_ISSUER,
  EURC: process.env.NEXT_PUBLIC_STELLAR_EURC_ISSUER,
};

function validatePublicKey(address: string, label: string) {
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new Error(`${label} must be a valid Stellar public key.`);
  }
}

function validateAmount(amount: string) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/.test(amount) || Number(amount) <= 0) {
    throw new Error("Amount must be greater than zero with no more than 7 decimal places.");
  }
}

export function getPaymentAsset(
  assetCode: PaymentAsset,
  issuers: PaymentAssetIssuers = DEFAULT_ASSET_ISSUERS,
): Asset {
  if (assetCode === "XLM") return Asset.native();

  const issuer = issuers[assetCode];
  if (!issuer) {
    throw new Error(
      `${assetCode} is not configured for this network. Configure NEXT_PUBLIC_STELLAR_${assetCode}_ISSUER before sending it.`,
    );
  }
  validatePublicKey(issuer, `${assetCode} issuer`);
  return new Asset(assetCode, issuer);
}

/**
 * Builds an unsigned Stellar payment transaction ready for Freighter signing.
 * The caller supplies the current source sequence and network fee from Horizon.
 */
export function buildPaymentTransaction({
  source,
  destination,
  amount,
  asset,
  sequence,
  fee,
  memo,
  networkPassphrase,
  assetIssuers = DEFAULT_ASSET_ISSUERS,
  timeoutSeconds = 180,
}: BuildPaymentTransactionOptions): Transaction {
  validatePublicKey(source, "Source");
  validatePublicKey(destination, "Destination");
  validateAmount(amount);

  if (!sequence || !/^\d+$/.test(sequence)) {
    throw new Error("Source account sequence is invalid.");
  }
  if (!fee || !/^\d+$/.test(fee) || Number(fee) <= 0) {
    throw new Error("Network fee is invalid.");
  }
  if (memo && new TextEncoder().encode(memo).length > 28) {
    throw new Error("Memo must be 28 bytes or fewer.");
  }

  const sourceAccount = new Account(source, sequence);
  const builder = new TransactionBuilder(sourceAccount, {
    fee,
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination,
        amount,
        asset: getPaymentAsset(asset, assetIssuers),
      }),
    )
    .setTimeout(timeoutSeconds);

  if (memo) {
    builder.addMemo(Memo.text(memo));
  }

  return builder.build();
}
