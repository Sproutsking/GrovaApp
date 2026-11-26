import { normalizeTrinityLens, PLATFORM_MODES } from './useTrinitylens';

describe('normalizeTrinityLens', () => {
  it('allows Main and Web3 while keeping other modes disabled', () => {
    expect(normalizeTrinityLens('everyday')).toBe('everyday');
    expect(normalizeTrinityLens('main')).toBe('everyday');
    expect(normalizeTrinityLens('gaming')).toBe('everyday');
    expect(normalizeTrinityLens('web3')).toBe('web3');
    expect(normalizeTrinityLens('streaming')).toBe('everyday');
    expect(normalizeTrinityLens('student')).toBe('everyday');
    expect(PLATFORM_MODES.filter(({ enabled }) => enabled).map(({ id }) => id)).toEqual([
      'everyday',
      'web3',
    ]);
    expect(PLATFORM_MODES.find(({ id }) => id === 'streaming').label).toBe('Stream');
  });
});
