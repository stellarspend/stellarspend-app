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

if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
  // jsdom provides a crypto stub without WebCrypto `subtle` support, and
  // its globalThis.crypto getter has no setter (so assignment does nothing).
  // Re-define the property with Node's full webcrypto.
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    writable: true,
    configurable: true,
    enumerable: false,
  });
}
