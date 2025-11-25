-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "documentType" TEXT,
ADD COLUMN     "processingError" TEXT,
ADD COLUMN     "processingStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "source" TEXT,
    "extractedText" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractedField_submissionId_idx" ON "ExtractedField"("submissionId");

-- CreateIndex
CREATE INDEX "ExtractedField_documentId_idx" ON "ExtractedField"("documentId");

-- CreateIndex
CREATE INDEX "ExtractedField_fieldName_idx" ON "ExtractedField"("fieldName");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedField_documentId_fieldName_key" ON "ExtractedField"("documentId", "fieldName");

-- CreateIndex
CREATE INDEX "Document_documentType_idx" ON "Document"("documentType");

-- AddForeignKey
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
