'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import AuxosLogo from './AuxosLogo';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function ConditionalHeader() {
  const { isAuthenticated } = useAdminAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromEmail = searchParams?.get('fromEmail') === 'true';
  const isSubmissionPage = pathname?.startsWith('/submission/');
  
  // If on submission page and fromEmail=true, show restricted navigation
  const showRestricted = isSubmissionPage && fromEmail;

  // Restricted header - only shows Home and Admin Login
  if (showRestricted) {
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

  // Normal header with navigation
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
            {isAuthenticated && (
              <>
                <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
                  Dashboard
                </Link>
                <Link href="/debug-emails" className="hover:text-slate-900 transition-colors">
                  Debug Emails
                </Link>
                <Link href="/debug-extractors" className="hover:text-slate-900 transition-colors">
                  Debug Extractors
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
              <Link href="/debug-extractors" className="hover:text-slate-900 transition-colors">
                Debug Extractors
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
  const { isAuthenticated, logout } = useAdminAuth();

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
    <Link
      href="/admin/login"
      className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
    >
      Admin Login
    </Link>
  );
}
