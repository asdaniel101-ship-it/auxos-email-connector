import { Injectable, Logger } from '@nestjs/common';
import { MinioService } from '../files/minio.service';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';

// pdf-parse is a CommonJS module
// In version 2.x, it exports PDFParse as a class constructor that must be instantiated with 'new'
const pdfParseModule = require('pdf-parse');
// Check if PDFParse is a class constructor (has prototype and can be instantiated)
const PDFParseClass = pdfParseModule.PDFParse || pdfParseModule.default || pdfParseModule;

@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  constructor(private minioService: MinioService) {}

  /**
   * Parse a document from MinIO storage and extract text
   */
  async parseDocument(attachment: any): Promise<string> {
    this.logger.log(`Parsing document: ${attachment.filename} (${attachment.contentType})`);

    try {
      // Get file from MinIO
      const minioClient = this.minioService.getClient();
      const dataStream = await minioClient.getObject('documents', attachment.storageKey);
      
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of dataStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Parse based on content type
      const contentType = attachment.contentType?.toLowerCase() || '';
      
      if (contentType.includes('pdf')) {
        return await this.parsePdf(buffer);
      } else if (contentType.includes('excel') || contentType.includes('spreadsheet') || 
                 attachment.filename.toLowerCase().endsWith('.xlsx') || 
                 attachment.filename.toLowerCase().endsWith('.xls')) {
        return await this.parseExcel(buffer);
      } else if (contentType.includes('word') || 
                 attachment.filename.toLowerCase().endsWith('.docx') ||
                 attachment.filename.toLowerCase().endsWith('.doc')) {
        return await this.parseWord(buffer);
      } else {
        // Try to parse as text
        return buffer.toString('utf-8');
      }
    } catch (error) {
      this.logger.error(`Error parsing document ${attachment.filename}:`, error);
      return `[Error parsing document: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  /**
   * Parse PDF and extract text
   */
  private async parsePdf(buffer: Buffer): Promise<string> {
    try {
      // pdf-parse v2.x exports PDFParse as a class constructor that must be instantiated with 'new'
      // When instantiated with 'new PDFParse(buffer)', it returns a promise that resolves to the parsed data
      if (!PDFParseClass || typeof PDFParseClass !== 'function') {
        throw new Error('PDFParse class not found in pdf-parse module');
      }
      
      // Check if it's a class constructor (has prototype)
      if (PDFParseClass.prototype) {
        // It's a class constructor - must use 'new'
        const instance = new PDFParseClass(buffer);
        // The instance should be a promise
        if (instance && typeof instance.then === 'function') {
          const data = await instance;
          return data.text || '';
        } else {
          // If it's not a promise, it might be the data directly
          return (instance as any).text || '';
        }
      } else {
        // It's a function, call it directly (for older versions)
        const data = await PDFParseClass(buffer);
        return data.text || '';
      }
    } catch (error) {
      this.logger.error('Error parsing PDF:', error);
      
      // If the error is about needing 'new', try with 'new' explicitly
      if (error instanceof Error && error.message.includes('cannot be invoked without')) {
        try {
          this.logger.log('Retrying PDF parse with explicit new operator');
          const instance = new PDFParseClass(buffer);
          if (instance && typeof instance.then === 'function') {
            const data = await instance;
            return data.text || '';
          } else {
            return (instance as any).text || '';
          }
        } catch (retryError) {
          this.logger.error('Retry with new also failed:', retryError);
          throw retryError;
        }
      }
      
      throw error;
    }
  }

  /**
   * Parse Excel and extract text (convert to TSV-like format)
   */
  private async parseExcel(buffer: Buffer): Promise<string> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';

      // Process all sheets
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        text += `\n=== Sheet: ${sheetName} ===\n`;
        // Convert rows to text
        for (const row of jsonData) {
          if (Array.isArray(row)) {
            text += row.join('\t') + '\n';
          }
        }
      }

      return text;
    } catch (error) {
      this.logger.error('Error parsing Excel:', error);
      throw error;
    }
  }

  /**
   * Parse Word document and extract text
   */
  private async parseWord(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      this.logger.error('Error parsing Word document:', error);
      throw error;
    }
  }

  /**
   * Parse all attachments and return text by document type
   */
  async parseAllDocuments(attachments: any[], documentClassifications: Map<string, string>): Promise<Map<string, string>> {
    const parsedTexts = new Map<string, string>();

    for (const attachment of attachments) {
      try {
        const text = await this.parseDocument(attachment);
        const docType = documentClassifications.get(attachment.id) || 'other';
        
        // Group by document type
        const existing = parsedTexts.get(docType) || '';
        parsedTexts.set(docType, existing + (existing ? '\n\n' : '') + `=== ${attachment.filename} ===\n${text}`);
      } catch (error) {
        this.logger.error(`Failed to parse ${attachment.filename}:`, error);
        // Continue with other documents
      }
    }

    return parsedTexts;
  }
}

