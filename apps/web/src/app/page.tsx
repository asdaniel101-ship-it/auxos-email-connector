'use client';

import { useState } from 'react';

import { getApiUrl } from '@/lib/api-url';
const API_URL = getApiUrl();

export default function Home() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const response = await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        setSubmitted(true);
        setFormData({ name: '', email: '', message: '' });
        setTimeout(() => {
          setShowForm(false);
          setSubmitted(false);
        }, 3000);
      } else {
        alert('Failed to send feedback. Please try again.');
      }
    } catch {
      alert('Failed to send feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight mb-4 leading-tight">
              Process Insurance Submissions Faster
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
              Structure and review more submissions so you can be faster and make more money.
            </p>
          </div>
          
          {/* Main CTA - Try it now section */}
          <div className="bg-blue-900/90 rounded-2xl p-8 sm:p-12 mb-8 border-2 border-blue-500/50 shadow-2xl transform hover:scale-[1.02] transition-transform">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-white mb-6">Try it now:</p>
              <p className="text-xl sm:text-2xl text-white/90 mb-2">
                Forward any insurance submission email to
              </p>
              <a 
                href="mailto:auxosreachout@gmail.com" 
                className="inline-block text-2xl sm:text-3xl lg:text-4xl font-bold text-white underline decoration-2 underline-offset-4 hover:text-blue-200 transition-colors"
              >
                auxosreachout@gmail.com
              </a>
              <p className="text-lg sm:text-xl text-white/80 mt-4 mb-2">
                <strong className="text-white">Include all attachments</strong> (ACORD forms, SOVs, loss runs, etc.) as we process these
              </p>
              <p className="text-lg sm:text-xl text-white/80">
                Wait a couple minutes and receive the processed submission back in your inbox
              </p>
            </div>
          </div>

          {/* Feedback Form Button */}
          <div className="text-center">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white/10 text-white font-semibold border border-white/20 hover:bg-white/20 transition-colors text-base"
            >
              Share Interest or Feedback
            </button>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 mb-4">
            How It Works
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              step: "1",
              title: "Forward Your Submission",
              description: "Simply forward any insurance submission email to auxosreachout@gmail.com. Include all attachments (ACORD forms, SOVs, loss runs, etc.).",
            },
            {
              step: "2",
              title: "Wait a Couple Minutes",
              description: "Our AI automatically extracts all fields, structures the data, and generates a comprehensive summary.",
            },
            {
              step: "3",
              title: "Receive Processed Submission",
              description: "Get a beautifully formatted reply email with all extracted fields, organized data, and ready-to-review information. Click on any field to see which document and where in the document it was extracted from.",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-900 text-white text-2xl font-bold mb-4">
                {item.step}
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">{item.title}</h3>
              <p className="text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example Email Response Preview */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 mb-4">
              See What You Get
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Your processed submission comes back as a beautifully formatted email with clickable fields
            </p>
          </div>

          {/* Email Preview Mockup */}
          <div className="bg-white rounded-xl shadow-xl border-2 border-slate-200 overflow-hidden mb-12">
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                  A
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Auxos</p>
                  <p className="text-sm text-slate-600">auxosreachout@gmail.com</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-slate-500 mb-1">Subject:</p>
                <p className="font-semibold text-slate-900">Re: Commercial Property Submission - Processed</p>
              </div>
              <div className="prose max-w-none">
                <p className="text-slate-700 mb-4">
                  Your submission has been processed. Here are the extracted fields:
                </p>
                <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-900 mb-3">Submission Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Named Insured:</span>
                      <a href="#" className="text-blue-600 hover:text-blue-800 underline font-medium">
                        ABC Restaurant Group
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Building Limit:</span>
                      <a href="#" className="text-blue-600 hover:text-blue-800 underline font-medium">
                        $2,500,000
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Construction Type:</span>
                      <a href="#" className="text-blue-600 hover:text-blue-800 underline font-medium">
                        Frame
                      </a>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 italic">
                  Click any field above to see the exact document and location where it was extracted from.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Example Submission Reviewer Preview */}
      <section className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 mb-4">
              Interactive Field Review
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Click on any extracted field to see exactly where it came from in your documents
            </p>
          </div>

          {/* Submission Reviewer Mockup */}
          <div className="bg-white rounded-xl shadow-xl border-2 border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Submission Information</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Example Field 1 - Clickable */}
                <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50 cursor-pointer hover:shadow-md transition-all animate-pulse">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-700 mb-1">Named Insured</div>
                      <div className="text-base font-medium text-green-900">ABC Restaurant Group</div>
                    </div>
                    <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      ACORD
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-blue-600">
                    Click to view source document →
                  </div>
                </div>

                {/* Example Field 2 - Clickable */}
                <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50 cursor-pointer hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-700 mb-1">Building Limit</div>
                      <div className="text-base font-medium text-green-900">$2,500,000</div>
                    </div>
                    <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                      SOV
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-blue-600">
                    Click to view source document →
                  </div>
                </div>

                {/* Example Field 3 - N/A */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-700 mb-1">Prior Carrier</div>
                      <div className="text-base font-medium text-slate-500 italic">N/A</div>
                    </div>
                    <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      Email
                    </span>
                  </div>
                </div>

                {/* Example Field 4 - Clickable */}
                <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50 cursor-pointer hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-700 mb-1">Construction Type</div>
                      <div className="text-base font-medium text-green-900">Frame</div>
                    </div>
                    <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      ACORD
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-blue-600">
                    Click to view source document →
                  </div>
                </div>
              </div>

              {/* Document Excerpt Popup Preview */}
              <div className="mt-8 bg-slate-100 rounded-lg p-6 border-2 border-dashed border-slate-300">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-slate-900">Named Insured</h4>
                      <p className="text-sm text-slate-600">Source: ACORD</p>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Extracted Value</p>
                    <div className="bg-green-50 rounded p-3 text-green-900 font-semibold border border-green-200">
                      ABC Restaurant Group
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Document Excerpt</p>
                    <div className="bg-slate-50 rounded p-3 text-sm font-mono text-slate-900 border border-slate-200">
                      <span className="text-slate-600">...Named Insured: </span>
                      <mark className="bg-yellow-200 px-1 rounded font-semibold">ABC Restaurant Group</mark>
                      <span className="text-slate-600">, Mailing Address: 123 Main St...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 mb-4">
              Why Use Auxos?
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Save Time",
                description: "Process submissions in minutes instead of hours. No manual data entry required.",
                icon: "⚡",
              },
              {
                title: "Review More",
                description: "Handle more submissions per day, increasing your capacity and revenue potential.",
                icon: "📈",
              },
              {
                title: "Better Accuracy",
                description: "AI-powered extraction ensures consistent, accurate data extraction from all document types.",
                icon: "✅",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-slate-50 rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col gap-4 hover:shadow-md transition-shadow"
              >
                <div className="text-4xl mb-2">{card.icon}</div>
                <h3 className="text-xl font-semibold text-slate-900">{card.title}</h3>
                <p className="text-slate-600 leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feedback Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-slate-900">Share Interest or Feedback</h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setSubmitted(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {submitted ? (
              <div className="text-center py-8">
                <div className="text-green-600 text-5xl mb-4">✓</div>
                <p className="text-lg font-semibold text-slate-900 mb-2">Thank you!</p>
                <p className="text-slate-600">Your feedback has been sent.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-6 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Sending...' : 'Send Feedback'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setSubmitted(false);
                    }}
                    className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
