import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Insurance Platform
          </h1>
          <p className="text-xl text-gray-600">
            Streamlined insurance submission and quote management
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* SMB Side */}
          <div className="bg-white rounded-lg shadow-lg p-8 border">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Business Owner</h2>
              <p className="text-gray-600 mb-6">
                Submit your insurance application, upload documents, and get quotes from multiple carriers.
              </p>
              <Link
                href="/intake"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Start Application →
              </Link>
            </div>
          </div>

          {/* Carrier Side */}
          <div className="bg-white rounded-lg shadow-lg p-8 border">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Insurance Carrier</h2>
              <p className="text-gray-600 mb-6">
                Review submissions, manage quotes, and track your pipeline with advanced analytics.
              </p>
              <Link
                href="/carrier"
                className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                Carrier Dashboard →
              </Link>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-500 text-sm">
            Choose your role to access the appropriate platform features
          </p>
        </div>
      </div>
    </div>
  );
}