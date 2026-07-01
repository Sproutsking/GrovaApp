import {
  createAppRouteState,
  normalizeRoute,
  resolveRouteFromHistoryState,
  shouldSkipRoutePush,
} from './navigationHistory';

describe('navigationHistory', () => {
  it('normalizes a route payload and preserves the previous route context', () => {
    const current = normalizeRoute({ tab: 'home', homeSection: 'reels', accountSection: 'profile' });
    const previous = normalizeRoute({ tab: 'account', homeSection: 'newsfeed', accountSection: 'settings' });
    const entry = createAppRouteState(current, '/#home/reels', previous);

    expect(entry.type).toBe('app-route');
    expect(entry.route).toEqual(current);
    expect(entry.previousRoute).toEqual(previous);
    expect(entry.path).toBe('/#home/reels');
  });

  it('resolves the active route from the history payload before falling back to the hash-derived route', () => {
    const fallback = normalizeRoute({ tab: 'home', homeSection: 'newsfeed', accountSection: 'profile' });
    const previous = normalizeRoute({ tab: 'account', homeSection: 'newsfeed', accountSection: 'settings' });
    const entry = createAppRouteState(fallback, '/#home/newsfeed', previous);

    const resolved = resolveRouteFromHistoryState(entry, fallback);

    expect(resolved.route).toEqual(fallback);
    expect(resolved.previousRoute).toEqual(previous);
    expect(resolved.path).toBe('/#home/newsfeed');
  });

  it('skips pushing a new history entry when the route has not changed', () => {
    const current = normalizeRoute({ tab: 'home', homeSection: 'newsfeed', accountSection: 'profile' });
    const next = normalizeRoute({ tab: 'home', homeSection: 'newsfeed', accountSection: 'profile' });

    expect(shouldSkipRoutePush(current, next)).toBe(true);
  });
});
