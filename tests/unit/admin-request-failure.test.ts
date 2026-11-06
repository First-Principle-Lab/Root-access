import { describe, expect, it } from 'vitest';
import { requestFailureMessage } from '../../src/lib/api';

/* The fallback sentence is what makes a failed list "actionable" in the acceptance table
   (docs/admin-redesign-plan.md, "Failure paths"). Every browser gives a request that never landed
   a different useless string, and all of them must turn into the same sentence. */
const FALLBACK = 'Subsections could not be reached. Check your connection and try again.';

describe('requestFailureMessage', () => {
  it('passes a server message through untouched', () => {
    const error = new Error('Cannot delete tag with 3 associated post(s).');
    expect(requestFailureMessage(error, FALLBACK)).toBe(
      'Cannot delete tag with 3 associated post(s).',
    );
  });

  it('replaces the transport-only strings browsers invent', () => {
    for (const text of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.', '']) {
      expect(requestFailureMessage(new Error(text), FALLBACK)).toBe(FALLBACK);
    }
  });

  it('copes with a rejection that is not an Error at all', () => {
    expect(requestFailureMessage('boom', FALLBACK)).toBe(FALLBACK);
    expect(requestFailureMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });
});
