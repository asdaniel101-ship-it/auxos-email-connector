'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface UploadedFile {
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  uploadProgress: number;
}

export default function IntakePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    overview: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        console.log('📤 Uploading file:', file.name);
        
        // Get presigned URL
        const presignResponse = await fetch(`${API}/files/presign?name=${encodeURIComponent(file.name)}`);
        if (!presignResponse.ok) {
          console.error('❌ Failed to get presigned URL:', await presignResponse.text());
          throw new Error('Failed to get upload URL');
        }
        
        const { url, fileKey } = await presignResponse.json();
        console.log('✅ Got presigned URL, fileKey:', fileKey);

        // Initialize progress tracking
        const newFile: UploadedFile = {
          fileName: file.name,
          fileKey,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          uploadProgress: 0,
        };
        setUploadedFiles(prev => [...prev, newFile]);

        // Upload to MinIO
        console.log('📤 Uploading to MinIO...');
        const uploadResponse = await fetch(url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        });

        if (!uploadResponse.ok) {
          console.error('❌ MinIO upload failed:', uploadResponse.status, await uploadResponse.text());
          throw new Error('Failed to upload file');
        }

        console.log('✅ File uploaded to MinIO successfully');

        // Update progress to 100%
        setUploadedFiles(prev => 
          prev.map(f => f.fileKey === fileKey ? { ...f, uploadProgress: 100 } : f)
        );
      } catch (error) {
        console.error('❌ Error uploading file:', error);
        alert(`Failed to upload ${file.name}. Please try again.`);
        // Remove failed file from list
        setUploadedFiles(prev => prev.filter(f => f.fileName !== file.name));
      }
    }

    // Clear the input
    e.target.value = '';
  };

  const removeFile = (fileKey: string) => {
    setUploadedFiles(prev => prev.filter(f => f.fileKey !== fileKey));
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    // Business name is required (handled by HTML required attribute, but double-check)
    if (!formData.businessName.trim()) {
      errors.push('Business Name is required');
    } else if (formData.businessName.trim().length < 2) {
      errors.push('Business Name must be at least 2 characters');
    }

    // State validation (2 letters if provided)
    if (formData.state.trim() && !/^[A-Za-z]{2}$/.test(formData.state.trim())) {
      errors.push('State must be a 2-letter code (e.g., TX, CA, NY)');
    }

    // ZIP code validation (5 digits or 5+4 format if provided)
    if (formData.zip.trim() && !/^\d{5}(-\d{4})?$/.test(formData.zip.trim())) {
      errors.push('ZIP code must be 5 digits (e.g., 78701) or 9 digits with dash (e.g., 78701-1234)');
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form first
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowErrorModal(true);
      return;
    }

    setLoading(true);

    try {
      // Create submission - only send non-empty fields
      const payload: Record<string, string> = { businessName: formData.businessName };
      if (formData.address?.trim()) payload.address = formData.address;
      if (formData.city?.trim()) payload.city = formData.city;
      if (formData.state?.trim()) payload.state = formData.state;
      if (formData.zip?.trim()) payload.zip = formData.zip;
      if (formData.overview?.trim()) payload.overview = formData.overview;

      console.log('Creating submission with:', payload);
      
      const response = await fetch(`${API}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to create submission: ${response.status} - ${errorText}`);
      }

      const submission = await response.json();

      // Upload documents and trigger extraction
      if (uploadedFiles.length > 0) {
        // Remove uploadProgress field before sending (API doesn't expect it)
        const filesForApi = uploadedFiles.map(({ fileName, fileKey, fileSize, mimeType }) => ({
          fileName,
          fileKey,
          fileSize,
          mimeType,
        }));
        
        await fetch(`${API}/submissions/${submission.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: filesForApi }),
        });
      }

      // Redirect to chat page
      router.push(`/intake/${submission.id}/chat`);
    } catch (error) {
      console.error('Error creating submission:', error);
      alert('Failed to create submission. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Start your Auxo submission
          </h1>
          <p className="text-lg text-gray-600">
            Tell us about your business so Auxo can connect you with the right coverage partners.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Business Name */}
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-2">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="businessName"
                name="businessName"
                required
                value={formData.businessName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Acme Construction LLC"
              />
            </div>

            {/* Address */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Street Address
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="123 Main St"
              />
            </div>

            {/* City, State, ZIP */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3 sm:col-span-1">
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Austin"
                />
              </div>

              <div className="col-span-3 sm:col-span-1">
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                  State
                </label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  maxLength={2}
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                  placeholder="TX"
                />
              </div>

              <div className="col-span-3 sm:col-span-1">
                <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-2">
                  ZIP Code
                </label>
                <input
                  type="text"
                  id="zip"
                  name="zip"
                  maxLength={10}
                  value={formData.zip}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="78701"
                />
              </div>
            </div>

            {/* Business Overview */}
            <div>
              <label htmlFor="overview" className="block text-sm font-medium text-gray-700 mb-2">
                Tell us about your business
              </label>
              <textarea
                id="overview"
                name="overview"
                rows={4}
                value={formData.overview}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="We are a commercial construction company specializing in office buildings..."
              />
              <p className="mt-1 text-sm text-gray-500">
                Optional: Describe what your business does, your industry, and any other relevant details.
              </p>
            </div>

            {/* Document Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Documents (Optional)
              </label>
              <p className="text-sm text-gray-500 mb-3">
                Upload any relevant documents (business registration, financial statements, prior insurance docs). Our AI will extract information automatically.
              </p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  id="fileUpload"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="fileUpload"
                  className="cursor-pointer inline-flex flex-col items-center"
                >
                  <svg
                    className="w-12 h-12 text-gray-400 mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span className="text-blue-600 font-medium hover:text-blue-700">
                    Click to upload files
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    PDF, DOC, DOCX, JPG, PNG (up to 10MB each)
                  </span>
                </label>
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={`${file.fileKey}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3 flex-1">
                          <svg
                            className="w-5 h-5 text-blue-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.fileName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(file.fileSize / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(file.fileKey)}
                          className="ml-4 text-red-600 hover:text-red-800"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !formData.businessName}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold text-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating...' : 'Continue to Chat →'}
              </button>
            </div>
          </form>

          {/* Help Text */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Next step:</span> After submitting this form, you&apos;ll chat with our AI assistant
              to provide additional details about your insurance needs. The conversation takes about 2-3 minutes.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p>Your information is secure and will only be used to generate insurance quotes.</p>
        </div>
      </div>

      {/* Validation Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 relative">
            {/* Close button */}
            <button
              onClick={() => setShowErrorModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Error icon */}
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
              Invalid Fields
            </h3>

            {/* Error list */}
            <p className="text-gray-600 text-center mb-4">
              Please fix the following issues:
            </p>
            <ul className="space-y-2 mb-6">
              {validationErrors.map((error, index) => (
                <li key={index} className="flex items-start text-sm text-red-600">
                  <span className="mr-2 mt-0.5">•</span>
                  <span>{error}</span>
                </li>
              ))}
            </ul>

            {/* Close button */}
            <button
              onClick={() => setShowErrorModal(false)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Got it, let me fix that
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

