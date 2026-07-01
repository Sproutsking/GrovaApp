export const DEFAULT_ROUTE = Object.freeze({
  tab: 'home',
  homeSection: 'newsfeed',
  accountSection: 'profile',
});

export function normalizeRoute(route = {}) {
  const next = {
    tab: route.tab || DEFAULT_ROUTE.tab,
    homeSection: route.homeSection || DEFAULT_ROUTE.homeSection,
    accountSection: route.accountSection || DEFAULT_ROUTE.accountSection,
  };

  return {
    ...next,
    key: `${next.tab}:${next.homeSection}:${next.accountSection}`,
  };
}

export function createAppRouteState(route, path, previousRoute = null) {
  return {
    type: 'app-route',
    route: normalizeRoute(route),
    previousRoute: previousRoute ? normalizeRoute(previousRoute) : null,
    path: path || '/#' + route.tab,
    timestamp: Date.now(),
  };
}

export function resolveRouteFromHistoryState(state, fallbackRoute = null) {
  const fallback = normalizeRoute(fallbackRoute || DEFAULT_ROUTE);

  if (!state || typeof state !== 'object') {
    return {
      route: fallback,
      previousRoute: null,
      path: buildHashPath(fallback),
    };
  }

  const routeState = state.route || state;
  const route = normalizeRoute(routeState && routeState.route ? routeState.route : routeState || fallback);
  const previousRoute = state.previousRoute
    ? normalizeRoute(state.previousRoute)
    : routeState && routeState.previousRoute
      ? normalizeRoute(routeState.previousRoute)
      : null;
  const path = typeof state.path === 'string' && state.path.length > 0
    ? state.path
    : buildHashPath(route);

  return { route, previousRoute, path };
}

export function shouldSkipRoutePush(currentRoute, nextRoute) {
  const current = normalizeRoute(currentRoute);
  const next = normalizeRoute(nextRoute);
  return current.key === next.key;
}

export function buildHashPath(route) {
  const normalized = normalizeRoute(route);
  let path = `#${normalized.tab}`;

  if (normalized.tab === 'home' && normalized.homeSection !== DEFAULT_ROUTE.homeSection) {
    path += `/${normalized.homeSection}`;
  } else if (normalized.tab === 'account' && normalized.accountSection !== DEFAULT_ROUTE.accountSection) {
    path += `/${normalized.accountSection}`;
  }

  return path;
}
