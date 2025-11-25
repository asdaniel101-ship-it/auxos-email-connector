# MinIO/S3 Storage Setup for Production

## Option 1: DigitalOcean Spaces (Recommended - Easiest)

### Step 1: Create a DigitalOcean Space
1. Go to https://cloud.digitalocean.com/spaces
2. Click "Create a Spaces Bucket"
3. Choose:
   - **Datacenter region**: Choose closest to your users (e.g., `nyc3`, `sfo3`, `ams3`)
   - **CDN**: Enable it (recommended for faster access)
   - **Name**: `auxo-documents` (or any name you prefer)
4. Click "Create a Spaces Bucket"

### Step 2: Get Your Credentials
1. Go to https://cloud.digitalocean.com/account/api/spaces
2. Click "Generate New Key"
3. Save:
   - **Access Key** (starts with something like `DO00...`)
   - **Secret Key** (long random string - save this immediately, you can't see it again!)

### Step 3: Create the Bucket
1. In your Space, create a folder called `documents` (or the bucket will be auto-created)
2. Note your Space endpoint (e.g., `nyc3.digitaloceanspaces.com`)

### Step 4: Add Environment Variables to Vercel
Add these to your Vercel project:
- `MINIO_ENDPOINT`: `nyc3.digitaloceanspaces.com` (your region + `.digitaloceanspaces.com`)
- `MINIO_PORT`: `443` (for HTTPS)
- `MINIO_USE_SSL`: `true`
- `MINIO_ACCESS_KEY`: Your DigitalOcean Access Key
- `MINIO_SECRET_KEY`: Your DigitalOcean Secret Key

---

## Option 2: AWS S3

### Step 1: Create S3 Bucket
1. Go to https://console.aws.amazon.com/s3/
2. Click "Create bucket"
3. Name: `auxo-documents`
4. Region: Choose closest to your users
5. Uncheck "Block all public access" (or configure CORS as needed)
6. Click "Create bucket"

### Step 2: Create IAM User
1. Go to https://console.aws.amazon.com/iam/
2. Click "Users" → "Add users"
3. Username: `auxo-storage-user`
4. Check "Provide user access to the AWS Management Console" → "Programmatic access"
5. Attach policy: `AmazonS3FullAccess` (or create custom policy for just your bucket)
6. Save the **Access Key ID** and **Secret Access Key**

### Step 3: Add Environment Variables
- `MINIO_ENDPOINT`: `s3.amazonaws.com`
- `MINIO_PORT`: `443`
- `MINIO_USE_SSL`: `true`
- `MINIO_ACCESS_KEY`: Your AWS Access Key ID
- `MINIO_SECRET_KEY`: Your AWS Secret Access Key

---

## Option 3: Backblaze B2 (Cheapest)

1. Go to https://www.backblaze.com/b2/sign-up.html
2. Create account and bucket
3. Create Application Key with read/write permissions
4. Use endpoint: `s3.us-west-000.backblazeb2.com` (varies by region)
5. Add same environment variables as above

---

## Option 4: Cloudflare R2 (No Egress Fees)

1. Go to https://dash.cloudflare.com/
2. Navigate to R2
3. Create bucket: `auxo-documents`
4. Create API token
5. Use endpoint: `your-account-id.r2.cloudflarestorage.com`
6. Add same environment variables

---

## After Setup

Once you have your credentials, I can add them to Vercel for you. Just provide:
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_USE_SSL` (usually `true`)
- `MINIO_PORT` (usually `443` for HTTPS, or `80` for HTTP)

