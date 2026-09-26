import { describe, beforeEach, expect, test } from '@jest/globals';

import {
  encryptData,
  decryptData,
  generateSalt,
  isPassphraseSet,
  setPassphraseSet,
  loadPlaintext,
  loadEncrypted,
  saveEncrypted,
  detectPlaintextData,
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

  describe('decryptData with a mismatched key', () => {
    const plaintext = {
      test: 'hello world',
      nested: { amounts: [1, 2, 3] },
      number: 123,
    };

    test('rejects because the ciphertext is not authentic, not because JSON parsing fails', async () => {
      const encrypted = await encryptData(plaintext, 'correct-passphrase');

      // Resolve the rejection to a value so we can inspect *why* it failed.
      const reason: unknown = await decryptData(encrypted, 'wrong-passphrase').then(
        () => null,
        (error: unknown) => error,
      );

      // A resolved value would mean the mismatched key produced plaintext.
      expect(reason).not.toBeNull();
      // AES-GCM verifies the authentication tag before releasing any plaintext,
      // so a mismatched key fails inside WebCrypto and `JSON.parse` is never
      // reached. A `SyntaxError` here would mean the wrong key produced
      // plaintext that merely happened to be invalid JSON — exactly the
      // silent-corruption case this test guards against.
      expect((reason as Error | null)?.name).toBeDefined();
      expect((reason as Error | null)?.name).not.toBe('SyntaxError');
    });

    test('loadEncrypted returns null for the wrong key but still decrypts with the right one', async () => {
      const key = 'wallet-backup';
      await saveEncrypted(key, plaintext, 'correct-passphrase');

      // The "or null is returned" half of the requirement: callers that go
      // through loadEncrypted must not receive partially decrypted data.
      await expect(loadEncrypted(key, 'wrong-passphrase')).resolves.toBeNull();

      // The stored payload is intact — the null above came from the key
      // mismatch, not from a missing or corrupted entry.
      await expect(loadEncrypted(key, 'correct-passphrase')).resolves.toEqual(plaintext);
    });

    test('also rejects when the ciphertext itself has been tampered with', async () => {
      const encrypted = await encryptData(plaintext, 'correct-passphrase');

      // Flip a single bit in the authentication tag.
      const bytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
      bytes[bytes.length - 1] ^= 0x01;
      const tampered = btoa(String.fromCharCode(...bytes));

      await expect(decryptData(tampered, 'correct-passphrase')).rejects.toThrow();
      await expect(decryptData(tampered, 'wrong-passphrase')).rejects.toThrow();

      // The untouched payload is unaffected by the failed attempts above.
      await expect(decryptData(encrypted, 'correct-passphrase')).resolves.toEqual(plaintext);
    });

    test('rejects a mismatched key for every payload shape', async () => {
      const payloads: unknown[] = ['a string', 42, [1, 2, 3], { a: { b: 1 } }, null];

      for (const payload of payloads) {
        const encrypted = await encryptData(payload, 'key-one');
        await expect(decryptData(encrypted, 'key-two')).rejects.toThrow();
      }
    });

    test('compares passphrases byte for byte', async () => {
      const encrypted = await encryptData(plaintext, 'correct-passphrase');

      // A passphrase that differs by a single trailing space must not be
      // treated as a match (e.g. by trimming before key derivation).
      await expect(decryptData(encrypted, 'correct-passphrase ')).rejects.toThrow();
    });

    test('encrypts the same data to different ciphertext each time', async () => {
      const first = await encryptData(plaintext, 'correct-passphrase');
      const second = await encryptData(plaintext, 'correct-passphrase');

      // A fresh salt and IV per call mean re-encrypting never reproduces a
      // previous ciphertext, so a mismatched key can never be masked by a
      // reused keystream.
      expect(first).not.toBe(second);
      await expect(decryptData(second, 'correct-passphrase')).resolves.toEqual(plaintext);
    });
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
