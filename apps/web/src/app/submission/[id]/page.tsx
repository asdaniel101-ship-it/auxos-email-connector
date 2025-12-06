'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PasswordProtection from '@/components/PasswordProtection';
import { getApiUrl } from '@/lib/api-url';
import { useAdminAuth } from '@/hooks/useAdminAuth';
const API_URL = getApiUrl();

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
      confidence: number | null;
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
  confidence: number | null;
}

function SubmissionPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const fieldParam = searchParams.get('field');
  const fromEmail = searchParams.get('fromEmail') === 'true';
  const { isAuthenticated } = useAdminAuth();

  const [submission, setSubmission] = useState<EmailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<FieldExtraction | null>(null);
  const [showBindabilityDetails, setShowBindabilityDetails] = useState(false);
  const [expectedSchema, setExpectedSchema] = useState<Record<string, unknown> | null>(null);

  const loadSubmission = useCallback(async () => {
    try {
      setLoading(true);
      const [submissionResponse, schemaResponse] = await Promise.all([
        fetch(`${API_URL}/email-intake/submissions/${id}`),
        fetch(`${API_URL}/field-schema/expected`),
      ]);
      
      if (!submissionResponse.ok) {
        if (submissionResponse.status === 404) {
          throw new Error('Submission not found');
        }
        throw new Error('Failed to load submission');
      }
      
      const submissionData = await submissionResponse.json();
      setSubmission(submissionData);
      
      if (schemaResponse.ok) {
        const schemaData = await schemaResponse.json();
        setExpectedSchema(schemaData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSubmission();
  }, [loadSubmission]);

  useEffect(() => {
    // If we have a field parameter and the submission is loaded, find and highlight that field
    if (fieldParam && submission?.extractionResult?.fieldExtractions) {
      const field = submission.extractionResult.fieldExtractions.find(
        (fe) => fe.fieldPath === fieldParam
      );
      if (field) {
        setSelectedField(field);
        // Scroll to field after a short delay to ensure page is rendered
        setTimeout(() => {
          const element = document.getElementById(`field-${field.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight the field briefly
            element.classList.add('ring-4', 'ring-blue-400');
            setTimeout(() => {
              element.classList.remove('ring-4', 'ring-blue-400');
            }, 2000);
          }
        }, 500);
      }
    }
  }, [fieldParam, submission]);


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

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  };

  // Bindability Index Calculation
  interface BindabilityCalculation {
    score: number;
    documentationPenalty: number;
    lossHistoryPenalty: number;
    exposurePenalty: number;
    dataQualityPenalty: number;
    breakdown: {
      documentation: Array<{ reason: string; penalty: number }>;
      lossHistory: Array<{ reason: string; penalty: number }>;
      exposure: Array<{ reason: string; penalty: number }>;
      dataQuality: Array<{ reason: string; penalty: number }>;
    };
    keyDrivers: Array<{ type: 'positive' | 'warning' | 'negative'; text: string }>;
  }

  const calculateBindabilityIndex = (
    data: Record<string, unknown>,
    attachments?: Array<{ filename: string; documentType: string }>
  ): BindabilityCalculation => {
    const breakdown = {
      documentation: [] as Array<{ reason: string; penalty: number }>,
      lossHistory: [] as Array<{ reason: string; penalty: number }>,
      exposure: [] as Array<{ reason: string; penalty: number }>,
      dataQuality: [] as Array<{ reason: string; penalty: number }>,
    };
    const keyDrivers: Array<{ type: 'positive' | 'warning' | 'negative'; text: string }> = [];

    // A. Documentation Penalty (0-40 points)
    let documentationPenalty = 0;
    const submission = (data.submission || {}) as Record<string, unknown>;
    const priorCarrier = (data.priorCarrier || {}) as Record<string, unknown>;
    const locations = (data.locations || []) as Array<Record<string, unknown>>;
    const classification = (data.classification || []) as Array<Record<string, unknown>>;

    // Missing required WC app info - Workers Comp specific fields
    if (!submission.fein) {
      documentationPenalty += 5;
      breakdown.documentation.push({ reason: 'Missing FEIN (Federal Employer Identification Number)', penalty: 5 });
    }
    // Check for payroll by class - Workers Comp requires payroll breakdown by class code
    if (!classification || classification.length === 0 || !classification.some((c: Record<string, unknown>) => {
      const payroll = typeof c.estimatedAnnualPayroll === 'number' ? c.estimatedAnnualPayroll : 0;
      return payroll > 0;
    })) {
      documentationPenalty += 5;
      breakdown.documentation.push({ reason: 'Missing payroll by class code', penalty: 5 });
    }
    // Check for locations - Workers Comp requires location information
    if (!locations || locations.length === 0) {
      documentationPenalty += 5;
      breakdown.documentation.push({ reason: 'Missing location information', penalty: 5 });
    }
    // Check for employee count - Workers Comp specific: check classification array for employee counts
    const hasEmployeeCount = classification.some((c: Record<string, unknown>) => {
      const fullTime = typeof c.numEmployeesFullTime === 'number' ? c.numEmployeesFullTime : 0;
      const partTime = typeof c.numEmployeesPartTime === 'number' ? c.numEmployeesPartTime : 0;
      return fullTime > 0 || partTime > 0;
    });
    if (!hasEmployeeCount) {
      documentationPenalty += 5;
      breakdown.documentation.push({ reason: 'Missing number of employees (full-time or part-time)', penalty: 5 });
    }

    // Loss runs - check both priorCarrier field and attachments directly
    const lossRunsAttachedField = priorCarrier.lossRunsAttached === true || priorCarrier.lossRunsAttached === 'Yes';
    const hasLossRunAttachment = attachments?.some((att) => 
      att.documentType === 'loss_run' ||
      att.filename.toLowerCase().includes('loss') && (
        att.filename.toLowerCase().includes('run') ||
        att.filename.toLowerCase().includes('history') ||
        att.filename.toLowerCase().includes('claim')
      )
    ) || false;
    const lossRunsAttached = lossRunsAttachedField || hasLossRunAttachment;
    
    if (!lossRunsAttached) {
      documentationPenalty += 20;
      breakdown.documentation.push({ reason: 'No loss runs provided', penalty: 20 });
      keyDrivers.push({ type: 'negative', text: 'No loss runs provided' });
    } else {
      keyDrivers.push({ type: 'positive', text: 'Loss runs provided' });
    }

    // Loss runs age (check if priorCarrierYear is recent)
    if (priorCarrier.priorCarrierYear) {
      const priorYear = typeof priorCarrier.priorCarrierYear === 'number' ? priorCarrier.priorCarrierYear : parseInt(String(priorCarrier.priorCarrierYear), 10);
      const currentYear = new Date().getFullYear();
      const yearsAgo = currentYear - priorYear;
      if (yearsAgo > 2) {
        documentationPenalty += 10;
        breakdown.documentation.push({ reason: `Loss runs older than ${yearsAgo} years`, penalty: 10 });
      }
    }

    // Cap documentation penalty at 40
    documentationPenalty = Math.min(40, documentationPenalty);

    // B. Loss History Penalty (0-30 points)
    let lossHistoryPenalty = 0;
    const lossHistory = (data.lossHistory || []) as Array<Record<string, unknown>>;

    if (lossHistory.length > 0) {
      // Calculate loss ratio if premium is available
      const priorPremium = typeof priorCarrier.priorAnnualPremium === 'number' ? priorCarrier.priorAnnualPremium : null;
      let totalIncurred = 0;
      let claimCount = 0;
      let hasLargeClaim = false;
      let hasLargeOpenClaim = false;

      lossHistory.forEach((claim: Record<string, unknown>) => {
        const incurred = typeof claim.claimTotalIncurred === 'number' ? claim.claimTotalIncurred : 0;
        totalIncurred += incurred;
        claimCount++;
        if (incurred > 50000) hasLargeClaim = true;
        if ((claim.claimStatus === 'Open' || claim.claimStatus === 'open') && incurred > 25000) {
          hasLargeOpenClaim = true;
        }
      });

      if (priorPremium && priorPremium > 0) {
        const lossRatio = (totalIncurred / priorPremium) * 100;
        if (lossRatio >= 150) {
          lossHistoryPenalty += 30;
          breakdown.lossHistory.push({ reason: `Loss ratio ${lossRatio.toFixed(1)}% (≥150%)`, penalty: 30 });
        } else if (lossRatio >= 100) {
          lossHistoryPenalty += 20;
          breakdown.lossHistory.push({ reason: `Loss ratio ${lossRatio.toFixed(1)}% (100-150%)`, penalty: 20 });
        } else if (lossRatio >= 60) {
          lossHistoryPenalty += 10;
          breakdown.lossHistory.push({ reason: `Loss ratio ${lossRatio.toFixed(1)}% (60-100%)`, penalty: 10 });
        } else if (lossRatio >= 30) {
          lossHistoryPenalty += 5;
          breakdown.lossHistory.push({ reason: `Loss ratio ${lossRatio.toFixed(1)}% (30-60%)`, penalty: 5 });
        } else {
          keyDrivers.push({ type: 'positive', text: `Low loss ratio (${lossRatio.toFixed(1)}%)` });
        }
      } else {
        // Use proxies if premium unknown
        if (claimCount >= 5) {
          lossHistoryPenalty += 10;
          breakdown.lossHistory.push({ reason: `${claimCount} claims in last 5 years`, penalty: 10 });
        }
        if (hasLargeClaim) {
          lossHistoryPenalty += 10;
          breakdown.lossHistory.push({ reason: 'Single claim > $50k', penalty: 10 });
        }
        if (hasLargeOpenClaim) {
          lossHistoryPenalty += 10;
          breakdown.lossHistory.push({ reason: 'Open claim > $25k incurred', penalty: 10 });
        }
      }

      if (claimCount === 0 || (claimCount < 3 && totalIncurred < 10000)) {
        keyDrivers.push({ type: 'positive', text: 'Low claim frequency and minimal losses' });
      }
    } else {
      keyDrivers.push({ type: 'positive', text: 'No prior claims' });
    }

    // Cap loss history penalty at 30
    lossHistoryPenalty = Math.min(30, lossHistoryPenalty);

    // C. Exposure Complexity Penalty (0-20 points)
    let exposurePenalty = 0;

    // Multi-state operations - coveredStatesPart1 is a string (comma or space separated)
    const coverage = (data.coverage || {}) as Record<string, unknown>;
    const coveredStatesStr = String(coverage.coveredStatesPart1 || '');
    // Parse states from string (could be comma-separated, space-separated, or single state)
    const stateList = coveredStatesStr
      .split(/[,\s]+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s && s !== 'N/A' && s.length === 2); // Filter for valid 2-letter state codes
    const stateCount = stateList.length;
    if (stateCount >= 4) {
      exposurePenalty += 10;
      breakdown.exposure.push({ reason: `Multi-state operations (${stateCount} states)`, penalty: 10 });
      keyDrivers.push({ type: 'warning', text: `Multi-state exposure (${stateCount} states)` });
    } else if (stateCount >= 2) {
      exposurePenalty += 5;
      breakdown.exposure.push({ reason: `Multi-state operations (${stateCount} states)`, penalty: 5 });
      keyDrivers.push({ type: 'warning', text: `Multi-state exposure (${stateCount} states)` });
    }

    // Higher-hazard class codes - Workers Comp specific high-hazard codes
    // Common high-hazard WC class codes: 5000s (construction), 6000s (roofing), 8000s (manufacturing), etc.
    const hasHighHazard = classification.some((c: Record<string, unknown>) => {
      const code = String(c.classCode || '').trim();
      const desc = String(c.classCodeDescription || '').toLowerCase();
      // Check for high-hazard WC class codes (5000s = construction, 6000s = roofing, 8000s = manufacturing)
      const codeNum = parseInt(code, 10);
      const isHighHazardCode = !isNaN(codeNum) && (
        (codeNum >= 5000 && codeNum < 6000) || // Construction
        (codeNum >= 6000 && codeNum < 7000) || // Roofing, etc.
        (codeNum >= 8000 && codeNum < 9000)   // Manufacturing
      );
      return isHighHazardCode || 
        desc.includes('construction') || 
        desc.includes('roofing') || 
        desc.includes('roofer') ||
        desc.includes('manufacturing') ||
        desc.includes('welding') ||
        desc.includes('demolition');
    });
    if (hasHighHazard) {
      exposurePenalty += 10;
      breakdown.exposure.push({ reason: 'Higher-hazard class codes present', penalty: 10 });
    }

    // Very large payroll (heuristic: > $5M)
    const totalPayroll = classification.reduce((sum: number, c: Record<string, unknown>) => {
      const payroll = typeof c.estimatedAnnualPayroll === 'number' ? c.estimatedAnnualPayroll : 0;
      return sum + payroll;
    }, 0);
    if (totalPayroll > 5000000) {
      exposurePenalty += 5;
      breakdown.exposure.push({ reason: `Very large payroll ($${(totalPayroll / 1000000).toFixed(1)}M)`, penalty: 5 });
    }

    // Cap exposure penalty at 20
    exposurePenalty = Math.min(20, exposurePenalty);

    // D. Data Quality Penalty (0-10 points)
    let dataQualityPenalty = 0;

    // Check for conflicting FEINs (if multiple sources)
    // This would require checking fieldExtractions for conflicts - simplified for now
    // Check for low confidence extractions
    // This would require fieldExtractions data - simplified for now

    // Cap data quality penalty at 10
    dataQualityPenalty = Math.min(10, dataQualityPenalty);

    // Calculate final score
    const score = Math.max(0, Math.min(100, 100 - documentationPenalty - lossHistoryPenalty - exposurePenalty - dataQualityPenalty));

    return {
      score,
      documentationPenalty,
      lossHistoryPenalty,
      exposurePenalty,
      dataQualityPenalty,
      breakdown,
      keyDrivers,
    };
  };

  const renderField = (
    fieldPath: string,
    fieldName: string,
    value: unknown,
    fieldExtractions: FieldExtraction[] = []
  ): React.JSX.Element | null => {
    // Try exact match first
    let extraction = fieldExtractions.find((fe) => fe.fieldPath === fieldPath);
    
    // If no exact match, try to find by field name (for cases where path format differs)
    if (!extraction) {
      // Extract the last part of the path (the field name)
      const pathParts = fieldPath.split('.');
      const fieldKey = pathParts[pathParts.length - 1];
      // Try to find extraction where fieldPath ends with the field key
      extraction = fieldExtractions.find((fe) => fe.fieldPath.endsWith(`.${fieldKey}`) || fe.fieldPath === fieldKey);
    }
    const hasValue = value !== null && value !== undefined && value !== '';
    // Check if extraction has a fieldValue (was actually extracted)
    const hasExtractedValue = extraction && extraction.fieldValue !== null && extraction.fieldValue !== undefined && extraction.fieldValue !== '';
    const displayValue = formatValue(value);
    const source = extraction?.source || 'email_body';
    const isClickable = extraction && extraction.fieldValue && extraction.documentChunk;

    return (
      <div
        key={fieldPath}
        id={extraction ? `field-${extraction.id}` : undefined}
        className={`p-4 rounded-lg border-2 transition-all ${
          hasExtractedValue
            ? 'border-green-200 bg-green-50 cursor-pointer hover:shadow-md'
            : 'border-slate-200 bg-slate-50'
        } ${fieldParam === fieldPath ? 'ring-4 ring-blue-400' : ''}`}
        onClick={() => {
          if (isClickable && extraction) {
            setSelectedField(extraction);
          }
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-700 mb-1">{fieldName}</div>
            <div
              className={`text-base font-medium ${
                hasValue ? 'text-slate-900' : 'text-slate-500 italic'
              }`}
            >
              {displayValue}
            </div>
          </div>
          <span
            className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${getSourceColor(
              source,
            )}`}
          >
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
  };

  // Helper to merge schema fields with data fields
  const mergeFieldsWithSchema = (
    schemaFields: Record<string, unknown>,
    dataFields: Record<string, unknown>
  ): Array<{ schemaKey: string; dataKey: string; value: unknown }> => {
    const schemaKeys = Object.keys(schemaFields);
    const dataKeys = Object.keys(dataFields);
    const merged: Array<{ schemaKey: string; dataKey: string; value: unknown }> = [];
    const usedDataKeys = new Set<string>();
    
    // First, match schema fields to data fields
    schemaKeys.forEach(schemaKey => {
      // Try exact match first
      if (dataKeys.includes(schemaKey) && !usedDataKeys.has(schemaKey)) {
        merged.push({ schemaKey, dataKey: schemaKey, value: dataFields[schemaKey] });
        usedDataKeys.add(schemaKey);
      } else {
        // Schema field not found in data - still include it with null
        merged.push({ schemaKey, dataKey: schemaKey, value: null });
      }
    });
    
    // Then, add any remaining data fields that weren't matched to schema
    dataKeys.forEach(dataKey => {
      if (!usedDataKeys.has(dataKey)) {
        // This is a new field not in schema - include it
        merged.push({ schemaKey: dataKey, dataKey, value: dataFields[dataKey] });
      }
    });
    
    return merged;
  };

  const renderLossHistoryTable = (
    lossHistory: unknown,
    priorCarrier: Record<string, unknown>,
    fieldExtractions: FieldExtraction[],
  ): React.JSX.Element | null => {
    // Handle lossHistory as array or extract from object
    let claimsArray: Array<Record<string, unknown>> = [];
    
    if (Array.isArray(lossHistory)) {
      claimsArray = lossHistory;
    } else if (lossHistory && typeof lossHistory === 'object' && !Array.isArray(lossHistory)) {
      const lossHistoryObj = lossHistory as Record<string, unknown>;
      if (Array.isArray(lossHistoryObj.lossHistory)) {
        claimsArray = lossHistoryObj.lossHistory as Array<Record<string, unknown>>;
      } else if (Array.isArray(lossHistoryObj.claims)) {
        claimsArray = lossHistoryObj.claims as Array<Record<string, unknown>>;
      }
    }

    if (claimsArray.length === 0) {
      return (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
            Loss History
          </h2>
          <div className="text-slate-500 italic p-4 bg-slate-50 rounded-lg">
            No loss history data available
          </div>
        </div>
      );
    }

    // Define all claim field columns
    const claimFields = [
      { key: 'claimNumber', label: 'Claim Number' },
      { key: 'claimStatus', label: 'Status' },
      { key: 'claimType', label: 'Type' },
      { key: 'claimDateOfLoss', label: 'Date of Loss' },
      { key: 'claimDescription', label: 'Description' },
      { key: 'claimCauseOfInjury', label: 'Cause of Injury' },
      { key: 'claimBodyPart', label: 'Body Part' },
      { key: 'claimPaidIndemnity', label: 'Paid Indemnity' },
      { key: 'claimPaidMedical', label: 'Paid Medical' },
      { key: 'claimReserve', label: 'Reserve' },
      { key: 'claimTotalIncurred', label: 'Total Incurred' },
      { key: 'claimLitigationFlag', label: 'Litigation' },
    ];

    const formatCurrency = (value: unknown): string => {
      if (typeof value !== 'number' || isNaN(value) || value === 0) return '$0';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    };

    const formatDate = (value: unknown): string => {
      if (!value) return 'N/A';
      if (typeof value === 'string') {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
          }
        } catch {
          return String(value);
        }
      }
      return String(value);
    };

    const formatBoolean = (value: unknown): string => {
      if (value === true || value === 'true' || value === 'Yes') return 'Yes';
      if (value === false || value === 'false' || value === 'No') return 'No';
      return 'N/A';
    };

    const getFieldExtraction = (fieldPath: string) => {
      return fieldExtractions.find((fe) => fe.fieldPath === fieldPath);
    };

    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
          Loss History
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-slate-200 rounded-lg">
            <thead className="bg-slate-50">
              <tr>
                {claimFields.map((field) => (
                  <th
                    key={field.key}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200"
                  >
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {claimsArray.map((claim, index) => {
                const rowExtractions = claimFields.map((field) => {
                  const fieldPath = `lossHistory[${index}].${field.key}`;
                  return getFieldExtraction(fieldPath);
                });
                const hasExtractedFields = rowExtractions.some((ext) => ext && ext.fieldValue !== null && ext.fieldValue !== undefined);

                return (
                  <tr
                    key={index}
                    className={hasExtractedFields ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-slate-50'}
                  >
                    {claimFields.map((field) => {
                      const value = claim[field.key];
                      const fieldPath = `lossHistory[${index}].${field.key}`;
                      const extraction = getFieldExtraction(fieldPath);
                      const isExtracted = extraction && extraction.fieldValue !== null && extraction.fieldValue !== undefined;
                      const isClickable = extraction && extraction.documentChunk;

                      let displayValue: string;
                      if (field.key.includes('Paid') || field.key.includes('Reserve') || field.key.includes('Incurred')) {
                        displayValue = formatCurrency(value);
                      } else if (field.key.includes('Date')) {
                        displayValue = formatDate(value);
                      } else if (field.key.includes('Flag') || field.key === 'claimLitigationFlag') {
                        displayValue = formatBoolean(value);
                      } else {
                        displayValue = value !== null && value !== undefined ? String(value) : 'N/A';
                      }

                      return (
                        <td
                          key={field.key}
                          onClick={() => {
                            if (isClickable && extraction) {
                              setSelectedField(extraction);
                            }
                          }}
                          className={`px-4 py-3 text-sm border-b border-slate-200 ${
                            isExtracted ? 'text-slate-900 font-medium' : 'text-slate-600'
                          } ${
                            isClickable
                              ? 'cursor-pointer hover:bg-blue-50 transition-colors'
                              : ''
                          }`}
                        >
                          {displayValue}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSection = (
    sectionName: string,
    sectionData: unknown,
    fieldExtractions: FieldExtraction[] = [],
    prefix = '',
  ): React.JSX.Element | null => {
    // Normalize section name for schema lookup
    const normalizedSectionName = sectionName.replace(/\s+/g, '').replace(/^./, (str) => str.toLowerCase());
    const schemaSection = expectedSchema?.[normalizedSectionName] || expectedSchema?.[sectionName.toLowerCase()];
    
    const fields: React.JSX.Element[] = [];

    if (Array.isArray(schemaSection)) {
      // Handle array sections (like locations)
      const dataArray = Array.isArray(sectionData) ? sectionData : [];
      const schemaItem = schemaSection[0] as Record<string, unknown> | undefined;
      
      if (schemaItem) {
        dataArray.forEach((item: unknown, index: number) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            const itemData = item as Record<string, unknown>;
            
            // Render all fields from schema
            Object.entries(schemaItem).forEach(([key]) => {
              // Skip locationNumber if it's already shown
              if ((sectionName.toLowerCase() === 'locations' || prefix === 'locations') && key === 'locationNumber') {
                return;
              }
              
              const value = itemData[key] !== undefined ? itemData[key] : null;
              const fieldPath = prefix ? `${prefix}[${index}].${key}` : `${index}.${key}`;
              const fieldName = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str: string) => str.toUpperCase())
                .trim();
              
              // Handle nested arrays (like buildings)
              if (key === 'buildings' && Array.isArray(schemaItem[key])) {
                const buildingsData = Array.isArray(value) ? value : [];
                const buildingSchema = (schemaItem[key] as unknown[])[0] as Record<string, unknown> | undefined;
                
                if (buildingSchema) {
                  buildingsData.forEach((building: unknown, buildingIndex: number) => {
                    if (building && typeof building === 'object' && !Array.isArray(building)) {
                      const buildingData = building as Record<string, unknown>;
                      
                      // Render all building fields from schema
                      Object.entries(buildingSchema).forEach(([buildingKey]) => {
                        const buildingValue = buildingData[buildingKey] !== undefined ? buildingData[buildingKey] : null;
                        const buildingFieldPath = prefix ? `${prefix}[${index}].buildings[${buildingIndex}].${buildingKey}` : `${index}.buildings[${buildingIndex}].${buildingKey}`;
                        const buildingFieldName = buildingKey
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, (str: string) => str.toUpperCase())
                          .trim();
                        const field = renderField(buildingFieldPath, buildingFieldName, buildingValue, fieldExtractions);
                        if (field) fields.push(field);
                      });
                    }
                  });
                }
              } else {
                // Regular location field
                const field = renderField(fieldPath, fieldName, value, fieldExtractions);
                if (field) fields.push(field);
              }
            });
          }
        });
      }
    } else if (schemaSection && typeof schemaSection === 'object' && !Array.isArray(schemaSection)) {
      // Handle object sections (like submission, coverage, lossHistory)
      const schemaObj = schemaSection as Record<string, unknown>;
      const dataObj = (sectionData && typeof sectionData === 'object' && !Array.isArray(sectionData))
        ? sectionData as Record<string, unknown>
        : {};
      
      // Special handling for lossHistory: normalize priorLosses or losses array to aggregate fields (if present)
      let normalizedDataObj = dataObj;
      if ((sectionName.toLowerCase() === 'losshistory' || prefix === 'lossHistory')) {
        // Check for both 'priorLosses' and 'losses' arrays
        const lossesArray = (dataObj.priorLosses && Array.isArray(dataObj.priorLosses))
          ? dataObj.priorLosses as Array<Record<string, unknown>>
          : (dataObj.losses && Array.isArray(dataObj.losses))
          ? dataObj.losses as Array<Record<string, unknown>>
          : null;
        
        if (lossesArray) {
          // Aggregate losses array into aggregate fields
          let totalIncurred = 0;
          let largestSingleLoss = 0;
          let hasOpenClaims = false;
          let hasCatLosses = false;
          const claimCount = lossesArray.length;
          
          lossesArray.forEach((loss: Record<string, unknown>) => {
            const incurred = typeof loss.totalIncurred === 'number' ? loss.totalIncurred : 
                            typeof loss.incurred === 'number' ? loss.incurred : 0;
            totalIncurred += incurred;
            if (incurred > largestSingleLoss) {
              largestSingleLoss = incurred;
            }
            if (loss.open === true || loss.status === 'open' || loss.status === 'Open') {
              hasOpenClaims = true;
            }
            if (loss.catastrophe === true || loss.cat === true || loss.catastropheLoss === true) {
              hasCatLosses = true;
            }
          });
          
          normalizedDataObj = {
            ...dataObj,
            totalIncurred: dataObj.totalIncurred ?? (totalIncurred > 0 ? totalIncurred : null),
            numberOfClaims: dataObj.numberOfClaims ?? (claimCount > 0 ? claimCount : null),
            largestSingleLoss: dataObj.largestSingleLoss ?? (largestSingleLoss > 0 ? largestSingleLoss : null),
            anyOpenClaims: dataObj.anyOpenClaims ?? hasOpenClaims,
            anyCatLosses: dataObj.anyCatLosses ?? hasCatLosses,
          };
          delete normalizedDataObj.priorLosses;
          delete normalizedDataObj.losses;
        }
      }
      
      // Merge schema fields with actual data fields
      const mergedFields = mergeFieldsWithSchema(schemaObj, normalizedDataObj);
      
      // Render all merged fields
      mergedFields.forEach(({ schemaKey, dataKey, value }) => {
        const fieldPath = prefix ? `${prefix}.${dataKey}` : dataKey;
        const fieldName = schemaKey
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str: string) => str.toUpperCase())
          .trim();
        const field = renderField(fieldPath, fieldName, value, fieldExtractions);
        if (field) fields.push(field);
      });
    } else {
      // Fallback: if no schema, render from data (backward compatibility)
      if (!sectionData || typeof sectionData !== 'object') {
        return null;
      }

      if (Array.isArray(sectionData)) {
        sectionData.forEach((item: unknown, index) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            Object.entries(item as Record<string, unknown>).forEach(([key, value]) => {
              const fieldPath = prefix ? `${prefix}[${index}].${key}` : `${index}.${key}`;
              const fieldName = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str: string) => str.toUpperCase())
                .trim();
              const field = renderField(fieldPath, fieldName, value, fieldExtractions);
              if (field) fields.push(field);
            });
          }
        });
      } else {
        Object.entries(sectionData as Record<string, unknown>).forEach(([key, value]: [string, unknown]) => {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Nested object - render recursively
            const nested = renderSection(
              key,
              value,
              fieldExtractions,
              prefix ? `${prefix}.${key}` : key,
            );
            if (nested) fields.push(nested);
          } else {
            const fieldPath = prefix ? `${prefix}.${key}` : key;
            const fieldName = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, (str: string) => str.toUpperCase())
              .trim();
            const field = renderField(fieldPath, fieldName, value, fieldExtractions);
            if (field) fields.push(field);
          }
        });
      }
    }

    // Always show section header, even if no fields (show "No data available")
    return (
      <div key={sectionName} className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
          {sectionName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (str) => str.toUpperCase())
            .trim()}
        </h2>
        {fields.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{fields}</div>
        ) : (
          <div className="text-slate-500 italic p-4 bg-slate-50 rounded-lg">No data available</div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-slate-900 mb-4"></div>
          <p className="text-slate-600 font-medium">Loading submission...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Submission Not Found</h1>
          <p className="text-slate-600 mb-6">{error || 'The submission you are looking for does not exist.'}</p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const fieldExtractions = submission.extractionResult?.fieldExtractions || [];
  
  // Calculate bindability index
  const bindabilityData = submission.extractionResult?.data 
    ? calculateBindabilityIndex(submission.extractionResult.data, submission.attachments)
    : null;
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };
  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'High';
    if (score >= 60) return 'Medium';
    return 'Low';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              {isAuthenticated && (
                <Link
                  href="/dashboard"
                  className="text-blue-600 hover:text-blue-800 font-medium mb-2 inline-block"
                >
                  ← Back to Dashboard
                </Link>
              )}
              <h1 className="text-3xl font-bold text-slate-900">Submission Details</h1>
              {fromEmail && (
                <p className="text-sm text-blue-600 mt-2">
                  You arrived here from an email link. Click on any highlighted field to see where it was extracted from.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bindability Index */}
        {bindabilityData && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Bindability Index</h2>
                <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-lg border-2 font-bold text-2xl ${getScoreColor(bindabilityData.score)}`}>
                    {bindabilityData.score} / 100
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="font-semibold">Rating:</span> {getScoreLabel(bindabilityData.score)}
                  </div>
                </div>
                {bindabilityData.keyDrivers.length > 0 && (
                  <div className="mt-4 space-y-1">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Key Drivers:</p>
                    <ul className="space-y-1">
                      {bindabilityData.keyDrivers.map((driver, idx) => (
                        <li key={idx} className="text-sm flex items-center gap-2">
                          {driver.type === 'positive' && <span className="text-green-600">✅</span>}
                          {driver.type === 'warning' && <span className="text-yellow-600">⚠️</span>}
                          {driver.type === 'negative' && <span className="text-red-600">❌</span>}
                          <span className={driver.type === 'positive' ? 'text-green-700' : driver.type === 'warning' ? 'text-yellow-700' : 'text-red-700'}>
                            {driver.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowBindabilityDetails(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                View Calculation
              </button>
            </div>
          </div>
        )}

        {/* Email Information */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Email Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong className="text-slate-700">From:</strong>{' '}
              <span className="text-slate-900">{submission.from}</span>
            </div>
            <div>
              <strong className="text-slate-700">Subject:</strong>{' '}
              <span className="text-slate-900">{submission.subject}</span>
            </div>
            <div>
              <strong className="text-slate-700">Received:</strong>{' '}
              <span className="text-slate-900">{formatDate(submission.receivedAt)}</span>
            </div>
            <div>
              <strong className="text-slate-700">Type:</strong>{' '}
              <span className="text-slate-900">{submission.submissionType || 'N/A'}</span>
            </div>
            <div>
              <strong className="text-slate-700">Status:</strong>{' '}
              <span
                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                  submission.processingStatus,
                )}`}
              >
                {submission.processingStatus}
              </span>
            </div>
            <div>
              <strong className="text-slate-700">Attachments:</strong>{' '}
              <span className="text-slate-900">{submission.attachments.length}</span>
            </div>
          </div>
        </div>

        {submission.errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <h3 className="text-sm font-semibold text-red-700 mb-2">Error</h3>
            <p className="text-sm text-red-700">{submission.errorMessage}</p>
          </div>
        )}

        {submission.attachments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Attachments</h2>
            <div className="space-y-2">
              {submission.attachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                  <span className="text-slate-900">{att.filename}</span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSourceColor(att.documentType)}`}>
                    {att.documentType}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {submission.extractionResult && (
          <>
            {submission.extractionResult.summaryText && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
                <h2 className="text-lg font-semibold text-blue-900 mb-2">Summary</h2>
                <p className="text-blue-900 leading-relaxed">
                  {submission.extractionResult.summaryText}
                </p>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-2xl font-semibold text-slate-900 mb-6">Extracted Fields</h2>

              <div>
                {renderSection(
                  'Submission',
                  submission.extractionResult?.data?.submission || {},
                  fieldExtractions,
                  'submission',
                )}
                {renderSection(
                  'Locations',
                  submission.extractionResult?.data?.locations || [],
                  fieldExtractions,
                  'locations',
                )}
                {renderSection(
                  'Coverage',
                  submission.extractionResult?.data?.coverage || {},
                  fieldExtractions,
                  'coverage',
                )}
                {renderSection(
                  'Prior Carrier',
                  submission.extractionResult?.data?.priorCarrier || {},
                  fieldExtractions,
                  'priorCarrier',
                )}
                {renderLossHistoryTable(
                  submission.extractionResult?.data?.lossHistory || [],
                  (submission.extractionResult?.data?.priorCarrier || {}) as Record<string, unknown>,
                  fieldExtractions,
                )}
              </div>

              {submission.extractionResult.qaFlags && (
                <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-yellow-900 mb-2">QA Flags</h3>
                  <pre className="text-xs text-yellow-900 whitespace-pre-wrap">
                    {JSON.stringify(submission.extractionResult.qaFlags, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </>
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
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => {
                      setSelectedField(null);
                      // Scroll to the field after closing the modal
                      setTimeout(() => {
                        const element = document.getElementById(`field-${selectedField.id}`);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }, 100);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    Back to full submission
                  </button>
                  <button
                    onClick={() => setSelectedField(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedField.fieldName}</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Source:{' '}
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${getSourceColor(
                        selectedField.source,
                      )}`}
                    >
                      {selectedField.source === 'email_body' ? 'Email' : selectedField.source}
                    </span>
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Extracted Value</h3>
                  <div
                    className={`rounded-lg p-4 text-lg font-semibold border ${
                      selectedField.fieldValue
                        ? 'bg-green-50 text-green-900 border-green-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200 italic'
                    }`}
                  >
                    {selectedField.fieldValue || 'N/A'}
                  </div>
                </div>

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

        {/* Bindability Index Calculation Popup */}
        {showBindabilityDetails && bindabilityData && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowBindabilityDetails(false)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-2xl font-bold text-slate-900">Bindability Index Calculation</h2>
                  <button
                    onClick={() => setShowBindabilityDetails(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-lg border-2 font-bold text-2xl ${getScoreColor(bindabilityData.score)}`}>
                    {bindabilityData.score} / 100
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="font-semibold">Rating:</span> {getScoreLabel(bindabilityData.score)}
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Formula */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">Formula</h3>
                  <p className="text-sm text-blue-800">
                    Bindability Index = 100 − (Documentation Penalty + Loss History Penalty + Exposure Complexity Penalty + Data Quality Penalty)
                  </p>
                  <p className="text-sm text-blue-800 mt-2 font-mono">
                    {bindabilityData.score} = 100 − ({bindabilityData.documentationPenalty} + {bindabilityData.lossHistoryPenalty} + {bindabilityData.exposurePenalty} + {bindabilityData.dataQualityPenalty})
                  </p>
                </div>

                {/* Documentation Penalty */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">
                    A. Documentation Penalty: {bindabilityData.documentationPenalty} / 40
                  </h3>
                  {bindabilityData.breakdown.documentation.length > 0 ? (
                    <ul className="space-y-2">
                      {bindabilityData.breakdown.documentation.map((item, idx) => (
                        <li key={idx} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                          <span className="text-sm text-red-800">{item.reason}</span>
                          <span className="text-sm font-semibold text-red-900">-{item.penalty} pts</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-green-700 p-3 bg-green-50 border border-green-200 rounded-lg">✅ No documentation issues</p>
                  )}
                </div>

                {/* Loss History Penalty */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">
                    B. Loss History Penalty: {bindabilityData.lossHistoryPenalty} / 30
                  </h3>
                  {bindabilityData.breakdown.lossHistory.length > 0 ? (
                    <ul className="space-y-2">
                      {bindabilityData.breakdown.lossHistory.map((item, idx) => (
                        <li key={idx} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                          <span className="text-sm text-red-800">{item.reason}</span>
                          <span className="text-sm font-semibold text-red-900">-{item.penalty} pts</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-green-700 p-3 bg-green-50 border border-green-200 rounded-lg">✅ No loss history issues</p>
                  )}
                </div>

                {/* Exposure Complexity Penalty */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">
                    C. Exposure Complexity Penalty: {bindabilityData.exposurePenalty} / 20
                  </h3>
                  {bindabilityData.breakdown.exposure.length > 0 ? (
                    <ul className="space-y-2">
                      {bindabilityData.breakdown.exposure.map((item, idx) => (
                        <li key={idx} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <span className="text-sm text-yellow-800">{item.reason}</span>
                          <span className="text-sm font-semibold text-yellow-900">-{item.penalty} pts</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-green-700 p-3 bg-green-50 border border-green-200 rounded-lg">✅ No exposure complexity issues</p>
                  )}
                </div>

                {/* Data Quality Penalty */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">
                    D. Data Quality Penalty: {bindabilityData.dataQualityPenalty} / 10
                  </h3>
                  {bindabilityData.breakdown.dataQuality.length > 0 ? (
                    <ul className="space-y-2">
                      {bindabilityData.breakdown.dataQuality.map((item, idx) => (
                        <li key={idx} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                          <span className="text-sm text-red-800">{item.reason}</span>
                          <span className="text-sm font-semibold text-red-900">-{item.penalty} pts</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-green-700 p-3 bg-green-50 border border-green-200 rounded-lg">✅ No data quality issues</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SubmissionPageWrapper() {
  const searchParams = useSearchParams();
  const fromEmail = searchParams.get('fromEmail') === 'true';
  
  // If coming from email, don't require password protection
  if (fromEmail) {
    return <SubmissionPageContent />;
  }
  
  // Otherwise, require admin login
  return (
    <PasswordProtection>
      <SubmissionPageContent />
    </PasswordProtection>
  );
}

export default function SubmissionPage() {
  return <SubmissionPageWrapper />;
}

