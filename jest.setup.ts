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
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}
