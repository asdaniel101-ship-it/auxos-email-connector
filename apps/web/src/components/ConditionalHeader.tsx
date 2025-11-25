'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuxoLogo from './AuxoLogo';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function ConditionalHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromEmail = searchParams.get('fromEmail') === 'true';
  const isSubmissionPage = pathname?.startsWith('/submission/');
  const { isAuthenticated } = useAdminAuth();
  
  // Hide navigation if accessed via email link
  if (isSubmissionPage && fromEmail) {
    return (
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-3">
            <AuxoLogo />
            <div>
              <span className="block text-sm text-slate-500">
                Process insurance submissions faster.
              </span>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // Normal header with navigation
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <AuxoLogo />
          <div>
            <span className="block text-sm text-slate-500">
              Process insurance submissions faster.
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {isAuthenticated && (
              <>
                <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
                  Dashboard
                </Link>
                <Link href="/debug-emails" className="hover:text-slate-900 transition-colors">
                  Debug Emails
                </Link>
                <Link href="/upload-eml" className="hover:text-slate-900 transition-colors">
                  Upload .eml
                </Link>
                <Link href="/admin/field-schema" className="hover:text-slate-900 transition-colors">
                  Field Schema
                </Link>
              </>
            )}
          </nav>
          <AdminLoginButton />
        </div>
        <div className="md:hidden flex flex-col gap-3 text-sm text-slate-600">
          {isAuthenticated && (
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
                Dashboard
              </Link>
              <Link href="/debug-emails" className="hover:text-slate-900 transition-colors">
                Debug Emails
              </Link>
              <Link href="/upload-eml" className="hover:text-slate-900 transition-colors">
                Upload .eml
              </Link>
              <Link href="/admin/field-schema" className="hover:text-slate-900 transition-colors">
                Field Schema
              </Link>
            </div>
          )}
          <div className="flex justify-center">
            <AdminLoginButton />
          </div>
        </div>
      </div>
    </header>
  );
}

function AdminLoginButton() {
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { isAuthenticated, login, logout } = useAdminAuth();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (login(password)) {
      setShowLogin(false);
      setPassword('');
      // Refresh to update navigation
      window.location.reload();
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  if (isAuthenticated) {
    return (
      <button
        onClick={() => {
          logout();
          // Small delay to ensure sessionStorage is cleared before reload
          setTimeout(() => {
            window.location.reload();
          }, 10);
        }}
        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        Logout
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowLogin(true)}
        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        Admin Login
      </button>
      {showLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Admin Login</h2>
            <p className="text-slate-600 mb-6">Enter the admin password to access admin features.</p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="admin-password"
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
              
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogin(false);
                    setPassword('');
                    setError('');
                  }}
                  className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
