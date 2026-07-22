import { isChunkLoadError, buildRecoveryUrl } from './chunkRecovery';

describe('chunkRecovery', () => {
  it('detects chunk loading failures', () => {
    expect(isChunkLoadError('ChunkLoadError: Loading chunk 334 failed.')).toBe(true);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(true);
    expect(isChunkLoadError('Some other error')).toBe(false);
  });

  it('adds a cache-busting query to the current page url', () => {
    expect(buildRecoveryUrl('https://app.xeevia.com/#home')).toContain('v=');
    expect(buildRecoveryUrl('https://app.xeevia.com/?foo=1#home')).toContain('foo=1');
  });
});
