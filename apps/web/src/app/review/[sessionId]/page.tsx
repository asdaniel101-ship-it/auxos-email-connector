'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface ExtractedField {
  id: string;
  fieldName: string;
  fieldValue: string;
  confidence?: number;
  source?: string;
  extractedText?: string;
  document?: {
    id: string;
    fileName: string;
    docType: string | null;
  } | null;
}

interface Lead {
  id: string;
  legalBusinessName: string | null;
  primaryAddress: string | null;
  primaryCity: string | null;
  primaryState: string | null;
  primaryZip: string | null;
  employeeCountTotal: number | null;
  annualRevenue: number | null;
  businessDescription: string | null;
  yearsInOperation: number | null;
  desiredCoverages: string[] | null;
  currentCarrier: string | null;
  currentPolicyTypes: string[] | null;
  currentPremiumTotal: number | null;
  amountRequested: number | null;
  fundingPurpose: string | null;
  status: string;
  session: {
    vertical: string;
    businessType: string | null;
  };
  extractedFields?: ExtractedField[];
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    loadLead();
  }, [sessionId]);

  const loadLead = async () => {
    try {
      const sessionResponse = await fetch(`${API_URL}/sessions/${sessionId}`);
      
      if (!sessionResponse.ok) {
        if (sessionResponse.status === 404) {
          throw new Error('Session not found. Please start over.');
        }
        throw new Error(`Failed to load session: ${sessionResponse.statusText}`);
      }
      
      const session = await sessionResponse.json();
      
      if (!session.lead) {
        throw new Error('Lead information not found. Please complete the intake process first.');
      }
      
      const leadData = {
        ...session.lead,
        session: {
          vertical: session.vertical,
          businessType: session.businessType,
        },
      };
      setLead(leadData);
      // Initialize editData with lead's current values and extracted field values
      const initialEditData: any = { ...leadData };
      leadData.extractedFields?.forEach(field => {
        initialEditData[`extracted_${field.id}`] = field.fieldValue;
      });
      setEditData(initialEditData);
    } catch (error) {
      console.error('Error loading lead:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load your information. Please try again.';
      alert(errorMessage);
      // Optionally redirect to home if session not found
      if (error instanceof Error && error.message.includes('not found')) {
        setTimeout(() => router.push('/'), 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number | null): string => {
    if (value === null || value === undefined) return 'Not provided';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number | null): string => {
    if (value === null || value === undefined) return 'Not provided';
    return new Intl.NumberFormat('en-US').format(value);
  };

  const handleSave = async () => {
    if (!lead) return;

    setIsSubmitting(true);
    try {
      const updateData: any = {};
      
      if (editData.legalBusinessName !== undefined) updateData.legalBusinessName = editData.legalBusinessName || null;
      if (editData.primaryAddress !== undefined) updateData.primaryAddress = editData.primaryAddress || null;
      if (editData.primaryCity !== undefined) updateData.primaryCity = editData.primaryCity || null;
      if (editData.primaryState !== undefined) updateData.primaryState = editData.primaryState || null;
      if (editData.primaryZip !== undefined) updateData.primaryZip = editData.primaryZip || null;
      if (editData.employeeCountTotal !== undefined) {
        const empCount = editData.employeeCountTotal ? parseInt(String(editData.employeeCountTotal)) : null;
        if (empCount !== null && isNaN(empCount)) {
          throw new Error('Employee count must be a valid number');
        }
        updateData.employeeCountTotal = empCount;
      }
      if (editData.annualRevenue !== undefined) {
        const revenue = editData.annualRevenue ? parseFloat(String(editData.annualRevenue)) : null;
        if (revenue !== null && isNaN(revenue)) {
          throw new Error('Annual revenue must be a valid number');
        }
        updateData.annualRevenue = revenue;
      }
      if (editData.businessDescription !== undefined) updateData.businessDescription = editData.businessDescription || null;
      if (editData.yearsInOperation !== undefined) {
        const years = editData.yearsInOperation ? parseInt(String(editData.yearsInOperation)) : null;
        if (years !== null && isNaN(years)) {
          throw new Error('Years in operation must be a valid number');
        }
        updateData.yearsInOperation = years;
      }
      if (editData.desiredCoverages !== undefined) updateData.desiredCoverages = Array.isArray(editData.desiredCoverages) ? editData.desiredCoverages : [];
      if (editData.currentCarrier !== undefined) updateData.currentCarrier = editData.currentCarrier || null;
      if (editData.currentPolicyTypes !== undefined) updateData.currentPolicyTypes = Array.isArray(editData.currentPolicyTypes) ? editData.currentPolicyTypes : [];
      if (editData.currentPremiumTotal !== undefined) {
        const premium = editData.currentPremiumTotal ? parseFloat(String(editData.currentPremiumTotal)) : null;
        if (premium !== null && isNaN(premium)) {
          throw new Error('Premium amount must be a valid number');
        }
        updateData.currentPremiumTotal = premium;
      }
      if (editData.amountRequested !== undefined) {
        const amount = editData.amountRequested ? parseFloat(String(editData.amountRequested)) : null;
        if (amount !== null && isNaN(amount)) {
          throw new Error('Amount requested must be a valid number');
        }
        updateData.amountRequested = amount;
      }
      if (editData.fundingPurpose !== undefined) updateData.fundingPurpose = editData.fundingPurpose || null;

      const leadResponse = await fetch(`${API_URL}/leads/${lead.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!leadResponse.ok) {
        const errorData = await leadResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update lead information');
      }

      // Update individual extracted fields if they were edited
      const fieldUpdatePromises = [];
      for (const key in editData) {
        if (key.startsWith('extracted_')) {
          const extractedFieldId = key.substring('extracted_'.length);
          const originalField = lead.extractedFields?.find(f => f.id === extractedFieldId);
          if (originalField && originalField.fieldValue !== editData[key]) {
            fieldUpdatePromises.push(
              fetch(`${API_URL}/extracted-fields/${extractedFieldId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fieldValue: editData[key] }),
              }).then(res => {
                if (!res.ok) throw new Error(`Failed to update field ${extractedFieldId}`);
              })
            );
          }
        }
      }

      await Promise.all(fieldUpdatePromises);

      await loadLead();
      setIsEditing(false);
      alert('Information updated successfully!');
    } catch (error) {
      console.error('Error updating lead:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!lead) return;

    setIsSubmitting(true);
    try {
      // Mark lead as ready for match
      const confirmResponse = await fetch(`${API_URL}/leads/${lead.id}/confirm`, {
        method: 'POST',
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to confirm lead');
      }

      // Trigger matching (don't fail if this fails - lead is still confirmed)
      try {
        const matchResponse = await fetch(`${API_URL}/partners/match/${lead.id}`, {
          method: 'POST',
        });
        if (!matchResponse.ok) {
          console.warn('Matching failed but lead is confirmed');
        }
      } catch (matchError) {
        console.warn('Matching error (non-critical):', matchError);
      }

      alert('Your information has been submitted! We\'ll match you with brokers/lenders soon.');
      router.push('/');
    } catch (error) {
      console.error('Error confirming lead:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldValue = (fieldName: string): string => {
    if (isEditing) {
      return editData[fieldName] ?? '';
    }
    return lead?.[fieldName as keyof Lead] as string ?? '';
  };

  const getFieldValueNumber = (fieldName: string): string => {
    if (isEditing) {
      return editData[fieldName]?.toString() ?? '';
    }
    const value = lead?.[fieldName as keyof Lead];
    return value ? value.toString() : '';
  };

  const getFieldValueArray = (fieldName: string): string[] => {
    if (isEditing) {
      return Array.isArray(editData[fieldName]) ? editData[fieldName] : [];
    }
    const value = lead?.[fieldName as keyof Lead];
    return Array.isArray(value) ? value : [];
  };

  const getExtractedFieldValue = (fieldName: string): ExtractedField | null => {
    return lead?.extractedFields?.find(ef => ef.fieldName === fieldName) || null;
  };

  const getExtractedFieldsByDocument = () => {
    if (!lead?.extractedFields || lead.extractedFields.length === 0) return null;
    
    const grouped: Record<string, ExtractedField[]> = {};
    lead.extractedFields.forEach((field) => {
      const docName = field.document?.fileName || 'Unknown Document';
      if (!grouped[docName]) {
        grouped[docName] = [];
      }
      grouped[docName].push(field);
    });
    
    return grouped;
  };

  const renderField = (
    label: string,
    fieldName: string,
    type: 'text' | 'number' | 'textarea' | 'array' | 'currency' = 'text',
    extractedField?: ExtractedField | null
  ) => {
    const value = type === 'number' || type === 'currency' ? getFieldValueNumber(fieldName) : getFieldValue(fieldName);
    const arrayValue = type === 'array' ? getFieldValueArray(fieldName) : [];
    const hasExtracted = extractedField !== null && extractedField !== undefined;
    const displayValue = type === 'currency' && value && value !== 'Not provided' 
      ? formatCurrency(parseFloat(value))
      : type === 'number' && value && value !== 'Not provided'
      ? formatNumber(parseFloat(value))
      : value;

    return (
      <div className="mb-3">
        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
          {label}
          {hasExtracted && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-normal">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              From {extractedField?.document?.fileName || 'document'}
            </span>
          )}
        </label>
        {isEditing ? (
              type === 'textarea' ? (
            <textarea
              value={value}
              onChange={(e) => setEditData({ ...editData, [fieldName]: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              rows={2}
            />
          ) : type === 'array' ? (
            <input
              type="text"
              value={arrayValue.join(', ')}
              onChange={(e) => setEditData({ ...editData, [fieldName]: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              placeholder="e.g., GL, WC, BOP"
            />
          ) : (
            <input
              type={type === 'currency' ? 'text' : type}
              value={value}
              onChange={(e) => setEditData({ ...editData, [fieldName]: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              placeholder={type === 'currency' ? '$0.00' : ''}
            />
          )
        ) : (
          <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-slate-900 font-medium text-sm">
              {type === 'array' 
                ? (arrayValue.length > 0 ? arrayValue.join(', ') : 'Not provided')
                : (displayValue || 'Not provided')}
            </p>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600 text-lg">Loading your information...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600 text-lg">Lead not found</div>
      </div>
    );
  }

  const extractedFieldsGrouped = getExtractedFieldsByDocument();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold mb-1">Review Your Information</h1>
                <p className="text-blue-100 text-sm">
                  {isEditing 
                    ? 'Edit the information below and click "Save Changes" to update.'
                    : 'Please review all the information below. You can edit any field or proceed to share with brokers/lenders.'}
                </p>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-sm text-sm"
                >
                  Edit Answers
                </button>
              )}
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Business Basics */}
            <section className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Business Basics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {renderField('Business Name', 'legalBusinessName', 'text', getExtractedFieldValue('legalBusinessName'))}
                {renderField('Address', 'primaryAddress', 'text', getExtractedFieldValue('primaryAddress'))}
                {renderField('City', 'primaryCity', 'text', getExtractedFieldValue('primaryCity'))}
                {renderField('State', 'primaryState', 'text', getExtractedFieldValue('primaryState'))}
                {renderField('ZIP Code', 'primaryZip', 'text', getExtractedFieldValue('primaryZip'))}
                {renderField('Employees', 'employeeCountTotal', 'number', getExtractedFieldValue('employeeCountTotal'))}
                {renderField('Annual Revenue', 'annualRevenue', 'currency', getExtractedFieldValue('annualRevenue'))}
                {renderField('Years in Operation', 'yearsInOperation', 'number', getExtractedFieldValue('yearsInOperation'))}
              </div>
              <div className="mt-3">
                {renderField('Description', 'businessDescription', 'textarea', getExtractedFieldValue('businessDescription'))}
              </div>
            </section>

            {/* Vertical-specific fields */}
            {lead.session.vertical === 'insurance' && (
              <section className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Insurance Details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderField('Desired Coverages', 'desiredCoverages', 'array', getExtractedFieldValue('desiredCoverages'))}
                  {renderField('Current Carrier', 'currentCarrier', 'text', getExtractedFieldValue('currentCarrier'))}
                  {renderField('Current Policy Types', 'currentPolicyTypes', 'array')}
                  {renderField('Current Premium', 'currentPremiumTotal', 'currency', getExtractedFieldValue('currentPremiumTotal'))}
                </div>
              </section>
            )}

            {lead.session.vertical === 'lending' && (
              <section className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Funding Details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderField('Amount Requested', 'amountRequested', 'currency', getExtractedFieldValue('amountRequested'))}
                </div>
                <div className="mt-3">
                  {renderField('Funding Purpose', 'fundingPurpose', 'textarea', getExtractedFieldValue('fundingPurpose'))}
                </div>
              </section>
            )}

            {/* Document Extracted Fields Section */}
            {extractedFieldsGrouped && (
              <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
                <h2 className="text-lg font-bold text-slate-900 mb-1.5 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Information Extracted from Documents
                </h2>
                <p className="text-xs text-slate-600 mb-4">
                  The following information was automatically extracted from your uploaded documents using AI-powered extraction.
                  Review and verify these fields to ensure accuracy.
                </p>
                
                {Object.entries(extractedFieldsGrouped).map(([docName, fields]) => (
                  <div key={docName} className="mb-4 p-4 bg-white rounded-xl border border-blue-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {docName}
                      <span className="text-xs font-normal text-blue-600 bg-blue-100 px-2 py-1 rounded-full ml-2">
                        {fields.length} field{fields.length !== 1 ? 's' : ''} extracted
                      </span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fields.map((extracted) => {
                        const displayName = extracted.fieldName
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, str => str.toUpperCase())
                          .trim();

                        const isShownAbove = [
                          'legalBusinessName', 'primaryAddress', 'primaryCity', 'primaryState', 'primaryZip',
                          'employeeCountTotal', 'annualRevenue', 'yearsInOperation', 'businessDescription',
                          'desiredCoverages', 'currentCarrier', 'currentPremiumTotal', 'amountRequested', 'fundingPurpose'
                        ].includes(extracted.fieldName);

                        return (
                          <div key={extracted.id} className={`p-3 bg-white rounded-lg border ${isShownAbove ? 'border-yellow-300 bg-yellow-50' : 'border-blue-200'}`}>
                            <div className="flex items-start justify-between mb-1.5">
                              <label className="block text-sm font-semibold text-slate-800">
                                {displayName}
                                {isShownAbove && (
                                  <span className="ml-2 text-xs text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded-full font-normal">
                                    Also shown above
                                  </span>
                                )}
                              </label>
                              {extracted.confidence && (
                                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full font-medium">
                                  {Math.round(extracted.confidence * 100)}% confidence
                                </span>
                              )}
                            </div>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editData[`extracted_${extracted.id}`] ?? extracted.fieldValue}
                                onChange={(e) => setEditData({ ...editData, [`extracted_${extracted.id}`]: e.target.value })}
                                className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            ) : (
                              <p className="text-slate-900 text-sm mt-2 font-medium">{extracted.fieldValue}</p>
                            )}
                            {extracted.source && (
                              <p className="text-xs text-slate-500 mt-1 italic">
                                Source: {extracted.source}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {!extractedFieldsGrouped && (
              <section className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center">
                <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-slate-600">No document extractions available. Upload documents during intake to extract information automatically.</p>
              </section>
            )}
          </div>

          {/* Footer Actions */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditData(lead);
                  }}
                  className="px-5 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-white transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="flex-1 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push(`/intake/${sessionId}`)}
                  className="px-5 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-white transition-colors text-sm"
                >
                  Back to Chat
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="flex-1 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm & Share with Broker / Lender'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
