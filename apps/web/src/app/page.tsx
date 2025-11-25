'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
    } catch (error) {
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
                href="mailto:auxoreachout@gmail.com" 
                className="inline-block text-2xl sm:text-3xl lg:text-4xl font-bold text-white underline decoration-2 underline-offset-4 hover:text-blue-200 transition-colors"
              >
                auxoreachout@gmail.com
              </a>
              <p className="text-lg sm:text-xl text-white/80 mt-6">
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
              description: "Simply forward any insurance submission email to auxoreachout@gmail.com. Include all attachments (ACORD forms, SOVs, loss runs, etc.).",
            },
            {
              step: "2",
              title: "Wait a Couple Minutes",
              description: "Our AI automatically extracts all fields, structures the data, and generates a comprehensive summary.",
            },
            {
              step: "3",
              title: "Receive Processed Submission",
              description: "Get a beautifully formatted reply email with all extracted fields, organized data, and ready-to-review information.",
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

      {/* Benefits Section */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 mb-4">
              Why Use Auxo?
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
