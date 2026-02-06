import { useEffect, useCallback } from 'react';

export const useNavigation = (activeTab, homeSection, accountSection, setActiveTab, setHomeSection, setAccountSection) => {
  
  const getStateFromLocation = useCallback(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return { tab: 'home', homeSection: 'newsfeed', accountSection: 'profile' };
    
    const [tab, ...params] = hash.split('/');
    
    if (tab === 'home' && params[0]) {
      return { tab: 'home', homeSection: params[0], accountSection: 'profile' };
    }
    
    if (tab === 'account' && params[0]) {
      return { tab: 'account', homeSection: 'newsfeed', accountSection: params[0] };
    }
    
    return { tab, homeSection: 'newsfeed', accountSection: 'profile' };
  }, []);

  const updateLocation = useCallback((tab, homeSec, accSec) => {
    let path = `#${tab}`;
    
    if (tab === 'home' && homeSec !== 'newsfeed') {
      path += `/${homeSec}`;
    } else if (tab === 'account' && accSec !== 'profile') {
      path += `/${accSec}`;
    }
    
    if (window.location.hash !== path) {
      window.history.pushState({ tab, homeSection: homeSec, accountSection: accSec }, '', path);
    }
  }, []);

  useEffect(() => {
    updateLocation(activeTab, homeSection, accountSection);
  }, [activeTab, homeSection, accountSection, updateLocation]);

  useEffect(() => {
    const handlePopState = (event) => {
      const state = getStateFromLocation();
      setActiveTab(state.tab);
      setHomeSection(state.homeSection);
      setAccountSection(state.accountSection);
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