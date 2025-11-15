'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Document = {
  id: string;
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  documentType?: string;
  processingStatus: string; // pending, processing, completed, failed
  processingError?: string;
  createdAt: string;
};

type Submission = {
  id: string;
  businessName: string;
  
  // Physical Locations
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  additionalLocations?: string;
  
  // Business Details
  overview?: string;
  employeeCount?: number;
  yearsInOperation?: number;
  revenue?: number;
  
  // Industry
  industryCode?: string;
  industryLabel?: string;
  
  // Coverage
  insuranceNeeds?: string;
  currentCoverages?: string;
  riskToleranceLevel?: string;
  
  // Assets & Growth
  keyAssets?: string;
  growthPlans?: string;
  
  // Nice to Have
  totalClaimsCount?: number;
  totalClaimsLoss?: number;
  
  // Submission Agent Fields
  taxId?: string;
  businessRegistrationCert?: string;
  financialStatements?: string;
  proofOfAddress?: string;
  ownershipStructure?: string;
  priorInsuranceDocs?: string;
  employeeList?: string;
  safetyManuals?: string;
  digitalInfrastructureProfile?: string;
  
  // Metadata
  status: string;
  createdAt: string;
  updatedAt: string;
  documents?: Document[];
  messages?: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
};

// All possible insurance coverage types
const ALL_COVERAGES = [
  { id: 'general_liability', label: 'General Liability' },
  { id: 'workers_compensation', label: 'Workers Compensation' },
  { id: 'professional_liability', label: 'Professional Liability (E&O)' },
  { id: 'cyber_liability', label: 'Cyber Liability' },
  { id: 'commercial_auto', label: 'Commercial Auto' },
  { id: 'property', label: 'Property Insurance' },
  { id: 'liquor_liability', label: 'Liquor Liability' },
  { id: 'product_liability', label: 'Product Liability' },
  { id: 'business_interruption', label: 'Business Interruption' },
  { id: 'builders_risk', label: 'Builders Risk' },
];

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

type ExtractedField = {
  id: string;
  fieldName: string;
  fieldValue: string;
  confidence?: number;
  source?: string;
  document: {
    fileName: string;
    documentType: string | null;
  };
};

export default function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [formData, setFormData] = useState<Partial<Submission>>({});
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedCoverages, setSelectedCoverages] = useState<string[]>([]);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<{
    fieldName: string;
    fieldLabel: string;
    userValue: string;
    aiValue: string;
    extracted: ExtractedField;
  } | null>(null);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [currentSource, setCurrentSource] = useState<ExtractedField | null>(null);

  const normalizeConfidence = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0.9;
    }
    return Math.min(Math.max(value, 0.9), 1);
  };

  // Debounce the form data for auto-save
  const debouncedFormData = useDebounce(formData, 1000);

  // Load submission
  useEffect(() => {
    loadSubmission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  // Poll for document processing status
  useEffect(() => {
    if (!submission || !submission.documents || submission.documents.length === 0) {
      setExtractionProgress(0);
      return;
    }

    // Check if any documents are still processing
    const hasProcessing = submission.documents.some(
      (doc) => doc.processingStatus === 'processing' || doc.processingStatus === 'pending'
    );

    // Calculate progress based on document status
    const totalDocs = submission.documents.length;
    const completedDocs = submission.documents.filter((doc) => doc.processingStatus === 'completed').length;
    const processingDocs = submission.documents.filter((doc) => doc.processingStatus === 'processing').length;
    const pendingDocs = submission.documents.filter((doc) => doc.processingStatus === 'pending').length;
    
    if (completedDocs === totalDocs) {
      setExtractionProgress(100);
    } else if (processingDocs > 0) {
      // Show 50% for documents that are actively processing
      const completedProgress = (completedDocs / totalDocs) * 100;
      const processingProgress = (processingDocs / totalDocs) * 50; // Mid-point for processing
      setExtractionProgress(completedProgress + processingProgress);
    } else if (pendingDocs > 0) {
      // Show 10% for pending documents (waiting to start)
      const completedProgress = (completedDocs / totalDocs) * 100;
      const pendingProgress = (pendingDocs / totalDocs) * 10;
      setExtractionProgress(completedProgress + pendingProgress);
    } else {
      setExtractionProgress((completedDocs / totalDocs) * 100);
    }

    // If documents are processing, poll every 3 seconds
    if (hasProcessing) {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${API}/submissions/${submissionId}`);
          if (response.ok) {
            const updatedSubmission = await response.json();
            setSubmission(updatedSubmission);
            
            // Reload extracted fields if any documents completed
            const anyCompleted = updatedSubmission.documents?.some(
              (doc: Document) => doc.processingStatus === 'completed'
            );
            if (anyCompleted) {
              const fieldsResponse = await fetch(`${API}/submissions/${submissionId}/extracted-fields`);
              if (fieldsResponse.ok) {
                const fields = await fieldsResponse.json();
                setExtractedFields(fields);
                
                // Merge extracted fields into empty form fields
                const currentFormData = { ...updatedSubmission };
                const fieldsToSave: Record<string, unknown> = {};
                
                fields.forEach((field: ExtractedField) => {
                  const fieldName = field.fieldName as keyof Submission;
                  // Only use extracted value if field is empty/null
                  if (!currentFormData[fieldName] || currentFormData[fieldName] === '') {
                    (currentFormData as Record<string, unknown>)[fieldName] = field.fieldValue;
                    fieldsToSave[fieldName] = field.fieldValue;
                  }
                });
                
                // Save extracted fields to backend so they persist
                if (Object.keys(fieldsToSave).length > 0) {
                  fetch(`${API}/submissions/${submissionId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fieldsToSave),
                  }).catch(err => console.error('Failed to save extracted fields:', err));
                }
                
                // Update both submission and formData
                setSubmission(currentFormData);
                setFormData((prev) => {
                  const updated = { ...prev };
                  const numericFields = ['employeeCount', 'revenue', 'yearsInOperation', 'totalClaimsCount', 'totalClaimsLoss'];
                  fields.forEach((field: ExtractedField) => {
                    const fieldName = field.fieldName as keyof Submission;
                    if (!prev[fieldName] || prev[fieldName] === '') {
                      // Convert numeric fields from string to number
                      // Remove commas first (e.g., "1,250,000.00" -> "1250000.00")
                      const value = numericFields.includes(field.fieldName)
                        ? parseFloat(String(field.fieldValue).replace(/,/g, ''))
                        : field.fieldValue;
                      (updated as Record<string, unknown>)[fieldName] = value;
                    }
                  });
                  return updated;
                });
              }
            }
          }
        } catch (error) {
          console.error('Error polling document status:', error);
        }
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(pollInterval);
    }
  }, [submission, submissionId]);

  // Auto-save when debounced form data changes
  useEffect(() => {
    if (!submission || loading) return; // Don't save on initial load

    // Check if anything actually changed
    const hasChanges = Object.keys(debouncedFormData).some(
      (key) => debouncedFormData[key as keyof Submission] !== submission[key as keyof Submission]
    );

    if (hasChanges && Object.keys(debouncedFormData).length > 0) {
      autoSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFormData]);

  // Helper to check if a field was extracted
  function isFieldExtracted(fieldName: string): ExtractedField | null {
    const extracted = extractedFields.find(f => f.fieldName === fieldName);
    // Only show as extracted if the current value matches extracted value
    // (i.e., user hasn't edited it)
    if (extracted) {
      const formValue = formData[fieldName as keyof Submission];
      const extractedValue = extracted.fieldValue;
      
      // Normalize both values for comparison
      // Remove commas, spaces, and convert to numbers for numeric fields
      const numericFields = ['employeeCount', 'revenue', 'yearsInOperation', 'totalClaimsCount', 'totalClaimsLoss'];
      
      let valuesMatch = false;
      if (numericFields.includes(fieldName)) {
        // For numeric fields, parse both to numbers and compare
        const formNum = typeof formValue === 'number' ? formValue : parseFloat(String(formValue).replace(/,/g, ''));
        const extractedNum = parseFloat(String(extractedValue).replace(/,/g, ''));
        valuesMatch = !isNaN(formNum) && !isNaN(extractedNum) && formNum === extractedNum;
      } else {
        // For text fields, direct string comparison
        valuesMatch = String(formValue) === String(extractedValue);
      }
      
      if (valuesMatch) {
        return extracted;
      }
    }
    return null;
  }

  // Badge component for extracted fields
  function ExtractedBadge({ field }: { field: ExtractedField }) {
    const confidence = normalizeConfidence(field.confidence);
    const confidenceColor =
      confidence > 0.9 ? 'text-green-600' : confidence > 0.7 ? 'text-yellow-600' : 'text-orange-600';
    
    return (
      <div className="mb-1 flex items-center gap-2 text-xs">
        <button
          onClick={() => {
            setCurrentSource(field);
            setSourceModalOpen(true);
          }}
          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
          Extracted by AI Agent
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
        <span className="text-gray-500">
          from <span className="font-medium">{field.document.fileName}</span>
        </span>
        <span className={`font-medium ${confidenceColor}`}>
          {Math.round(confidence * 100)}% confidence
        </span>
      </div>
    );
  }

  // Helper to normalize values for comparison
  function normalizeValue(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const str = String(value).toLowerCase().trim();
    // Remove common punctuation and extra spaces
    return str.replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ');
  }

  // Helper to check if two values are meaningfully different
  function hasMeaningfulDifference(userValue: string | number | null | undefined, aiValue: string | number | null | undefined): boolean {
    const user = normalizeValue(userValue);
    const ai = normalizeValue(aiValue);
    
    if (!user || !ai) return false; // No conflict if either is empty
    if (user === ai) return false; // Exact match
    
    // Check for typos/minor differences (Levenshtein distance)
    const distance = levenshteinDistance(user, ai);
    const maxLength = Math.max(user.length, ai.length);
    const similarity = 1 - (distance / maxLength);
    
    // If similarity > 90%, consider it the same (typo)
    if (similarity > 0.9) return false;
    
    // Check if one contains the other (e.g., "10" vs "10 employees")
    if (user.includes(ai) || ai.includes(user)) {
      // But make sure it's not a significant addition
      const lengthDiff = Math.abs(user.length - ai.length);
      if (lengthDiff < 15) return false; // Small addition, not meaningful
    }
    
    return true; // Values are meaningfully different
  }

  // Levenshtein distance algorithm for string similarity
  function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Check if a field has a conflict
  function hasFieldConflict(fieldName: string): ExtractedField | null {
    const extracted = extractedFields.find(f => f.fieldName === fieldName);
    const userValue = formData[fieldName as keyof Submission];
    
    if (!extracted || !userValue) return null;
    
    // Check if there's a meaningful difference
    if (hasMeaningfulDifference(userValue, extracted.fieldValue)) {
      return extracted;
    }
    
    return null;
  }

  // Conflict Badge component
  function ConflictBadge({ fieldName, fieldLabel }: { fieldName: string; fieldLabel: string }) {
    const conflict = hasFieldConflict(fieldName);
    
    if (!conflict) return null;
    
    const userValue = String(formData[fieldName as keyof Submission] || '');
    
    return (
      <button
        type="button"
        onClick={() => {
          setCurrentConflict({
            fieldName,
            fieldLabel,
            userValue,
            aiValue: conflict.fieldValue,
            extracted: conflict,
          });
          setConflictModalOpen(true);
        }}
        className="mb-1 inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors text-xs cursor-pointer border border-amber-200"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        AI found different value
      </button>
    );
  }

  async function loadSubmission() {
    try {
      const response = await fetch(`${API}/submissions/${submissionId}`);
      if (!response.ok) {
        throw new Error('Failed to load submission');
      }
      const data = await response.json();
      
      // Fetch extracted fields
      const extractedResponse = await fetch(`${API}/submissions/${submissionId}/extracted-fields`);
      const extracted = extractedResponse.ok ? await extractedResponse.json() : [];
      setExtractedFields(extracted);
      
      // Merge extracted data into submission for empty fields
      const mergedData = { ...data };
      const fieldsToSave: Record<string, unknown> = {};
      const numericFields = ['employeeCount', 'revenue', 'yearsInOperation', 'totalClaimsCount', 'totalClaimsLoss'];
      
      extracted.forEach((field: ExtractedField) => {
        // Only use extracted value if user hasn't provided one
        if (!mergedData[field.fieldName] || mergedData[field.fieldName] === '') {
          // Convert numeric fields from string to number
          // Remove commas first (e.g., "1,250,000.00" -> "1250000.00")
          const value = numericFields.includes(field.fieldName)
            ? parseFloat(String(field.fieldValue).replace(/,/g, ''))
            : field.fieldValue;
          
          mergedData[field.fieldName] = value;
          fieldsToSave[field.fieldName] = value;
        }
      });
      
      // Save extracted fields to backend so they persist
      if (Object.keys(fieldsToSave).length > 0) {
        fetch(`${API}/submissions/${submissionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fieldsToSave),
        }).catch(err => console.error('Failed to save extracted fields:', err));
      }
      
      setSubmission(mergedData);
      
      // Generate overview from messages if not present
      if (!mergedData.overview && mergedData.messages && mergedData.messages.length > 0) {
        const generatedOverview = generateOverviewFromMessages(mergedData);
        mergedData.overview = generatedOverview;
        // Update in background
        fetch(`${API}/submissions/${submissionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ overview: generatedOverview }),
        });
      }
      
      setFormData(mergedData); // Initialize form with merged data
      
      // Initialize selected coverages
      if (mergedData.insuranceNeeds) {
        setSelectedCoverages(mergedData.insuranceNeeds.split(','));
      }
    } catch (error) {
      console.error('Error loading submission:', error);
      alert('Failed to load submission');
    } finally {
      setLoading(false);
    }
  }

  function generateOverviewFromMessages(data: Submission): string {
    if (!data.messages || data.messages.length === 0) {
      return data.overview || '';
    }

    const parts: string[] = [];
    
    parts.push(`${data.businessName} is a business`);
    
    if (data.industryLabel) {
      parts.push(`in the ${data.industryLabel.toLowerCase()} industry`);
    }
    
    if (data.employeeCount) {
      parts.push(`with ${data.employeeCount} employees`);
    }
    
    if (data.address && data.city && data.state) {
      parts.push(`located in ${data.city}, ${data.state}`);
    }
    
    if (data.insuranceNeeds) {
      const needs = data.insuranceNeeds.split(',').map(need => 
        need.replace(/_/g, ' ')
      );
      parts.push(`seeking coverage for ${needs.join(', ')}`);
    }

    return parts.join(' ') + '.';
  }

  async function autoSave() {
    setSaveStatus('saving');

    try {
      // List of readonly fields that should not be sent to the API
      const readonlyFields = ['id', 'createdAt', 'updatedAt', 'status', 'messages', 'documents'];
      
      // Only save non-empty data, excluding readonly fields
      const dataToSave = Object.keys(debouncedFormData).reduce<Partial<Submission>>((acc, key) => {
        // Skip readonly fields
        if (readonlyFields.includes(key)) {
          return acc;
        }
        
        const value = debouncedFormData[key as keyof Submission];
        if (value !== undefined && value !== null && value !== '') {
          (acc as Record<string, unknown>)[key] = value;
        }
        return acc;
      }, {});

      // Skip if no data to save
      if (Object.keys(dataToSave).length === 0) {
        setSaveStatus('idle');
        return;
      }

      const response = await fetch(`${API}/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Save failed:', errorText);
        throw new Error(`Failed to save: ${response.status}`);
      }

      const updated = await response.json();
      setSubmission(updated);
      setSaveStatus('saved');

      // Clear "saved" status after 2 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Error saving:', error);
      setSaveStatus('error');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    
    // Handle numeric fields
    const numericFields = ['employeeCount', 'revenue', 'yearsInOperation', 'totalClaimsCount', 'totalClaimsLoss'];
    const updatedValue = numericFields.includes(name)
      ? (value === '' ? null : Number(value))
      : value;

    setFormData((prev) => ({
      ...prev,
      [name]: updatedValue,
    }));
  }

  async function toggleCoverage(coverageId: string) {
    const newCoverages = selectedCoverages.includes(coverageId)
      ? selectedCoverages.filter((id) => id !== coverageId)
      : [...selectedCoverages, coverageId];
    
    setSelectedCoverages(newCoverages);
    
    // Save immediately (bypass debounce for better UX)
    try {
      const response = await fetch(`${API}/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insuranceNeeds: newCoverages.join(',') }),
      });

      if (!response.ok) {
        throw new Error('Failed to save coverage');
      }

      const updated = await response.json();
      setSubmission(updated);
      
      // Update form data to keep in sync
      setFormData((prev) => ({
        ...prev,
        insuranceNeeds: newCoverages.join(','),
      }));
    } catch (error) {
      console.error('Error saving coverage:', error);
      // Revert on error
      setSelectedCoverages(selectedCoverages);
      alert('Failed to update coverage. Please try again.');
    }
  }

  async function acceptAiValue() {
    if (!currentConflict) return;
    
    try {
      // Update form data with AI value
      const updatedFormData = {
        ...formData,
        [currentConflict.fieldName]: currentConflict.aiValue,
      };
      
      setFormData(updatedFormData);
      
      // Save to backend immediately
      const response = await fetch(`${API}/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [currentConflict.fieldName]: currentConflict.aiValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to save AI value');
      }

      const updated = await response.json();
      setSubmission(updated);
      
      // Close modal
      setConflictModalOpen(false);
      setCurrentConflict(null);
    } catch (error) {
      console.error('Error accepting AI value:', error);
      alert('Failed to update with AI value. Please try again.');
    }
  }

  async function handleSendForQuote() {
    try {
      // Save any pending changes first
      if (Object.keys(debouncedFormData).length > 0) {
        await fetch(`${API}/submissions/${submissionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(debouncedFormData),
        });
      }

      // Update status to submitted
      await fetch(`${API}/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_review' }),
      });

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error sending for quote:', error);
      alert('Failed to submit. Please try again.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading submission...</p>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-lg">Submission not found</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-blue-600 hover:underline"
          >
            ← Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:underline text-sm mb-2 inline-block"
            >
              ← Back to submissions
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{submission.businessName}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Created {new Date(submission.createdAt).toLocaleDateString()}
              {' • '}
              Status: <span className="font-semibold capitalize">{submission.status}</span>
            </p>
          </div>

          {/* Save Status Indicator */}
          <div className="text-right">
            {saveStatus === 'saving' && (
              <span className="text-sm text-gray-600 flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-sm text-green-600 flex items-center gap-2">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-red-600">Failed to save</span>
            )}
          </div>
        </div>

        {/* Document Extraction Status */}
        {submission.documents && submission.documents.length > 0 && (() => {
          const processingDocs = submission.documents.filter(
            (doc) => doc.processingStatus === 'processing' || doc.processingStatus === 'pending'
          );
          const completedDocs = submission.documents.filter((doc) => doc.processingStatus === 'completed');
          const failedDocs = submission.documents.filter((doc) => doc.processingStatus === 'failed');

          if (processingDocs.length === 0 && failedDocs.length === 0 && completedDocs.length > 0) {
            return (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-green-900">AI Extraction Complete</h3>
                    <p className="text-sm text-green-700 mt-1">
                      Successfully extracted information from {completedDocs.length} document{completedDocs.length > 1 ? 's' : ''}. 
                      Fields marked with &ldquo;🤖 Extracted by AI Agent&rdquo; were automatically filled.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          if (processingDocs.length > 0) {
            return (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-blue-900">AI Agent is Extracting Information</h3>
                      <span className="text-sm font-medium text-blue-700">{Math.round(extractionProgress)}%</span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-blue-200 rounded-full h-2 mb-3">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${extractionProgress}%` }}
                      ></div>
                    </div>
                    
                    <p className="text-sm text-blue-700 mb-2">
                      Processing {processingDocs.length} document{processingDocs.length > 1 ? 's' : ''}... 
                      This may take a couple of minutes. We recommend waiting for processing to finish before submitting.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {processingDocs.map((doc) => (
                        <span key={doc.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {doc.fileName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (failedDocs.length > 0) {
            return (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-red-900">Extraction Failed</h3>
                    <p className="text-sm text-red-700 mt-1">
                      Failed to process {failedDocs.length} document{failedDocs.length > 1 ? 's' : ''}. 
                      Please review and enter information manually.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })()}

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-8 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 pb-2 border-b">Business Information</h2>

          {/* Business Name */}
          <div>
            <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-2">
              Business Name
            </label>
            {isFieldExtracted('businessName') && (
              <ExtractedBadge field={isFieldExtracted('businessName')!} />
            )}
            <ConflictBadge fieldName="businessName" fieldLabel="Business Name" />
            <input
              type="text"
              id="businessName"
              name="businessName"
              value={formData.businessName || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Address */}
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
              Street Address
            </label>
            {isFieldExtracted('address') && (
              <ExtractedBadge field={isFieldExtracted('address')!} />
            )}
            <ConflictBadge fieldName="address" fieldLabel="Street Address" />
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* City, State, ZIP */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              {isFieldExtracted('city') && (
                <ExtractedBadge field={isFieldExtracted('city')!} />
              )}
              <ConflictBadge fieldName="city" fieldLabel="City" />
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              {isFieldExtracted('state') && (
                <ExtractedBadge field={isFieldExtracted('state')!} />
              )}
              <ConflictBadge fieldName="state" fieldLabel="State" />
              <input
                type="text"
                id="state"
                name="state"
                maxLength={2}
                value={formData.state || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              />
            </div>

            <div>
              <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-2">
                ZIP Code
              </label>
              {isFieldExtracted('zip') && (
                <ExtractedBadge field={isFieldExtracted('zip')!} />
              )}
              <ConflictBadge fieldName="zip" fieldLabel="ZIP Code" />
              <input
                type="text"
                id="zip"
                name="zip"
                value={formData.zip || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Overview */}
          <div>
            <label htmlFor="overview" className="block text-sm font-medium text-gray-700 mb-2">
              Business Overview
            </label>
            <textarea
              id="overview"
              name="overview"
              rows={4}
              value={formData.overview || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Employee Count, Years in Operation, & Revenue */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="employeeCount" className="block text-sm font-medium text-gray-700 mb-2">
                Number of Employees <span className="text-red-500">*</span>
              </label>
              {isFieldExtracted('employeeCount') && (
                <ExtractedBadge field={isFieldExtracted('employeeCount')!} />
              )}
              <ConflictBadge fieldName="employeeCount" fieldLabel="Number of Employees" />
              <input
                type="number"
                id="employeeCount"
                name="employeeCount"
                min="0"
                value={formData.employeeCount || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 50"
              />
            </div>

            <div>
              <label htmlFor="yearsInOperation" className="block text-sm font-medium text-gray-700 mb-2">
                Years in Operation <span className="text-red-500">*</span>
              </label>
              {isFieldExtracted('yearsInOperation') && (
                <ExtractedBadge field={isFieldExtracted('yearsInOperation')!} />
              )}
              <ConflictBadge fieldName="yearsInOperation" fieldLabel="Years in Operation" />
              <input
                type="number"
                id="yearsInOperation"
                name="yearsInOperation"
                min="0"
                value={formData.yearsInOperation || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 5"
              />
            </div>

            <div>
              <label htmlFor="revenue" className="block text-sm font-medium text-gray-700 mb-2">
                Annual Revenue ($)
              </label>
              {isFieldExtracted('revenue') && (
                <ExtractedBadge field={isFieldExtracted('revenue')!} />
              )}
              <ConflictBadge fieldName="revenue" fieldLabel="Annual Revenue" />
              <input
                type="number"
                id="revenue"
                name="revenue"
                min="0"
                step="0.01"
                value={formData.revenue || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 1500000"
              />
            </div>
          </div>

          {/* Industry */}
          {submission.industryLabel && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Industry
              </label>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-sm font-medium text-purple-900">
                  {submission.industryLabel}
                  {submission.industryCode && (
                    <span className="ml-2 text-purple-600">(NAICS {submission.industryCode})</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Insurance Coverage Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Insurance Coverage Needed <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Click on any coverage to add or remove it
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_COVERAGES.map((coverage) => {
                const isSelected = selectedCoverages.includes(coverage.id);
                return (
                  <button
                    key={coverage.id}
                    type="button"
                    onClick={() => toggleCoverage(coverage.id)}
                    className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-green-100 text-green-800 border-2 border-green-300'
                        : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {coverage.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
          </div>

          {/* Current Coverages */}
          <div>
            <label htmlFor="currentCoverages" className="block text-sm font-medium text-gray-700 mb-2">
              Current Insurance Coverages
              <span className="text-xs text-gray-500 ml-2">(If any)</span>
            </label>
            <input
              type="text"
              id="currentCoverages"
              name="currentCoverages"
              value={formData.currentCoverages || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., General Liability with State Farm"
            />
          </div>

          {/* Claims History */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="totalClaimsCount" className="block text-sm font-medium text-gray-700 mb-2">
                Total Claims (Last 3-5 years)
                <span className="text-xs text-gray-500 ml-2">(Nice to have)</span>
              </label>
              {isFieldExtracted('totalClaimsCount') && (
                <ExtractedBadge field={isFieldExtracted('totalClaimsCount')!} />
              )}
              <ConflictBadge fieldName="totalClaimsCount" fieldLabel="Total Claims Count" />
              <input
                type="number"
                id="totalClaimsCount"
                name="totalClaimsCount"
                min="0"
                value={formData.totalClaimsCount ?? ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 3"
              />
            </div>

            <div>
              <label htmlFor="totalClaimsLoss" className="block text-sm font-medium text-gray-700 mb-2">
                Total Claims Loss ($)
                <span className="text-xs text-gray-500 ml-2">(Nice to have)</span>
              </label>
              {isFieldExtracted('totalClaimsLoss') && (
                <ExtractedBadge field={isFieldExtracted('totalClaimsLoss')!} />
              )}
              <ConflictBadge fieldName="totalClaimsLoss" fieldLabel="Total Claims Loss" />
              <input
                type="number"
                id="totalClaimsLoss"
                name="totalClaimsLoss"
                min="0"
                step="0.01"
                value={formData.totalClaimsLoss ?? ''}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 25000"
              />
            </div>
          </div>

          {/* Risk Tolerance */}
          <div>
            <label htmlFor="riskToleranceLevel" className="block text-sm font-medium text-gray-700 mb-2">
              Risk Tolerance Level
            </label>
            <select
              id="riskToleranceLevel"
              name="riskToleranceLevel"
              value={formData.riskToleranceLevel || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select risk tolerance...</option>
              <option value="low">Low (Higher premium, lower deductible)</option>
              <option value="medium">Medium (Balanced)</option>
              <option value="high">High (Lower premium, higher deductible)</option>
            </select>
          </div>

          {/* Key Assets */}
          <div>
            <label htmlFor="keyAssets" className="block text-sm font-medium text-gray-700 mb-2">
              Key Assets
              <span className="text-xs text-gray-500 ml-2">(Equipment, vehicles, property, etc.)</span>
            </label>
            <textarea
              id="keyAssets"
              name="keyAssets"
              rows={3}
              value={formData.keyAssets || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="e.g., Fleet of 10 trucks, warehouse building"
            />
          </div>

          {/* Digital Infrastructure */}
          <div>
            <label htmlFor="digitalInfrastructureProfile" className="block text-sm font-medium text-gray-700 mb-2">
              Digital Infrastructure & Cybersecurity
            </label>
            <textarea
              id="digitalInfrastructureProfile"
              name="digitalInfrastructureProfile"
              rows={3}
              value={formData.digitalInfrastructureProfile || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="e.g., Cloud-based CRM, basic firewall, no sensitive customer data stored"
            />
          </div>

          {/* Growth Plans */}
          <div>
            <label htmlFor="growthPlans" className="block text-sm font-medium text-gray-700 mb-2">
              Growth Plans & Expansion
            </label>
            <textarea
              id="growthPlans"
              name="growthPlans"
              rows={3}
              value={formData.growthPlans || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="e.g., Planning to open 2 new locations next year, hiring 20 more employees"
            />
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentation & Compliance</h3>
          </div>

          {/* Tax ID */}
          <div>
            <label htmlFor="taxId" className="block text-sm font-medium text-gray-700 mb-2">
              Tax ID (EIN)
            </label>
            {isFieldExtracted('taxId') && (
              <ExtractedBadge field={isFieldExtracted('taxId')!} />
            )}
            <ConflictBadge fieldName="taxId" fieldLabel="Tax ID (EIN)" />
            <input
              type="text"
              id="taxId"
              name="taxId"
              value={formData.taxId || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 12-3456789"
            />
          </div>

          {/* Ownership Structure */}
          <div>
            <label htmlFor="ownershipStructure" className="block text-sm font-medium text-gray-700 mb-2">
              Ownership Structure
            </label>
            <textarea
              id="ownershipStructure"
              name="ownershipStructure"
              rows={2}
              value={formData.ownershipStructure || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="e.g., John Doe 60%, Jane Smith 40%"
            />
          </div>

          {/* Employee List Summary */}
          <div>
            <label htmlFor="employeeList" className="block text-sm font-medium text-gray-700 mb-2">
              Employee Summary
              <span className="text-xs text-gray-500 ml-2">(De-identified, by role/department)</span>
            </label>
            <textarea
              id="employeeList"
              name="employeeList"
              rows={2}
              value={formData.employeeList || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="e.g., 20 office staff, 30 field workers"
            />
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status || 'draft'}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="draft">Draft</option>
              <option value="in_review">In Review</option>
              <option value="quoted">Quoted</option>
              <option value="bound">Bound</option>
            </select>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">💡 Auto-save enabled:</span> All changes are automatically saved after you stop typing.
          </p>
        </div>

        {/* Send for Quote Button */}
        <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Ready to get quotes?
              </h3>
              <p className="text-sm text-gray-600">
                We&apos;ll send your information to multiple insurers to get you the best rates.
              </p>
            </div>
            <button
              onClick={handleSendForQuote}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg shadow-lg hover:shadow-xl"
            >
              Send Out for Quote →
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 relative animate-fade-in">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowSuccessModal(false);
                router.push('/intake');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Success Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Success Message */}
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Submission Sent!
            </h2>
            <p className="text-center text-gray-600 mb-6">
              Your submission has been sent to multiple insurance carriers. We&apos;ll reach out to you within 24-48 hours with competitive quotes.
            </p>

            {/* Submission Details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-semibold">Business:</span> {submission?.businessName}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-semibold">Coverages:</span> {selectedCoverages.length} selected
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Status:</span> In Review
              </p>
            </div>

            {/* Action Button */}
            <button
              onClick={() => {
                setShowSuccessModal(false);
                router.push('/intake');
              }}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Start Another Submission
            </button>
          </div>
        </div>
      )}

      {/* Conflict Modal */}
      {conflictModalOpen && currentConflict && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-8 relative animate-fade-in">
            {/* Close Button */}
            <button
              onClick={() => {
                setConflictModalOpen(false);
                setCurrentConflict(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Icon */}
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Different Values Found
            </h2>
            <p className="text-center text-gray-600 mb-6">
              The AI agent found a different value for <span className="font-semibold">{currentConflict.fieldLabel}</span> in your documents.
            </p>

            {/* Comparison */}
            <div className="space-y-4 mb-8">
              {/* Your Value */}
              <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold text-blue-900">Your Value:</span>
                </div>
                <div className="text-lg text-blue-900 font-mono bg-white rounded p-3 border border-blue-200">
                  {currentConflict.userValue}
                </div>
              </div>

              {/* AI Value */}
              <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  <span className="font-semibold text-green-900">AI Agent Found:</span>
                </div>
                <div className="text-lg text-green-900 font-mono bg-white rounded p-3 border border-green-200">
                  {currentConflict.aiValue}
                </div>
                <div className="mt-2 text-sm text-green-700">
                  <span className="font-medium">Source:</span> {currentConflict.extracted.document.fileName}
                  <span className="ml-2">
                    • <span className="font-medium">Confidence:</span>{' '}
                    {Math.round(normalizeConfidence(currentConflict.extracted.confidence) * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {/* See Source Button */}
              <button
                onClick={() => {
                  setCurrentSource(currentConflict.extracted);
                  setSourceModalOpen(true);
                }}
                className="w-full px-6 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-semibold border-2 border-blue-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Source Document
              </button>
              
              {/* Decision Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setConflictModalOpen(false);
                    setCurrentConflict(null);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  Keep My Value
                </button>
                <button
                  onClick={acceptAiValue}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  Use AI Value
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Source Document Modal */}
      {sourceModalOpen && currentSource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Source Document</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Extracted from: <span className="font-semibold">{currentSource.document.fileName}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setSourceModalOpen(false);
                  setCurrentSource(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Field Info */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-1">Extracted Field</h3>
                    <div className="text-sm text-blue-800">
                      <div className="mb-2">
                        <span className="font-medium">Field:</span> <span className="font-mono bg-white px-2 py-0.5 rounded">{currentSource.fieldName}</span>
                      </div>
                      <div className="mb-2">
                        <span className="font-medium">Value:</span> <span className="font-mono bg-white px-2 py-0.5 rounded">{currentSource.fieldValue}</span>
                      </div>
                      <div>
                        <span className="font-medium">Confidence:</span>{' '}
                        {Math.round(normalizeConfidence(currentSource.confidence) * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Source Location */}
              {currentSource.source && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Location in Document
                  </h3>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
                    {currentSource.source}
                  </p>
                </div>
              )}

              {/* Extracted Text */}
              {currentSource.extractedText && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Text Excerpt from Document
                  </h3>
                  <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                      {(() => {
                        // Highlight the extracted value within the text
                        const text = currentSource.extractedText;
                        const value = String(currentSource.fieldValue);
                        
                        // Try to find the value in the text (case-insensitive)
                        const lowerText = text.toLowerCase();
                        const lowerValue = value.toLowerCase();
                        let index = lowerText.indexOf(lowerValue);
                        
                        // If exact match not found, try finding numeric value with different formatting
                        if (index === -1 && !isNaN(parseFloat(value.replace(/,/g, '')))) {
                          // For numeric values, try to find with/without commas and decimals
                          const numericValue = value.replace(/,/g, '');
                          const patterns = [
                            value, // Original format
                            numericValue, // Without commas
                            parseFloat(numericValue).toString(), // Simplified number
                          ];
                          
                          for (const pattern of patterns) {
                            index = lowerText.indexOf(pattern.toLowerCase());
                            if (index !== -1) break;
                          }
                        }
                        
                        if (index !== -1) {
                          const before = text.substring(0, index);
                          const match = text.substring(index, index + value.length);
                          const after = text.substring(index + value.length);
                          
                          return (
                            <>
                              {before}
                              <span className="bg-yellow-200 font-bold px-1 rounded">
                                {match}
                              </span>
                              {after}
                            </>
                          );
                        }
                        
                        // If still no match found, just return the text with a note
                        return (
                          <>
                            {text}
                            <div className="mt-2 text-xs text-amber-600 italic">
                              Note: Could not locate exact value in excerpt. The value may have been derived or formatted.
                            </div>
                          </>
                        );
                      })()}
                    </pre>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    This is the surrounding text where the AI agent found the extracted value.
                  </p>
                </div>
              )}

              {/* No source data message */}
              {!currentSource.source && !currentSource.extractedText && (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No source location or text excerpt available for this field.</p>
                  <p className="text-sm mt-1">The value was extracted but detailed source information wasn't saved.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setSourceModalOpen(false);
                  setCurrentSource(null);
                }}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

