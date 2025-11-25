# Setup Guide

This guide will help you get the Auxo platform running on your computer. Follow these steps in order.

## What You Need

Before you start, make sure you have these installed on your computer:

1. **Node.js** (version 18 or higher)
   - Download from: https://nodejs.org/
   - This lets you run JavaScript code

2. **pnpm** (package manager)
   - After installing Node.js, open your terminal and run:
   ```bash
   npm install -g pnpm
   ```
   - This helps install all the code libraries we need

3. **Docker Desktop**
   - Download from: https://www.docker.com/products/docker-desktop/
   - This runs the database and file storage on your computer
   - Make sure Docker Desktop is running before you continue

4. **Git** (if you don't have it)
   - Download from: https://git-scm.com/
   - This lets you download the code

## Step 1: Get the Code

1. Open your terminal (or command prompt on Windows)
2. Navigate to where you want to save the project (like your Desktop or Documents folder)
3. If you have the code already, navigate to the project folder:
   ```bash
   cd insurance-app
   ```
   
   Or if you need to download it, ask for the repository URL and run:
   ```bash
   git clone <repository-url>
   cd insurance-app
   ```

## Step 2: Install Dependencies

This downloads all the code libraries the project needs:

```bash
pnpm install
```

This might take a few minutes. Wait until it finishes.

## Step 3: Set Up the Database

1. Start Docker Desktop (make sure it's running)
2. In your terminal, run:
   ```bash
   pnpm run up
   ```
   This starts the database and file storage services.

3. Wait about 30 seconds for everything to start up.

4. Set up the database tables:
   ```bash
   pnpm run migrate
   ```

5. (Optional) Add some test data:
   ```bash
   cd apps/api
   pnpm run seed
   cd ../..
   ```

## Step 4: Set Up Environment Variables

1. Create a file called `.env` in the `apps/api` folder
2. Copy this template and fill in your values:

```env
# Database (this should work as-is if Docker is running)
DATABASE_URL="postgresql://dev:dev@localhost:5432/app?schema=public"

# OpenAI API Key (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY="your-openai-api-key-here"

# Gmail for email processing (optional - only needed for email intake)
GMAIL_EMAIL="your-email@gmail.com"
GMAIL_APP_PASSWORD="your-gmail-app-password"

# File Storage (this should work as-is if Docker is running)
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="dev"
MINIO_SECRET_KEY="dev12345"
MINIO_USE_SSL="false"

# API Port (default is 4000)
PORT=4000
```

**Important Notes:**
- For **OpenAI API Key**: Sign up at https://platform.openai.com/ and create an API key
- For **Gmail App Password**: 
  - Go to your Google Account settings
  - Enable 2-factor authentication
  - Generate an "App Password" for this application
  - Use that password (not your regular Gmail password)

## Step 5: Run the Application

You need to run two things at the same time:

### Terminal 1: Start the API (Backend)
```bash
pnpm run api
```

Wait until you see: `🚀 API running at http://localhost:4000`

### Terminal 2: Start the Website (Frontend)
Open a **new terminal window** and run:
```bash
pnpm run web
```

Wait until you see: `Ready on http://localhost:3000`

## Step 6: Open in Your Browser

1. Open your web browser
2. Go to: http://localhost:3000
3. You should see the Auxo homepage!

## Troubleshooting

### "Port already in use" error
- Something else is using port 3000 or 4000
- Close other applications or change the ports in the `.env` file

### "Cannot connect to database" error
- Make sure Docker Desktop is running
- Try running `pnpm run down` then `pnpm run up` again

### "Module not found" errors
- Run `pnpm install` again in the root folder

### API won't start
- Check that your `.env` file exists in `apps/api` folder
- Make sure all required values are filled in

## Stopping the Application

1. In both terminal windows, press `Ctrl + C` to stop
2. To stop Docker services:
   ```bash
   pnpm run down
   ```

## Need Help?

If you get stuck, check:
- Docker Desktop is running
- All environment variables are set correctly
- You're in the right folder when running commands
- Your terminal/command prompt has the right permissions

## What's Next?

Once everything is running:
- Visit http://localhost:3000 to see the homepage
- Visit http://localhost:4000/docs to see the API documentation
- Visit http://localhost:4000/health to check if the API is working

