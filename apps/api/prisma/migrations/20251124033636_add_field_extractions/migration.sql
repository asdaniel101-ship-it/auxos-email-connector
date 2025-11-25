-- CreateTable
CREATE TABLE "FieldExtraction" (
    "id" TEXT NOT NULL,
    "extractionResultId" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldValue" TEXT,
    "source" TEXT NOT NULL,
    "documentId" TEXT,
    "documentChunk" TEXT,
    "highlightedText" TEXT,
    "chunkStartIndex" INTEGER,
    "chunkEndIndex" INTEGER,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FieldExtraction_extractionResultId_idx" ON "FieldExtraction"("extractionResultId");

-- CreateIndex
CREATE INDEX "FieldExtraction_fieldPath_idx" ON "FieldExtraction"("fieldPath");

-- CreateIndex
CREATE INDEX "FieldExtraction_fieldName_idx" ON "FieldExtraction"("fieldName");

-- CreateIndex
CREATE INDEX "FieldExtraction_source_idx" ON "FieldExtraction"("source");

-- AddForeignKey
ALTER TABLE "FieldExtraction" ADD CONSTRAINT "FieldExtraction_extractionResultId_fkey" FOREIGN KEY ("extractionResultId") REFERENCES "ExtractionResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
