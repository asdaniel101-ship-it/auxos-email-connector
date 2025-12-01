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
      'acord' | 'sov' | 'loss_run' | 'schedule' | 'supplemental' | 'other'
    >
  > {
    const classifications = new Map<
      string,
      'acord' | 'sov' | 'loss_run' | 'schedule' | 'supplemental' | 'other'
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
    'acord' | 'sov' | 'loss_run' | 'schedule' | 'supplemental' | 'other'
  > {
    const filename = attachment.filename.toLowerCase();
    const contentType = attachment.contentType?.toLowerCase() || '';

    // ACORD detection
    if (
      filename.includes('acord') ||
      filename.includes('acord 140') ||
      filename.includes('acord140')
    ) {
      return 'acord';
    }

    // SOV detection
    if (
      filename.includes('sov') ||
      filename.includes('statement of values') ||
      filename.includes('statement_of_values')
    ) {
      return 'sov';
    }

    // Loss run detection
    if (
      filename.includes('loss run') ||
      filename.includes('loss_run') ||
      filename.includes('loss history') ||
      filename.includes('loss_history') ||
      filename.includes('claims experience') ||
      filename.includes('claims_experience')
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
