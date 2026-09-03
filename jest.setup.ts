/// <reference types="node" />

import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "node:util";
import { webcrypto } from "node:crypto";

declare global {
  var TextEncoder: typeof globalThis.TextEncoder;
  var TextDecoder: typeof globalThis.TextDecoder;
  var crypto: Crypto;
}

if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder as typeof TextEncoder;
}

if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder = TextDecoder as typeof TextDecoder;
}

// jsdom ships a `crypto` global that only implements getRandomValues() —
// it has no `subtle`, which localEncryption's PBKDF2/AES-GCM flow needs.
// Replace it with Node's full WebCrypto implementation in that case.
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto?.subtle) {
// Some jsdom versions ship a `crypto` global without `subtle`; the encryption
// helpers need the full WebCrypto API, so replace it whenever subtle is missing.
// Plain assignment is not enough — the global can be an accessor — so we use
// Object.defineProperty (the property is configurable in this environment).
if (
  typeof globalThis.crypto === "undefined" ||
  typeof (globalThis.crypto as Crypto).subtle === "undefined"
) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}
