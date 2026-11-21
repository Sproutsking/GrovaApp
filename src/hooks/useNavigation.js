import { useEffect, useCallback, useRef, useState } from 'react';
import {
  buildHashPath,
  createAppRouteState,
  DEFAULT_ROUTE,
  ensureHistoryIndex,
  getHistoryIndex,
  pushHistoryState,
  normalizeRoute,
  replaceHistoryState,
  resolveRouteFromHistoryState,
  setKnownHistoryIndex,
  shouldSkipRoutePush,
} from '../utils/navigationHistory';

export const useNavigation = (activeTab, homeSection, accountSection, setActiveTab, setHomeSection, setAccountSection) => {
  const lastPushedRouteRef = useRef(null);
  const lastHistoryIndexRef = useRef(getHistoryIndex(window.history.state) ?? 0);
  const [navigationDirection, setNavigationDirection] = useState('forward');

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
    let historyState = ensureHistoryIndex();
    if (!historyState.__back_navigation && !historyState.__app_route && historyState.type !== 'app-route') {
      historyState = replaceHistoryState({ ...historyState, __back_navigation: true });
    }

    const route = normalizeRoute({ tab, homeSection: homeSec, accountSection: accSec });
    const path = buildHashPath(route);
    const currentPath = window.location.hash || '#';
    const currentRoute = getStateFromLocation();

    if (shouldSkipRoutePush(currentRoute, route) && currentPath === path) {
      if (!window.history.state?.type || window.history.state.type !== 'app-route') {
        replaceHistoryState(createAppRouteState(route, path), path);
        lastHistoryIndexRef.current = getHistoryIndex(window.history.state) ?? lastHistoryIndexRef.current;
      }
      lastPushedRouteRef.current = route;
      return;
    }

    const hasAppState = Boolean(window.history.state && window.history.state.type === 'app-route');
    const previousRoute = lastPushedRouteRef.current || currentRoute;
    const entry = createAppRouteState(route, path, previousRoute);

    if (!hasAppState && (currentPath === path || window.history.state?.__back_navigation)) {
      replaceHistoryState(entry, path);
    } else {
      pushHistoryState(entry, path);
    }

    lastHistoryIndexRef.current = getHistoryIndex(window.history.state) ?? lastHistoryIndexRef.current;
    setNavigationDirection('forward');
    lastPushedRouteRef.current = route;
  }, [getStateFromLocation]);

  useEffect(() => {
    updateLocation(activeTab, homeSection, accountSection);
  }, [activeTab, homeSection, accountSection, updateLocation]);

  useEffect(() => {
    const handlePopState = (event) => {
      const targetIndex = getHistoryIndex(event.state);
      const previousIndex = lastHistoryIndexRef.current;
      setNavigationDirection(targetIndex !== null && targetIndex > previousIndex ? 'forward' : 'back');
      if (targetIndex !== null) {
        lastHistoryIndexRef.current = targetIndex;
        setKnownHistoryIndex(targetIndex);
      } else {
        lastHistoryIndexRef.current = Math.max(0, previousIndex - 1);
      }

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

  return { isAtRoot, navigationDirection };
};