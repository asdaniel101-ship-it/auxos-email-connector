'use client';

import React, { useState, useEffect } from 'react';
import PasswordProtection from '@/components/PasswordProtection';

interface ExtractedField {
  id: string;
  fieldName: string;
  fieldValue: string;
  confidence?: number;
  source?: string;
  document?: {
    id: string;
    fileName: string;
    docType: string | null;
  } | null;
}

interface Lead {
  id: string;
  legalBusinessName: string | null;
  primaryState: string | null;
  status: string;
  assignmentStatus: string;
  assignedAt: string | null;
  session: {
    id: string;
    vertical: string;
    businessType: string | null;
    createdAt: string;
  };
  extractedFields?: ExtractedField[];
  // All lead fields
  primaryAddress?: string | null;
  primaryCity?: string | null;
  primaryZip?: string | null;
  employeeCountTotal?: number | null;
  annualRevenue?: number | null;
  businessDescription?: string | null;
  yearsInOperation?: number | null;
  desiredCoverages?: string[] | null;
  currentCarrier?: string | null;
  currentPolicyTypes?: string[] | null;
  currentPremiumTotal?: number | null;
  activelyLookingForInsurance?: boolean | null;
  amountRequested?: number | null;
  fundingPurpose?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  [key: string]: unknown; // For any other fields
}

export default function PartnersDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setPartnerId] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    // In a real app, you'd get partnerId from auth/session
    const storedPartnerId = localStorage.getItem('partnerId');
    if (storedPartnerId) {
      setPartnerId(storedPartnerId);
      loadLeads(storedPartnerId);
    } else {
      // For demo, prompt for partner ID
      const id = prompt('Enter Partner ID (for demo):');
      if (id) {
        localStorage.setItem('partnerId', id);
        setPartnerId(id);
        loadLeads(id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLeads = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/partners/${id}/leads`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Failed to load leads: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      // Debug: log to see if activelyLookingForInsurance is being returned
      console.log('Loaded leads:', data.map((l: Lead) => ({ 
        id: l.id, 
        name: l.legalBusinessName, 
        vertical: l.session?.vertical,
        activelyLookingForInsurance: l.activelyLookingForInsurance 
      })));
      setLeads(data);
    } catch (error) {
      console.error('Error loading leads:', error);
      alert(`Error loading leads: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRow = (leadId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(leadId)) {
      newExpanded.delete(leadId);
    } else {
      newExpanded.add(leadId);
    }
    setExpandedRows(newExpanded);
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getFieldDisplayName = (fieldName: string): string => {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const getFieldValue = (lead: Lead, fieldName: string): string | number | string[] | null => {
    const value = lead[fieldName];
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return value;
    if (typeof value === 'number') {
      if (fieldName.includes('Revenue') || fieldName.includes('Premium') || fieldName.includes('Amount')) {
        return formatCurrency(value);
      }
      return value;
    }
    return String(value);
  };

  const getAllLeadFields = (lead: Lead): Array<{ name: string; value: unknown; source: 'chat' | 'extracted' }> => {
    const fields: Array<{ name: string; value: unknown; source: 'chat' | 'extracted' }> = [];
    
    // Common fields to display
    const fieldNames = [
      'legalBusinessName',
      'primaryAddress',
      'primaryCity',
      'primaryState',
      'primaryZip',
      'ownerName',
      'ownerEmail',
      'ownerPhone',
      'employeeCountTotal',
      'annualRevenue',
      'businessDescription',
      'yearsInOperation',
      'desiredCoverages',
      'activelyLookingForInsurance',
      'currentCarrier',
      'currentPolicyTypes',
      'currentPremiumTotal',
      'amountRequested',
      'fundingPurpose',
    ];

    // Get extracted field names to mark them
    const extractedFieldNames = new Set(lead.extractedFields?.map(f => f.fieldName) || []);

    // Add chat-collected fields
    for (const fieldName of fieldNames) {
      const value = getFieldValue(lead, fieldName);
      // Include the field if it's not null/undefined
      // For activelyLookingForInsurance, always include it (even if false)
      if (fieldName === 'activelyLookingForInsurance') {
        // Always include this field, even if false
        fields.push({
          name: fieldName,
          value: value ?? false,
          source: extractedFieldNames.has(fieldName) ? 'extracted' : 'chat',
        });
      } else if (value !== null && value !== undefined) {
        fields.push({
          name: fieldName,
          value,
          source: extractedFieldNames.has(fieldName) ? 'extracted' : 'chat',
        });
      }
    }

    // Add extracted fields that aren't in the main list
    lead.extractedFields?.forEach(extracted => {
      if (!fieldNames.includes(extracted.fieldName)) {
        fields.push({
          name: extracted.fieldName,
          value: extracted.fieldValue,
          source: 'extracted',
        });
      }
    });

    return fields;
  };

  if (isLoading) {
    return (
      <PasswordProtection>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-slate-600">Loading...</div>
        </div>
      </PasswordProtection>
    );
  }

  return (
    <PasswordProtection>
      <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-2xl font-semibold text-slate-900">Partner Dashboard</h1>
        <p className="text-sm text-slate-600">View and manage your leads</p>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-12">
                  {/* Expand column */}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Company Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Industry
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date Applied
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-slate-500">
                    No leads assigned yet
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const isExpanded = expandedRows.has(lead.id);
                  const allFields = getAllLeadFields(lead);

                  return (
                    <React.Fragment key={lead.id}>
                      <tr
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => toggleRow(lead.id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            className="text-slate-400 hover:text-slate-600 transition-transform"
                            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {lead.legalBusinessName || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {lead.session.businessType || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const isInsurance = lead.session.vertical === 'insurance';
                            const isActivelyLooking = lead.activelyLookingForInsurance === true || 
                                                      String(lead.activelyLookingForInsurance) === 'true';
                            
                            if (isInsurance && isActivelyLooking) {
                              return (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                                  Active
                                </span>
                              );
                            }
                            return <span className="text-xs text-slate-400">—</span>;
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {formatDate(lead.session.createdAt)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 bg-slate-50">
                            <div className="space-y-4">
                              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                                Full Lead Details
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {allFields.map((field) => (
                                  <div
                                    key={field.name}
                                    className="bg-white p-3 rounded-lg border border-slate-200"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                          {getFieldDisplayName(field.name)}
                                        </label>
                                        <div className="text-sm text-slate-900">
                                          {field.name === 'activelyLookingForInsurance' ? (
                                            field.value ? (
                                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                                                Active
                                              </span>
                                            ) : (
                                              <span className="text-slate-400">Not actively looking</span>
                                            )
                                          ) : Array.isArray(field.value) ? (
                                            <span>{field.value.join(', ')}</span>
                                          ) : (
                                            <span>{field.value ? String(field.value) : 'N/A'}</span>
                                          )}
                                        </div>
                                      </div>
                                      {field.source === 'extracted' && (
                                        <span className="ml-2 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                                          Extracted
                                        </span>
                                      )}
                                    </div>
                                    {field.source === 'extracted' && (
                                      <div className="mt-2 text-xs text-slate-500">
                                        {lead.extractedFields
                                          ?.find(ef => ef.fieldName === field.name)
                                          ?.document?.fileName && (
                                          <span>
                                            From:{' '}
                                            {
                                              lead.extractedFields.find(
                                                ef => ef.fieldName === field.name
                                              )?.document?.fileName
                                            }
                                          </span>
                                        )}
                                        {lead.extractedFields
                                          ?.find(ef => ef.fieldName === field.name)
                                          ?.confidence && (
                                          <span className="ml-2">
                                            (
                                            {Math.round(
                                              (lead.extractedFields.find(
                                                ef => ef.fieldName === field.name
                                              )?.confidence || 0) * 100
                                            )}
                                            % confidence)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {allFields.length === 0 && (
                                <p className="text-sm text-slate-500 text-center py-4">
                                  No additional details available
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </PasswordProtection>
  );
}
