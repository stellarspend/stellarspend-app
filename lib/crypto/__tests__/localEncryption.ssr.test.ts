/**
 * @jest-environment node
 *
 * SSR-safety checks for the local encryption helpers.
 *
 * These must run in the Node test environment: jsdom's `window` global is a
 * non-configurable accessor, so it cannot be temporarily undefined there to
 * simulate server-side rendering. In the Node environment `window` does not
 * exist at all, which is exactly the condition these helpers guard against.
 */
import { describe, expect, test } from '@jest/globals';

import {
  isPassphraseSet,
  loadPlaintext,
  detectPlaintextData,
} from '../localEncryption';

describe('localEncryption (SSR safety)', () => {
  test('storage helpers are safe when window is unavailable', () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'window',
    );

    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(isPassphraseSet()).toBe(false);
    expect(loadPlaintext('missing')).toBeNull();
    expect(detectPlaintextData('missing')).toBe(false);

    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
    } else {
      delete (globalThis as typeof globalThis & { window?: undefined }).window;
    }
  });
});
