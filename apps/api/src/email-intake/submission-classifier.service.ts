import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SubmissionClassifierService {
  private readonly logger = new Logger(SubmissionClassifierService.name);

  /**
   * Classify if an email is a submission and what type
   */
  async classify(emailData: any): Promise<{
    isSubmission: boolean;
    submissionType?: 'new_business' | 'renewal' | 'endorsement' | 'other';
    reason?: string; // Add reason for debugging
  }> {
    const { subject, body, attachments } = emailData;

    // Ensure attachments is an array
    const attachmentsArray = Array.isArray(attachments) ? attachments : [];

    // Log what we're checking for debugging
    this.logger.log(
      `Classifying email: subject="${subject || '(empty)'}", body length=${(body || '').length}, attachments=${attachmentsArray.length}`,
    );

    // Log attachment details for debugging
    if (attachmentsArray.length > 0) {
      attachmentsArray.forEach((att: any, idx: number) => {
        const filename = att.filename || '(unnamed)';
        const contentType = att.contentType || '(unknown)';
        this.logger.log(
          `  Attachment ${idx + 1}: filename="${filename}", contentType="${contentType}"`,
        );
      });
    } else {
      this.logger.warn(`  No attachments found in attachments array!`);
    }

    // Check for submission indicators in attachments
    const hasRelevantAttachments =
      attachmentsArray.length > 0 &&
      attachmentsArray.some((att: any) => {
        const filename = att.filename.toLowerCase();
        const contentType = att.contentType?.toLowerCase() || '';

        // Check if it's a document type (PDF, Excel, Word, etc.)
        const isDocument =
          contentType.includes('pdf') ||
          contentType.includes('excel') ||
          contentType.includes('spreadsheet') ||
          contentType.includes('word') ||
          contentType.includes('msword') ||
          filename.endsWith('.pdf') ||
          filename.endsWith('.xlsx') ||
          filename.endsWith('.xls') ||
          filename.endsWith('.doc') ||
          filename.endsWith('.docx');

        // Check for insurance-related keywords in filename
        const hasInsuranceKeywords =
          filename.includes('acord') ||
          filename.includes('sov') ||
          filename.includes('statement of values') ||
          filename.includes('statement_of_values') ||
          filename.includes('loss run') ||
          filename.includes('loss_run') ||
          filename.includes('loss history') ||
          filename.includes('loss_history') ||
          filename.includes('property') ||
          filename.includes('insurance') ||
          filename.includes('submission') ||
          filename.includes('application') ||
          filename.includes('quote') ||
          filename.includes('coverage');

        return isDocument && hasInsuranceKeywords;
      });

    // Also check if there are ANY attachments (more lenient)
    const hasAnyAttachments = attachmentsArray.length > 0;

    const subjectLower = (subject || '').toLowerCase();
    const bodyLower = (body || '').toLowerCase();

    // Expanded submission keywords
    const submissionKeywords = [
      'submission',
      'new business',
      'new-business',
      'bind',
      'quote',
      'quotation',
      'renewal',
      'indication',
      'property',
      'commercial property',
      'commercial property insurance',
      'insurance application',
      'underwriting',
      'coverage',
      'policy',
      'premium',
      'harborview', // Common business name pattern
      'manufacturing', // Common business type
    ];

    const hasSubmissionKeywords = submissionKeywords.some(
      (keyword) =>
        subjectLower.includes(keyword) || bodyLower.includes(keyword),
    );

    // Check if "submission" appears anywhere in subject or body (most important indicator)
    const hasSubmissionWord =
      subjectLower.includes('submission') || bodyLower.includes('submission');

    // Debug logging
    if (subjectLower.includes('submission')) {
      this.logger.log(`Found "submission" in subject: "${subject}"`);
    } else if (bodyLower.includes('submission')) {
      this.logger.log(
        `Found "submission" in body (length: ${bodyLower.length})`,
      );
    } else {
      this.logger.log(
        `"submission" NOT found in subject="${subjectLower.substring(0, 50)}..." or body (length: ${bodyLower.length})`,
      );
    }

    // Check if subject contains "New Property Submission" or similar patterns
    const hasSubmissionInSubject =
      subjectLower.includes('new property submission') ||
      subjectLower.includes('property submission') ||
      subjectLower.includes('submission -');

    // Classification logic (in order of priority):
    // 1. If "submission" appears anywhere - it's a submission (even without attachments)
    // 2. If it has relevant attachments with insurance keywords
    // 3. If it has any attachments AND submission keywords
    // 4. If subject clearly indicates it's a submission
    const isSubmission =
      hasSubmissionWord || // Most important: if "submission" is mentioned, it's a submission
      hasRelevantAttachments ||
      (hasSubmissionKeywords && hasAnyAttachments) ||
      hasSubmissionKeywords ||
      (hasSubmissionInSubject && hasAnyAttachments) ||
      hasSubmissionInSubject;

    if (!isSubmission) {
      // Log why it wasn't classified
      const reasons: string[] = [];
      if (!hasSubmissionWord) {
        reasons.push('word "submission" not found in subject/body');
      }
      if (!hasRelevantAttachments) {
        reasons.push('no relevant attachments');
      }
      if (!hasSubmissionKeywords) {
        reasons.push('no submission keywords in subject/body');
      }
      if (!hasAnyAttachments) {
        reasons.push('no attachments at all');
      }

      this.logger.log(
        `Email NOT classified as submission. Reasons: ${reasons.join(', ')}`,
      );
      this.logger.log(
        `Subject: ${subject}, Attachments: ${attachmentsArray.length}, Body length: ${body?.length || 0}`,
      );

      return {
        isSubmission: false,
        reason: reasons.join('; '),
      };
    }

    // Determine submission type
    let submissionType: 'new_business' | 'renewal' | 'endorsement' | 'other' =
      'other';

    if (subjectLower.includes('renewal') || bodyLower.includes('renewal')) {
      submissionType = 'renewal';
    } else if (
      subjectLower.includes('endorsement') ||
      bodyLower.includes('endorsement')
    ) {
      submissionType = 'endorsement';
    } else if (
      subjectLower.includes('new business') ||
      bodyLower.includes('new business') ||
      subjectLower.includes('new submission') ||
      subjectLower.includes('new property submission') ||
      (subjectLower.includes('new') && subjectLower.includes('submission'))
    ) {
      submissionType = 'new_business';
    }

    this.logger.log(`Classified as submission: ${submissionType}`);

    let reason = 'matched submission criteria';
    if (hasSubmissionWord) {
      reason += ' (contains "submission" keyword)';
    }
    if (hasRelevantAttachments) {
      reason += ' (has relevant attachments)';
    }
    if (hasSubmissionKeywords) {
      reason += ' (has submission keywords)';
    }

    return { isSubmission: true, submissionType, reason };
  }
}
