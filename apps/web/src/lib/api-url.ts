// Helper to get API URL - uses Railway API URL in production, localhost in dev
export function getApiUrl(): string {
  // Always use NEXT_PUBLIC_API_URL if set (for Railway backend)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // In local development, use localhost
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000';
  }
  
  // Fallback: if no env var set in production, this will fail
  // User must set NEXT_PUBLIC_API_URL in Vercel environment variables
  return 'http://localhost:4000';
}

