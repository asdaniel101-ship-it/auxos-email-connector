'use client';

import { useEffect, useState } from 'react';

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
    data: Record<string, unknown>;
    qaFlags: Record<string, unknown> | null;
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

interface FieldExtraction {
  id: string;
  fieldPath: string;
  fieldName: string;
  fieldValue: string | null;
  source: string;
  documentChunk: string | null;
  highlightedText: string | null;
}

export default function DashboardPage() {
  const [submissions, setSubmissions] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<EmailMessage | null>(null);
  const [selectedField, setSelectedField] = useState<FieldExtraction | null>(null);

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

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      email_body: 'bg-blue-100 text-blue-800',
      acord: 'bg-green-100 text-green-800',
      sov: 'bg-purple-100 text-purple-800',
      loss_run: 'bg-orange-100 text-orange-800',
      schedule: 'bg-pink-100 text-pink-800',
      supplemental: 'bg-yellow-100 text-yellow-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[source] || colors.other;
  };

  // Flatten the data structure to show all fields
  const flattenData = (obj: Record<string, unknown>, path = ''): Array<{ path: string; name: string; value: unknown; displayName: string }> => {
    const fields: Array<{ path: string; name: string; value: any; displayName: string }> = [];
    
    const formatFieldName = (name: string) => {
      return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
    };
    
    for (const key in obj) {
      const currentPath = path ? `${path}.${key}` : key;
      const value = obj[key];
      
      if (value === null || value === undefined) {
        fields.push({ 
          path: currentPath, 
          name: key, 
          value: null,
          displayName: formatFieldName(key),
        });
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
            fields.push(...flattenData(item as Record<string, unknown>, `${currentPath}[${index}]`, `${currentPath}[${index}]`));
          } else {
            fields.push({ 
              path: `${currentPath}[${index}]`, 
              name: key, 
              value: item,
              displayName: `${formatFieldName(key)} [${index}]`,
            });
          }
        });
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        fields.push(...flattenData(value as Record<string, unknown>, currentPath, currentPath));
      } else {
        fields.push({ 
          path: currentPath, 
          name: key, 
          value,
          displayName: formatFieldName(key),
        });
      }
    }
    
    return fields;
  };

  const getFieldExtraction = (fieldPath: string): FieldExtraction | undefined => {
    return selectedSubmission?.extractionResult?.fieldExtractions?.find(fe => fe.fieldPath === fieldPath);
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'number' && value > 1000) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
    }
    return String(value);
  };

  // Render human-readable HTML view
  const renderHumanReadableData = (data: Record<string, unknown>) => {
    if (!data) return null;

    const allFields = flattenData(data);
    const sections: Record<string, Array<typeof allFields[0]>> = {};
    allFields.forEach(field => {
      const section = field.path.split('.')[0] || 'other';
      if (!sections[section]) {
        sections[section] = [];
      }
      sections[section].push(field);
    });

    return (
      <div className="space-y-6">
        {Object.entries(sections).map(([sectionName, fields]) => (
          <div key={sectionName} className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h4 className="text-base font-semibold text-slate-900 capitalize">
                {sectionName === 'submission' ? 'Submission Information' :
                 sectionName === 'locations' ? 'Locations & Buildings' :
                 sectionName === 'coverage' ? 'Coverage & Limits' :
                 sectionName === 'lossHistory' ? 'Loss History' :
                 sectionName}
              </h4>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {fields.map((field) => {
                    const extraction = getFieldExtraction(field.path);
                    // Use extraction's fieldValue to determine if value was actually extracted
                    // If extraction exists, use its fieldValue; otherwise fall back to field.value
                    const displayValue = extraction?.fieldValue !== undefined ? extraction.fieldValue : field.value;
                    const hasValue = displayValue !== null && displayValue !== undefined && displayValue !== '';
                    // Only make fields clickable if they have a value AND have a chunk AND the extraction's fieldValue is not null
                    // Null/empty fields should NOT be clickable (no value found, nothing to show)
                    const source = extraction?.source || 'email_body';
                    const extractionHasValue = extraction?.fieldValue !== null && extraction?.fieldValue !== undefined && extraction?.fieldValue !== '';
                    const isClickable = hasValue && extraction && extraction.documentChunk && extractionHasValue;
                    const hasExtraction = extraction !== undefined;

                    return (
                      <div
                        key={field.path}
                        className={`p-3 rounded-lg border transition-all ${
                          hasValue
                            ? 'bg-green-50 border-green-200'
                            : 'bg-slate-50 border-slate-200'
                        } ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-green-300' : ''}`}
                        onClick={() => {
                          // Only allow clicking if field has value and extraction has chunk
                          // Also check that the extraction's fieldValue is not null/empty
                          if (isClickable && extraction && extraction.documentChunk && extraction.fieldValue) {
                            setSelectedField(extraction);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-700 mb-1 truncate">
                              {field.displayName}
                            </div>
                            <div className={`text-sm font-medium ${
                              hasValue ? 'text-green-900' : 'text-slate-500 italic'
                            }`}>
                              {formatValue(displayValue)}
                            </div>
                          </div>
                          {/* Always show source badge */}
                          <span className={`ml-2 px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${getSourceColor(source)}`}>
                            {source === 'email_body' ? 'Email' : source}
                          </span>
                        </div>
                        {isClickable && (
                          <div className="mt-1.5 text-xs text-blue-600 font-medium">
                            Click to view source →
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
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
                        <div className="bg-blue-50 rounded-lg p-4 text-sm text-slate-900 leading-relaxed">
                          {selectedSubmission.extractionResult.summaryText}
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">Extracted Data</h3>
                      
                      {/* Human-readable HTML view */}
                      <div className="mb-4">
                        {renderHumanReadableData(selectedSubmission.extractionResult.data)}
                      </div>

                      {/* JSON view (collapsible) */}
                      <details className="bg-slate-50 rounded-lg overflow-hidden">
                        <summary className="px-4 py-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-100">
                          View Raw JSON Data
                        </summary>
                        <pre className="p-4 text-xs overflow-x-auto border-t border-slate-200">
                          {JSON.stringify(selectedSubmission.extractionResult.data, null, 2)}
                        </pre>
                      </details>
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

        {/* Field Extraction Popup */}
        {selectedField && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedField(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {selectedField.fieldName}
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Source: <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSourceColor(selectedField.source)}`}>
                      {selectedField.source === 'email_body' ? 'Email' : selectedField.source}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedField(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Extracted Value</h3>
                  <div className={`rounded-lg p-4 text-lg font-semibold border ${
                    selectedField.fieldValue 
                      ? 'bg-green-50 text-green-900 border-green-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200 italic'
                  }`}>
                    {selectedField.fieldValue || 'N/A'}
                  </div>
                </div>

                {/* Only show document excerpt if we actually have a value (not N/A) */}
                {selectedField.fieldValue && selectedField.documentChunk && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Document Excerpt</h3>
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 overflow-x-auto">
                      {selectedField.highlightedText ? (
                        <div
                          className="text-sm text-slate-900 whitespace-pre-wrap font-mono leading-relaxed break-words"
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                          dangerouslySetInnerHTML={{ __html: selectedField.highlightedText }}
                        />
                      ) : (
                        <div 
                          className="text-sm text-slate-900 whitespace-pre-wrap font-mono leading-relaxed break-words"
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                        >
                          {selectedField.documentChunk}
                        </div>
                      )}
                    </div>
                    <style jsx global>{`
                      mark {
                        background-color: #fef08a;
                        padding: 2px 4px;
                        border-radius: 3px;
                        font-weight: 600;
                        color: #92400e;
                        word-break: break-word;
                        overflow-wrap: break-word;
                      }
                    `}</style>
                  </div>
                )}

                {selectedField.confidence && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Confidence Score</h3>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="text-base font-semibold text-blue-900">
                        {(selectedField.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

