'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuxosLogo from './AuxosLogo';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function ConditionalHeader() {
  const { isAuthenticated } = useAdminAuth();

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
