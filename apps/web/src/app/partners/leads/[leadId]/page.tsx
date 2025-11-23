'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PasswordProtection from '@/components/PasswordProtection';

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
  status: string;
  session: {
    vertical: string;
    businessType: string | null;
  };
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.leadId as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [partnerId, setPartnerId] = useState<string>('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const storedPartnerId = localStorage.getItem('partnerId');
    if (storedPartnerId) {
      setPartnerId(storedPartnerId);
    }
    loadLead();
  }, [leadId]);

  const loadLead = async () => {
    try {
      const response = await fetch(`${API_URL}/leads/${leadId}`);
      if (!response.ok) throw new Error('Failed to load lead');
      const data = await response.json();
      setLead({
        ...data,
        session: data.session.session,
      });
    } catch (error) {
      console.error('Error loading lead:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!partnerId) return;
    try {
      await fetch(`${API_URL}/partners/${partnerId}/leads/${leadId}/accept`, {
        method: 'POST',
      });
      alert('Lead accepted!');
      router.push('/partners/dashboard');
    } catch (error) {
      console.error('Error accepting lead:', error);
    }
  };

  const handleReject = async () => {
    if (!partnerId) return;
    try {
      await fetch(`${API_URL}/partners/${partnerId}/leads/${leadId}/reject`, {
        method: 'POST',
      });
      alert('Lead rejected');
      router.push('/partners/dashboard');
    } catch (error) {
      console.error('Error rejecting lead:', error);
    }
  };

  if (isLoading) {
    return (
      <PasswordProtection>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-slate-600">Loading...</div>
        </div>
      </PasswordProtection>
    );
  }

  if (!lead) {
    return (
      <PasswordProtection>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-slate-600">Lead not found</div>
        </div>
      </PasswordProtection>
    );
  }

  return (
    <PasswordProtection>
      <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <button
            onClick={() => router.push('/partners/dashboard')}
            className="text-slate-500 hover:text-slate-700 text-sm"
          >
            ← Back to dashboard
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">Lead Details</h1>
          <p className="text-slate-600 mb-8">
            {lead.session.vertical === 'insurance' ? 'Insurance' : 'Lending'} Lead
          </p>

          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Business Information</h2>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-slate-600">Business Name:</span>
                  <p className="text-slate-900">{lead.legalBusinessName || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-600">Address:</span>
                  <p className="text-slate-900">
                    {lead.primaryAddress || 'Not provided'}
                    {lead.primaryCity && `, ${lead.primaryCity}`}
                    {lead.primaryState && `, ${lead.primaryState}`}
                    {lead.primaryZip && ` ${lead.primaryZip}`}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-600">Employees:</span>
                  <p className="text-slate-900">{lead.employeeCountTotal || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-600">Annual Revenue:</span>
                  <p className="text-slate-900">
                    {lead.annualRevenue
                      ? `$${lead.annualRevenue.toLocaleString()}`
                      : 'Not provided'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-600">Description:</span>
                  <p className="text-slate-900">{lead.businessDescription || 'Not provided'}</p>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 flex gap-4">
            <button
              onClick={handleReject}
              className="px-6 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 px-6 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
            >
              Accept Lead
            </button>
          </div>
        </div>
      </div>
    </div>
    </PasswordProtection>
  );
}

