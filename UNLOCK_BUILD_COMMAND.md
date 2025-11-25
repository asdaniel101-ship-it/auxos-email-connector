# Unlock Build Command in Vercel

## The Problem
Even with Framework set to "Other", the Build Command is locked with `pnpm --filter web run build`.

## Solution 1: Click the Pencil Icon

1. **Look at the Build Command field** - there's a small pencil icon on the far right
2. **Click that pencil icon** - it should unlock the field
3. **Change** `pnpm --filter web run build` to `pnpm install && pnpm --filter api run build`
4. Click "Deploy"

## Solution 2: Change Root Directory First

Sometimes changing Root Directory unlocks other fields:

1. Click **"Edit"** next to Root Directory
2. Change it to: `apps/api` (temporarily)
3. See if Build Command unlocks
4. If it does, change Build Command
5. Then change Root Directory back to `./` (empty/root)
6. Click "Deploy"

## Solution 3: Use Vercel CLI (Most Reliable)

If the UI won't let you change it, use the CLI:

1. **Don't deploy yet** - close this screen or cancel

2. **Install Vercel CLI** (if you don't have it):
   ```bash
   npm i -g vercel
   ```

3. **In your terminal**, go to your project:
   ```bash
   cd /Users/ashtondaniel/dev/insurance-app
   ```

4. **Link to Vercel**:
   ```bash
   vercel link
   ```
   - It will ask if you want to link to existing project or create new
   - Choose **"Create new project"**
   - Name it: `brokerzeroashton1-api` (or whatever you want)
   - It will create the project

5. **Set build command via CLI**:
   ```bash
   vercel env add BUILD_COMMAND
   ```
   - When prompted, enter: `pnpm install && pnpm --filter api run build`
   - Select environment: `Production`

6. **Or manually edit the project config**:
   After linking, a `.vercel` folder is created. You can also:
   - Go to Vercel dashboard
   - The project should now exist
   - Go to Settings → General
   - The build command might now be editable

7. **Deploy**:
   ```bash
   vercel --prod
   ```

## Solution 4: Create Project Without Auto-Detection

1. **Cancel/close** the current project creation
2. Go back to Vercel dashboard
3. Click "Add New..." → "Project"
4. Import your repo
5. **IMMEDIATELY** click "Configure Project" (before Vercel auto-detects)
6. Set Framework to "Other" FIRST
7. Then set Build Command
8. Deploy

## Solution 5: Use vercel.json to Override

Create/update a `vercel.json` file in your repo root specifically for the API project:

1. **In your code editor**, create `vercel.json` in the root (we might already have one)

2. Make sure it has:
   ```json
   {
     "buildCommand": "pnpm install && pnpm --filter api run build",
     "installCommand": "pnpm install",
     "framework": null
   }
   ```

3. **Commit and push** this file to GitHub

4. **In Vercel**, when you import the repo, it should read this file
5. The build command should be set automatically

## Solution 6: Deploy First, Then Override

Sometimes you can override after the first deployment:

1. **Deploy with the locked command** (it will fail, but that's OK)
2. Go to **Settings** → **General**
3. Scroll to **"Build & Development Settings"**
4. Look for **"Override"** button next to Build Command
5. Click it and change the command
6. **Redeploy**

## Recommended: Try Solutions in This Order

1. ✅ **First**: Click the pencil icon (Solution 1)
2. ✅ **Second**: Change Root Directory, then Build Command (Solution 2)
3. ✅ **Third**: Use Vercel CLI (Solution 3) - most reliable
4. ✅ **Fourth**: Use vercel.json file (Solution 5)

## Quick Test

After you get the build command set, the deployment should:
- Run `pnpm install`
- Then run `pnpm --filter api run build`
- Deploy the API as serverless functions

Check the build logs to verify it's using the correct command.

