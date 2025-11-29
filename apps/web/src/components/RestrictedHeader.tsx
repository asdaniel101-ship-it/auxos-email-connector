'use client';

import Link from 'next/link';
import AuxosLogo from './AuxosLogo';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function RestrictedHeader() {
  const { isAuthenticated } = useAdminAuth();

  // Restricted header - only shows Home and Admin Login
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <AuxosLogo />
          <div>
            <span className="block text-sm text-slate-500">
              Process insurance submissions faster.
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            {!isAuthenticated && (
              <Link href="/admin/login" className="hover:text-slate-900 transition-colors">
                Admin Login
              </Link>
            )}
            {isAuthenticated && (
              <button
                onClick={() => {
                  sessionStorage.removeItem('admin_authenticated');
                  window.dispatchEvent(new Event('adminAuthChange'));
                  window.location.reload();
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Logout
              </button>
            )}
          </nav>
          <div className="md:hidden flex flex-col gap-3 text-sm text-slate-600">
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/" className="hover:text-slate-900 transition-colors">
                Home
              </Link>
              {!isAuthenticated && (
                <Link href="/admin/login" className="hover:text-slate-900 transition-colors">
                  Admin Login
                </Link>
              )}
              {isAuthenticated && (
                <button
                  onClick={() => {
                    sessionStorage.removeItem('admin_authenticated');
                    window.dispatchEvent(new Event('adminAuthChange'));
                    window.location.reload();
                  }}
                  className="text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

