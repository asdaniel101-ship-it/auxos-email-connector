import * as Minio from 'minio';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

// pdf-parse is a CommonJS module - PDFParse is a class
const { PDFParse } = require('pdf-parse');

// Types
interface ExtractionConfig {
  documentTypes: {
    [key: string]: {
      label: string;
      description: string;
      keywords: string[];
    };
  };
  fieldExtractionInstructions: {
    [fieldName: string]: {
      label: string;
      mandatory: boolean;
      instructions: string;
      keywords: string[];
      documentTypes: string[];
      patterns: string[];
    };
  };
}

interface ExtractedFieldData {
  fieldName: string;
  fieldValue: string;
  confidence: number;
  source: string;
  extractedText: string;
}

// Initialize MinIO client
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'dev',
  secretKey: process.env.MINIO_SECRET_KEY || 'dev12345',
});

export async function ping() {
  return 'pong';
}

/**
 * Download a file from MinIO and return it as a Buffer
 */
export async function downloadFile(fileKey: string): Promise<Buffer> {
  const bucketName = 'documents';
  
  try {
    const stream = await minioClient.getObject(bucketName, fileKey);
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err: Error) => reject(new Error(`Failed to download file: ${err.message}`)));
    });
  } catch (error) {
    throw new Error(`Failed to get object from MinIO: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from a PDF buffer
 */
export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    // PDFParse is a class that needs to be instantiated with the PDF data
    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    return result.text;
  } catch (error) {
    throw new Error(`Failed to extract PDF text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search for specific text in a document
 * Returns boolean indicating whether all search terms were found
 */
export async function searchTextInDocument(
  text: string,
  searchTerms: string[]
): Promise<{ found: Record<string, boolean>; matches: string[] }> {
  const normalizedText = text.toLowerCase();
  const found: Record<string, boolean> = {};
  const matches: string[] = [];

  for (const term of searchTerms) {
    const normalizedTerm = term.toLowerCase();
    const isFound = normalizedText.includes(normalizedTerm);
    found[term] = isFound;
    if (isFound) {
      matches.push(term);
    }
  }

  return { found, matches };
}

/**
 * Get submission data from database (via API)
 * In production, you'd use Prisma directly or a database connection
 */
export async function getSubmissionFromAPI(submissionId: string): Promise<any> {
  const apiUrl = process.env.API_URL || 'http://localhost:4000';
  
  const response = await fetch(`${apiUrl}/submissions/${submissionId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch submission: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Update submission via API
 */
export async function updateSubmissionViaAPI(submissionId: string, data: any): Promise<any> {
  const apiUrl = process.env.API_URL || 'http://localhost:4000';
  
  const response = await fetch(`${apiUrl}/submissions/${submissionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to update submission: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Load extraction configuration from JSON file
 */
export async function loadExtractionConfig(): Promise<ExtractionConfig> {
  const configPath = path.join(__dirname, '../../../apps/api/extraction-config.json');
  const configContent = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(configContent);
}

/**
 * Classify document type based on text content
 */
export async function classifyDocument(text: string, config: ExtractionConfig): Promise<string | null> {
  const textLower = text.toLowerCase();
  let bestMatch: { type: string; score: number } | null = null;

  for (const [docType, docConfig] of Object.entries(config.documentTypes)) {
    let score = 0;
    
    // Count keyword matches
    for (const keyword of docConfig.keywords) {
      const keywordLower = keyword.toLowerCase();
      // Count occurrences of this keyword
      const matches = textLower.split(keywordLower).length - 1;
      score += matches;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { type: docType, score };
    }
  }

  // Return type if we found at least 2 keyword matches
  return bestMatch && bestMatch.score >= 2 ? bestMatch.type : null;
}

/**
 * Extract fields from document text based on configuration
 */
export async function extractFields(
  text: string,
  config: ExtractionConfig,
  documentType: string | null
): Promise<ExtractedFieldData[]> {
  const extractedFields: ExtractedFieldData[] = [];

  for (const [fieldName, fieldConfig] of Object.entries(config.fieldExtractionInstructions)) {
    // Skip if this document type doesn't match the field's expected types
    if (documentType && !fieldConfig.documentTypes.includes(documentType)) {
      continue;
    }

    let foundValue: string | null = null;
    let confidence = 0;
    let extractedText = '';

    // Try regex patterns first
    for (const pattern of fieldConfig.patterns) {
      try {
        const regex = new RegExp(pattern, 'im');
        const match = text.match(regex);
        if (match && match[1]) {
          foundValue = match[1].trim();
          confidence = 0.9; // High confidence for regex matches
          
          // Capture surrounding context (300 chars before and after)
          const matchIndex = match.index || 0;
          const contextStart = Math.max(0, matchIndex - 300);
          const contextEnd = Math.min(text.length, matchIndex + match[0].length + 300);
          extractedText = text.substring(contextStart, contextEnd);
          
          break;
        }
      } catch (error) {
        console.error(`Invalid regex pattern for ${fieldName}:`, pattern);
      }
    }

    // If no regex match, try keyword search
    if (!foundValue) {
      for (const keyword of fieldConfig.keywords) {
        const keywordRegex = new RegExp(`${keyword}[:\\s]+([^\\n]{1,100})`, 'i');
        const match = text.match(keywordRegex);
        if (match && match[1]) {
          foundValue = match[1].trim();
          confidence = 0.7; // Medium confidence for keyword matches
          
          // Capture surrounding context (300 chars before and after)
          const matchIndex = match.index || 0;
          const contextStart = Math.max(0, matchIndex - 300);
          const contextEnd = Math.min(text.length, matchIndex + match[0].length + 300);
          extractedText = text.substring(contextStart, contextEnd);
          
          break;
        }
      }
    }

    // Add to results if we found something
    if (foundValue) {
      extractedFields.push({
        fieldName,
        fieldValue: foundValue,
        confidence,
        source: 'Document text extraction',
        extractedText: extractedText.substring(0, 1000), // Increased limit to 1000 chars for context
      });
    }
  }

  return extractedFields;
}

/**
 * Save extracted fields to database
 */
export async function saveExtractedFields(
  submissionId: string,
  documentId: string,
  fields: ExtractedFieldData[]
): Promise<number> {
  const apiUrl = process.env.API_URL || 'http://localhost:4000';
  let savedCount = 0;

  for (const field of fields) {
    try {
      const response = await fetch(`${apiUrl}/extracted-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          documentId,
          ...field,
        }),
      });

      if (response.ok) {
        savedCount++;
      } else {
        console.error(`Failed to save field ${field.fieldName}:`, await response.text());
      }
    } catch (error) {
      console.error(`Error saving field ${field.fieldName}:`, error);
    }
  }

  return savedCount;
}

/**
 * Update document processing status
 */
export async function updateDocumentStatus(
  documentId: string,
  status: string,
  documentType?: string | null,
  error?: string
): Promise<void> {
  const apiUrl = process.env.API_URL || 'http://localhost:4000';
  const updateData: any = { processingStatus: status };
  
  if (documentType) updateData.documentType = documentType;
  if (error) updateData.processingError = error;

  const response = await fetch(`${apiUrl}/documents/${documentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    console.error(`Failed to update document status: ${await response.text()}`);
  }
}

/**
 * Get document info from API
 */
export async function getDocumentFromAPI(documentId: string): Promise<any> {
  const apiUrl = process.env.API_URL || 'http://localhost:4000';
  
  const response = await fetch(`${apiUrl}/documents/${documentId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.statusText}`);
  }

  return response.json();
}
