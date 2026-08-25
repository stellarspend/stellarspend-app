import { describe, beforeEach, expect, test } from '@jest/globals';

import {
  encryptData,
  decryptData,
  generateSalt,
  isPassphraseSet,
  setPassphraseSet,
  resetEncryption,
} from '../localEncryption';

describe('localEncryption', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('generateSalt returns a string', () => {
    const salt = generateSalt();
    expect(typeof salt).toBe('string');
    expect(salt.length).toBe(32);
  });

  test('encryptData and decryptData work correctly', async () => {
    const data = { test: 'hello world', number: 123 };
    const passphrase = 'test-passphrase-123';
    
    const encrypted = await encryptData(data, passphrase);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toBe(JSON.stringify(data));
    
    const decrypted = await decryptData(encrypted, passphrase);
    expect(decrypted).toEqual(data);
  });

  test('decryptData fails with wrong passphrase', async () => {
    const data = { test: 'hello world' };
    const passphrase = 'correct-passphrase';
    const wrongPassphrase = 'wrong-passphrase';
    
    const encrypted = await encryptData(data, passphrase);
    
    await expect(decryptData(encrypted, wrongPassphrase)).rejects.toThrow();
  });

  test('passphrase set functions work', () => {
    expect(isPassphraseSet()).toBe(false);
    setPassphraseSet();
    expect(isPassphraseSet()).toBe(true);
    resetEncryption();
    expect(isPassphraseSet()).toBe(false);
  });

  // Note: SSR-safety for the storage helpers lives in
  // localEncryption.ssr.test.ts, which runs in the Node environment where
  // `window` is genuinely absent (jsdom's window cannot be undefined).
});
