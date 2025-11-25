// Helper to get API URL - uses relative path in production, localhost in dev
export function getApiUrl(): string {
  // In production on Vercel, use relative path
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return '/api';
  }
  // In local development, use localhost
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

