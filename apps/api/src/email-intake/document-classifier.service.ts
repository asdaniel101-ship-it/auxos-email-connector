import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DocumentClassifierService {
  private readonly logger = new Logger(DocumentClassifierService.name);

  /**
   * Classify all attachments by document type
   */
  async classifyAll(
    attachments: any[],
  ): Promise<
    Map<
      string,
      'sov' | 'loss_run' | 'schedule' | 'supplemental' | 'payroll' | 'questionnaire' | 'application' | 'other'
    >
  > {
    const classifications = new Map<
      string,
      'sov' | 'loss_run' | 'schedule' | 'supplemental' | 'payroll' | 'questionnaire' | 'application' | 'other'
    >();

    for (const attachment of attachments) {
      const docType = await this.classify(attachment);
      classifications.set(attachment.id, docType);
    }

    return classifications;
  }

  /**
   * Classify a single document
   */
  async classify(
    attachment: any,
  ): Promise<
    'sov' | 'loss_run' | 'schedule' | 'supplemental' | 'payroll' | 'questionnaire' | 'application' | 'other'
  > {
    const filename = attachment.filename.toLowerCase();
    const contentType = attachment.contentType?.toLowerCase() || '';

    // Payroll detection
    if (
      filename.includes('payroll') ||
      filename.includes('payroll schedule') ||
      filename.includes('payroll_by_class') ||
      filename.includes('payroll_report')
    ) {
      return 'payroll';
    }

    // Questionnaire/Application detection
    if (
      filename.includes('questionnaire') ||
      filename.includes('application') ||
      filename.includes('wc application') ||
      filename.includes('workers comp application') ||
      filename.includes('wc questionnaire')
    ) {
      if (filename.includes('questionnaire')) {
        return 'questionnaire';
      }
      return 'application';
    }

    // SOV detection
    if (
      filename.includes('sov') ||
      filename.includes('statement of values') ||
      filename.includes('statement_of_values')
    ) {
      return 'sov';
    }

    // Loss run detection - check BEFORE schedule to catch Excel loss runs
    // Handle various filename formats: "loss run", "loss_run", "lossruns", "WC_LossRuns", etc.
    if (
      filename.includes('loss run') ||
      filename.includes('loss_run') ||
      filename.includes('lossruns') ||
      filename.includes('loss-runs') ||
      filename.includes('loss history') ||
      filename.includes('loss_history') ||
      filename.includes('losshistory') ||
      filename.includes('loss-history') ||
      filename.includes('loss runs') ||
      filename.includes('claims experience') ||
      filename.includes('claims_experience') ||
      filename.includes('claimsexperience') ||
      filename.includes('claims-experience') ||
      filename.includes('wc_loss') ||
      filename.includes('wc-loss') ||
      filename.includes('wcloss') ||
      filename.includes('lossrun') ||
      filename.includes('loss-run')
    ) {
      return 'loss_run';
    }

    // Schedule detection (Excel with property data)
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) {
      // Could be SOV or schedule - check content later
      return 'schedule';
    }

    // Supplemental documents
    if (
      filename.includes('supplemental') ||
      filename.includes('additional') ||
      filename.includes('misc')
    ) {
      return 'supplemental';
    }

    return 'other';
  }
}
