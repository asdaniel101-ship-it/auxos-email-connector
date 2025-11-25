# Fix: Can't Change Build Command in Vercel

## The Problem
Vercel auto-detected your project as a Next.js/web app and set the build command to `pnpm --filter web run build`. You need to override this for the API.

## Solution: Override Build Command

### Method 1: In Project Settings (Recommended)

1. **Make sure you're in the API project** (not your frontend project)
   - Check the project name in the top left
   - It should be something like `auxo-api` or a new project name

2. Go to **Settings** → **General**

3. Scroll down to **"Build & Development Settings"** section

4. Find the **"Build Command"** field

5. Look for an **"Override"** button or **"Edit"** button next to it
   - If you see "Override", click it
   - If you see a lock icon 🔒, click it to unlock
   - If you see "Edit", click it

6. Change the build command from:
   ```
   pnpm --filter web run build
   ```
   to:
   ```
   pnpm install && pnpm --filter api run build
   ```

7. Click **"Save"**

8. Go to **Deployments** tab

9. Click the **"..."** (three dots) on the latest deployment

10. Click **"Redeploy"**

### Method 2: If Override Button Doesn't Exist

If you don't see an "Override" or "Edit" button:

1. Go to **Settings** → **General**

2. Scroll to **"Framework Preset"**

3. Click **"Override"** or **"Change"**

4. Select **"Other"** or **"Node.js"** (not Next.js)

5. This should unlock the Build Command field

6. Now change the Build Command to:
   ```
   pnpm install && pnpm --filter api run build
   ```

7. Click **"Save"** and **"Redeploy"**

### Method 3: Create New Project (If Above Doesn't Work)

If you still can't change it:

1. **Delete the current API project** (if you just created it)
   - Settings → General → Scroll to bottom → "Delete Project"

2. Create a **NEW** project:
   - Click "Add New..." → "Project"
   - Import your repo
   - **Before clicking Deploy**, click **"Configure Project"**

3. In the configuration screen:
   - **Framework Preset**: Select **"Other"** (NOT Next.js)
   - **Build Command**: Enter `pnpm install && pnpm --filter api run build`
   - **Root Directory**: Leave empty
   - **Output Directory**: Leave empty

4. Click **"Deploy"**

## Verify It's Working

After redeploying, check the build logs:

1. Go to **Deployments** → Click on the latest deployment

2. Check the build logs - you should see:
   ```
   Running "pnpm install && pnpm --filter api run build"
   ```

3. If you see `pnpm --filter web run build`, the override didn't work - try Method 2 or 3

## Still Having Issues?

If none of the above work:
- Make sure you're in a **separate project** from your frontend
- Try using Vercel CLI to set the build command:
  ```bash
  vercel env add BUILD_COMMAND
  # Enter: pnpm install && pnpm --filter api run build
  ```
- Or contact Vercel support - they can unlock the settings for you

