import { describe, expect, test } from "@jest/globals";
import { Networks, StrKey } from "@stellar/stellar-sdk";
import {
  buildPaymentTransaction,
  getPaymentAsset,
} from "../buildPaymentTransaction";

const source = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(1));
const destination = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(2));
const issuer = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(3));

const baseOptions = {
  source,
  destination,
  amount: "1.2500000",
  asset: "XLM" as const,
  sequence: "7",
  fee: "100",
  networkPassphrase: Networks.TESTNET,
};

describe("buildPaymentTransaction", () => {
  test("builds an unsigned payment transaction with the requested memo", () => {
    const transaction = buildPaymentTransaction({
      ...baseOptions,
      memo: "Test payment",
    });
    const operation = transaction.operations[0];

    expect(transaction.source).toBe(source);
    expect(transaction.sequence).toBe("8");
    expect(transaction.memo.value).toBe("Test payment");
    expect(operation.type).toBe("payment");
    expect(operation.amount).toBe("1.2500000");
    expect(operation.destination).toBe(destination);
    expect(operation.asset).toEqual(getPaymentAsset("XLM"));
    expect(transaction.toXDR()).toBeTruthy();
  });

  test("builds a credit-asset payment with the configured issuer", () => {
    const asset = getPaymentAsset("USDC", { USDC: issuer });
    const transaction = buildPaymentTransaction({
      ...baseOptions,
      asset: "USDC",
      assetIssuers: { USDC: issuer },
    });
    const operation = transaction.operations[0];

    expect(asset.issuer).toBe(issuer);
    expect(operation.asset).toEqual(asset);
  });

  test("rejects an unconfigured credit asset", () => {
    expect(() =>
      buildPaymentTransaction({
        ...baseOptions,
        asset: "USDC",
      }),
    ).toThrow(/USDC is not configured/);
  });

  test("rejects invalid amounts and oversized memos", () => {
    expect(() =>
      buildPaymentTransaction({ ...baseOptions, amount: "1.12345678" }),
    ).toThrow(/no more than 7 decimal places/);
    expect(() =>
      buildPaymentTransaction({ ...baseOptions, memo: "a".repeat(29) }),
    ).toThrow(/28 bytes or fewer/);
  });
});
