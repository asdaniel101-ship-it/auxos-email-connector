'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PasswordProtection from '@/components/PasswordProtection';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface EmailMessage {
  id: string;
  gmailMessageId: string;
  subject: string;
  from: string;
  to: string[];
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
  } | null;
}

function DebugEmailsPageContent() {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [imapStatus, setImapStatus] = useState<any>(null);
  const [checkingImap, setCheckingImap] = useState(false);
  const [reprocessing, setReprocessing] = useState<string | null>(null);

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/email-intake/emails/recent`);
      if (!response.ok) {
        throw new Error('Failed to load emails');
      }
      const data = await response.json();
      setEmails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  };

  const triggerPolling = async () => {
    try {
      setPolling(true);
      const response = await fetch(`${API_URL}/email-intake/poll`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to trigger polling');
      }
      const result = await response.json();
      alert(`Polling completed: ${result.processed || 0} messages processed`);
      // Reload emails after polling
      setTimeout(() => loadEmails(), 2000);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to poll'}`);
    } finally {
      setPolling(false);
    }
  };

  const checkImap = async () => {
    try {
      setCheckingImap(true);
      const response = await fetch(`${API_URL}/email-intake/imap/check`);
      if (!response.ok) {
        throw new Error('Failed to check IMAP');
      }
      const result = await response.json();
      setImapStatus(result);
    } catch (err) {
      setImapStatus({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to check IMAP',
      });
    } finally {
      setCheckingImap(false);
    }
  };

  const reprocessEmail = async (emailId: string) => {
    try {
      setReprocessing(emailId);
      const response = await fetch(`${API_URL}/email-intake/reprocess/${emailId}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to reprocess email');
      }
      const result = await response.json();
      alert(`Email reprocessed successfully! ${result.message || ''}`);
      // Reload emails after reprocessing
      setTimeout(() => loadEmails(), 2000);
    } catch (err) {
      alert(`Error reprocessing email: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setReprocessing(null);
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
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-slate-900 mb-4"></div>
          <p className="text-slate-600 font-medium">Loading emails...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Email Debug Dashboard</h1>
            <p className="text-slate-600">View all emails received in the last 24 hours</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={triggerPolling}
              disabled={polling}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {polling ? 'Polling...' : 'Trigger Poll Now'}
            </button>
            <button
              onClick={checkImap}
              disabled={checkingImap}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkingImap ? 'Checking...' : 'Check IMAP'}
            </button>
            <button
              onClick={loadEmails}
              className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition-colors"
            >
              Refresh
            </button>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
            >
              View Submissions
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}

        {imapStatus && (
          <div className={`mb-4 p-4 rounded-lg ${imapStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <h3 className="font-bold mb-2">{imapStatus.success ? '✅ IMAP Connection Successful' : '❌ IMAP Connection Failed'}</h3>
            {imapStatus.success ? (
              <div className="text-sm">
                <p><strong>Email:</strong> {imapStatus.email}</p>
                <p><strong>Total Emails (last 24h):</strong> {imapStatus.totalEmails}</p>
                <p><strong>Unread:</strong> {imapStatus.unreadCount}</p>
                {imapStatus.emails && imapStatus.emails.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer font-medium">View emails in inbox ({imapStatus.emails.length})</summary>
                    <div className="mt-2 max-h-64 overflow-y-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-2 py-1 text-left">UID</th>
                            <th className="px-2 py-1 text-left">Date</th>
                            <th className="px-2 py-1 text-left">Unread</th>
                            <th className="px-2 py-1 text-left">From</th>
                            <th className="px-2 py-1 text-left">Subject</th>
                          </tr>
                        </thead>
                        <tbody>
                          {imapStatus.emails.map((email: any, idx: number) => (
                            <tr key={idx} className="border-b">
                              <td className="px-2 py-1">{email.uid}</td>
                              <td className="px-2 py-1">{email.date ? new Date(email.date).toLocaleString() : 'N/A'}</td>
                              <td className="px-2 py-1">{email.isUnread ? '✅' : '❌'}</td>
                              <td className="px-2 py-1 truncate max-w-xs">{email.from}</td>
                              <td className="px-2 py-1 truncate max-w-xs">{email.subject}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <p className="text-red-700">{imapStatus.error}</p>
            )}
          </div>
        )}

        {emails.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-lg shadow-sm border border-slate-200">
            <p className="text-slate-600">No emails found in the last 24 hours.</p>
            <p className="text-sm text-slate-500 mt-2">Try clicking "Trigger Poll Now" to check for new emails.</p>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    From
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Received
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Is Submission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Attachments
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Error
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {emails.map((email) => (
                  <tr key={email.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {email.from}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {email.subject || '(No subject)'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formatDate(email.receivedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(email.processingStatus)}`}>
                        {email.processingStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {email.isSubmission ? (
                        <span className="text-green-600 font-medium">Yes {email.submissionType ? `(${email.submissionType})` : ''}</span>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {email.attachments.length}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate">
                      {email.errorMessage || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => reprocessEmail(email.id)}
                        disabled={reprocessing === email.id}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={email.gmailMessageId?.startsWith('imap-') ? 'Reprocess from IMAP' : 'Only IMAP emails can be reprocessed'}
                      >
                        {reprocessing === email.id ? 'Reprocessing...' : 'Reprocess'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DebugEmailsPage() {
  return (
    <PasswordProtection>
      <DebugEmailsPageContent />
    </PasswordProtection>
  );
}

