'use client';

import { useState } from "react";
import Link from "next/link";

export default function RequestDemoPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    // TODO: Replace this stub with an API call, email service, or CRM webhook.
    console.info("Demo request submitted:", payload);

    await new Promise((resolve) => setTimeout(resolve, 600)); // simulate latency
    setSubmitted(true);
    setIsSubmitting(false);
    event.currentTarget.reset();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-100 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-[0.9fr_1.1fr]">
            <div className="bg-slate-900 text-white p-8 lg:p-12 flex flex-col justify-between">
              <div>
                <p className="uppercase tracking-[0.35em] text-xs text-slate-300 mb-6">Auxo</p>
                <h1 className="text-3xl font-semibold leading-tight">
                  Let&apos;s show you how Auxo works.
                </h1>
                <p className="mt-6 text-slate-200">
                  Share a few details and our team will reach out to schedule a tailored walkthrough. We&apos;ll cover
                  chat-driven intake, document extraction, lead matching, and partner workflows.
                </p>
              </div>
              <div className="mt-12 text-sm text-slate-400">
                Already a partner?{" "}
                <Link href="/partners/dashboard" className="underline hover:text-white">
                  Access the partner portal
                </Link>
                .
              </div>
            </div>

            <div className="p-8 lg:p-12">
              {submitted ? (
                <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-6">
                  <h2 className="text-xl font-semibold mb-2">Thanks! We&apos;ll be in touch shortly.</h2>
                  <p className="text-sm text-green-700">
                    A member of the Auxo team will reach out to coordinate a live demo tailored to your brokerage
                    or carrier workflow.
                  </p>
                </div>
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                        Full name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        placeholder="Jordan Blake"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                        Work email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        placeholder="jordan@brokerage.com"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-2">
                      Company
                    </label>
                    <input
                      id="company"
                      name="company"
                      type="text"
                      required
                      placeholder="Summit Insurance Partners"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-2">
                      Role (optional)
                    </label>
                    <input
                      id="role"
                      name="role"
                      type="text"
                      placeholder="Broker, COO, Underwriting lead..."
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-2">
                      Anything specific we should prepare?
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      rows={4}
                      placeholder="Share current workflow pain points or tools you need to connect."
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex items-center justify-center px-6 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Sending..." : "Submit Request"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

