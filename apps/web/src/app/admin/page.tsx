'use client';

import { useEffect, useMemo, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type FieldDefinition = {
  id: string;
  fieldName: string;
  category: string;
  fieldType: 'string' | 'number' | 'decimal' | 'boolean' | 'text';
  enteredFieldKey?: string | null;
  chatFieldKey?: string | null;
  documentFieldKey?: string | null;
  businessDescription?: string | null;
  extractorLogic?: string | null;
  documentSources: string[];
  alternateFieldNames: string[];
  createdAt: string;
  updatedAt: string;
};

type EditableFieldDefinition = FieldDefinition & {
  documentSourcesText: string;
  alternateFieldNamesText: string;
};

const FIELD_TYPE_OPTIONS: FieldDefinition['fieldType'][] = ['string', 'number', 'decimal', 'boolean', 'text'];

export default function AdminFieldDefinitionsPage() {
  const [records, setRecords] = useState<EditableFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API}/field-definitions`);
        if (!response.ok) {
          throw new Error(`Failed to load field definitions (${response.status})`);
        }
        const data: FieldDefinition[] = await response.json();
        const prepared = data.map((item) => ({
          ...item,
          documentSourcesText: item.documentSources.join(', '),
          alternateFieldNamesText: item.alternateFieldNames.join(', '),
        }));
        setRecords(prepared);
        setHasChanges(false);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unable to load field definitions');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const groupedRecords = useMemo(() => {
    const map = new Map<string, EditableFieldDefinition[]>();
    for (const record of records) {
      const key = record.category ?? 'General';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(record);
    }
    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      items,
    }));
  }, [records]);

  function handleChange<K extends keyof EditableFieldDefinition>(
    index: number,
    key: K,
    value: EditableFieldDefinition[K],
  ) {
    setRecords((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [key]: value,
      };
      return next;
    });
    setHasChanges(true);
  }

  function splitToArray(value: string) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function createEmptyField(category: string): EditableFieldDefinition {
    const newId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `temp-${Date.now()}`;
    const now = new Date().toISOString();
    return {
      id: `temp-${newId}`,
      fieldName: '',
      category,
      fieldType: 'string',
      enteredFieldKey: '',
      chatFieldKey: '',
      documentFieldKey: '',
      businessDescription: '',
      extractorLogic: '',
      documentSources: [],
      alternateFieldNames: [],
      documentSourcesText: '',
      alternateFieldNamesText: '',
      createdAt: now,
      updatedAt: now,
    };
  }

  function handleAddField(category: string) {
    setRecords((prev) => [...prev, createEmptyField(category)]);
    setHasChanges(true);
  }

  function validatePayload(payload: EditableFieldDefinition[]) {
    const errors: string[] = [];

    payload.forEach((record) => {
      if (!record.fieldName?.trim()) {
        errors.push(`Field name is required for one of the rows.`);
      }
      if (!record.category?.trim()) {
        errors.push(`Category is required for field "${record.fieldName}".`);
      }
      if (!FIELD_TYPE_OPTIONS.includes(record.fieldType)) {
        errors.push(`Field type for "${record.fieldName}" must be one of ${FIELD_TYPE_OPTIONS.join(', ')}.`);
      }
    });

    return errors;
  }

  async function handleSave() {
    setStatusMessage(null);
    setFormErrors([]);
    setError(null);

    const validationErrors = validatePayload(records);
    if (validationErrors.length) {
      setFormErrors(validationErrors);
      return;
    }

    const payload = records.map(
      ({
        fieldName,
        category,
        fieldType,
        enteredFieldKey,
        chatFieldKey,
        documentFieldKey,
        businessDescription,
        extractorLogic,
        documentSourcesText,
        alternateFieldNamesText,
      }) => ({
        fieldName: fieldName.trim(),
        category: category.trim(),
        fieldType,
        documentSources: splitToArray(documentSourcesText),
        alternateFieldNames: splitToArray(alternateFieldNamesText),
        enteredFieldKey: enteredFieldKey?.trim() || fieldName.trim(),
        chatFieldKey: chatFieldKey?.trim() || fieldName.trim(),
        documentFieldKey: documentFieldKey?.trim() || fieldName.trim(),
        businessDescription: businessDescription?.trim() || null,
        extractorLogic: extractorLogic?.trim() || null,
      }),
    );

    setSaving(true);
    try {
      const response = await fetch(`${API}/field-definitions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Update failed with status ${response.status}`);
      }

      const updated: FieldDefinition[] = await response.json();
      const prepared = updated.map((item) => ({
        ...item,
        documentSourcesText: item.documentSources.join(', '),
        alternateFieldNamesText: item.alternateFieldNames.join(', '),
      }));
      setRecords(prepared);
      setHasChanges(false);
      setStatusMessage('Field definitions updated successfully.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unexpected error updating field definitions');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Field Metadata Admin</h1>
          <p className="mt-2 text-sm text-gray-600">
            Review and edit how BrokerZero tracks, extracts, and reconciles fields across chat, forms, and documents.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`px-5 py-2 rounded-md border text-sm font-medium transition-colors ${
            !hasChanges || saving
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-500'
          }`}
        >
          {saving ? 'Saving…' : 'Update'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {formErrors.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 space-y-1">
          {formErrors.map((errMsg, idx) => (
            <p key={idx}>{errMsg}</p>
          ))}
        </div>
      )}

      {statusMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {statusMessage}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading fields…</div>
      ) : (
        <div className="space-y-10">
          {groupedRecords.map(({ category, items }) => (
            <section key={category} className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{category}</h2>
                  <p className="text-sm text-gray-500">
                    Manage the mappings for fields categorized under {category}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddField(category)}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <span className="text-base leading-none">+</span>
                  Add field
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Field name</th>
                      <th className="px-4 py-3">Entered field value</th>
                      <th className="px-4 py-3">Chat field value</th>
                      <th className="px-4 py-3">Document field value</th>
                      <th className="px-4 py-3">Field type</th>
                      <th className="px-4 py-3">Business description</th>
                      <th className="px-4 py-3">Extractor logic</th>
                      <th className="px-4 py-3">Documents</th>
                      <th className="px-4 py-3">Other field names</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {items.map((record) => {
                      const rowIndex = records.findIndex((row) => row.id === record.id);
                      return (
                        <tr key={record.id} className="align-top hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={record.fieldName}
                              onChange={(event) => handleChange(rowIndex, 'fieldName', event.target.value)}
                              className="w-48 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <label className="mt-2 block text-xs font-medium text-gray-400">
                              Category
                              <input
                                type="text"
                                value={record.category}
                                onChange={(event) => handleChange(rowIndex, 'category', event.target.value)}
                                className="mt-1 w-48 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </label>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={record.enteredFieldKey ?? ''}
                              onChange={(event) => handleChange(rowIndex, 'enteredFieldKey', event.target.value)}
                              className="w-40 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="submission field key"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={record.chatFieldKey ?? ''}
                              onChange={(event) => handleChange(rowIndex, 'chatFieldKey', event.target.value)}
                              className="w-40 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="chat key"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={record.documentFieldKey ?? ''}
                              onChange={(event) => handleChange(rowIndex, 'documentFieldKey', event.target.value)}
                              className="w-44 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="extraction key"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={record.fieldType}
                              onChange={(event) =>
                                handleChange(
                                  rowIndex,
                                  'fieldType',
                                  event.target.value as EditableFieldDefinition['fieldType'],
                                )
                              }
                              className="w-32 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {FIELD_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <textarea
                              value={record.businessDescription ?? ''}
                              onChange={(event) => handleChange(rowIndex, 'businessDescription', event.target.value)}
                              className="h-28 w-64 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Short description of why this field matters"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <textarea
                              value={record.extractorLogic ?? ''}
                              onChange={(event) => handleChange(rowIndex, 'extractorLogic', event.target.value)}
                              className="h-28 w-72 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Guidance for locating or inferring the field"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <textarea
                              value={record.documentSourcesText}
                              onChange={(event) => handleChange(rowIndex, 'documentSourcesText', event.target.value)}
                              className="h-28 w-48 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Comma-separated document types"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <textarea
                              value={record.alternateFieldNamesText}
                              onChange={(event) => handleChange(rowIndex, 'alternateFieldNamesText', event.target.value)}
                              className="h-28 w-56 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Other labels or synonyms"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

