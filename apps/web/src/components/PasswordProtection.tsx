'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function PasswordProtection({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { isAuthenticated, login } = useAdminAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      setError('');
      setPassword('');
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Admin Access Required</h1>
        <p className="text-slate-600 mb-6">Please enter the password to access this page.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              placeholder="Enter password"
              autoFocus
            />
          </div>
          
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
          
          <button
            type="submit"
            className="w-full px-6 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Access
          </button>
        </form>
      </div>
    </div>
  );
}
