'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuxoLogo from './AuxoLogo';

export default function ConditionalHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromEmail = searchParams.get('fromEmail') === 'true';
  const isSubmissionPage = pathname?.startsWith('/submission/');
  
  // Hide navigation if accessed via email link
  if (isSubmissionPage && fromEmail) {
    return (
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-3">
            <AuxoLogo />
            <div>
              <span className="block text-sm text-slate-500">
                Insurance & funding made easy for restaurants.
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
              Insurance & funding made easy for restaurants.
            </span>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
            Dashboard
          </Link>
          <Link href="/debug-emails" className="hover:text-slate-900 transition-colors">
            Debug Emails
          </Link>
          <Link href="/partners/dashboard" className="hover:text-slate-900 transition-colors">
            Partner Portal
          </Link>
          <Link href="/upload-eml" className="hover:text-slate-900 transition-colors">
            Upload .eml
          </Link>
        </nav>
        <div className="md:hidden flex flex-col gap-3 text-sm text-slate-600">
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
              Dashboard
            </Link>
            <Link href="/partners/dashboard" className="hover:text-slate-900 transition-colors">
              Partner Portal
            </Link>
            <Link href="/upload-eml" className="hover:text-slate-900 transition-colors">
              Upload .eml
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

