export const DEFAULT_ROUTE = Object.freeze({
  tab: 'home',
  homeSection: 'newsfeed',
  accountSection: 'profile',
});

export const HISTORY_INDEX_KEY = '__xv_history_index';

let knownHistoryIndex = null;

export function getHistoryIndex(state) {
  const index = state?.[HISTORY_INDEX_KEY];
  return Number.isInteger(index) && index >= 0 ? index : null;
}

export function getKnownHistoryIndex() {
  return knownHistoryIndex;
}

export function setKnownHistoryIndex(index) {
  if (Number.isInteger(index) && index >= 0) knownHistoryIndex = index;
}

export function ensureHistoryIndex() {
  const currentState = window.history.state && typeof window.history.state === 'object'
    ? window.history.state
    : {};
  const currentIndex = getHistoryIndex(currentState);
  if (currentIndex !== null) {
    setKnownHistoryIndex(currentIndex);
    return currentState;
  }

  const nextState = { ...currentState, [HISTORY_INDEX_KEY]: 0 };
  window.history.replaceState(nextState, '', window.location.href);
  setKnownHistoryIndex(0);
  return nextState;
}

export function pushHistoryState(state, url = window.location.href) {
  const currentState = window.history.state && typeof window.history.state === 'object'
    ? window.history.state
    : {};
  const currentIndex = getHistoryIndex(currentState) ?? getKnownHistoryIndex() ?? 0;
  const nextState = { ...state, [HISTORY_INDEX_KEY]: currentIndex + 1 };
  window.history.pushState(nextState, '', url);
  setKnownHistoryIndex(currentIndex + 1);
  return nextState;
}

export function replaceHistoryState(state, url = window.location.href) {
  const currentState = window.history.state && typeof window.history.state === 'object'
    ? window.history.state
    : {};
  const index = getHistoryIndex(state) ?? getHistoryIndex(currentState) ?? getKnownHistoryIndex() ?? 0;
  const nextState = { ...state, [HISTORY_INDEX_KEY]: index };
  window.history.replaceState(nextState, '', url);
  setKnownHistoryIndex(index);
  return nextState;
}

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
