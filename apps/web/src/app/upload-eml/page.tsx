'use client';

import { useState } from 'react';
import Link from 'next/link';
import PasswordProtection from '@/components/PasswordProtection';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function UploadEmlPageContent() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.endsWith('.eml')) {
        setError('Please select a .eml file');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/email-intake/test/upload-eml`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Upload .eml File for Testing</h1>

          <div className="space-y-6">
            {/* File Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select .eml File
              </label>
              <input
                type="file"
                accept=".eml"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
                disabled={uploading}
              />
              {file && (
                <p className="mt-2 text-sm text-slate-600">
                  Selected: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <span>Upload & Process</span>
              )}
            </button>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                <strong className="font-bold">Error:</strong> {error}
              </div>
            )}

            {/* Success Result */}
            {result && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md">
                <h3 className="font-bold mb-2">✅ Upload Successful!</h3>
                <p className="text-sm mb-3">
                  Your .eml file has been processed. Check the dashboard to see the results.
                </p>
                <Link
                  href="/dashboard"
                  className="inline-block px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700 transition-colors"
                >
                  View Dashboard
                </Link>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium">View Raw Response</summary>
                  <pre className="mt-2 p-3 bg-white rounded border border-green-200 text-xs overflow-auto max-h-64">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Instructions</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
              <li>Select a .eml file from your computer</li>
              <li>Click &quot;Upload &amp; Process&quot; to start processing</li>
              <li>Wait for processing to complete (this may take a minute)</li>
              <li>View the results on the dashboard</li>
            </ol>
            <p className="mt-4 text-xs text-slate-500">
              <strong>Note:</strong> The API must be running on port 4000 for this to work.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UploadEmlPage() {
  return (
    <PasswordProtection>
      <UploadEmlPageContent />
    </PasswordProtection>
  );
}

