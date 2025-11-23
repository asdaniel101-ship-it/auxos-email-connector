'use client';

import { useState, useEffect } from 'react';

interface PasswordProtectionProps {
  children: React.ReactNode;
}

export default function PasswordProtection({ children }: PasswordProtectionProps) {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if already authenticated (stored in sessionStorage)
    const authStatus = sessionStorage.getItem('partner_portal_authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Get password from environment variable or use a default for development
    const correctPassword = process.env.NEXT_PUBLIC_PARTNER_PORTAL_PASSWORD || 'partner2024';

    if (password === correctPassword) {
      sessionStorage.setItem('partner_portal_authenticated', 'true');
      setIsAuthenticated(true);
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Partner Portal</h1>
            <p className="text-slate-600 text-sm">Please enter the password to access the partner portal</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white shadow-sm transition-all"
                placeholder="Enter password"
                autoFocus
              />
            </div>
            
            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full px-4 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-sm hover:shadow-md"
            >
              Access Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

