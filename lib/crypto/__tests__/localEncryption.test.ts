import { describe, beforeEach, expect, test } from '@jest/globals';

import {
  encryptData,
  decryptData,
  generateSalt,
  isPassphraseSet,
  setPassphraseSet,
  resetEncryption,
  loadPlaintext,
  detectPlaintextData,
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

  test('storage helpers return safe defaults and never throw', () => {
    // jsdom exposes a non-configurable global `window`, so the `typeof window
    // === 'undefined'` guard cannot be forced in this environment. These
    // assertions still verify the documented safe-default behaviour of the
    // helpers when no data is stored.
    expect(isPassphraseSet()).toBe(false);
    expect(loadPlaintext('missing')).toBeNull();
    expect(detectPlaintextData('missing')).toBe(false);
    expect(() => isPassphraseSet()).not.toThrow();
    expect(() => loadPlaintext('missing')).not.toThrow();
  });
});
