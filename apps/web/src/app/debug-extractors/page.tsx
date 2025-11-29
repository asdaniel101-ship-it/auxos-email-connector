'use client';

import { useEffect, useState, useCallback } from 'react';
import PasswordProtection from '@/components/PasswordProtection';
import { getApiUrl } from '@/lib/api-url';

const API_URL = getApiUrl();

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
  llmReasoning: string | null;
}

interface ExtractionResult {
  id: string;
  data: Record<string, unknown>;
  llmPrompt: string | null;
  llmResponse: string | null;
  fieldExtractions: FieldExtraction[];
}

interface Submission {
  id: string;
  gmailMessageId: string;
  subject: string;
  from: string;
  receivedAt: string;
  extractionResult: ExtractionResult | null;
}

function DebugExtractorsContent() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedField, setSelectedField] = useState<FieldExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allSchemaFields, setAllSchemaFields] = useState<Array<{ fieldPath: string; fieldName: string }>>([]);

  const getAllFieldsFromSchema = useCallback((schema: Record<string, unknown>, prefix = ''): Array<{ fieldPath: string; fieldName: string }> => {
    const fields: Array<{ fieldPath: string; fieldName: string }> = [];
    
    for (const [key, value] of Object.entries(schema)) {
      if (!value || typeof value !== 'object') continue;
      
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      if ('type' in value && typeof value.type === 'string') {
        if (value.type === 'array' && 'items' in value) {
          // Process array items
          if (value.items && typeof value.items === 'object') {
            const nestedFields = getAllFieldsFromSchema(value.items as Record<string, unknown>, `${fieldPath}[0]`);
            fields.push(...nestedFields);
          }
        } else {
          // Regular field
          const fieldName = fieldPath.split('.').pop()?.replace(/\[\d+\]/g, '') || key;
          fields.push({ fieldPath, fieldName });
        }
      } else {
        // Nested object - recurse
        const nestedFields = getAllFieldsFromSchema(value as Record<string, unknown>, fieldPath);
        fields.push(...nestedFields);
      }
    }
    
    return fields;
  }, []);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/email-intake/submissions?limit=50`);
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

  const getAllFieldsForSubmission = (extractionResult: ExtractionResult): FieldExtraction[] => {
    // Create a map of existing field extractions by fieldPath
    const existingExtractionsMap = new Map<string, FieldExtraction>();
    extractionResult.fieldExtractions.forEach(fe => {
      existingExtractionsMap.set(fe.fieldPath, fe);
    });

    // If schema fields aren't loaded yet, return the database extractions plus placeholders for missing ones
    if (allSchemaFields.length === 0) {
      // Fallback: use database extractions
      const allFields: FieldExtraction[] = [...extractionResult.fieldExtractions];
      
      // This is a fallback - ideally schema fields should be loaded
      console.warn('Schema fields not loaded yet, showing only database extractions');
      return allFields;
    }

    // Merge schema fields with existing extractions
    const allFields: FieldExtraction[] = allSchemaFields.map(schemaField => {
      const existing = existingExtractionsMap.get(schemaField.fieldPath);
      if (existing) {
        return existing;
      }
      // Create a placeholder for fields that weren't extracted
      return {
        id: `placeholder-${schemaField.fieldPath}`,
        fieldPath: schemaField.fieldPath,
        fieldName: schemaField.fieldName,
        fieldValue: null,
        source: 'other',
        documentId: null,
        documentChunk: null,
        highlightedText: null,
        chunkStartIndex: null,
        chunkEndIndex: null,
        confidence: null,
        llmReasoning: null,
      };
    });

    // Also add any database extractions that aren't in the schema (for backwards compatibility)
    for (const dbExtraction of extractionResult.fieldExtractions) {
      const exists = allFields.some(f => f.fieldPath === dbExtraction.fieldPath);
      if (!exists) {
        allFields.push(dbExtraction);
      }
    }

    return allFields;
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <p className="text-slate-600">Loading submissions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">Extractor Debug</h1>
          <p className="text-slate-600">View LLM reasoning and extraction details for each field</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submissions List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Submissions</h2>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {submissions.map((submission) => (
                  <button
                    key={submission.id}
                    onClick={() => setSelectedSubmission(submission)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedSubmission?.id === submission.id
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-medium text-sm text-slate-900 truncate">
                      {submission.subject || 'No subject'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {new Date(submission.receivedAt).toLocaleDateString()}
                    </div>
                    {submission.extractionResult && (
                      <div className="text-xs text-green-600 mt-1">
                        {submission.extractionResult.fieldExtractions?.filter(fe => fe.fieldValue !== null && fe.fieldValue !== undefined && fe.fieldValue !== '').length || 0} fields extracted
                        {' '}
                        ({submission.extractionResult.fieldExtractions?.length || 0} total)
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Field Extractions */}
          <div className="lg:col-span-1">
            {selectedSubmission?.extractionResult ? (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">
                  Field Extractions ({getAllFieldsForSubmission(selectedSubmission.extractionResult).length} total)
                </h2>
                <div className="mb-2 text-xs text-slate-500">
                  Showing all fields from schema including null values. Fields with reasoning are marked with ✓.
                  {allSchemaFields.length === 0 && (
                    <span className="text-yellow-600 ml-2 font-medium">⚠ Schema fields not loaded - showing database extractions only</span>
                  )}
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {(() => {
                    const allFields = getAllFieldsForSubmission(selectedSubmission.extractionResult);
                    console.log('Rendering fields:', {
                      total: allFields.length,
                      schemaFields: allSchemaFields.length,
                      dbExtractions: selectedSubmission.extractionResult.fieldExtractions.length,
                      extracted: allFields.filter(f => f.fieldValue !== null && f.fieldValue !== undefined && f.fieldValue !== '').length
                    });
                    return allFields;
                  })()
                    .sort((a, b) => {
                      // Sort: fields with reasoning first, then by name
                      if (a.llmReasoning && !b.llmReasoning) return -1;
                      if (!a.llmReasoning && b.llmReasoning) return 1;
                      return a.fieldName.localeCompare(b.fieldName);
                    })
                    .map((field) => (
                    <button
                      key={field.id || field.fieldPath}
                      onClick={() => setSelectedField(field)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedField?.id === field.id || (selectedField?.fieldPath === field.fieldPath && !field.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-medium text-sm text-slate-900">
                        {field.fieldName}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 truncate">
                        {field.fieldValue || <span className="italic text-slate-400">null</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {field.source || 'other'}
                        </span>
                        {field.confidence && (
                          <span className="text-xs text-slate-500">
                            {(field.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                        {field.llmReasoning ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700" title="Has LLM reasoning">
                            ✓ Reasoning
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700" title="Missing LLM reasoning">
                            ⚠ No Reasoning
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-slate-500">Select a submission to view field extractions</p>
              </div>
            )}
          </div>

          {/* Field Details & LLM Reasoning */}
          <div className="lg:col-span-1">
            {selectedField ? (
              <FieldDetailsView
                field={selectedField}
                extractionResult={selectedSubmission!.extractionResult!}
              />
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-slate-500">Select a field to view extraction details</p>
              </div>
            )}
          </div>
        </div>

        {/* Full LLM Prompt/Response */}
        {selectedSubmission?.extractionResult && (
          <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Full LLM Interaction</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-slate-700 mb-2">System + User Prompt</h3>
                <pre className="bg-slate-50 p-4 rounded-lg text-xs overflow-auto max-h-96 border border-slate-200">
                  {selectedSubmission.extractionResult.llmPrompt || 'Not available'}
                </pre>
              </div>
              <div>
                <h3 className="font-medium text-slate-700 mb-2">LLM Response</h3>
                <pre className="bg-slate-50 p-4 rounded-lg text-xs overflow-auto max-h-96 border border-slate-200">
                  {selectedSubmission.extractionResult.llmResponse || 'Not available'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldDetailsView({
  field,
  extractionResult,
}: {
  field: FieldExtraction;
  extractionResult: ExtractionResult;
}) {

  // Extract reasoning from LLM response for this specific field
  const getFieldReasoning = () => {
    // First check if field has reasoning stored in database
    if (field.llmReasoning) {
      return { llmReasoning: field.llmReasoning };
    }
    
    // Otherwise, try to extract from LLM response JSON
    if (!extractionResult.llmResponse) return null;
    
    try {
      const response = JSON.parse(extractionResult.llmResponse);
      const fieldExtractions = response.fieldExtractions || [];
      const fieldExtraction = fieldExtractions.find(
        (fe: { fieldPath?: string; fieldName?: string }) => fe.fieldPath === field.fieldPath || fe.fieldName === field.fieldName
      );
      return fieldExtraction;
    } catch {
      return null;
    }
  };

  const reasoning = getFieldReasoning();

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-semibold text-slate-900 mb-4">Field Details</h2>
      
      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium text-slate-700">Field Name</div>
          <div className="text-base text-slate-900">{field.fieldName}</div>
          <div className="text-xs text-slate-500 mt-1">{field.fieldPath}</div>
        </div>

        <div>
          <div className="text-sm font-medium text-slate-700">Extracted Value</div>
          <div className="text-base text-slate-900 bg-slate-50 p-2 rounded">
            {field.fieldValue || <span className="italic text-slate-400">null</span>}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-slate-700">Source</div>
          <div className="text-sm text-slate-600">{field.source}</div>
        </div>

        {fieldDef && (
          <>
            <div>
              <div className="text-sm font-medium text-slate-700">Extractor Logic</div>
              <div className="text-sm text-slate-600 bg-blue-50 p-3 rounded border border-blue-200">
                {fieldDef.extractorLogic || 'No extractor logic defined'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-700">Where to Look</div>
              <div className="text-sm text-slate-600">{fieldDef.whereToLook || 'Not specified'}</div>
            </div>
          </>
        )}

        <div>
          <div className="text-sm font-medium text-slate-700 mb-2">LLM Reasoning</div>
          {(field.llmReasoning || reasoning?.llmReasoning) ? (
            <>
              <div className="text-sm text-slate-700 bg-blue-50 p-4 rounded-lg border border-blue-200 whitespace-pre-wrap">
                {field.llmReasoning || reasoning?.llmReasoning || 'No reasoning available'}
              </div>
              <div className="text-xs text-slate-500 mt-1 italic">
                This explains what the LLM looked for, where it searched, and why it extracted this value (or why it couldn&apos;t find it).
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-slate-600 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <span className="font-medium text-yellow-800">⚠ No LLM reasoning available</span>
                <p className="mt-2 text-yellow-700">
                  This field does not have LLM reasoning stored. This may be because:
                </p>
                <ul className="mt-2 ml-4 list-disc text-yellow-700 text-xs">
                  <li>The submission was processed before reasoning tracking was added</li>
                  <li>The LLM did not provide reasoning for this field</li>
                  <li>The field was generated by fallback extraction (non-LLM)</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {field.documentChunk && (
          <div>
            <div className="text-sm font-medium text-slate-700">Document Chunk</div>
            <div 
              className="text-sm text-slate-600 bg-slate-50 p-3 rounded border border-slate-200 max-h-40 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: field.highlightedText || field.documentChunk }}
            />
          </div>
        )}

        {!field.llmReasoning && reasoning && (
          <div>
            <div className="text-sm font-medium text-slate-700">LLM Reasoning (from response JSON)</div>
            <pre className="text-xs text-slate-600 bg-yellow-50 p-3 rounded border border-yellow-200 overflow-auto max-h-40">
              {JSON.stringify(reasoning, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DebugExtractorsPage() {
  return (
    <PasswordProtection>
      <DebugExtractorsContent />
    </PasswordProtection>
  );
}

