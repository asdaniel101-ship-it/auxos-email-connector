#!/bin/bash
# Railway setup script for API
# Run this from apps/api directory

export RAILWAY_TOKEN=a5f910f4-634c-49b9-94e4-75d41b8fa0ad

echo "=== Railway API Setup ==="
echo "Project: 7a7d2d21-e857-4011-9c85-ce5d3057c614"
echo ""

# Link to project (if not already linked)
echo "Linking to project..."
railway link --project 7a7d2d21-e857-4011-9c85-ce5d3057c614

# Check status
echo ""
echo "Current status:"
railway status

# Set environment variables
echo ""
echo "Setting environment variables..."
railway variables --set "DATABASE_URL=your-database-url"
railway variables --set "OPENAI_API_KEY=your-openai-key"
railway variables --set "GMAIL_EMAIL=auxoreachout@gmail.com"
railway variables --set "GMAIL_APP_PASSWORD=your-gmail-app-password"
railway variables --set "FRONTEND_URL=https://auxos-email-connector2.vercel.app"
railway variables --set "MINIO_ENDPOINT=s3.amazonaws.com"
railway variables --set "MINIO_ACCESS_KEY=your-aws-access-key"
railway variables --set "MINIO_SECRET_KEY=your-aws-secret-key"
railway variables --set "MINIO_BUCKET_NAME=auxodocuments"
railway variables --set "MINIO_USE_SSL=true"
railway variables --set "MINIO_PORT=443"

echo ""
echo "=== Setup Complete ==="
echo "To deploy, run: railway up"

