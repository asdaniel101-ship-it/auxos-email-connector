'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
  
  // Metadata
  status: string;
  createdAt: string;
  updatedAt: string;
  documents?: Array<{
    id: string;
    fileName: string;
    fileKey: string;
    fileSize: number;
    mimeType: string;
    documentType?: string;
    processingStatus: string;
    processingError?: string;
    createdAt: string;
  }>;
  messages?: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
};

type ExtractedField = {
  id: string;
  fieldName: string;
  fieldValue: string;
  confidence: number;
  source: string;
  extractedText: string;
  document: {
    fileName: string;
  };
};

// Mock similar submissions data
const mockSimilarSubmissions = [
  {
    id: 'similar-1',
    companyName: 'TechCorp Solutions',
    employeeCount: 25,
    industry: 'Technology',
    quotePrice: 68000
  },
  {
    id: 'similar-2', 
    companyName: 'DataFlow Inc',
    employeeCount: 18,
    industry: 'Technology',
    quotePrice: 72000
  },
  {
    id: 'similar-3',
    companyName: 'CloudTech Partners',
    employeeCount: 32,
    industry: 'Technology', 
    quotePrice: 89000
  }
];

export default function CarrierSubmissionDetail() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const [formData, setFormData] = useState<Partial<Submission>>({});
  const [loading, setLoading] = useState(true);
  const [showProceedModal, setShowProceedModal] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<{
    fieldName: string;
    userValue: any;
    extracted: ExtractedField;
  } | null>(null);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [currentSource, setCurrentSource] = useState<ExtractedField | null>(null);

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  async function loadSubmission() {
    try {
      const response = await fetch(`${API}/submissions/${submissionId}`);
      if (!response.ok) throw new Error('Failed to load submission');
      
      const data = await response.json();
      setSubmission(data);
      setFormData(data);

      // Load extracted fields
      const extractedResponse = await fetch(`${API}/submissions/${submissionId}/extracted-fields`);
      if (extractedResponse.ok) {
        const extractedData = await extractedResponse.json();
        setExtractedFields(extractedData);
      }
    } catch (error) {
      console.error('Error loading submission:', error);
    } finally {
      setLoading(false);
    }
  }

  function isFieldExtracted(fieldName: string): ExtractedField | null {
    const extracted = extractedFields.find(f => f.fieldName === fieldName);
    if (extracted) {
      const formValue = formData[fieldName as keyof Submission];
      const extractedValue = extracted.fieldValue;

      const numericFields = ['employeeCount', 'revenue', 'yearsInOperation', 'totalClaimsCount', 'totalClaimsLoss'];

      let valuesMatch = false;
      if (numericFields.includes(fieldName)) {
        const formNum = typeof formValue === 'number' ? formValue : parseFloat(String(formValue).replace(/,/g, ''));
        const extractedNum = parseFloat(String(extractedValue).replace(/,/g, ''));
        valuesMatch = !isNaN(formNum) && !isNaN(extractedNum) && formNum === extractedNum;
      } else {
        valuesMatch = String(formValue) === String(extractedValue);
      }

      if (valuesMatch) {
        return extracted;
      }
    }
    return null;
  }

  function hasFieldConflict(fieldName: string): ExtractedField | null {
    const extracted = extractedFields.find(f => f.fieldName === fieldName);
    if (extracted) {
      const formValue = formData[fieldName as keyof Submission];
      const extractedValue = extracted.fieldValue;

      const numericFields = ['employeeCount', 'revenue', 'yearsInOperation', 'totalClaimsCount', 'totalClaimsLoss'];

      let valuesMatch = false;
      if (numericFields.includes(fieldName)) {
        const formNum = typeof formValue === 'number' ? formValue : parseFloat(String(formValue).replace(/,/g, ''));
        const extractedNum = parseFloat(String(extractedValue).replace(/,/g, ''));
        valuesMatch = !isNaN(formNum) && !isNaN(extractedNum) && formNum === extractedNum;
      } else {
        valuesMatch = String(formValue) === String(extractedValue);
      }

      if (!valuesMatch && formValue && String(formValue).trim() !== '') {
        return extracted;
      }
    }
    return null;
  }

  function ExtractedBadge({ field }: { field: ExtractedField }) {
    const confidence = field.confidence;
    const confidenceColor = confidence >= 0.8 ? 'text-green-700' : confidence >= 0.6 ? 'text-yellow-700' : 'text-red-700';
    
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
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
          Extracted by AI Agent
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
        <span className={`font-medium ${confidenceColor}`}>
          {Math.round(confidence * 100)}% confidence
        </span>
      </div>
    );
  }

  function ConflictBadge({ field }: { field: ExtractedField }) {
    return (
      <div className="mb-1 flex items-center gap-2 text-xs">
        <button
          onClick={() => {
            const formValue = formData[field.fieldName as keyof Submission];
            setCurrentConflict({
              fieldName: field.fieldName,
              userValue: formValue,
              extracted: field
            });
            setConflictModalOpen(true);
          }}
          className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded hover:bg-orange-100 transition-colors cursor-pointer border border-orange-200"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          AI suggests different value
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      </div>
    );
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Submission Not Found</h1>
          <Link href="/carrier" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <Link href="/carrier" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
                ← Back to Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">{submission.businessName}</h1>
              <p className="text-gray-600 mt-1">Submission Review & Quote</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Carrier Review</span>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">C</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Business Information */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Business Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Business Name */}
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-2">
                Business Name
              </label>
              {isFieldExtracted('businessName') && <ExtractedBadge field={isFieldExtracted('businessName')!} />}
              {hasFieldConflict('businessName') && <ConflictBadge field={hasFieldConflict('businessName')!} />}
              <input
                type="text"
                id="businessName"
                value={formData.businessName || ''}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Address */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Street Address
              </label>
              {isFieldExtracted('address') && <ExtractedBadge field={isFieldExtracted('address')!} />}
              {hasFieldConflict('address') && <ConflictBadge field={hasFieldConflict('address')!} />}
              <input
                type="text"
                id="address"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* City */}
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              {isFieldExtracted('city') && <ExtractedBadge field={isFieldExtracted('city')!} />}
              {hasFieldConflict('city') && <ConflictBadge field={hasFieldConflict('city')!} />}
              <input
                type="text"
                id="city"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* State */}
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              {isFieldExtracted('state') && <ExtractedBadge field={isFieldExtracted('state')!} />}
              {hasFieldConflict('state') && <ConflictBadge field={hasFieldConflict('state')!} />}
              <input
                type="text"
                id="state"
                value={formData.state || ''}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* ZIP */}
            <div>
              <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-2">
                ZIP Code
              </label>
              {isFieldExtracted('zip') && <ExtractedBadge field={isFieldExtracted('zip')!} />}
              {hasFieldConflict('zip') && <ConflictBadge field={hasFieldConflict('zip')!} />}
              <input
                type="text"
                id="zip"
                value={formData.zip || ''}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Business Overview */}
            <div className="md:col-span-2">
              <label htmlFor="overview" className="block text-sm font-medium text-gray-700 mb-2">
                Business Overview
              </label>
              {isFieldExtracted('overview') && <ExtractedBadge field={isFieldExtracted('overview')!} />}
              {hasFieldConflict('overview') && <ConflictBadge field={hasFieldConflict('overview')!} />}
              <textarea
                id="overview"
                value={formData.overview || ''}
                onChange={(e) => setFormData({ ...formData, overview: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Employee Count */}
            <div>
              <label htmlFor="employeeCount" className="block text-sm font-medium text-gray-700 mb-2">
                Number of Employees <span className="text-red-500">*</span>
              </label>
              {isFieldExtracted('employeeCount') && <ExtractedBadge field={isFieldExtracted('employeeCount')!} />}
              {hasFieldConflict('employeeCount') && <ConflictBadge field={hasFieldConflict('employeeCount')!} />}
              <input
                type="number"
                id="employeeCount"
                value={formData.employeeCount || ''}
                onChange={(e) => setFormData({ ...formData, employeeCount: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Years in Operation */}
            <div>
              <label htmlFor="yearsInOperation" className="block text-sm font-medium text-gray-700 mb-2">
                Years in Operation <span className="text-red-500">*</span>
              </label>
              {isFieldExtracted('yearsInOperation') && <ExtractedBadge field={isFieldExtracted('yearsInOperation')!} />}
              {hasFieldConflict('yearsInOperation') && <ConflictBadge field={hasFieldConflict('yearsInOperation')!} />}
              <input
                type="number"
                id="yearsInOperation"
                value={formData.yearsInOperation || ''}
                onChange={(e) => setFormData({ ...formData, yearsInOperation: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Revenue */}
            <div>
              <label htmlFor="revenue" className="block text-sm font-medium text-gray-700 mb-2">
                Annual Revenue ($)
              </label>
              {isFieldExtracted('revenue') && <ExtractedBadge field={isFieldExtracted('revenue')!} />}
              {hasFieldConflict('revenue') && <ConflictBadge field={hasFieldConflict('revenue')!} />}
              <input
                type="number"
                id="revenue"
                value={formData.revenue || ''}
                onChange={(e) => setFormData({ ...formData, revenue: parseFloat(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Industry */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Industry
              </label>
              {isFieldExtracted('industryLabel') && <ExtractedBadge field={isFieldExtracted('industryLabel')!} />}
              {hasFieldConflict('industryLabel') && <ConflictBadge field={hasFieldConflict('industryLabel')!} />}
              <input
                type="text"
                value={formData.industryLabel || ''}
                onChange={(e) => setFormData({ ...formData, industryLabel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Insurance Coverage Needed */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Insurance Coverage Needed <span className="text-red-500">*</span>
              </label>
              {isFieldExtracted('insuranceNeeds') && <ExtractedBadge field={isFieldExtracted('insuranceNeeds')!} />}
              {hasFieldConflict('insuranceNeeds') && <ConflictBadge field={hasFieldConflict('insuranceNeeds')!} />}
              <textarea
                value={formData.insuranceNeeds || ''}
                onChange={(e) => setFormData({ ...formData, insuranceNeeds: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the types of insurance coverage your business needs..."
              />
            </div>

            {/* Current Coverages */}
            <div className="md:col-span-2">
              <label htmlFor="currentCoverages" className="block text-sm font-medium text-gray-700 mb-2">
                Current Insurance Coverages
                <span className="text-xs text-gray-500 ml-2">(If any)</span>
              </label>
              {isFieldExtracted('currentCoverages') && <ExtractedBadge field={isFieldExtracted('currentCoverages')!} />}
              {hasFieldConflict('currentCoverages') && <ConflictBadge field={hasFieldConflict('currentCoverages')!} />}
              <textarea
                id="currentCoverages"
                value={formData.currentCoverages || ''}
                onChange={(e) => setFormData({ ...formData, currentCoverages: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="List any existing insurance policies..."
              />
            </div>

            {/* Claims Count */}
            <div>
              <label htmlFor="totalClaimsCount" className="block text-sm font-medium text-gray-700 mb-2">
                Total Claims (Last 3-5 years)
                <span className="text-xs text-gray-500 ml-2">(Nice to have)</span>
              </label>
              {isFieldExtracted('totalClaimsCount') && <ExtractedBadge field={isFieldExtracted('totalClaimsCount')!} />}
              {hasFieldConflict('totalClaimsCount') && <ConflictBadge field={hasFieldConflict('totalClaimsCount')!} />}
              <input
                type="number"
                id="totalClaimsCount"
                value={formData.totalClaimsCount || ''}
                onChange={(e) => setFormData({ ...formData, totalClaimsCount: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Claims Loss */}
            <div>
              <label htmlFor="totalClaimsLoss" className="block text-sm font-medium text-gray-700 mb-2">
                Total Claims Loss ($)
                <span className="text-xs text-gray-500 ml-2">(Nice to have)</span>
              </label>
              {isFieldExtracted('totalClaimsLoss') && <ExtractedBadge field={isFieldExtracted('totalClaimsLoss')!} />}
              {hasFieldConflict('totalClaimsLoss') && <ConflictBadge field={hasFieldConflict('totalClaimsLoss')!} />}
              <input
                type="number"
                id="totalClaimsLoss"
                value={formData.totalClaimsLoss || ''}
                onChange={(e) => setFormData({ ...formData, totalClaimsLoss: parseFloat(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Risk Tolerance */}
            <div>
              <label htmlFor="riskToleranceLevel" className="block text-sm font-medium text-gray-700 mb-2">
                Risk Tolerance Level
              </label>
              {isFieldExtracted('riskToleranceLevel') && <ExtractedBadge field={isFieldExtracted('riskToleranceLevel')!} />}
              {hasFieldConflict('riskToleranceLevel') && <ConflictBadge field={hasFieldConflict('riskToleranceLevel')!} />}
              <select
                id="riskToleranceLevel"
                value={formData.riskToleranceLevel || ''}
                onChange={(e) => setFormData({ ...formData, riskToleranceLevel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select risk tolerance...</option>
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>

            {/* Key Assets */}
            <div className="md:col-span-2">
              <label htmlFor="keyAssets" className="block text-sm font-medium text-gray-700 mb-2">
                Key Assets
                <span className="text-xs text-gray-500 ml-2">(Equipment, vehicles, property, etc.)</span>
              </label>
              {isFieldExtracted('keyAssets') && <ExtractedBadge field={isFieldExtracted('keyAssets')!} />}
              {hasFieldConflict('keyAssets') && <ConflictBadge field={hasFieldConflict('keyAssets')!} />}
              <textarea
                id="keyAssets"
                value={formData.keyAssets || ''}
                onChange={(e) => setFormData({ ...formData, keyAssets: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe your business assets..."
              />
            </div>

            {/* Digital Infrastructure */}
            <div className="md:col-span-2">
              <label htmlFor="digitalInfrastructureProfile" className="block text-sm font-medium text-gray-700 mb-2">
                Digital Infrastructure & Cybersecurity
              </label>
              {isFieldExtracted('digitalInfrastructureProfile') && <ExtractedBadge field={isFieldExtracted('digitalInfrastructureProfile')!} />}
              {hasFieldConflict('digitalInfrastructureProfile') && <ConflictBadge field={hasFieldConflict('digitalInfrastructureProfile')!} />}
              <textarea
                id="digitalInfrastructureProfile"
                value={formData.digitalInfrastructureProfile || ''}
                onChange={(e) => setFormData({ ...formData, digitalInfrastructureProfile: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe your IT infrastructure and cybersecurity measures..."
              />
            </div>

            {/* Growth Plans */}
            <div className="md:col-span-2">
              <label htmlFor="growthPlans" className="block text-sm font-medium text-gray-700 mb-2">
                Growth Plans & Expansion
              </label>
              {isFieldExtracted('growthPlans') && <ExtractedBadge field={isFieldExtracted('growthPlans')!} />}
              {hasFieldConflict('growthPlans') && <ConflictBadge field={hasFieldConflict('growthPlans')!} />}
              <textarea
                id="growthPlans"
                value={formData.growthPlans || ''}
                onChange={(e) => setFormData({ ...formData, growthPlans: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe your business growth plans..."
              />
            </div>

            {/* Tax ID */}
            <div>
              <label htmlFor="taxId" className="block text-sm font-medium text-gray-700 mb-2">
                Tax ID (EIN)
              </label>
              {isFieldExtracted('taxId') && <ExtractedBadge field={isFieldExtracted('taxId')!} />}
              {hasFieldConflict('taxId') && <ConflictBadge field={hasFieldConflict('taxId')!} />}
              <input
                type="text"
                id="taxId"
                value={formData.taxId || ''}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="XX-XXXXXXX"
              />
            </div>

            {/* Ownership Structure */}
            <div>
              <label htmlFor="ownershipStructure" className="block text-sm font-medium text-gray-700 mb-2">
                Ownership Structure
              </label>
              {isFieldExtracted('ownershipStructure') && <ExtractedBadge field={isFieldExtracted('ownershipStructure')!} />}
              {hasFieldConflict('ownershipStructure') && <ConflictBadge field={hasFieldConflict('ownershipStructure')!} />}
              <input
                type="text"
                id="ownershipStructure"
                value={formData.ownershipStructure || ''}
                onChange={(e) => setFormData({ ...formData, ownershipStructure: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Sole proprietorship, LLC, Corporation, etc."
              />
            </div>

            {/* Employee List */}
            <div className="md:col-span-2">
              <label htmlFor="employeeList" className="block text-sm font-medium text-gray-700 mb-2">
                Employee Summary
                <span className="text-xs text-gray-500 ml-2">(De-identified, by role/department)</span>
              </label>
              {isFieldExtracted('employeeList') && <ExtractedBadge field={isFieldExtracted('employeeList')!} />}
              {hasFieldConflict('employeeList') && <ConflictBadge field={hasFieldConflict('employeeList')!} />}
              <textarea
                id="employeeList"
                value={formData.employeeList || ''}
                onChange={(e) => setFormData({ ...formData, employeeList: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 5 developers, 2 sales reps, 1 operations manager..."
              />
            </div>
          </div>
        </div>

        {/* Similar Submissions */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Similar Submissions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockSimilarSubmissions.map((similar) => (
              <div key={similar.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-gray-900 mb-2">{similar.companyName}</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>{similar.employeeCount} employees</div>
                  <div>{similar.industry}</div>
                  <div className="font-medium text-green-600">${similar.quotePrice.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Ready to Proceed?</h2>
              <p className="text-gray-600 text-sm mt-1">Choose how to handle this submission</p>
            </div>
            <button
              onClick={() => setShowProceedModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Proceed with Submission
            </button>
          </div>
        </div>
      </div>

      {/* Proceed Modal */}
      {showProceedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Proceed with Submission</h2>
              <p className="text-gray-600 mb-6">Choose how you'd like to handle this submission:</p>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    alert('Success! Submission sent via API to internal systems.');
                    setShowProceedModal(false);
                  }}
                  className="w-full px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-semibold border-2 border-blue-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Send via API to Internal Systems
                </button>
                
                <button
                  onClick={() => {
                    alert('Success! Submission details sent to your email.');
                    setShowProceedModal(false);
                  }}
                  className="w-full px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-semibold border-2 border-green-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send to My Email
                </button>
                
                <button
                  onClick={() => {
                    setShowProceedModal(false);
                    router.push(`/carrier/submissions/${submissionId}/quote`);
                  }}
                  className="w-full px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors font-semibold border-2 border-purple-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Enter Quote
                </button>
              </div>
              
              <button
                onClick={() => setShowProceedModal(false)}
                className="w-full mt-4 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Modal */}
      {conflictModalOpen && currentConflict && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Value Conflict Detected</h2>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">{currentConflict.fieldName}</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Value</label>
                    <div className="p-3 bg-white border border-gray-300 rounded-md">
                      {currentConflict.userValue}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">AI Extracted Value</label>
                    <div className="p-3 bg-blue-50 border border-blue-300 rounded-md">
                      {currentConflict.extracted.fieldValue}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* View Source Document Button */}
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
                    onClick={() => {
                      setFormData({
                        ...formData,
                        [currentConflict.fieldName]: currentConflict.extracted.fieldValue
                      });
                      setConflictModalOpen(false);
                      setCurrentConflict(null);
                    }}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                  >
                    Use AI Value
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Source Document Modal */}
      {sourceModalOpen && currentSource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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

            <div className="flex-1 overflow-y-auto p-6">
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
                      {currentSource.confidence && (
                        <div>
                          <span className="font-medium">Confidence:</span> {Math.round(currentSource.confidence * 100)}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

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
                        const text = currentSource.extractedText;
                        const value = String(currentSource.fieldValue);
                        
                        const lowerText = text.toLowerCase();
                        const lowerValue = value.toLowerCase();
                        let index = lowerText.indexOf(lowerValue);
                        
                        if (index === -1 && !isNaN(parseFloat(value.replace(/,/g, '')))) {
                          const numericValue = value.replace(/,/g, '');
                          const patterns = [
                            value,
                            numericValue,
                            parseFloat(numericValue).toString(),
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
