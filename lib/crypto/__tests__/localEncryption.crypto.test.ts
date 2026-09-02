/**
 * @jest-environment node
 *
 * PBKDF2 + AES-GCM encrypt/decrypt round-trip tests.
 * These run in the node test environment because jsdom's crypto stub can
 * interfere with Node's WebCrypto engine on the first PBKDF2 call.
 */

// Warm up the crypto engine BEFORE tests run. Node 24 with OpenSSL 3 can
// fail the first PBKDF2/AES-GCM operation with "Cipher job failed".
// A throw-away call before any test ensures the engine is ready.
import { webcrypto } from 'node:crypto';
const _warmup = (async () => {
  try {
    const enc = new TextEncoder();
    const key = await webcrypto.subtle.importKey('raw', enc.encode('warmup'), 'PBKDF2', false, ['deriveKey']);
    const dk = await webcrypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new Uint8Array(16), iterations: 100000, hash: 'SHA-256' },
      key, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
    );
    const iv = new Uint8Array(12);
    webcrypto.getRandomValues(iv);
    const ct = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, dk, enc.encode('warmup'));
    const pt = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, dk, ct);
    if (new TextDecoder().decode(pt) !== 'warmup') throw new Error('warmup mismatch');
  } catch (e) {
    // If the engine fails here, tests will fail too — no point silently ignoring.
    throw e;
  }
})();

import { describe, expect, test } from '@jest/globals';

import {
  encryptData,
  decryptData,
  generateSalt,
} from '../localEncryption';

describe('localEncryption — crypto round-trip (node)', () => {
  test('encryptData and decryptData work correctly', async () => {
    // Wait for warmup promise to settle before asserting.
    await _warmup;

    const data = { test: 'hello world', number: 123 };
    const passphrase = 'test-passphrase-123';

    const encrypted = await encryptData(data, passphrase);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toBe(JSON.stringify(data));

    const decrypted = await decryptData(encrypted, passphrase);
    expect(decrypted).toEqual(data);
  });

  test('generateSalt returns a string', () => {
    const salt = generateSalt();
    expect(typeof salt).toBe('string');
    expect(salt.length).toBe(32);
  });

  test('decryptData fails with wrong passphrase', async () => {
    const data = { test: 'hello world' };
    const passphrase = 'correct-passphrase';
    const wrongPassphrase = 'wrong-passphrase';

    const encrypted = await encryptData(data, passphrase);

    await expect(decryptData(encrypted, wrongPassphrase)).rejects.toThrow();
  });
});