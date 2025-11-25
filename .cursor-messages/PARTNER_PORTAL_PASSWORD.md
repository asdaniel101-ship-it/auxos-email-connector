# Partner Portal Password Protection

The partner portal is now password-protected. To set the password:

## For Vercel Deployment:

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add a new environment variable:
   - **Name**: `NEXT_PUBLIC_PARTNER_PORTAL_PASSWORD`
   - **Value**: Your desired password (e.g., `your-secure-password-here`)
4. Redeploy your application

## For Local Development:

1. Create or update `.env.local` in the `apps/web` directory
2. Add:
   ```
   NEXT_PUBLIC_PARTNER_PORTAL_PASSWORD=your-secure-password-here
   ```
3. Restart your development server

## Default Password (Development Only):

If no environment variable is set, the default password is: `partner2024`

**Note**: This default should NOT be used in production. Always set a secure password via environment variables.

## How It Works:

- The password is checked client-side using the `NEXT_PUBLIC_PARTNER_PORTAL_PASSWORD` environment variable
- Authentication status is stored in `sessionStorage` (cleared when browser session ends)
- All partner portal routes (`/partners/*`) are protected
- The password prompt appears before any partner portal content is shown

