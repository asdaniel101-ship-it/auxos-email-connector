'use client';

import { useState, useEffect, ReactElement } from 'react';
import PasswordProtection from '@/components/PasswordProtection';

import { getApiUrl } from '@/lib/api-url';
const API_URL = getApiUrl();

interface FieldDefinition {
  type: string;
  description?: string; // This is now the business description
  whereToLook?: string;
  extractorLogic?: string;
}

interface FieldData {
  [key: string]: FieldDefinition | FieldData | { type: string; description: string; items: FieldData };
}

interface DatabaseFieldDefinition {
  id: string;
  fieldName: string;
  category: string;
  fieldType: string;
  businessDescription?: string | null;
  extractorLogic?: string | null;
  whereToLook?: string | null;
  documentSources?: string[];
  alternateFieldNames?: string[];
}

function FieldSchemaAdminContent() {
  const [schema, setSchema] = useState<FieldData | null>(null);
  const [dbDefinitions, setDbDefinitions] = useState<Map<string, DatabaseFieldDefinition>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<FieldDefinition | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [totalFieldsCount, setTotalFieldsCount] = useState(0);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load schema structure and database definitions in parallel
      const [schemaResponse, definitionsResponse] = await Promise.all([
        fetch(`${API_URL}/field-schema`),
        fetch(`${API_URL}/field-definitions`),
      ]);

      if (!schemaResponse.ok) {
        throw new Error('Failed to load field schema');
      }
      if (!definitionsResponse.ok) {
        throw new Error('Failed to load field definitions');
      }

      const schemaData = await schemaResponse.json();
      const definitionsData = await definitionsResponse.json();

      // Create map of field definitions by fieldName
      const defMap = new Map<string, DatabaseFieldDefinition>();
      definitionsData.forEach((def: DatabaseFieldDefinition) => {
        defMap.set(def.fieldName, def);
      });
      setDbDefinitions(defMap);
      
      // Log for debugging
      console.log(`Loaded ${definitionsData.length} field definitions from database`);
      console.log(`Schema sections: ${Object.keys(schemaData).join(', ')}`);

      // Merge database definitions into schema
      const mergedSchema = mergeDefinitionsIntoSchema(schemaData, defMap);
      setSchema(mergedSchema);
      setHasChanges(false);
      
      // Count total fields in schema for display
      const countAllFields = (obj: Record<string, unknown>): number => {
        let count = 0;
        if (!obj || typeof obj !== 'object') return count;
        for (const [, value] of Object.entries(obj)) {
          if (value && typeof value === 'object') {
            if ('type' in value && typeof value.type === 'string') {
              count++;
            } else if ('type' in value && value.type === 'array' && 'items' in value) {
              count += countAllFields(value.items as Record<string, unknown>);
            } else {
              count += countAllFields(value as Record<string, unknown>);
            }
          }
        }
        return count;
      };
      setTotalFieldsCount(countAllFields(mergedSchema));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const mergeDefinitionsIntoSchema = (
    schemaData: FieldData,
    definitions: Map<string, DatabaseFieldDefinition>
  ): FieldData => {
    const merged = JSON.parse(JSON.stringify(schemaData)); // Deep copy

    const mergeIntoField = (obj: Record<string, unknown>, path: string = '') => {
      if (!obj || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          if (typeof item === 'object') {
            mergeIntoField(item, `${path}[${index}]`);
          }
        });
        return;
      }

      if (obj.type === 'array' && obj.items) {
        mergeIntoField(obj.items as Record<string, unknown>, path);
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = path ? `${path}.${key}` : key;

        if (value && typeof value === 'object') {
          if ('type' in value && typeof value.type === 'string') {
            // This is a field definition - merge database info
            // Try to find database definition by field name (key)
            const dbDef = definitions.get(key);
            if (dbDef) {
              // Map businessDescription from DB to description in UI
              // Prefer database value over JSON schema value
              if (dbDef.businessDescription) {
                (value as FieldDefinition).description = dbDef.businessDescription;
              } else if ((value as FieldDefinition).description) {
                // Keep existing description from JSON if no DB value
              }
              if (dbDef.extractorLogic) {
                (value as FieldDefinition).extractorLogic = dbDef.extractorLogic;
              }
              if (dbDef.whereToLook) {
                (value as FieldDefinition).whereToLook = dbDef.whereToLook;
              }
            }
            // Always keep the field even if no DB definition exists
            // This ensures all schema fields are shown
          } else {
            mergeIntoField(value as Record<string, unknown>, fieldPath);
          }
        }
      }
    };

    mergeIntoField(merged);
    return merged;
  };

  const handleSaveAll = async () => {
    if (!schema) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Extract all field definitions from schema and convert to database format
      const definitionsToSave: Array<{
        fieldName: string;
        category: string;
        fieldType: string;
        businessDescription?: string | null;
        extractorLogic?: string | null;
        whereToLook?: string | null;
      }> = [];

      const extractFields = (obj: Record<string, unknown>, category: string = 'submission', path: string = '') => {
        if (!obj || typeof obj !== 'object') return;

        if (obj.type === 'array' && obj.items) {
          extractFields(obj.items as Record<string, unknown>, category, path);
          return;
        }

        for (const [key, value] of Object.entries(obj)) {
          const fieldPath = path ? `${path}.${key}` : key;

          if (value && typeof value === 'object') {
            if ('type' in value && typeof value.type === 'string') {
              // This is a field definition
              const fieldDef = value as FieldDefinition;
              const fieldCategory = determineCategory(fieldPath);
              
              // Get existing DB definition to preserve values that weren't edited
              const existingDef = dbDefinitions.get(key);
              
              definitionsToSave.push({
                fieldName: key,
                category: fieldCategory,
                fieldType: mapTypeToFieldValueType(fieldDef.type),
                // Map description from UI to businessDescription in DB
                businessDescription: fieldDef.description !== undefined && fieldDef.description !== '' 
                  ? fieldDef.description 
                  : (existingDef?.businessDescription || null),
                extractorLogic: fieldDef.extractorLogic !== undefined && fieldDef.extractorLogic !== ''
                  ? fieldDef.extractorLogic
                  : (existingDef?.extractorLogic || null),
                whereToLook: fieldDef.whereToLook !== undefined && fieldDef.whereToLook !== ''
                  ? fieldDef.whereToLook
                  : (existingDef?.whereToLook || null),
              });
            } else {
              // Determine category from path
              const newCategory = determineCategory(fieldPath);
              extractFields(value as Record<string, unknown>, newCategory, fieldPath);
            }
          }
        }
      };

      extractFields(schema);

      if (definitionsToSave.length === 0) {
        throw new Error('No fields found to save');
      }

      // Save to database
      const response = await fetch(`${API_URL}/field-definitions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(definitionsToSave),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to save field definitions';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const savedData = await response.json();
      
      setSuccess(`Field definitions updated successfully! ${savedData.length} fields saved. Changes will be used for the next submission.`);
      setHasChanges(false);
      setEditingField(null);
      
      // Reload to get updated data from database
      await loadData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save field definitions';
      setError(errorMessage);
      console.error('Error saving field definitions:', err);
    } finally {
      setSaving(false);
    }
  };

  const determineCategory = (fieldPath: string): string => {
    if (fieldPath.startsWith('submission.')) return 'submission';
    if (fieldPath.startsWith('locations')) return 'locations';
    if (fieldPath.startsWith('coverage.')) return 'coverage';
    if (fieldPath.startsWith('lossHistory.')) return 'lossHistory';
    return 'submission';
  };

  const mapTypeToFieldValueType = (type: string): string => {
    const mapping: Record<string, string> = {
      string: 'string',
      number: 'number',
      decimal: 'decimal',
      boolean: 'boolean',
      date: 'string',
      text: 'text',
    };
    return mapping[type] || 'string';
  };

  const startEdit = (fieldPath: string) => {
    const field = getFieldByPath(schema, fieldPath);
    if (field && 'type' in field) {
      setEditingField(fieldPath);
      setEditValues({
        type: field.type,
        description: field.description || '', // This is the business description
        whereToLook: field.whereToLook || '',
        extractorLogic: field.extractorLogic || '',
      });
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValues(null);
  };

  const saveField = async (fieldPath: string) => {
    if (!schema || !editValues) return;

    const newSchema = JSON.parse(JSON.stringify(schema)) as FieldData;
    const pathParts = fieldPath.split('.');
    let current: FieldData | { type: string; description: string; items: FieldData } = newSchema;

    // Navigate to the parent object
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      
      if (part.includes('[items]')) {
        const key = part.replace('[items]', '');
        const currentObj = current as FieldData;
        if (!currentObj[key] || typeof currentObj[key] !== 'object') {
          currentObj[key] = { type: 'array', description: '', items: {} };
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
    const updatedField: FieldDefinition = {
      type: editValues.type,
      description: editValues.description || undefined, // This is the business description
      whereToLook: editValues.whereToLook || undefined,
      extractorLogic: editValues.extractorLogic || undefined,
    };

    currentObj[fieldName] = updatedField;

    setSchema(newSchema);
    setHasChanges(true);
    setEditingField(null);
    setEditValues(null);
    
    // Auto-save this single field to database immediately
    try {
      const fieldCategory = determineCategory(fieldPath);
      const existingDef = dbDefinitions.get(fieldName);
      
      const fieldToSave = {
        fieldName: fieldName,
        category: fieldCategory,
        fieldType: mapTypeToFieldValueType(editValues.type),
        businessDescription: editValues.description || null, // Map description to businessDescription
        extractorLogic: editValues.extractorLogic || null,
        whereToLook: editValues.whereToLook || null,
      };

      const response = await fetch(`${API_URL}/field-definitions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([fieldToSave]),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to save field');
      }

      // Update local dbDefinitions map
      const updatedDef = { ...existingDef, ...fieldToSave } as DatabaseFieldDefinition;
      dbDefinitions.set(fieldName, updatedDef);
      setDbDefinitions(new Map(dbDefinitions));
      
      // Reload to ensure we have the latest from database
      await loadData();
    } catch (err) {
      console.error('Error auto-saving field:', err);
      // Don't show error to user - they can still use "Save All Changes"
      // Just log it for debugging
    }
  };

  const getFieldByPath = (data: FieldData | null, path: string): FieldDefinition | null => {
    if (!data) return null;
    const pathParts = path.split('.');
    let current: FieldData | FieldDefinition | { type: string; description: string; items: FieldData } = data;

    for (const part of pathParts) {
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
    // Skip rendering array containers - they're just structural
    if (field.type === 'array') {
      return null;
    }
    
    const isEditing = editingField === fieldPath;
    const displayName = fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
    
    // Extract the actual field name from path (e.g., "fireAlarmType" from "locations[0].buildings[0].fireAlarmType")
    const actualFieldName = fieldPath.split('.').pop()?.replace(/\[\d+\]/g, '') || fieldName;
    
    // Check if this field has a database definition (use actual field name, not path)
    const hasDefinition = dbDefinitions.has(actualFieldName);
    const dbDef = dbDefinitions.get(actualFieldName);

    return (
      <div key={fieldPath} className={`border rounded-lg p-4 ${hasDefinition ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-300 border-dashed'}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-slate-900">{displayName}</h4>
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                {field.type}
              </span>
              {hasDefinition ? (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                  ✓ Has Definition
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                  ⚠ No Definition
                </span>
              )}
              <span className="text-xs text-slate-400 font-mono ml-auto">
                {fieldPath}
              </span>
            </div>
            {!isEditing ? (
              <div className="space-y-2">
                {(dbDef?.businessDescription || field.description) && (
                  <p className="text-sm text-slate-700">
                    {dbDef?.businessDescription || field.description}
                  </p>
                )}
                {(() => {
                  const extractorLogic = dbDef?.extractorLogic || (field as unknown as Record<string, unknown>).extractorLogic;
                  return extractorLogic ? (
                    <div className="text-xs">
                      <span className="font-medium text-slate-600">Extraction Logic:</span>
                      <p className="text-slate-500 mt-0.5">{String(extractorLogic)}</p>
                    </div>
                  ) : null;
                })()}
                {(() => {
                  const whereToLook = dbDef?.whereToLook || (field as unknown as Record<string, unknown>).whereToLook;
                  return whereToLook ? (
                    <div className="text-xs">
                      <span className="font-medium text-slate-600">Where to Look:</span>
                      <p className="text-slate-500 mt-0.5">{String(whereToLook)}</p>
                    </div>
                  ) : null;
                })()}
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
                    rows={3}
                    placeholder="Business context for this field (e.g., what it means, why it's important)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Extraction Logic</label>
                  <textarea
                    value={editValues?.extractorLogic || ''}
                    onChange={(e) => setEditValues({ ...editValues!, extractorLogic: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 resize-none"
                    rows={4}
                    placeholder="Detailed instructions for the LLM on how to extract this field (e.g., specific patterns, formats, edge cases)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Where to Look</label>
                  <input
                    type="text"
                    value={editValues?.whereToLook || ''}
                    onChange={(e) => setEditValues({ ...editValues!, whereToLook: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                    placeholder="e.g., ACORD 125/140, SOV header, email body"
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
    const fields: ReactElement[] = [];

    const processObject = (obj: FieldData | FieldDefinition | { type: string; description: string; items: FieldData }, prefix: string, _depth: number = 0) => {
      if (!obj || typeof obj !== 'object') return;

      // Handle array type with items - expand the array and process its items
      if ('type' in obj && obj.type === 'array' && 'items' in obj) {
        if (obj.items && typeof obj.items === 'object') {
          // Process items - use [0] notation to show it's an array item
          processObject(obj.items, `${prefix}[0]`, _depth + 1);
        }
        return;
      }

      // Process object properties
      const objAsData = obj as FieldData;
      for (const [key, value] of Object.entries(objAsData)) {
        if (!value || typeof value !== 'object') continue;
        
        const fieldPath = prefix ? `${prefix}.${key}` : key;

        // Check if this is an array field - expand it, don't render the array itself
        if ('type' in value && value.type === 'array' && 'items' in value) {
          // This is an array field - process its items (don't render the array container)
          if (value.items && typeof value.items === 'object') {
            processObject(value.items, `${fieldPath}[0]`, _depth + 1);
          }
        } 
        // Check if this is a field definition (has 'type' property and is NOT an array)
        else if ('type' in value && typeof value.type === 'string' && value.type !== 'array') {
          // This is a field - render it
          const rendered = renderField(key, value as FieldDefinition, fieldPath);
          if (rendered) {
            fields.push(rendered);
          }
        } 
        // Nested object - recurse
        else {
          processObject(value as FieldData, fieldPath, _depth + 1);
        }
      }
    };

    processObject(sectionData, sectionName);

    // Filter out null fields (arrays that shouldn't be rendered)
    return fields.filter(f => f !== null);
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
              <p className="text-slate-600">
                Edit field definitions for email document extraction
                {dbDefinitions.size > 0 && (
                  <span className="ml-2 text-slate-400">
                    ({dbDefinitions.size} field definitions in database)
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadData}
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

          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Showing all fields from schema. Fields with database definitions will show extractor logic.
              {totalFieldsCount > 0 && (
                <span className="ml-2 font-medium">
                  Total: {totalFieldsCount} fields | {dbDefinitions.size} with definitions
                </span>
              )}
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800 transition-colors"
            >
              Refresh Data
            </button>
          </div>

          <div className="space-y-6">
            {Object.entries(schema).map(([sectionKey, sectionData]) => {
              if (sectionData && typeof sectionData === 'object' && 'type' in sectionData && !('items' in sectionData)) {
                return null;
              }
              const sectionFields = renderSection(sectionKey, sectionData as FieldData);
              
              return (
                <div key={sectionKey} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">
                      {sectionTitles[sectionKey] || sectionKey}
                    </h2>
                    <span className="text-sm text-slate-500">
                      {sectionFields.length} field{sectionFields.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="p-6 space-y-4">
                    {sectionFields.length > 0 ? (
                      sectionFields
                    ) : (
                      <p className="text-sm text-slate-500 italic">No fields in this section</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 text-sm text-slate-500">
            <p>
              <strong>Note:</strong> Field definitions are stored in the database and will be used immediately for the next submission. No server restart required.
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
