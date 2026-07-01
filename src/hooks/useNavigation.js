import { useEffect, useCallback, useRef } from 'react';
import {
  buildHashPath,
  createAppRouteState,
  DEFAULT_ROUTE,
  normalizeRoute,
  resolveRouteFromHistoryState,
  shouldSkipRoutePush,
} from '../utils/navigationHistory';

export const useNavigation = (activeTab, homeSection, accountSection, setActiveTab, setHomeSection, setAccountSection) => {
  const lastPushedRouteRef = useRef(null);

  const getStateFromLocation = useCallback(() => {
    const historyState = window.history.state;
    const historyRoute = resolveRouteFromHistoryState(historyState, DEFAULT_ROUTE);

    if (historyRoute && historyRoute.route && historyRoute.route.key) {
      return historyRoute.route;
    }

    const hash = window.location.hash.slice(1);
    if (!hash) return normalizeRoute(DEFAULT_ROUTE);

    const [tab, ...params] = hash.split('/');

    if (tab === 'home' && params[0]) {
      return normalizeRoute({ tab: 'home', homeSection: params[0], accountSection: 'profile' });
    }

    if (tab === 'account' && params[0]) {
      return normalizeRoute({ tab: 'account', homeSection: 'newsfeed', accountSection: params[0] });
    }

    return normalizeRoute({ tab, homeSection: 'newsfeed', accountSection: 'profile' });
  }, []);

  const updateLocation = useCallback((tab, homeSec, accSec) => {
    const route = normalizeRoute({ tab, homeSection: homeSec, accountSection: accSec });
    const path = buildHashPath(route);
    const currentPath = window.location.hash || '#';
    const currentRoute = getStateFromLocation();

    if (shouldSkipRoutePush(currentRoute, route) && currentPath === path) {
      lastPushedRouteRef.current = route;
      return;
    }

    const hasAppState = Boolean(window.history.state && window.history.state.type === 'app-route');
    const previousRoute = lastPushedRouteRef.current || currentRoute;
    const entry = createAppRouteState(route, path, previousRoute);

    if (!hasAppState && currentPath === path) {
      window.history.replaceState(entry, '', path);
    } else {
      window.history.pushState(entry, '', path);
    }

    lastPushedRouteRef.current = route;
  }, [getStateFromLocation]);

  useEffect(() => {
    updateLocation(activeTab, homeSection, accountSection);
  }, [activeTab, homeSection, accountSection, updateLocation]);

  useEffect(() => {
    const handlePopState = () => {
      const state = getStateFromLocation();
      const historyState = window.history.state;
      const resolved = resolveRouteFromHistoryState(historyState, state);
      const nextRoute = resolved.route || state;

      setActiveTab(nextRoute.tab);
      setHomeSection(nextRoute.homeSection);
      setAccountSection(nextRoute.accountSection);
      lastPushedRouteRef.current = nextRoute;
    };

    window.addEventListener('popstate', handlePopState);

    const initialState = getStateFromLocation();
    if (initialState.tab !== activeTab ||
        initialState.homeSection !== homeSection ||
        initialState.accountSection !== accountSection) {
      setActiveTab(initialState.tab);
      setHomeSection(initialState.homeSection);
      setAccountSection(initialState.accountSection);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [getStateFromLocation, setActiveTab, setHomeSection, setAccountSection, activeTab, homeSection, accountSection]);

  const isAtRoot = useCallback(() => {
    return activeTab === 'home' && homeSection === 'newsfeed';
  }, [activeTab, homeSection]);

  return { isAtRoot };
};