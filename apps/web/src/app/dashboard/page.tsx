'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface EmailMessage {
  id: string;
  gmailMessageId: string;
  subject: string;
  from: string;
  receivedAt: string;
  isSubmission: boolean;
  submissionType: string | null;
  processingStatus: string;
  errorMessage: string | null;
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    documentType: string;
  }>;
  extractionResult: {
    id: string;
    summaryText: string | null;
    data: any;
    qaFlags: any;
    fieldExtractions?: Array<{
      id: string;
      fieldPath: string;
      fieldName: string;
      fieldValue: string | null;
      source: string;
      documentChunk: string | null;
      highlightedText: string | null;
    }>;
  } | null;
}

export default function DashboardPage() {
  const [submissions, setSubmissions] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<EmailMessage | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/email-intake/submissions?limit=100`);
      if (!response.ok) {
        throw new Error('Failed to load submissions');
      }
      const data = await response.json();
      setSubmissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-slate-900 mb-4"></div>
          <p className="text-slate-600 font-medium">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Email Intake Dashboard</h1>
              <p className="text-slate-600 mt-2">View all processed email submissions</p>
            </div>
            <button
              onClick={loadSubmissions}
              className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Received
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    From
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Attachments
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No submissions found. Forward an email to auxoreachout@gmail.com to get started.
                    </td>
                  </tr>
                ) : (
                  submissions.map((submission) => (
                    <tr
                      key={submission.id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelectedSubmission(submission)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {formatDate(submission.receivedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {submission.from}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900 max-w-md truncate">
                        {submission.subject}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {submission.submissionType || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            submission.processingStatus,
                          )}`}
                        >
                          {submission.processingStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {submission.attachments.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSubmission(submission);
                            }}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Quick View
                          </button>
                          <a
                            href={`/submission/${submission.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            Review →
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Modal */}
        {selectedSubmission && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedSubmission(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Submission Details</h2>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Email Information</h3>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                    <div><strong>From:</strong> {selectedSubmission.from}</div>
                    <div><strong>Subject:</strong> {selectedSubmission.subject}</div>
                    <div><strong>Received:</strong> {formatDate(selectedSubmission.receivedAt)}</div>
                    <div><strong>Type:</strong> {selectedSubmission.submissionType || 'N/A'}</div>
                    <div><strong>Status:</strong> {selectedSubmission.processingStatus}</div>
                  </div>
                </div>

                {selectedSubmission.errorMessage && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-700 mb-2">Error</h3>
                    <div className="bg-red-50 rounded-lg p-4 text-sm text-red-700">
                      {selectedSubmission.errorMessage}
                    </div>
                  </div>
                )}

                {selectedSubmission.attachments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Attachments</h3>
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                      {selectedSubmission.attachments.map((att) => (
                        <div key={att.id} className="flex items-center justify-between text-sm">
                          <span>{att.filename}</span>
                          <span className="text-slate-500">{att.documentType}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSubmission.extractionResult && (
                  <>
                    {selectedSubmission.extractionResult.summaryText && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Summary</h3>
                        <div className="bg-blue-50 rounded-lg p-4 text-sm text-slate-900">
                          {selectedSubmission.extractionResult.summaryText}
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">Extracted Data</h3>
                      <pre className="bg-slate-50 rounded-lg p-4 text-xs overflow-x-auto">
                        {JSON.stringify(selectedSubmission.extractionResult.data, null, 2)}
                      </pre>
                    </div>

                    {selectedSubmission.extractionResult.qaFlags && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">QA Flags</h3>
                        <div className="bg-yellow-50 rounded-lg p-4 text-sm">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(selectedSubmission.extractionResult.qaFlags, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

