import { describe, beforeEach, expect, test } from '@jest/globals';

import {
  isPassphraseSet,
  setPassphraseSet,
  resetEncryption,
} from '../localEncryption';

// PBKDF2 + AES-GCM round-trip tests are in localEncryption.crypto.test.ts
// (node environment) because jsdom's crypto stub interferes with Node's
// WebCrypto engine on the first PBKDF2 call (OpenSSL 3 "Cipher job failed").
// The localStorage-based helpers below depend only on jsdom APIs.
describe('localEncryption — storage helpers (jsdom)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('passphrase set functions work', () => {
    expect(isPassphraseSet()).toBe(false);
    setPassphraseSet();
    expect(isPassphraseSet()).toBe(true);
    resetEncryption();
    expect(isPassphraseSet()).toBe(false);
  });
});