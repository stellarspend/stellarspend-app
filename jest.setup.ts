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

// Ensure a full WebCrypto implementation is available (with `subtle`).
// Some environments (e.g. jsdom) expose a global `crypto` that lacks
// `subtle`, and `globalThis.crypto` is configurable but not writable, so
// reassigning directly would throw. Redefine it so PBKDF2/AES-GCM work.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}
