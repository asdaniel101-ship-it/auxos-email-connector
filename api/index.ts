// Vercel serverless function - lazy load NestJS to avoid build-time dependencies
export default async function handler(req: any, res: any) {
  const { default: nestHandler } = await import('../apps/api/vercel');
  return nestHandler(req, res);
}
