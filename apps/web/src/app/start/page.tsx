'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// Default restaurant coverages: GL, WC, and BOP are the most common for restaurants
const DEFAULT_COVERAGES = ['GL', 'WC', 'BOP'];

const COVERAGE_OPTIONS = [
  { id: 'GL', name: 'General Liability', description: 'Protects against claims of bodily injury and property damage' },
  { id: 'WC', name: 'Workers Compensation', description: 'Covers employee injuries and medical expenses' },
  { id: 'BOP', name: 'Business Owners Policy', description: 'Combines property and liability coverage' },
  { id: 'PROP', name: 'Property Insurance', description: 'Covers business property and equipment' },
  { id: 'LIQ', name: 'Liquor Liability', description: 'Required if you serve alcohol' },
  { id: 'E&O', name: 'Professional Liability (E&O)', description: 'Errors and omissions coverage' },
  { id: 'CYBER', name: 'Cyber Liability', description: 'Protects against data breaches and cyber attacks' },
  { id: 'AUTO', name: 'Commercial Auto', description: 'Covers business vehicles' },
  { id: 'PROD', name: 'Product Liability', description: 'Covers products you manufacture or sell' },
  { id: 'BUILD', name: 'Builders Risk', description: 'Covers construction projects' },
];

function StartPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const vertical = searchParams.get('vertical') || 'insurance';

  const [formData, setFormData] = useState({
    vertical,
    businessType: '',
    businessName: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    howDidYouHear: '',
  });

  const [selectedCoverages, setSelectedCoverages] = useState<string[]>(DEFAULT_COVERAGES);
  const [consent, setConsent] = useState(false);
  const [interestedInBrokers, setInterestedInBrokers] = useState(true); // Auto-checked
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const toggleCoverage = (coverageId: string) => {
    setSelectedCoverages((prev) =>
      prev.includes(coverageId)
        ? prev.filter((id) => id !== coverageId)
        : [...prev, coverageId]
    );
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error(`File "${file.name}" is too large. Maximum size is 10MB.`);
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`File "${file.name}" is not a supported format. Please upload PDF or Word documents.`);
      }

      // Get presigned URL with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const presignResponse = await fetch(`${API_URL}/files/presign?name=${encodeURIComponent(file.name)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!presignResponse.ok) {
        throw new Error('Failed to get upload URL. Please try again.');
      }
      
      const { url, fileKey } = await presignResponse.json();

      // Upload file with timeout
      const uploadController = new AbortController();
      const uploadTimeoutId = setTimeout(() => uploadController.abort(), 60000); // 60 second timeout for upload
      
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
        signal: uploadController.signal,
      });
      clearTimeout(uploadTimeoutId);

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload "${file.name}". Please try again.`);
      }

      return { fileKey, fileName: file.name, fileSize: file.size, mimeType: file.type };
    } catch (error) {
      console.error('Error uploading file:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Upload timed out for "${file.name}". Please try again with a smaller file.`);
        }
        throw error;
      }
      throw new Error(`Failed to upload "${file.name}". Please try again.`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      alert('Please agree to the terms to continue');
      return;
    }

    if (vertical === 'insurance' && selectedCoverages.length === 0) {
      alert('Please select at least one insurance coverage');
      return;
    }

    setIsSubmitting(true);

    try {
      // Map form data to API expected format
      const apiData: Record<string, unknown> = {
        vertical: formData.vertical,
        businessType: formData.businessType,
        businessName: formData.businessName,
        ownerName: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zip: formData.zip || undefined,
        howDidYouHear: formData.howDidYouHear || undefined,
      };

      // Add desired coverages and actively looking flag if insurance vertical
      if (vertical === 'insurance') {
        apiData.desiredCoverages = selectedCoverages;
        apiData.activelyLookingForInsurance = interestedInBrokers;
      }

      console.log('Sending request to API:', apiData);

      // Create session first
      const response = await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `Failed to create session (${response.status} ${response.statusText})`;
        try {
          const errorData = await response.json();
          // NestJS validation errors come in a specific format
          if (Array.isArray(errorData.message)) {
            errorMessage = `Validation error: ${errorData.message.join(', ')}`;
          } else {
            errorMessage = errorData.message || errorData.error || errorMessage;
          }
          console.error('API Error Response:', errorData);
        } catch {
          // Response might not be JSON
          const text = await response.text();
          console.error('Non-JSON Error Response:', text);
          errorMessage = `Failed to create session: ${text || response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const session = await response.json();

      // Upload documents if any
      if (uploadedFiles.length > 0) {
        const uploadErrors: string[] = [];
        for (const file of uploadedFiles) {
          try {
            const fileInfo = await handleFileUpload(file);
            
            // Create document record
            const docResponse = await fetch(`${API_URL}/documents/upload`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sessionId: session.id,
                fileName: fileInfo.fileName,
                fileKey: fileInfo.fileKey,
                fileSize: fileInfo.fileSize,
                mimeType: fileInfo.mimeType,
              }),
            });

            if (!docResponse.ok) {
              throw new Error(`Failed to register document: ${file.name}`);
            }
          } catch (error) {
            console.error('Error uploading document:', error);
            const errorMsg = error instanceof Error ? error.message : `Failed to upload ${file.name}`;
            uploadErrors.push(errorMsg);
            // Continue with other files
          }
        }
        
        // Show warning if some files failed
        if (uploadErrors.length > 0 && uploadErrors.length < uploadedFiles.length) {
          console.warn('Some files failed to upload:', uploadErrors);
          // Don't block the flow, but log the errors
        } else if (uploadErrors.length === uploadedFiles.length) {
          // All files failed - show error but still proceed
          alert(`Warning: Failed to upload some documents. You can continue and upload them later.`);
        }
      }

      router.push(`/intake/${session.id}`);
    } catch (error) {
      console.error('Error creating session:', error);
      let errorMessage = 'Failed to start. Please try again.';
      
      if (error instanceof Error && error.message) {
        errorMessage = error.message;
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Unable to connect to server. Please check your internet connection and try again.';
      }
      
      // Show user-friendly error
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/60 p-6">
          <div className="mb-6">
            <Link href="/" className="text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors inline-flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to home
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-1 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Let&apos;s get started
          </h1>
          <p className="text-slate-600 mb-6 text-sm">
            {vertical === 'insurance'
              ? "Answer a few questions and we'll help you get better insurance quotes"
              : "Answer a few questions and we'll help you find small business funding"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="vertical" value={vertical} />

            <div>
              <label htmlFor="businessType" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Business Type *
              </label>
              <select
                id="businessType"
                required
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300/60 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white shadow-sm transition-all"
              >
                <option value="">Select...</option>
                <option value="restaurant">Restaurant</option>
                <option value="retail">Retail Shop</option>
                <option value="services">Local Services (Contractors, Salons, Gyms, etc.)</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="businessName" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Business Name *
                </label>
                <input
                  type="text"
                  id="businessName"
                  required
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300/60 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white shadow-sm transition-all"
                  placeholder="Acme Restaurant LLC"
                />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Your Name *
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300/60 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white shadow-sm transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300/60 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white shadow-sm transition-all"
                  placeholder="john@acme.com"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Phone <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300/60 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white shadow-sm transition-all"
                  placeholder="+1234567890"
                />
              </div>
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Business Address *
              </label>
              <input
                type="text"
                id="address"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300/60 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white shadow-sm transition-all"
                placeholder="123 Main Street"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label htmlFor="city" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  City *
                </label>
                <input
                  type="text"
                  id="city"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300/60 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white shadow-sm transition-all"
                  placeholder="San Francisco"
                />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  State *
                </label>
                <input
                  type="text"
                  id="state"
                  required
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-slate-300/60 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white shadow-sm transition-all"
                  placeholder="CA"
                  maxLength={2}
                />
              </div>
            </div>

            <div>
              <label htmlFor="zip" className="block text-sm font-semibold text-slate-700 mb-1.5">
                ZIP Code *
              </label>
              <input
                type="text"
                id="zip"
                required
                value={formData.zip}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300/60 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white shadow-sm transition-all"
                placeholder="94102"
                maxLength={10}
              />
            </div>

            {/* Insurance Coverage Selection - Only show for insurance vertical */}
            {vertical === 'insurance' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Insurance Coverage Needed *
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Click on any coverage to add or remove it. Default coverages are pre-selected.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {COVERAGE_OPTIONS.map((coverage) => {
                    const isSelected = selectedCoverages.includes(coverage.id);
                    return (
                      <button
                        key={coverage.id}
                        type="button"
                        onClick={() => toggleCoverage(coverage.id)}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'bg-green-50 border-green-500 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`font-semibold text-xs ${isSelected ? 'text-green-900' : 'text-slate-900'}`}>
                            {coverage.name}
                          </span>
                          <div className={`flex-shrink-0 ml-2 ${isSelected ? 'text-green-600' : 'text-slate-400'}`}>
                            {isSelected ? (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <p className={`text-xs leading-tight ${isSelected ? 'text-green-700' : 'text-slate-500'}`}>
                          {coverage.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Upload Documents <span className="text-slate-400 font-normal text-xs">(Optional)</span>
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Upload your documents now and we&apos;ll extract information while you chat. 
                {vertical === 'insurance' 
                  ? ' (e.g., dec pages, loss runs, payroll reports)'
                  : ' (e.g., bank statements, tax returns, P&L)'}
              </p>
              <div className="relative">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setUploadedFiles((prev) => [...prev, ...files]);
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-slate-400 cursor-pointer transition-all group"
                >
                  <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">
                    Choose files or drag and drop
                  </span>
                </label>
              </div>
              {uploadedFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-xs text-slate-700 truncate">{file.name}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="consent"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 mr-2 w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-500"
                />
                <label htmlFor="consent" className="text-xs text-slate-600 leading-tight">
                  I agree to the Terms and allow my info to be shared with matched partners.
                </label>
              </div>
              
              {vertical === 'insurance' && (
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="interestedInBrokers"
                    checked={interestedInBrokers}
                    onChange={(e) => setInterestedInBrokers(e.target.checked)}
                    className="mt-0.5 mr-2 w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-500"
                  />
                  <label htmlFor="interestedInBrokers" className="text-xs text-slate-600 leading-tight">
                    I am interested in being connected with brokers and carriers for better insurance rates and coverage
                  </label>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || uploading}
              className="w-full px-6 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white font-semibold rounded-xl hover:from-slate-800 hover:to-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:hover:shadow-lg flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Uploading...</span>
                </>
              ) : isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <span>Continue to Chat</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function StartPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-slate-900 mb-4"></div>
          <p className="text-slate-600 font-medium">Loading...</p>
        </div>
      </div>
    }>
      <StartPageContent />
    </Suspense>
  );
}
