import Link from 'next/link';

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Email Intake System
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          Process insurance submissions from email automatically
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Link
          href="/dashboard"
          className="block p-6 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Dashboard
          </h2>
          <p className="text-slate-600">
            View all processed email submissions and extracted data
          </p>
        </Link>

        <Link
          href="/upload-eml"
          className="block p-6 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Upload .eml File
          </h2>
          <p className="text-slate-600">
            Test the system by uploading an email file directly
          </p>
        </Link>

        <Link
          href="/debug-emails"
          className="block p-6 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Debug Emails
          </h2>
          <p className="text-slate-600">
            Debug and troubleshoot email processing
          </p>
        </Link>

        <Link
          href="/admin/field-schema"
          className="block p-6 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Field Schema Admin
          </h2>
          <p className="text-slate-600">
            Manage field definitions and extraction schema
          </p>
        </Link>
      </div>
    </div>
  );
}

