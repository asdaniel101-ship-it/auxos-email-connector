# API Build Fix Instructions

The build is failing because `pnpm install` is exiting with error code 1. 

## Try This Fix:

1. **Go to API Project Settings**: https://vercel.com/ashton-daniels-projects/auxos-email-connector2-api/settings/general

2. **Update Build Command** to:
   ```
   pnpm install --no-frozen-lockfile && cd apps/api && pnpm prisma generate && pnpm build
   ```

3. **Update Install Command** to:
   ```
   pnpm install --no-frozen-lockfile
   ```

4. **Ensure Root Directory is EMPTY** (not `apps/api`)

5. **Output Directory**: `apps/api/dist`

6. **Framework Preset**: `Other`

7. **Trigger a new deployment**

## Alternative: If pnpm continues to fail, try using npm:

**Build Command**:
```
npm install && cd apps/api && npm run prisma:generate && npm run build
```

**Install Command**:
```
npm install
```

But you'll need to update `package.json` to add `prisma:generate` script first.

