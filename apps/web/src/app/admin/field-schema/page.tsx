'use client';

import { useState, useEffect } from 'react';
import PasswordProtection from '@/components/PasswordProtection';

import { getApiUrl } from '@/lib/api-url';
const API_URL = getApiUrl();

interface FieldDefinition {
  type: string;
  description: string;
  whereToLook?: string;
}

interface FieldData {
  [key: string]: FieldDefinition | FieldData | { type: string; description: string; items: FieldData };
}

function FieldSchemaAdminContent() {
  const [schema, setSchema] = useState<FieldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<FieldDefinition | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/field-schema`);
      if (!response.ok) {
        throw new Error('Failed to load field schema');
      }
      const data = await response.json();
      setSchema(data);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schema');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    if (!schema) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`${API_URL}/field-schema`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(schema),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save schema');
      }

      setSuccess('Field schema updated successfully! Restart the API server for changes to take effect.');
      setHasChanges(false);
      setEditingField(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schema');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (fieldPath: string) => {
    const field = getFieldByPath(schema, fieldPath);
    if (field && 'type' in field) {
      setEditingField(fieldPath);
      setEditValues({
        type: field.type,
        description: field.description,
        whereToLook: field.whereToLook || '',
      });
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValues(null);
  };

  const saveField = (fieldPath: string) => {
    if (!schema || !editValues) return;

    const newSchema = JSON.parse(JSON.stringify(schema)) as FieldData;
    const pathParts = fieldPath.split('.');
    let current: FieldData | { type: string; description: string; items: FieldData } = newSchema;

    // Navigate to the parent object
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      
      // Handle array items structure like "locations[items]"
      if (part.includes('[items]')) {
        const key = part.replace('[items]', '');
        const currentObj = current as FieldData;
        if (!currentObj[key] || typeof currentObj[key] !== 'object') {
          currentObj[key] = { type: 'array', items: {} };
        }
        const arrayField = currentObj[key] as { type: string; items: FieldData };
        if (!arrayField.items) arrayField.items = {};
        current = arrayField.items;
      } else {
        const currentObj = current as FieldData;
        if (!currentObj[part] || typeof currentObj[part] !== 'object') {
          currentObj[part] = {};
        }
        current = currentObj[part] as FieldData;
      }
    }

    const fieldName = pathParts[pathParts.length - 1];
    const currentObj = current as FieldData;
    currentObj[fieldName] = {
      type: editValues.type,
      description: editValues.description,
      ...(editValues.whereToLook ? { whereToLook: editValues.whereToLook } : {}),
    };

    setSchema(newSchema);
    setHasChanges(true);
    setEditingField(null);
    setEditValues(null);
  };

  const getFieldByPath = (data: FieldData | null, path: string): FieldDefinition | null => {
    if (!data) return null;
    const pathParts = path.split('.');
    let current: FieldData | FieldDefinition | { type: string; description: string; items: FieldData } = data;

    for (const part of pathParts) {
      // Handle array items structure like "locations[items]"
      if (part.includes('[items]')) {
        const key = part.replace('[items]', '');
        const currentObj = current as FieldData;
        if (currentObj[key] && typeof currentObj[key] === 'object' && 'items' in currentObj[key]) {
          const arrayField = currentObj[key] as { type: string; items: FieldData };
          current = arrayField.items;
        } else {
          return null;
        }
      } else {
        const currentObj = current as FieldData;
        if (currentObj && currentObj[part] && typeof currentObj[part] === 'object') {
          current = currentObj[part] as FieldData | FieldDefinition | { type: string; description: string; items: FieldData };
        } else {
          return null;
        }
      }
    }

    if (current && typeof current === 'object' && 'type' in current && typeof current.type === 'string') {
      return current as FieldDefinition;
    }
    return null;
  };

  const renderField = (fieldName: string, field: FieldDefinition, fieldPath: string) => {
    const isEditing = editingField === fieldPath;
    const displayName = fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

    return (
      <div key={fieldPath} className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-slate-900">{displayName}</h4>
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                {field.type}
              </span>
            </div>
            {!isEditing ? (
              <div className="space-y-1">
                <p className="text-sm text-slate-700">{field.description}</p>
                {field.whereToLook && (
                  <p className="text-xs text-slate-500">
                    <span className="font-medium">Where to look:</span> {field.whereToLook}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 mt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={editValues?.type || ''}
                    onChange={(e) => setEditValues({ ...editValues!, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="date">date</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={editValues?.description || ''}
                    onChange={(e) => setEditValues({ ...editValues!, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Where to Look (optional)</label>
                  <input
                    type="text"
                    value={editValues?.whereToLook || ''}
                    onChange={(e) => setEditValues({ ...editValues!, whereToLook: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                    placeholder="e.g., ACORD, email body, signature"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveField(fieldPath)}
                    className="px-3 py-1.5 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          {!isEditing && (
            <button
              onClick={() => startEdit(fieldPath)}
              className="ml-4 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex-shrink-0"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSection = (sectionName: string, sectionData: FieldData) => {
    const fields: JSX.Element[] = [];

    const processObject = (obj: FieldData | FieldDefinition | { type: string; description: string; items: FieldData }, prefix: string, _depth: number = 0) => {
      if (!obj || typeof obj !== 'object') return;

      // Check if this is an array type definition
      if ('type' in obj && obj.type === 'array' && 'items' in obj) {
        // Process the items structure
        if (obj.items && typeof obj.items === 'object') {
          processObject(obj.items, `${prefix}[items]`, _depth + 1);
        }
        return;
      }

      // Process regular object fields
      const objAsData = obj as FieldData;
      for (const [key, value] of Object.entries(objAsData)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object') {
          if ('type' in value && typeof value.type === 'string') {
            // It's a field definition (has type, description, etc.)
            fields.push(renderField(key, value as FieldDefinition, fieldPath));
          } else if ('items' in value) {
            // It's an array type - recurse into items
            processObject(value, fieldPath, _depth + 1);
          } else {
            // It's a nested object - recurse
            processObject(value as FieldData, fieldPath, _depth + 1);
          }
        }
      }
    };

    processObject(sectionData, sectionName);

    return fields;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <p className="text-slate-600">Loading field schema...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <p className="text-red-600">Failed to load schema</p>
          </div>
        </div>
      </div>
    );
  }

  const sectionTitles: Record<string, string> = {
    submission: 'Submission Information',
    locations: 'Locations & Buildings',
    coverage: 'Coverage & Limits',
    lossHistory: 'Loss History',
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900 mb-2">Field Schema Editor</h1>
              <p className="text-slate-600">Edit field definitions for email document extraction</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadSchema}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Reload
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving || !hasChanges}
                className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : hasChanges ? 'Save All Changes' : 'No Changes'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              {success}
            </div>
          )}

          {hasChanges && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
              You have unsaved changes. Click &quot;Save All Changes&quot; to apply them.
            </div>
          )}

          <div className="space-y-6">
            {Object.entries(schema).map(([sectionKey, sectionData]) => (
              <div key={sectionKey} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {sectionTitles[sectionKey] || sectionKey}
                  </h2>
                </div>
                <div className="p-6 space-y-4">
                  {renderSection(sectionKey, sectionData)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-sm text-slate-500">
            <p>
              <strong>Note:</strong> After saving, restart the API server for changes to take effect. A backup is automatically created before saving.
            </p>
            <p className="mt-1">
              File location: <code className="bg-slate-100 px-2 py-1 rounded">apps/api/field-schema.json</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FieldSchemaAdminPage() {
  return (
    <PasswordProtection>
      <FieldSchemaAdminContent />
    </PasswordProtection>
  );
}
