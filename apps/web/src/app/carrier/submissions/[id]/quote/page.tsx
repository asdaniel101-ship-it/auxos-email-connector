'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Submission = {
  id: string;
  businessName: string;
  industryLabel?: string;
  employeeCount?: number;
  revenue?: number;
  yearsInOperation?: number;
  overview?: string;
  insuranceNeeds?: string;
  status: string;
};

type CoverageQuote = {
  id: string;
  coverageType: string;
  description: string;
  baseAmount: number;
  quoteAmount: number;
  notes: string;
};

// Mock coverage data based on industry
const getCoveragesForIndustry = (industry?: string): Omit<CoverageQuote, 'id' | 'quoteAmount' | 'notes'>[] => {
  const baseCoverages = [
    { coverageType: 'General Liability', description: 'Bodily injury and property damage coverage', baseAmount: 5000 },
    { coverageType: 'Professional Liability', description: 'Errors and omissions coverage', baseAmount: 8000 },
  ];

  switch (industry?.toLowerCase()) {
    case 'technology':
    case 'software':
      return [
        ...baseCoverages,
        { coverageType: 'Cyber Liability', description: 'Data breach and cyber attack coverage', baseAmount: 12000 },
        { coverageType: 'Technology Errors & Omissions', description: 'Tech-specific E&O coverage', baseAmount: 15000 },
      ];
    case 'construction':
      return [
        { coverageType: 'General Liability', description: 'Bodily injury and property damage coverage', baseAmount: 8000 },
        { coverageType: 'Workers Compensation', description: 'Workplace injury coverage', baseAmount: 12000 },
        { coverageType: 'Contractors Equipment', description: 'Equipment and tools coverage', baseAmount: 6000 },
        { coverageType: 'Builders Risk', description: 'Construction project coverage', baseAmount: 4000 },
      ];
    case 'healthcare':
    case 'health':
      return [
        ...baseCoverages,
        { coverageType: 'Medical Malpractice', description: 'Healthcare professional liability', baseAmount: 20000 },
        { coverageType: 'HIPAA Coverage', description: 'Privacy and security coverage', baseAmount: 5000 },
      ];
    case 'food service':
    case 'restaurant':
      return [
        { coverageType: 'General Liability', description: 'Bodily injury and property damage coverage', baseAmount: 6000 },
        { coverageType: 'Product Liability', description: 'Food safety and product coverage', baseAmount: 8000 },
        { coverageType: 'Liquor Liability', description: 'Alcohol-related coverage', baseAmount: 4000 },
        { coverageType: 'Property', description: 'Building and equipment coverage', baseAmount: 10000 },
      ];
    case 'retail':
      return [
        { coverageType: 'General Liability', description: 'Bodily injury and property damage coverage', baseAmount: 5000 },
        { coverageType: 'Product Liability', description: 'Product safety coverage', baseAmount: 7000 },
        { coverageType: 'Property', description: 'Building and inventory coverage', baseAmount: 12000 },
        { coverageType: 'Business Interruption', description: 'Income loss coverage', baseAmount: 3000 },
      ];
    default:
      return baseCoverages;
  }
};

export default function SubmissionQuotePage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [coverages, setCoverages] = useState<CoverageQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  async function loadSubmission() {
    try {
      const response = await fetch(`${API}/submissions/${submissionId}`);
      if (!response.ok) throw new Error('Failed to load submission');
      
      const data = await response.json();
      setSubmission(data);

      // Initialize coverages based on industry
      const industryCoverages = getCoveragesForIndustry(data.industryLabel);
      const initializedCoverages = industryCoverages.map((coverage, index) => ({
        id: `coverage-${index}`,
        ...coverage,
        quoteAmount: coverage.baseAmount,
        notes: ''
      }));
      setCoverages(initializedCoverages);
    } catch (error) {
      console.error('Error loading submission:', error);
    } finally {
      setLoading(false);
    }
  }

  function updateCoverageQuote(id: string, field: 'quoteAmount' | 'notes', value: string | number) {
    setCoverages(prev => prev.map(coverage => 
      coverage.id === id 
        ? { ...coverage, [field]: value }
        : coverage
    ));
  }

  function calculateTotal() {
    return coverages.reduce((sum, coverage) => sum + (coverage.quoteAmount || 0), 0);
  }

  function calculateMargin() {
    const total = calculateTotal();
    const baseTotal = coverages.reduce((sum, coverage) => sum + coverage.baseAmount, 0);
    return total - baseTotal;
  }

  async function saveQuote() {
    setSaving(true);
    try {
      // Here you would save the quote to your backend
      // For now, we'll just simulate a save
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setShowSuccess(true);
      setTimeout(() => {
        router.push('/carrier');
      }, 2000);
    } catch (error) {
      console.error('Error saving quote:', error);
      alert('Failed to save quote. Please try again.');
    } finally {
      setSaving(false);
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <Link href={`/carrier/submissions/${submissionId}`} className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
                ← Back to Submission Review
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">{submission.businessName}</h1>
              <p className="text-gray-600 mt-1">Insurance Quote</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Quote Generation</span>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">C</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Submission Summary */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Submission Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Industry</div>
              <div className="font-medium">{submission.industryLabel || 'Not specified'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Employees</div>
              <div className="font-medium">{submission.employeeCount || 'Not specified'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Revenue</div>
              <div className="font-medium">
                {submission.revenue ? `$${submission.revenue.toLocaleString()}` : 'Not specified'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Years in Operation</div>
              <div className="font-medium">{submission.yearsInOperation || 'Not specified'}</div>
            </div>
          </div>
        </div>

        {/* Coverage Quote Table */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Coverage Quote</h2>
            <p className="text-gray-600 text-sm mt-1">Adjust coverage amounts and add notes</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coverage Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Base Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quote Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {coverages.map((coverage) => (
                  <tr key={coverage.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{coverage.coverageType}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs">{coverage.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        ${coverage.baseAmount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        value={coverage.quoteAmount}
                        onChange={(e) => updateCoverageQuote(coverage.id, 'quoteAmount', parseFloat(e.target.value) || 0)}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={coverage.notes}
                        onChange={(e) => updateCoverageQuote(coverage.id, 'notes', e.target.value)}
                        placeholder="Add notes..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quote Summary */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Base Total:</span>
                  <span className="font-medium">
                    ${coverages.reduce((sum, c) => sum + c.baseAmount, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Quote Total:</span>
                  <span className="font-medium text-lg">
                    ${calculateTotal().toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Margin:</span>
                  <span className={`font-medium ${calculateMargin() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${calculateMargin().toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-gray-300 pt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Final Quote:</span>
                    <span className="font-bold text-xl text-blue-600">
                      ${calculateTotal().toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end space-x-4">
          <Link
            href={`/carrier/submissions/${submissionId}`}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-semibold"
          >
            Cancel
          </Link>
          <button
            onClick={saveQuote}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving Quote...
              </>
            ) : (
              'Save Quote'
            )}
          </button>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Quote Saved Successfully!</h2>
              <p className="text-gray-600 mb-4">The quote has been saved and will be sent to the client.</p>
              <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
