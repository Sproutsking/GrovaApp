import { normalizeTrinityLens } from './useTrinitylens';

describe('normalizeTrinityLens', () => {
  it('keeps the app focused on the everyday/main lens and ignores other mode variants', () => {
    expect(normalizeTrinityLens('everyday')).toBe('everyday');
    expect(normalizeTrinityLens('main')).toBe('everyday');
    expect(normalizeTrinityLens('gaming')).toBe('everyday');
    expect(normalizeTrinityLens('web3')).toBe('everyday');
    expect(normalizeTrinityLens('streaming')).toBe('everyday');
    expect(normalizeTrinityLens('student')).toBe('everyday');
  });
});
