import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Dynamic import for OpenAI
let OpenAI: any;
try {
  OpenAI = require('openai').default;
} catch (e) {
  // OpenAI not installed
}

@Injectable()
export class ResponsePackagerService {
  private readonly logger = new Logger(ResponsePackagerService.name);
  private openai: any = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey && OpenAI) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Package extraction result into response format
   */
  async package(extractionResult: any, qaFlags: any): Promise<{
    summary: string;
    table: string;
    pdf: Buffer;
    json: any;
  }> {
    // Generate summary paragraph
    const summary = await this.generateSummary(extractionResult.data);

    // Generate human-readable table
    const table = this.generateTable(extractionResult.data);

    // Generate PDF (placeholder - will use PDF library)
    const pdf = await this.generatePDF(extractionResult.data, summary, table);

    return {
      summary,
      table,
      pdf,
      json: extractionResult.data,
    };
  }

  /**
   * Generate summary paragraph using LLM
   */
  private async generateSummary(data: any): Promise<string> {
    if (!this.openai) {
      return this.generateSummaryFallback(data);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a professional insurance underwriter assistant. Write concise, clear summaries of commercial property submissions.',
          },
          {
            role: 'user',
            content: `Write a 3-4 sentence plain English summary of this commercial property submission for an underwriter. Mention named insured, line of business, number of locations/buildings, total building limit, notable protections (sprinklers/alarms), and any major losses.

Data: ${JSON.stringify(data, null, 2)}`,
          },
        ],
        temperature: 0.3,
      });

      return response.choices[0].message.content || this.generateSummaryFallback(data);
    } catch (error: any) {
      // Handle OpenAI API errors gracefully - use fallback
      if (error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('429')) {
        this.logger.warn('OpenAI API quota exceeded, using fallback summary');
        return this.generateSummaryFallback(data);
      }
      
      this.logger.error('Error generating summary:', error);
      return this.generateSummaryFallback(data);
    }
  }

  /**
   * Fallback summary generation
   */
  private generateSummaryFallback(data: any): string {
    const namedInsured = data.namedInsured || 'Unknown';
    const locations = data.locations?.length || 0;
    const buildings = data.locations?.reduce((sum: number, loc: any) => sum + (loc.buildings?.length || 0), 0) || 0;
    const totalLimit = data.locations?.reduce((sum: number, loc: any) => {
      return sum + (loc.buildings?.reduce((bSum: number, b: any) => bSum + (b.buildingLimit || 0), 0) || 0);
    }, 0) || 0;

    return `Commercial property submission for ${namedInsured}. ${locations} location(s) with ${buildings} building(s). Total building limit: $${totalLimit.toLocaleString()}.`;
  }

  /**
   * Generate human-readable table
   */
  private generateTable(data: any): string {
    let table = '';

    // Submission metadata
    if (data.submission) {
      table += 'SUBMISSION INFORMATION\n';
      table += '=====================\n';
      table += `Named Insured: ${data.submission.namedInsured || 'N/A'}\n`;
      table += `Carrier: ${data.submission.carrierName || 'N/A'}\n`;
      table += `Broker: ${data.submission.brokerName || 'N/A'}\n`;
      table += `Effective Date: ${data.submission.effectiveDate || 'N/A'}\n`;
      table += `Expiration Date: ${data.submission.expirationDate || 'N/A'}\n`;
      table += `Submission Type: ${data.submission.submissionType || 'N/A'}\n\n`;
    }

    // Locations and Buildings
    if (data.locations && Array.isArray(data.locations)) {
      table += 'LOCATIONS & BUILDINGS\n';
      table += '====================\n';
      for (const location of data.locations) {
        table += `\nLocation ${location.locationNumber || 'N/A'}:\n`;
        if (location.buildings && Array.isArray(location.buildings)) {
          for (const building of location.buildings) {
            table += `  Building ${building.buildingNumber || 'N/A'}:\n`;
            table += `    Address: ${building.riskAddress || 'N/A'}\n`;
            table += `    Square Feet: ${building.buildingSqFt?.toLocaleString() || 'N/A'}\n`;
            table += `    Building Limit: $${building.buildingLimit?.toLocaleString() || 'N/A'}\n`;
            table += `    Construction: ${building.constructionType || 'N/A'}\n`;
            table += `    Year Built: ${building.yearBuilt || 'N/A'}\n`;
            table += `    Sprinklered: ${building.sprinklered ? 'Yes' : 'No'}\n`;
          }
        }
      }
      table += '\n';
    }

    // Coverage
    if (data.coverage) {
      table += 'COVERAGE & LIMITS\n';
      table += '=================\n';
      table += `Policy Type: ${data.coverage.policyType || 'N/A'}\n`;
      table += `Cause of Loss: ${data.coverage.causeOfLossForm || 'N/A'}\n`;
      table += `Building Limit: $${data.coverage.buildingLimit?.toLocaleString() || 'N/A'}\n`;
      table += `BPP Limit: $${data.coverage.businessPersonalPropertyLimit?.toLocaleString() || 'N/A'}\n`;
      table += `Business Income Limit: $${data.coverage.businessIncomeLimit?.toLocaleString() || 'N/A'}\n`;
      table += `Deductible: $${data.coverage.deductibleAllPeril?.toLocaleString() || 'N/A'}\n`;
      table += `Coinsurance: ${data.coverage.coinsurancePercent || 'N/A'}%\n\n`;
    }

    // Loss History
    if (data.lossHistory) {
      table += 'LOSS HISTORY\n';
      table += '============\n';
      table += `Period: ${data.lossHistory.lossHistoryPeriodYears || 'N/A'} years\n`;
      table += `Number of Claims: ${data.lossHistory.numberOfClaims || 'N/A'}\n`;
      table += `Total Incurred: $${data.lossHistory.totalIncurredLoss?.toLocaleString() || 'N/A'}\n`;
      table += `Largest Single Loss: $${data.lossHistory.largestSingleLoss?.toLocaleString() || 'N/A'}\n`;
      table += `Open Claims: ${data.lossHistory.anyOpenClaims ? 'Yes' : 'No'}\n`;
      table += `CAT Losses: ${data.lossHistory.anyCatLosses ? 'Yes' : 'No'}\n\n`;
    }

    return table;
  }

  /**
   * Generate PDF using pdfkit
   */
  private async generatePDF(data: any, summary: string, table: string): Promise<Buffer> {
    try {
      // Dynamically import pdfkit to avoid CommonJS/ESM issues
      const pdfkitModule = await import('pdfkit');
      const PDFDocument = (pdfkitModule as any).default || pdfkitModule;
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {});

      // Header
      doc.fontSize(20).text('Commercial Property Submission', { align: 'center' });
      doc.moveDown();

      // Summary
      doc.fontSize(14).text('Summary', { underline: true });
      doc.fontSize(11).text(summary);
      doc.moveDown();

      // Table content
      doc.fontSize(14).text('Submission Details', { underline: true });
      doc.fontSize(10);
      
      // Split table into lines and add to PDF
      const lines = table.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          doc.text(line, { continued: false });
        } else {
          doc.moveDown(0.5);
        }
      }

      doc.end();

      // Wait for PDF to be generated
      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        doc.on('error', reject);
      });
    } catch (error) {
      this.logger.error('Error generating PDF:', error);
      // Return empty buffer if PDF generation fails
      return Buffer.from('');
    }
  }
}

