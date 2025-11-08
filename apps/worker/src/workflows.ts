import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities';

const { 
  ping,
  downloadFile,
  extractPdfText,
  searchTextInDocument,
  getSubmissionFromAPI,
  updateSubmissionViaAPI,
  loadExtractionConfig,
  classifyDocument,
  extractFields,
  saveExtractedFields,
  updateDocumentStatus,
  getDocumentFromAPI
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
});

/**
 * Example workflow: handles submission processing
 */
export async function submissionWorkflow(submissionId: string): Promise<string> {
  const result = await ping();
  return `Processed submission ${submissionId}: ${result}`;
}

/**
 * Document extraction workflow
 * Orchestrates the complete extraction process for a single document
 */
export async function extractDocumentWorkflow(args: { 
  documentId: string; 
  submissionId: string;
}): Promise<{
  success: boolean;
  documentType: string | null;
  fieldsExtracted: number;
  error?: string;
}> {
  const { documentId, submissionId } = args;
  
  try {
    console.log(`Starting extraction for document ${documentId}`);
    
    // Update status to processing
    await updateDocumentStatus(documentId, 'processing');
    
    // Step 1: Get document info
    const document = await getDocumentFromAPI(documentId);
    
    // Step 2: Download document from MinIO
    console.log(`Downloading file: ${document.fileKey}`);
    const fileBuffer = await downloadFile(document.fileKey);
    
    // Step 3: Extract text from PDF
    console.log(`Extracting text from PDF`);
    const text = await extractPdfText(fileBuffer);
    
    if (!text || text.length < 10) {
      throw new Error('No text could be extracted from document');
    }
    
    // Step 4: Load extraction configuration
    console.log(`Loading extraction config`);
    const config = await loadExtractionConfig();
    
    // Step 5: Classify document type
    console.log(`Classifying document`);
    const documentType = await classifyDocument(text, config);
    console.log(`Document classified as: ${documentType || 'unknown'}`);
    
    // Step 6: Extract fields based on configuration
    console.log(`Extracting fields`);
    const extractedFields = await extractFields(text, config, documentType);
    console.log(`Extracted ${extractedFields.length} fields`);
    
    // Step 7: Save extracted fields to database
    console.log(`Saving extracted fields`);
    const savedCount = await saveExtractedFields(submissionId, documentId, extractedFields);
    console.log(`Saved ${savedCount} fields to database`);
    
    // Step 8: Update document status to completed
    await updateDocumentStatus(documentId, 'completed', documentType);
    
    return {
      success: true,
      documentType,
      fieldsExtracted: savedCount,
    };
    
  } catch (error) {
    console.error(`Error extracting document ${documentId}:`, error);
    
    // Update document status to failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateDocumentStatus(documentId, 'failed', null, errorMessage);
    
    return {
      success: false,
      documentType: null,
      fieldsExtracted: 0,
      error: errorMessage,
    };
  }
}

/**
 * Legacy workflow for extracting all documents in a submission
 */
export async function extractSubmissionDocsWorkflow(args: { submissionId: string }): Promise<any> {
  const { submissionId } = args;
  
  // Get submission to find all documents
  const submission = await getSubmissionFromAPI(submissionId);
  
  const results = [];
  
  // Process each document
  for (const doc of submission.documents || []) {
    const result = await extractDocumentWorkflow({
      documentId: doc.id,
      submissionId,
    });
    results.push(result);
  }
  
  return {
    submissionId,
    documentsProcessed: results.length,
    results,
  };
}
