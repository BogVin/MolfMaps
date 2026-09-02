import { describe, expect, it } from 'vitest';

import { typefaceStack } from './typeface';

describe('typefaceStack', () => {
  it('maps every supported token to its system stack', () => {
    expect(typefaceStack('sans')).toContain('-apple-system');
    expect(typefaceStack('serif')).toContain('Georgia');
    expect(typefaceStack('condensed')).toContain('Arial Narrow');
  });

  it('falls back to sans for an unknown token', () => {
    expect(typefaceStack('unknown')).toBe(typefaceStack('sans'));
  });
});
