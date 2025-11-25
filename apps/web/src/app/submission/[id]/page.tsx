'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface FieldExtraction {
  id: string;
  fieldPath: string;
  fieldName: string;
  fieldValue: string | null;
  source: string;
  documentId: string | null;
  documentChunk: string | null;
  highlightedText: string | null;
  chunkStartIndex: number | null;
  chunkEndIndex: number | null;
  confidence: number | null;
}

interface Submission {
  id: string;
  gmailMessageId: string;
  subject: string;
  from: string;
  receivedAt: string;
  extractionResult: {
    id: string;
    data: Record<string, unknown>;
    fieldExtractions: FieldExtraction[];
  } | null;
  attachments: Array<{
    id: string;
    filename: string;
    documentType: string;
  }>;
}

function SubmissionReviewerContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<FieldExtraction | null>(null);
  const fromEmail = searchParams.get('fromEmail') === 'true';
  const fieldParam = searchParams.get('field');

  useEffect(() => {
    if (params.id) {
      loadSubmission(params.id as string);
    }
  }, [params.id]);

  // Auto-open field popup if field parameter is present
  useEffect(() => {
    if (submission && fieldParam && submission.extractionResult?.fieldExtractions) {
      const extraction = submission.extractionResult.fieldExtractions.find(
        fe => fe.fieldPath === fieldParam
      );
      if (extraction && extraction.fieldValue && extraction.documentChunk) {
        setSelectedField(extraction);
      }
    }
  }, [submission, fieldParam]);

  const loadSubmission = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/email-intake/submissions/${id}`);
      if (!response.ok) {
        throw new Error('Failed to load submission');
      }
      const data = await response.json();
      setSubmission(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  // Expected field schema - all fields we should always display
  const expectedFieldsSchema = {
    submission: {
      submissionId: null,
      carrierName: null,
      brokerName: null,
      brokerEmail: null,
      brokerPhone: null,
      namedInsured: null,
      mailingAddress: null,
      naicsCode: null,
      operationsDescription: null,
      submissionType: null,
      effectiveDate: null,
      expirationDate: null,
      priorCarrier: null,
      priorPolicyNumber: null,
    },
    locations: [{
      locationNumber: null,
      buildings: [{
        buildingNumber: null,
        buildingName: null,
        riskAddress: null,
        city: null,
        state: null,
        zipCode: null,
        buildingSqFt: null,
        numberOfStories: null,
        yearBuilt: null,
        yearRenovated: null,
        constructionType: null,
        roofType: null,
        roofYearUpdated: null,
        primaryOccupancy: null,
        occupancyPercentage: null,
        buildingUseHours: null,
        sprinklered: null,
        sprinklerType: null,
        sprinklerPercentage: null,
        fireAlarmType: null,
        burglarAlarmType: null,
        distanceToHydrantFeet: null,
        distanceToFireStationMiles: null,
        fireProtectionClass: null,
        neighbouringExposures: null,
        buildingLimit: null,
      }],
    }],
    coverage: {
      policyType: null,
      causeOfLossForm: null,
      coinsurancePercent: null,
      valuationMethod: null,
      buildingLimit: null,
      businessPersonalPropertyLimit: null,
      businessIncomeLimit: null,
      deductibleAllPeril: null,
      windHailDeductible: null,
      floodCoverage: null,
      earthquakeCoverage: null,
      equipmentBreakdownCoverage: null,
      ordinanceOrLawCoverage: null,
      terrorismCoverage: null,
      blanketCoverageFlag: null,
      blanketDescription: null,
    },
    lossHistory: {
      lossHistoryPeriodYears: null,
      numberOfClaims: null,
      totalIncurredLoss: null,
      largestSingleLoss: null,
      anyOpenClaims: null,
      anyCatLosses: null,
      lossNarrativeSummary: null,
      paidLoss: null,
      outstandingReserve: null,
    },
  };

  // Flatten the data structure to show all fields (unused but kept for reference)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const flattenData = (obj: Record<string, unknown>, prefix = '', path = ''): Array<{ path: string; name: string; value: unknown; displayName: string }> => {
    const fields: Array<{ path: string; name: string; value: unknown; displayName: string }> = [];
    
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
          if (typeof item === 'object' && item !== null) {
            fields.push(...flattenData(item, `${currentPath}[${index}]`, `${currentPath}[${index}]`));
          } else {
            fields.push({ 
              path: `${currentPath}[${index}]`, 
              name: key, 
              value: item,
              displayName: `${formatFieldName(key)} [${index}]`,
            });
          }
        });
      } else if (typeof value === 'object') {
        fields.push(...flattenData(value, currentPath, currentPath));
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

  // Generate all expected fields from schema and merge with extracted data
  const generateAllFields = (extractedData: Record<string, unknown>): Array<{ path: string; name: string; value: unknown; displayName: string }> => {
    const formatFieldName = (name: string) => {
      return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
    };

    const allFields: Array<{ path: string; name: string; value: unknown; displayName: string }> = [];
    
    // Helper to get nested value from object
    const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
      const parts = path.split('.');
      let current = obj;
      for (const part of parts) {
        if (part.includes('[')) {
          const [key, indexStr] = part.split('[');
          const index = parseInt(indexStr.replace(']', ''), 10);
          if (current && current[key] && Array.isArray(current[key]) && current[key][index]) {
            current = current[key][index];
          } else {
            return undefined;
          }
        } else {
          if (current && typeof current === 'object' && part in current) {
            current = current[part];
          } else {
            return undefined;
          }
        }
      }
      return current;
    };

    // Process submission fields
    if (expectedFieldsSchema.submission) {
      for (const [key] of Object.entries(expectedFieldsSchema.submission)) {
        const path = `submission.${key}`;
        const value = getNestedValue(extractedData, path);
        allFields.push({
          path,
          name: key,
          value: value !== undefined ? value : null,
          displayName: formatFieldName(key),
        });
      }
    }

    // Process locations and buildings
    if (expectedFieldsSchema.locations && expectedFieldsSchema.locations[0]) {
      const locationTemplate = expectedFieldsSchema.locations[0];
      const extractedLocations = extractedData?.locations || [];
      
      // Always show at least one location
      const maxLocations = Math.max(1, extractedLocations.length);
      
      for (let locIdx = 0; locIdx < maxLocations; locIdx++) {
      const location = (extractedLocations[locIdx] || {}) as Record<string, unknown>;
      
      // Location number
      allFields.push({
        path: `locations[${locIdx}].locationNumber`,
        name: 'locationNumber',
        value: location.locationNumber !== undefined ? location.locationNumber : null,
        displayName: `Location ${locIdx + 1} - Location Number`,
      });

        // Process buildings
        if (locationTemplate.buildings && Array.isArray(locationTemplate.buildings) && locationTemplate.buildings[0]) {
          const buildingTemplate = locationTemplate.buildings[0] as Record<string, unknown>;
          const buildings = (location.buildings || []) as Array<Record<string, unknown>>;
          
          // Always show at least one building per location
          const maxBuildings = Math.max(1, buildings.length);
          
          for (let bldIdx = 0; bldIdx < maxBuildings; bldIdx++) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const building = (buildings[bldIdx] || {}) as Record<string, unknown>;
            
            for (const [key] of Object.entries(buildingTemplate)) {
              const path = `locations[${locIdx}].buildings[${bldIdx}].${key}`;
              const value = getNestedValue(extractedData, path);
              allFields.push({
                path,
                name: key,
                value: value !== undefined ? value : null,
                displayName: `Location ${locIdx + 1} - Building ${bldIdx + 1} - ${formatFieldName(key)}`,
              });
            }
          }
        }
      }
    }

    // Process coverage fields
    if (expectedFieldsSchema.coverage) {
      for (const [key] of Object.entries(expectedFieldsSchema.coverage)) {
        const path = `coverage.${key}`;
        const value = getNestedValue(extractedData, path);
        allFields.push({
          path,
          name: key,
          value: value !== undefined ? value : null,
          displayName: formatFieldName(key),
        });
      }
    }

    // Process loss history fields
    if (expectedFieldsSchema.lossHistory) {
      for (const [key] of Object.entries(expectedFieldsSchema.lossHistory)) {
        const path = `lossHistory.${key}`;
        const value = getNestedValue(extractedData, path);
        allFields.push({
          path,
          name: key,
          value: value !== undefined ? value : null,
          displayName: formatFieldName(key),
        });
      }
    }

    return allFields;
  };

  const getFieldExtraction = (fieldPath: string): FieldExtraction | undefined => {
    return submission?.extractionResult?.fieldExtractions.find(fe => fe.fieldPath === fieldPath);
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'number' && value > 1000) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
    }
    return String(value);
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
        <div className="text-center">
          <p className="text-red-600 font-medium mb-4">{error || 'Submission not found'}</p>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Generate all expected fields (always show all fields from schema)
  const allFields = submission.extractionResult 
    ? generateAllFields(submission.extractionResult.data)
    : generateAllFields({});

  // Group fields by section
  const sections: Record<string, Array<typeof allFields[0]>> = {};
  allFields.forEach(field => {
    const section = field.path.split('.')[0] || 'other';
    if (!sections[section]) {
      sections[section] = [];
    }
    sections[section].push(field);
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              {!fromEmail && (
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
                  ← Back to Dashboard
                </Link>
              )}
              <h1 className="text-3xl font-bold text-slate-900">Submission Reviewer</h1>
              <p className="text-slate-600 mt-2">
                {submission.subject} • From: {submission.from}
              </p>
              {fromEmail && (
                <p className="text-sm text-slate-500 mt-1 italic">
                  Viewing from email link. You can explore all fields below.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {Object.entries(sections).map(([sectionName, fields]) => (
            <div key={sectionName} className="border-b border-slate-200 last:border-b-0">
              <div className="bg-slate-50 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900 capitalize">
                  {sectionName === 'submission' ? 'Submission Information' :
                   sectionName === 'locations' ? 'Locations & Buildings' :
                   sectionName === 'coverage' ? 'Coverage & Limits' :
                   sectionName === 'lossHistory' ? 'Loss History' :
                   sectionName}
                </h2>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    return (
                      <div
                        key={field.path}
                        className={`p-4 rounded-lg border ${
                          hasValue
                            ? 'bg-green-50 border-green-200'
                            : 'bg-slate-50 border-slate-200'
                        } ${isClickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                        onClick={() => {
                          // Only allow clicking if field has value and extraction has chunk
                          // Also check that the extraction's fieldValue is not null/empty
                          if (isClickable && extraction && extraction.documentChunk && extraction.fieldValue) {
                            setSelectedField(extraction);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-slate-700 mb-1">
                              {field.displayName}
                            </div>
                            <div className={`text-base font-medium ${
                              hasValue ? 'text-green-900' : 'text-slate-500 italic'
                            }`}>
                              {formatValue(displayValue)}
                            </div>
                          </div>
                          {/* Always show source badge */}
                          <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${getSourceColor(source)}`}>
                            {source === 'email_body' ? 'Email' : source}
                          </span>
                        </div>
                        {isClickable && (
                          <div className="mt-2 text-xs text-blue-600">
                            Click to view source document →
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
      </div>

      {/* Document Chunk Popup */}
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
              <div className="flex items-start justify-between mb-3">
                <button
                  onClick={() => setSelectedField(null)}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to full submission
                </button>
                <button
                  onClick={() => setSelectedField(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Confidence</h3>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-900">
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
  );
}

export default function SubmissionReviewerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-slate-900 mb-4"></div>
          <p className="text-slate-600 font-medium">Loading...</p>
        </div>
      </div>
    }>
      <SubmissionReviewerContent />
    </Suspense>
  );
}
