-- AlterTable
ALTER TABLE "EmailMessage" ADD COLUMN IF NOT EXISTS "originalMessageId" TEXT;
