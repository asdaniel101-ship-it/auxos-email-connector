-- AlterTable
ALTER TABLE "EmailMessage" ADD COLUMN IF NOT EXISTS "submissionNumber" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmailMessage_submissionNumber_key" ON "EmailMessage"("submissionNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailMessage_submissionNumber_idx" ON "EmailMessage"("submissionNumber");

