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
   * Parse PDF and extract text with improved formatting for LLM readability
   */
  private async parsePdf(buffer: Buffer): Promise<string> {
    try {
      // pdf-parse v2.x exports PDFParse as a class constructor that must be instantiated with 'new'
      // When instantiated with 'new PDFParse(buffer)', it returns a promise that resolves to the parsed data
      if (!PDFParseClass || typeof PDFParseClass !== 'function') {
        throw new Error('PDFParse class not found in pdf-parse module');
      }
      
      let rawText = '';
      
      // Check if it's a class constructor (has prototype)
      if (PDFParseClass.prototype) {
        // It's a class constructor - must use 'new'
        const instance = new PDFParseClass(buffer);
        // The instance should be a promise
        if (instance && typeof instance.then === 'function') {
          const data = await instance;
          rawText = data.text || '';
        } else {
          // If it's not a promise, it might be the data directly
          rawText = (instance as any).text || '';
        }
      } else {
        // It's a function, call it directly (for older versions)
        const data = await PDFParseClass(buffer);
        rawText = data.text || '';
      }
      
      // Post-process the text to improve LLM readability
      return this.enhancePdfText(rawText);
    } catch (error) {
      this.logger.error('Error parsing PDF:', error);
      
      // If the error is about needing 'new', try with 'new' explicitly
      if (error instanceof Error && error.message.includes('cannot be invoked without')) {
        try {
          this.logger.log('Retrying PDF parse with explicit new operator');
          const instance = new PDFParseClass(buffer);
          if (instance && typeof instance.then === 'function') {
            const data = await instance;
            return this.enhancePdfText(data.text || '');
          } else {
            return this.enhancePdfText((instance as any).text || '');
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
   * Enhance PDF text to improve LLM readability
   * Handles common issues like column layouts, tables, and formatting
   */
  private enhancePdfText(text: string): string {
    if (!text) return '';
    
    let enhanced = text;
    
    // Normalize whitespace but preserve line breaks
    enhanced = enhanced.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Detect and preserve table-like structures (rows with consistent separators)
    // Look for patterns like "Label: Value" or "Label | Value"
    const lines = enhanced.split('\n');
    const processedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (!trimmed) {
        processedLines.push('');
        continue;
      }
      
      // Detect key-value pairs with common separators
      const colonMatch = trimmed.match(/^([^:]+?):\s*(.+)$/);
      if (colonMatch) {
        const key = colonMatch[1].trim();
        const value = colonMatch[2].trim();
        // Format as clear key-value pair
        processedLines.push(`${key}: ${value}`);
        continue;
      }
      
      // Detect pipe-separated values (common in tables)
      if (trimmed.includes('|') && trimmed.split('|').length >= 2) {
        const parts = trimmed.split('|').map(p => p.trim()).filter(p => p);
        if (parts.length >= 2) {
          // Try to pair adjacent parts as key-value if they look like pairs
          let formatted = '';
          for (let j = 0; j < parts.length; j += 2) {
            if (j + 1 < parts.length) {
              formatted += (formatted ? ' | ' : '') + `${parts[j]}: ${parts[j + 1]}`;
            } else {
              formatted += (formatted ? ' | ' : '') + parts[j];
            }
          }
          processedLines.push(formatted || trimmed);
          continue;
        }
      }
      
      // Detect tab-separated values
      if (trimmed.includes('\t')) {
        const parts = trimmed.split('\t').map(p => p.trim()).filter(p => p);
        if (parts.length >= 2) {
          processedLines.push(parts.join(' | '));
          continue;
        }
      }
      
      // Preserve the line as-is
      processedLines.push(trimmed);
    }
    
    enhanced = processedLines.join('\n');
    
    // Add spacing around section headers (all caps or numbered sections)
    enhanced = enhanced.replace(/(\n)([A-Z][A-Z\s]{3,})(\n)/g, '$1\n=== $2 ===\n');
    
    // Normalize multiple blank lines to max 2
    enhanced = enhanced.replace(/\n{3,}/g, '\n\n');
    
    return enhanced;
  }

  /**
   * Parse Excel and extract text (convert to structured format preserving context)
   */
  private async parseExcel(buffer: Buffer): Promise<string> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';

      // Process all sheets
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        
        // Try to detect if first row is headers
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        const jsonDataWithHeaders = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
        
        text += `\n=== Sheet: ${sheetName} ===\n`;
        
        // Check if first row looks like headers (non-empty cells)
        const firstRow = jsonData[0] as any[];
        const hasHeaders = firstRow && firstRow.some((cell: any) => 
          cell && typeof cell === 'string' && cell.trim().length > 0
        );
        
        if (hasHeaders && jsonData.length > 1) {
          // Format as key-value pairs for better LLM readability
          text += 'HEADERS: ' + firstRow.join(' | ') + '\n\n';
          
          // Process remaining rows with header context
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (row && row.some((cell: any) => cell !== '' && cell !== null && cell !== undefined)) {
              // Create key-value pairs
              const rowPairs: string[] = [];
              for (let j = 0; j < Math.max(firstRow.length, row.length); j++) {
                const header = firstRow[j] || `Column${j + 1}`;
                const value = row[j] !== undefined && row[j] !== null ? String(row[j]) : '';
                if (value.trim()) {
                  rowPairs.push(`${header}: ${value}`);
                }
              }
              if (rowPairs.length > 0) {
                text += 'ROW ' + i + ': ' + rowPairs.join(' | ') + '\n';
              }
            }
          }
        } else {
          // No clear headers, use tab-separated format but preserve structure
          for (const row of jsonData) {
            if (Array.isArray(row) && row.some((cell: any) => cell !== '' && cell !== null && cell !== undefined)) {
              text += row.map(cell => cell !== null && cell !== undefined ? String(cell) : '').join('\t') + '\n';
            }
          }
        }
        text += '\n';
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
  /**
   * Parse Word document and extract text with improved formatting
   */
  private async parseWord(buffer: Buffer): Promise<string> {
    try {
      // Extract raw text
      const result = await mammoth.extractRawText({ buffer });
      let text = result.value;
      
      // Try to extract HTML for better table/structure detection
      try {
        const htmlResult = await mammoth.convertToHtml({ buffer });
        if (htmlResult.value) {
          // Extract text from HTML but preserve table structure
          const htmlText = htmlResult.value
            .replace(/<table[^>]*>/gi, '\n\n=== TABLE START ===\n')
            .replace(/<\/table>/gi, '\n=== TABLE END ===\n\n')
            .replace(/<tr[^>]*>/gi, '\nROW: ')
            .replace(/<\/tr>/gi, '')
            .replace(/<td[^>]*>/gi, ' | ')
            .replace(/<\/td>/gi, '')
            .replace(/<th[^>]*>/gi, ' HEADER: ')
            .replace(/<\/th>/gi, '')
            .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
          
          // Use HTML-extracted text if it has better structure (tables detected)
          if (htmlText.includes('TABLE START')) {
            text = htmlText;
          }
        }
      } catch (htmlError) {
        // If HTML conversion fails, just use raw text
        this.logger.debug('HTML conversion failed, using raw text:', htmlError);
      }
      
      // Post-process to improve readability
      return this.enhanceWordText(text);
    } catch (error) {
      this.logger.error('Error parsing Word document:', error);
      throw error;
    }
  }

  /**
   * Enhance Word document text for better LLM readability
   */
  private enhanceWordText(text: string): string {
    if (!text) return '';
    
    let enhanced = text;
    
    // Normalize whitespace
    enhanced = enhanced.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Detect and format key-value pairs
    const lines = enhanced.split('\n');
    const processedLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        processedLines.push('');
        continue;
      }
      
      // Format key-value pairs
      const colonMatch = trimmed.match(/^([^:]+?):\s*(.+)$/);
      if (colonMatch) {
        processedLines.push(`${colonMatch[1].trim()}: ${colonMatch[2].trim()}`);
        continue;
      }
      
      processedLines.push(trimmed);
    }
    
    enhanced = processedLines.join('\n');
    
    // Normalize multiple blank lines
    enhanced = enhanced.replace(/\n{3,}/g, '\n\n');
    
    return enhanced;
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

