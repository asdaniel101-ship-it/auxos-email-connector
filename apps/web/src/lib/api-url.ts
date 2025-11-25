// Helper to get API URL - uses separate API deployment in production
export function getApiUrl(): string {
  // In production on Vercel, use the separate API deployment
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return process.env.NEXT_PUBLIC_API_URL || 'https://auxos-email-connector2-api.vercel.app';
  }
  // In local development, use localhost
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

