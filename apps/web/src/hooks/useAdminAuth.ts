'use client';

import { useState, useEffect, useCallback } from 'react';

const ADMIN_PASSWORD = 'Insurance123';

export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if already authenticated in session storage
    const checkAuth = () => {
      const auth = sessionStorage.getItem('admin_authenticated');
      setIsAuthenticated(auth === 'true');
      setIsLoading(false);
    };

    checkAuth();

    // Listen for storage changes (e.g., logout from another component)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'admin_authenticated') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event for same-tab updates
    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener('adminAuthChange', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('adminAuthChange', handleAuthChange);
    };
  }, []);

  const login = useCallback((password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event('adminAuthChange'));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('admin_authenticated');
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('adminAuthChange'));
  }, []);

  return {
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}

