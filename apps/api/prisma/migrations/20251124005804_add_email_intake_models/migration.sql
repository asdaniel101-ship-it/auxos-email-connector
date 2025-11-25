-- CreateEnum
CREATE TYPE "EmailProcessingStatus" AS ENUM ('pending', 'processing', 'done', 'error');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('new_business', 'renewal', 'endorsement', 'other');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('email_body', 'acord', 'sov', 'loss_run', 'schedule', 'supplemental', 'other');

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT[],
    "cc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "rawMimeStorageKey" TEXT,
    "isSubmission" BOOLEAN NOT NULL DEFAULT false,
    "submissionType" "SubmissionType",
    "processingStatus" "EmailProcessingStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAttachment" (
    "id" TEXT NOT NULL,
    "emailMessageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL DEFAULT 'other',
    "parsedTextStorageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionResult" (
    "id" TEXT NOT NULL,
    "emailMessageId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "qaFlags" JSONB,
    "summaryText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_gmailMessageId_key" ON "EmailMessage"("gmailMessageId");

-- CreateIndex
CREATE INDEX "EmailMessage_gmailMessageId_idx" ON "EmailMessage"("gmailMessageId");

-- CreateIndex
CREATE INDEX "EmailMessage_threadId_idx" ON "EmailMessage"("threadId");

-- CreateIndex
CREATE INDEX "EmailMessage_processingStatus_idx" ON "EmailMessage"("processingStatus");

-- CreateIndex
CREATE INDEX "EmailMessage_isSubmission_idx" ON "EmailMessage"("isSubmission");

-- CreateIndex
CREATE INDEX "EmailMessage_receivedAt_idx" ON "EmailMessage"("receivedAt");

-- CreateIndex
CREATE INDEX "EmailAttachment_emailMessageId_idx" ON "EmailAttachment"("emailMessageId");

-- CreateIndex
CREATE INDEX "EmailAttachment_documentType_idx" ON "EmailAttachment"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionResult_emailMessageId_key" ON "ExtractionResult"("emailMessageId");

-- CreateIndex
CREATE INDEX "ExtractionResult_emailMessageId_idx" ON "ExtractionResult"("emailMessageId");

-- AddForeignKey
ALTER TABLE "EmailAttachment" ADD CONSTRAINT "EmailAttachment_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionResult" ADD CONSTRAINT "ExtractionResult_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
