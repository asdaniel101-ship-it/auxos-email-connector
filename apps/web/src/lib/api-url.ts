// Helper to get API URL - uses Railway API URL in production, localhost in dev
export function getApiUrl(): string {
  // Next.js replaces NEXT_PUBLIC_* env vars at build time
  // In production (Vercel), this will be the Railway URL
  // In local dev, this will be undefined, so we use localhost
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (apiUrl) {
    return apiUrl;
  }
  
  // Local development fallback
  // Check if we're in the browser and on localhost
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:4000';
    }
  }
  
  // Server-side or production without env var - this should not happen in production
  // but provides a fallback
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

