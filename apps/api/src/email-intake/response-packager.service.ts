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
  async package(
    extractionResult: any,
    qaFlags: any,
    attachments?: any[],
  ): Promise<{
    summary: string;
    table: string;
    pdf: Buffer;
    json: any;
  }> {
    // Generate summary paragraph
    const summary = await this.generateSummary(extractionResult.data, attachments);

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
  private async generateSummary(data: any, attachments?: any[]): Promise<string> {
    if (!this.openai) {
      return this.generateSummaryFallback(data, attachments);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional insurance underwriter assistant. Write concise, clear summaries of workers compensation insurance submissions.',
          },
          {
            role: 'user',
            content: `Write a comprehensive 1-2 sentence plain English summary of this workers compensation submission for an underwriter. Include:
- Company name (applicantName) and state/location
- Business type/operations description
- Years in business
- Requested effective date and billing/payment plan (if available)
- Primary class code and total payroll
- Prior carrier name and experience mod (if available)
- Number of prior claims and total incurred (if available)
- Key operations details (out-of-state exposure, safety program, etc.)
- Attachments included (loss runs, payroll, application, etc.)

Format like: "[Company] is a [State]-based [business type] with [X] years in business, requesting a [date] workers comp quote ([billing plan]). Primary class is [code] with $[X]M payroll. Prior carrier was [name] with a [X.XX] mod and [X] claims totaling $[X]K incurred. Operations include [description], [key details]. [Attachments] are attached."

Data: ${JSON.stringify(data, null, 2)}`,
          },
        ],
        temperature: 0.3,
      });

      return (
        response.choices[0].message.content ||
        this.generateSummaryFallback(data, attachments)
      );
    } catch (error: any) {
      // Handle OpenAI API errors gracefully - use fallback
      if (
        error?.status === 429 ||
        error?.message?.includes('quota') ||
        error?.message?.includes('429')
      ) {
        this.logger.warn('OpenAI API quota exceeded, using fallback summary');
        return this.generateSummaryFallback(data, attachments);
      }

      this.logger.error('Error generating summary:', error);
      return this.generateSummaryFallback(data, attachments);
    }
  }

  /**
   * Fallback summary generation for Workers Comp
   */
  private generateSummaryFallback(data: any, attachments?: any[]): string {
    const applicantName = data.submission?.applicantName || 'Unknown';
    const state = data.locations?.[0]?.locationState || 
                  data.businessEntity?.operationsDescription?.match(/\b([A-Z]{2})\b/)?.[1] || 
                  '';
    const yearsInBusiness = data.submission?.yearsInBusiness;
    const effectiveDate = data.submission?.effectiveDate ? 
      new Date(data.submission.effectiveDate).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : 
      null;
    const billingPlan = data.submission?.billingPlan || '';
    const paymentPlan = data.submission?.paymentPlan || '';
    
    // Get primary class code and payroll
    const classifications = data.classification || [];
    const primaryClass = classifications[0];
    const primaryClassCode = primaryClass?.classCode || '';
    const primaryPayroll = primaryClass?.estimatedAnnualPayroll || 0;
    const payrollInMillions = primaryPayroll >= 1000000 ? 
      (primaryPayroll / 1000000).toFixed(1) : 
      (primaryPayroll / 1000).toFixed(0) + 'K';
    
    // Get operations description
    const operations = data.businessEntity?.operationsDescription || '';
    const businessType = operations ? 
      operations.split(/[.,;]/)[0].trim().toLowerCase() || 'business' : 
      'business';
    
    // Get prior carrier info
    const priorCarrier = data.priorCarrier?.priorCarrierName || '';
    const priorMod = data.priorCarrier?.priorExperienceMod;
    const priorClaims = data.priorCarrier?.priorNumberOfClaims || 
                       data.lossHistory?.numberOfClaims || 0;
    const priorIncurred = data.priorCarrier?.priorAmountPaid || 
                         data.lossHistory?.totalIncurredLoss || 0;
    const priorIncurredFormatted = priorIncurred >= 1000 ? 
      (priorIncurred / 1000).toFixed(1) + 'K' : 
      priorIncurred.toFixed(0);
    
    // Get additional class codes
    const additionalClasses: string[] = [];
    if (classifications.length > 1) {
      for (let i = 1; i < Math.min(classifications.length, 3); i++) {
        const cls = classifications[i];
        if (cls?.classCode && cls?.estimatedAnnualPayroll) {
          const payroll = cls.estimatedAnnualPayroll >= 1000 ? 
            (cls.estimatedAnnualPayroll / 1000).toFixed(0) + 'K' : 
            cls.estimatedAnnualPayroll.toFixed(0);
          additionalClasses.push(`${cls.classCode} adds $${payroll}`);
        }
      }
    }
    
    // Get key operations details
    const operationsDetails: string[] = [];
    if (data.businessEntity?.employeesTravelOutOfState) {
      const states = data.locations?.map((loc: any) => loc.locationState).filter(Boolean).join('/') || '';
      if (states) {
        operationsDetails.push(`limited out-of-state exposure (${states})`);
      }
    }
    if (data.businessEntity?.safetyProgramInOperation) {
      operationsDetails.push('a formal safety program');
    }
    
    // Get attachments list
    const attachmentTypes: string[] = [];
    if (attachments) {
      const docTypes = new Set(attachments.map((att: any) => att.documentType).filter(Boolean));
      if (docTypes.has('loss_run')) attachmentTypes.push('loss runs');
      if (docTypes.has('payroll')) attachmentTypes.push('payroll schedule');
      if (docTypes.has('schedule')) attachmentTypes.push('officer schedule');
      if (docTypes.has('application')) attachmentTypes.push('application');
      if (docTypes.has('questionnaire')) attachmentTypes.push('questionnaire');
      if (docTypes.has('supplemental')) attachmentTypes.push('supplemental docs');
    }
    const attachmentsText = attachmentTypes.length > 0 ? 
      attachmentTypes.join(', ') + ' are attached' : 
      'supporting documents are attached';
    
    // Build summary
    let summary = `${applicantName}`;
    if (state) {
      summary += ` is a ${state}-based`;
    }
    summary += ` ${businessType}`;
    if (yearsInBusiness) {
      summary += ` with ${yearsInBusiness} years in business`;
    }
    if (effectiveDate) {
      summary += `, requesting a ${effectiveDate} workers comp quote`;
      if (billingPlan || paymentPlan) {
        const plan = billingPlan || paymentPlan;
        summary += ` (${plan.toLowerCase()})`;
      }
    }
    summary += '.';
    
    if (primaryClassCode && primaryPayroll) {
      summary += ` Primary class is ${primaryClassCode} with $${payrollInMillions}M payroll`;
      if (additionalClasses.length > 0) {
        summary += `; ${additionalClasses.join('; ')}`;
      }
      summary += '.';
    }
    
    if (priorCarrier) {
      summary += ` Prior carrier was ${priorCarrier}`;
      if (priorMod !== null && priorMod !== undefined) {
        summary += ` with a ${priorMod.toFixed(2)} mod`;
      }
      if (priorClaims > 0) {
        summary += ` and ${priorClaims} claim${priorClaims > 1 ? 's' : ''} totaling $${priorIncurredFormatted} incurred`;
      }
      summary += '.';
    }
    
    if (operations) {
      summary += ` Operations include ${operations.split(/[.,;]/)[0].trim().toLowerCase()}`;
      if (operationsDetails.length > 0) {
        summary += `, ${operationsDetails.join(', ')}`;
      }
      summary += '.';
    }
    
    summary += ` ${attachmentsText.charAt(0).toUpperCase() + attachmentsText.slice(1)}.`;
    
    return summary;
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
  private async generatePDF(
    data: any,
    summary: string,
    table: string,
  ): Promise<Buffer> {
    try {
      // Dynamically import pdfkit to avoid CommonJS/ESM issues
      const pdfkitModule = await import('pdfkit');
      const PDFDocument = (pdfkitModule as any).default || pdfkitModule;
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {});

      // Header
      doc
        .fontSize(20)
        .text('Commercial Property Submission', { align: 'center' });
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
