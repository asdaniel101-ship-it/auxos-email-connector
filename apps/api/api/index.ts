// Vercel serverless function entry point
// This is a placeholder - the API is deployed separately on Railway
export default async function handler(req: any, res: any) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      message: 'API is deployed on Railway, not Vercel',
      note: 'This is a placeholder entrypoint for Vercel build compatibility'
    })
  };
}

