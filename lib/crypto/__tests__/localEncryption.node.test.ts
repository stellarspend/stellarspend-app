/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';

import { isPassphraseSet, loadPlaintext, detectPlaintextData } from '../localEncryption';

// The node test environment has no `window` global — the same condition the
// app runs under during SSR or in offline workers. The storage helpers must
// degrade to safe defaults instead of throwing. (In jsdom, `window` cannot be
// removed at runtime, so this case lives in its own environment.)
describe('localEncryption without window (node environment)', () => {
  test('storage helpers are safe when window is unavailable', () => {
    expect(typeof window).toBe('undefined');

    expect(isPassphraseSet()).toBe(false);
    expect(loadPlaintext('missing')).toBeNull();
    expect(detectPlaintextData('missing')).toBe(false);
  });
});
