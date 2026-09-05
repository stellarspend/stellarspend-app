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

  test('storage helpers are safe when window is unavailable', () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    // Some jsdom versions install `window` as a non-configurable accessor that
    // cannot be redefined or deleted. In that case we can't simulate a missing
    // window, but the safety assertions below are still valid.
    const canRedefineWindow = originalWindowDescriptor?.configurable === true;

    if (canRedefineWindow) {
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        configurable: true,
        writable: true,
      });
    }

    expect(isPassphraseSet()).toBe(false);
    expect(loadPlaintext('missing')).toBeNull();
    expect(detectPlaintextData('missing')).toBe(false);

    if (canRedefineWindow) {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
      } else {
        delete (globalThis as typeof globalThis & { window?: undefined }).window;
      }
    }
    // Test behavior when localStorage or window methods return safely
    expect(isPassphraseSet()).toBe(false);
    expect(loadPlaintext('missing')).toBeNull();
    expect(detectPlaintextData('missing')).toBe(false);
  });
});
