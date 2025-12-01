import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { EmailListenerService } from './email-listener.service';
import { SubmissionClassifierService } from './submission-classifier.service';
import { DocumentClassifierService } from './document-classifier.service';
import { FieldExtractionService } from './field-extraction.service';
import { SubmissionQAService } from './submission-qa.service';
import { ResponsePackagerService } from './response-packager.service';

@Injectable()
export class EmailIntakeService {
  private readonly logger = new Logger(EmailIntakeService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private emailListener: EmailListenerService,
    private submissionClassifier: SubmissionClassifierService,
    private documentClassifier: DocumentClassifierService,
    private fieldExtraction: FieldExtractionService,
    private qaService: SubmissionQAService,
    private responsePackager: ResponsePackagerService,
  ) {
    // Inject DocumentParserService via fieldExtraction if needed
  }

  /**
   * Main orchestration method: process a stored email by its gmailMessageId
   * @param gmailMessageId - The Gmail message ID
   * @param emailBody - Optional email body (if not provided, will try to load from storage)
   */
  async processEmail(gmailMessageId: string, emailBody?: string) {
    this.logger.log(`Processing email: ${gmailMessageId}`);

    try {
      // 1. Atomically check and update status to prevent duplicate processing
      // Use a transaction to ensure only one process can claim the email
      const emailData = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.emailMessage.findUnique({
          where: { gmailMessageId },
          include: {
            attachments: true,
          },
        });

        if (!existing) {
          throw new Error(`Email with ID ${gmailMessageId} not found`);
        }

        // Check if already processed or currently processing
        // IMPORTANT: Once an email is processed (status='done'), do NOT reprocess it
        // This prevents infinite loops and duplicate replies
        if (existing.processingStatus === 'done') {
          this.logger.log(
            `Email ${gmailMessageId} already processed (status: done), skipping to prevent duplicate processing`,
          );
          return null; // Signal to skip processing
        }

        if (existing.processingStatus === 'processing') {
          this.logger.log(
            `Email ${gmailMessageId} is already being processed, skipping duplicate`,
          );
          return null; // Signal to skip processing
        }

        // Atomically update to 'processing' status
        await tx.emailMessage.update({
          where: { gmailMessageId },
          data: { processingStatus: 'processing' },
        });

        return existing;
      });

      // If transaction returned null, email was already processed/processing
      if (!emailData) {
        return { processed: false, reason: 'already_processed_or_processing' };
      }

      // 2. Check if email is from our own address to prevent infinite loops
      const systemEmail =
        this.configService.get<string>('GMAIL_EMAIL') ||
        'submit@auxos.dev';
      if (
        emailData.from &&
        emailData.from.toLowerCase().includes(systemEmail.toLowerCase())
      ) {
        this.logger.warn(
          `Skipping email ${gmailMessageId} - FROM our own address: ${emailData.from}`,
        );
        await this.prisma.emailMessage.update({
          where: { gmailMessageId },
          data: {
            processingStatus: 'done',
            errorMessage:
              'Skipped: Email from system address (prevents infinite loop)',
          },
        });
        return { processed: false, reason: 'from_system_address' };
      }

      // 3. Classify if it's a submission
      // Use provided body or empty string (body is not stored in DB, only in parsed result)
      const body = emailBody || '';

      // Removed verbose debug logging - keep logs clean

      const classification = await this.submissionClassifier.classify({
        subject: emailData.subject,
        body: body,
        attachments: emailData.attachments,
      });

      if (!classification.isSubmission) {
        this.logger.log(
          `Email ${gmailMessageId} is not a submission, skipping extraction`,
        );
        this.logger.log(
          `Classification reason: ${classification.reason || 'unknown'}`,
        );
        this.logger.log(
          `Subject: ${emailData.subject}, Attachments: ${emailData.attachments?.length || 0}`,
        );

        await this.prisma.emailMessage.update({
          where: { gmailMessageId },
          data: {
            isSubmission: false,
            submissionType: classification.submissionType || null,
            processingStatus: 'done',
            errorMessage:
              classification.reason || 'Not classified as submission',
          },
        });
        return {
          processed: false,
          reason: 'not_a_submission',
          classificationReason: classification.reason,
        };
      }

      // 4. Classify documents
      const documentClassifications = await this.documentClassifier.classifyAll(
        emailData.attachments,
      );

      // Update document types in database
      for (const [attachmentId, docType] of documentClassifications.entries()) {
        await this.prisma.emailAttachment.update({
          where: { id: attachmentId },
          data: { documentType: docType },
        });
      }

      // 5. Extract fields using LLM (add body to emailData for extraction)
      const emailDataWithBody = {
        ...emailData,
        body: body,
      };
      const extractionResult = await this.fieldExtraction.extract(
        emailDataWithBody,
        documentClassifications,
      );

      // 6. Run QA checks
      const qaFlags = await this.qaService.runChecks(extractionResult.data);

      // 7. Package response (summary, table, PDF, JSON)
      const packagedResponse = await this.responsePackager.package(
        extractionResult,
        qaFlags,
      );

      // 8. Store extraction result and field extractions (use upsert for reprocessing)
      const extractionResultRecord = await this.prisma.extractionResult.upsert({
        where: {
          emailMessageId: emailData.id,
        },
        update: {
          data: extractionResult.data,
          qaFlags: qaFlags,
          summaryText: packagedResponse.summary,
          llmPrompt: extractionResult.llmPrompt || null,
          llmResponse: extractionResult.llmResponse || null,
        },
        create: {
          emailMessageId: emailData.id,
          data: extractionResult.data,
          qaFlags: qaFlags,
          summaryText: packagedResponse.summary,
          llmPrompt: extractionResult.llmPrompt || null,
          llmResponse: extractionResult.llmResponse || null,
        },
      });

      // Delete existing field extractions before creating new ones (for reprocessing)
      await this.prisma.fieldExtraction.deleteMany({
        where: {
          extractionResultId: extractionResultRecord.id,
        },
      });

      // Store field extractions with document chunks
      if (
        extractionResult.fieldExtractions &&
        extractionResult.fieldExtractions.length > 0
      ) {
        await this.prisma.fieldExtraction.createMany({
          data: extractionResult.fieldExtractions.map((fe: any) => ({
            extractionResultId: extractionResultRecord.id,
            fieldPath: fe.fieldPath,
            fieldName: fe.fieldName,
            fieldValue: fe.fieldValue ? String(fe.fieldValue) : null,
            source: fe.source,
            documentId: fe.documentId || null,
            documentChunk: fe.documentChunk || null,
            highlightedText: fe.highlightedText || null,
            chunkStartIndex: fe.chunkStartIndex || null,
            chunkEndIndex: fe.chunkEndIndex || null,
            confidence: fe.confidence || null,
            llmReasoning: fe.llmReasoning || null,
          })),
        });
      }

      // 8. Send reply email (pass email message ID and field extractions for hyperlinks)
      await this.emailListener.sendReply(
        emailData,
        packagedResponse,
        extractionResult?.fieldExtractions || [],
      );

      // 9. Assign sequential submission number and mark as done
      // Get the next submission number (highest existing + 1, or 1 if none exist)
      const lastSubmission = await this.prisma.emailMessage.findFirst({
        where: {
          isSubmission: true,
          submissionNumber: { not: null },
        },
        orderBy: {
          submissionNumber: 'desc',
        },
        select: { submissionNumber: true },
      });

      const nextSubmissionNumber =
        lastSubmission?.submissionNumber != null
          ? lastSubmission.submissionNumber + 1
          : 1;

      this.logger.log(
        `Assigning submission number ${nextSubmissionNumber} to email ${gmailMessageId}`,
      );

      await this.prisma.emailMessage.update({
        where: { gmailMessageId },
        data: {
          isSubmission: true,
          submissionType: classification.submissionType || null,
          submissionNumber: nextSubmissionNumber,
          processingStatus: 'done',
        },
      });

      // Get the updated email with submission number
      const updatedEmail = await this.prisma.emailMessage.findUnique({
        where: { gmailMessageId },
        select: { id: true, submissionNumber: true },
      });

      this.logger.log(
        `Successfully processed submission: ${gmailMessageId} (Internal ID: ${emailData.id}, Submission #${updatedEmail?.submissionNumber || 'N/A'})`,
      );
      return {
        processed: true,
        emailMessageId: emailData.id, // Internal Prisma ID
        submissionNumber: updatedEmail?.submissionNumber || null, // Sequential submission number
      };
    } catch (error) {
      this.logger.error(`Error processing email ${gmailMessageId}:`, error);

      await this.prisma.emailMessage.update({
        where: { gmailMessageId },
        data: {
          processingStatus: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  private processingQueue: Array<{ uid: number; gmailMessageId?: string }> = [];
  private isProcessing = false;

  /**
   * Poll Gmail for new messages (called by cron job or scheduled task)
   * Processes one email at a time, queues the rest
   */
  async pollForNewEmails() {
    try {
      const newUids = await this.emailListener.getNewMessages();

      // Add new UIDs to queue
      for (const uid of newUids) {
        if (!this.processingQueue.find((q) => q.uid === uid)) {
          this.processingQueue.push({ uid });
        }
      }

      // Process queue one at a time
      if (!this.isProcessing && this.processingQueue.length > 0) {
        this.isProcessing = true;
        this.processQueue();
      }

      return { newEmailsFound: newUids.length, processed: 0 };
    } catch (error) {
      this.logger.error('Error polling Gmail:', error);
      throw error;
    }
  }

  /**
   * Process emails from queue one at a time
   */
  private async processQueue() {
    while (this.processingQueue.length > 0) {
      const queueItem = this.processingQueue.shift();
      if (!queueItem) break;

      const { uid } = queueItem;
      const maxRetries = 3;
      let lastError: Error | null = null;
      let success = false;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Fetch and store email first
          const emailData = await this.emailListener.fetchAndStoreEmail(uid);
          queueItem.gmailMessageId = emailData.gmailMessageId;

          this.logger.log(
            `Processing submission: ${emailData.subject || emailData.gmailMessageId}`,
          );

          // Then process it (pass body from parsed email)
          const result = await this.processEmail(
            emailData.gmailMessageId,
            emailData.body || '',
          );

          if (result?.processed) {
            this.logger.log(
              `✓ Submission processed: ${emailData.subject || emailData.gmailMessageId}`,
            );
          }
          success = true;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          this.logger.error(
            `Failed to process message UID ${uid} (attempt ${attempt}/${maxRetries}):`,
            lastError.message,
          );

          // Wait before retry (exponential backoff)
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (!success && lastError) {
        this.logger.error(
          `✗ Failed to process message UID ${uid} after ${maxRetries} attempts`,
        );
      }

      // Small delay between emails to avoid overwhelming the system
      if (this.processingQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get all processed submissions for admin dashboard
   */
  async getAllSubmissions(limit = 50, offset = 0) {
    return this.prisma.emailMessage.findMany({
      where: { isSubmission: true },
      include: {
        attachments: true,
        extractionResult: {
          include: {
            fieldExtractions: true,
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get a single submission by ID
   */
  async getSubmissionById(emailMessageId: string) {
    return this.prisma.emailMessage.findUnique({
      where: { id: emailMessageId },
      include: {
        attachments: true,
        extractionResult: {
          include: {
            fieldExtractions: true,
          },
        },
      },
    });
  }

  /**
   * Get all emails (including non-submissions) for debugging
   */
  async getAllEmails(limit = 100, offset = 0) {
    return this.prisma.emailMessage.findMany({
      include: {
        attachments: true,
        extractionResult: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get recent emails (last 24 hours) for debugging
   */
  async getRecentEmails() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return this.prisma.emailMessage.findMany({
      where: {
        receivedAt: {
          gte: yesterday,
        },
      },
      include: {
        attachments: true,
        extractionResult: true,
      },
      orderBy: { receivedAt: 'desc' },
    });
  }
}
