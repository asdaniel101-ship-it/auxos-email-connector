# AWS S3 Setup Guide (Quick & Easy)

## Step 1: Create AWS Account (if you don't have one)
1. Go to https://aws.amazon.com/
2. Click "Create an AWS Account"
3. You'll need a credit card, but the free tier includes:
   - 5 GB storage
   - 20,000 GET requests
   - 2,000 PUT requests
   - per month for 12 months

## Step 2: Create S3 Bucket
1. Go to https://console.aws.amazon.com/s3/
2. Click "Create bucket" (orange button)
3. Fill in:
   - **Bucket name**: `documents` (or any name - we'll configure it in env vars)
     - Note: S3 bucket names must be globally unique, lowercase, no spaces
     - If `documents` is taken, try `auxo-documents-[yourname]` or `documents-[random]`
   - **AWS Region**: Choose closest to you (e.g., `us-east-1` for Virginia, `us-west-2` for Oregon)
   - **Object Ownership**: ACLs disabled (recommended)
   - **Block Public Access**: Keep all checked (we'll use presigned URLs, not public access)
   - **Bucket Versioning**: Disable (unless you need it)
   - **Default encryption**: Enable (SSE-S3 is fine)
4. Click "Create bucket"

## Step 3: Create IAM User for API Access
1. Go to https://console.aws.amazon.com/iam/
2. Click "Users" in left sidebar
3. Click "Create user"
4. **User name**: `auxo-storage-user`
5. Click "Next"
6. **Select "Attach policies directly"**
7. Search for and select: `AmazonS3FullAccess` (or create a custom policy for just your bucket - see below)
8. Click "Next" → "Create user"

## Step 4: Create Access Keys
1. Click on the user you just created (`auxo-storage-user`)
2. Click "Security credentials" tab
3. Scroll to "Access keys"
4. Click "Create access key"
5. Select "Application running outside AWS"
6. Click "Next" → "Create access key"
7. **IMPORTANT**: Copy both:
   - **Access key ID** (starts with `AKIA...`)
   - **Secret access key** (long string - you can only see this once!)
8. Save these securely!

## Step 5: Get Your Endpoint
- For most regions: `s3.amazonaws.com`
- Or use region-specific: `s3.us-east-1.amazonaws.com` (replace with your region)

## Step 6: Environment Variables for Vercel
Once you have everything, provide me:
- `MINIO_ENDPOINT`: `s3.amazonaws.com` (or your region-specific endpoint like `s3.us-east-1.amazonaws.com`)
- `MINIO_ACCESS_KEY`: Your Access Key ID (starts with `AKIA...`)
- `MINIO_SECRET_KEY`: Your Secret Access Key
- `MINIO_USE_SSL`: `true`
- `MINIO_PORT`: `443`
- `MINIO_BUCKET_NAME`: Your S3 bucket name (e.g., `documents` or `auxo-documents-123`)

---

## Optional: Custom IAM Policy (More Secure)

If you want to limit access to just your bucket, create a custom policy:

1. Go to IAM → Policies → Create policy
2. Click "JSON" tab
3. Paste this (replace `auxo-documents` with your bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::auxo-documents",
        "arn:aws:s3:::auxo-documents/*"
      ]
    }
  ]
}
```

4. Name it: `AuxoStoragePolicy`
5. Attach this policy to your user instead of `AmazonS3FullAccess`

---

## Cost Estimate
- **Free tier**: 5 GB storage + 20K requests/month (first 12 months)
- **After free tier**: ~$0.023 per GB storage + $0.0004 per 1,000 requests
- For a small app: Usually $0-5/month

