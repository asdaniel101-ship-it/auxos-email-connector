'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function CarrierDashboard() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    submissions: 0,
    reviewed: 0,
    quoted: 0,
    bound: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function loadSubmissions() {
    try {
      const response = await fetch(`${API}/submissions`);
      if (!response.ok) throw new Error('Failed to load submissions');
      
      const data = await response.json();
      
      // Transform real submissions for carrier view
      const activeStatuses = ['draft', 'in_review', 'reviewed', 'quoted', 'bound'];
      const activeSubmissions = data.filter((sub: any) =>
        activeStatuses.includes((sub.status || 'draft').toLowerCase()),
      );

      const carrierSubmissions = activeSubmissions.map((sub: any) => ({
        id: sub.id,
        companyName: sub.businessName,
        industry: sub.industryLabel || 'Not specified',
        status: (sub.status || 'draft') as string,
        carrierAppetite: getRandomAppetite(),
        potentialPremium: getRandomPremium(),
      }));
      
      setSubmissions(carrierSubmissions);
      
      // Calculate metrics based on actual data
      const reviewedStatuses = ['reviewed', 'quoted', 'bound'];
      const quotedStatuses = ['quoted', 'bound'];
      const boundStatuses = ['bound'];

      setMetrics({
        submissions: activeSubmissions.length,
        reviewed: activeSubmissions.filter((s: any) =>
          reviewedStatuses.includes((s.status || '').toLowerCase()),
        ).length,
        quoted: activeSubmissions.filter((s: any) =>
          quotedStatuses.includes((s.status || '').toLowerCase()),
        ).length,
        bound: activeSubmissions.filter((s: any) =>
          boundStatuses.includes((s.status || '').toLowerCase()),
        ).length,
      });
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setLoading(false);
    }
  }

  function getRandomAppetite() {
    const appetites = ['High', 'Medium', 'Low'];
    return appetites[Math.floor(Math.random() * appetites.length)];
  }

  function getRandomPremium() {
    return Math.floor(Math.random() * 50000) + 50000; // 50k-100k
  }

  // Calculate ratios
  const ratios = {
    submissionsToReview: metrics.reviewed / Math.max(metrics.submissions, 1),
    reviewToQuote: metrics.quoted / Math.max(metrics.reviewed, 1),
    quoteToBind: metrics.bound / Math.max(metrics.quoted, 1),
    submitToBind: metrics.bound / Math.max(metrics.submissions, 1)
  };

  const getAppetiteColor = (appetite: string) => {
    switch (appetite.toLowerCase()) {
      case 'high': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'text-gray-600 bg-gray-100';
      case 'in_review':
        return 'text-blue-600 bg-blue-100';
      case 'reviewed':
        return 'text-purple-600 bg-purple-100';
      case 'quoted':
        return 'text-indigo-600 bg-indigo-100';
      case 'bound':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatStatusLabel = (status: string) =>
    status
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Submission Pipeline Metrics</h2>
          
          {/* Main Metrics with Progress Bars */}
          <div className="grid grid-cols-4 gap-6 mb-6">
            {[
              { label: 'Total Submissions', value: metrics.submissions, color: 'bg-blue-500' },
              { label: 'Reviewed', value: metrics.reviewed, color: 'bg-yellow-500' },
              { label: 'Quoted', value: metrics.quoted, color: 'bg-orange-500' },
              { label: 'Bound', value: metrics.bound, color: 'bg-green-500' }
            ].map((metric, index) => {
              const maxValue = Math.max(metrics.submissions, 1);
              const percentage = (metric.value / maxValue) * 100;
              
              return (
                <div key={metric.label} className="text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-2">{metric.value}</div>
                  <div className="text-sm text-gray-600 mb-3">{metric.label}</div>
                  
                  {/* Horizontal Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <div 
                      className={`h-3 rounded-full ${metric.color} transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>

          {/* Ratio Subtitles */}
          <div className="grid grid-cols-4 gap-6 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{(ratios.submissionsToReview * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Submissions-to-Review</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{(ratios.reviewToQuote * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Review-to-Quote</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{(ratios.quoteToBind * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Quote-to-Bind</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{(ratios.submitToBind * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Submit-to-Bind</div>
            </div>
          </div>
        </div>

        {/* New Submissions Queue */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">New Submissions Queue</h2>
            <p className="text-gray-600 text-sm mt-1">Submissions awaiting carrier review</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Carrier Appetite
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Potential Premium
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {submissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{submission.companyName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{submission.industry}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(submission.status)}`}>
                        {formatStatusLabel(submission.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAppetiteColor(submission.carrierAppetite)}`}>
                        {submission.carrierAppetite}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${submission.potentialPremium.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link 
                        href={`/carrier/submissions/${submission.id}`}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <div className="text-gray-500 text-lg">Loading submissions...</div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg">No submissions found</div>
              <div className="text-gray-400 text-sm mt-1">Submissions will appear here when businesses apply for insurance</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
