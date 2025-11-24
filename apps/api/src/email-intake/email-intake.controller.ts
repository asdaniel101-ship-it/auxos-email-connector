import { Controller, Get, Post, Param, Query, UseInterceptors, UploadedFile, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { EmailIntakeService } from './email-intake.service';
import { EmailListenerService } from './email-listener.service';
import { PrismaService } from '../prisma.service';
import { MinioService } from '../files/minio.service';

@ApiTags('email-intake')
@Controller('email-intake')
export class EmailIntakeController {
  constructor(
    private readonly emailIntakeService: EmailIntakeService,
    private readonly emailListener: EmailListenerService,
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
  ) {}

  @Post('poll')
  @ApiOperation({ summary: 'Manually trigger Gmail polling for new messages' })
  @ApiResponse({ status: 200, description: 'Polling completed' })
  async pollForNewEmails() {
    return this.emailIntakeService.pollForNewEmails();
  }

  @Post('process/:gmailMessageId')
  @ApiOperation({ summary: 'Manually process a specific email by Gmail message ID' })
  @ApiResponse({ status: 200, description: 'Email processed' })
  async processEmail(@Param('gmailMessageId') gmailMessageId: string) {
    return this.emailIntakeService.processEmail(gmailMessageId);
  }

  @Post('test/upload-eml')
  @ApiOperation({ summary: 'Upload and process a .eml file for testing' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '.eml file to upload and process',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadEmlFile(@UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
      }

      if (!file.originalname || !file.originalname.endsWith('.eml')) {
        throw new HttpException('File must be a .eml file', HttpStatus.BAD_REQUEST);
      }

      // Parse and store the .eml file
      const emailData = await this.emailListener.parseAndStoreEml(file.buffer);

      if (!emailData || !emailData.gmailMessageId) {
        throw new HttpException('Failed to parse email file', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Check if email was already processed
      const existingResult = await this.emailIntakeService.getSubmissionById(emailData.id);
      if (existingResult && existingResult.processingStatus === 'done' && existingResult.extractionResult) {
        return {
          success: true,
          message: 'Email was already processed previously',
          emailMessageId: emailData.gmailMessageId,
          alreadyProcessed: true,
          result: existingResult,
        };
      }

      // Process the email (pass the body from parsed email)
      const result = await this.emailIntakeService.processEmail(
        emailData.gmailMessageId,
        emailData.body || '',
      );

      return {
        success: true,
        message: 'Email processed successfully',
        emailMessageId: emailData.gmailMessageId,
        alreadyProcessed: false,
        result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Log the error for debugging
      console.error('Error uploading .eml file:', error);
      
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to process .eml file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('submissions')
  @ApiOperation({ summary: 'Get all processed submissions (for admin dashboard)' })
  @ApiResponse({ status: 200, description: 'List of submissions' })
  async getAllSubmissions(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.emailIntakeService.getAllSubmissions(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('submissions/:id')
  @ApiOperation({ summary: 'Get a single submission by ID' })
  @ApiResponse({ status: 200, description: 'Submission details' })
  async getSubmission(@Param('id') id: string) {
    return this.emailIntakeService.getSubmissionById(id);
  }

  @Get('emails')
  @ApiOperation({ summary: 'Get all emails (including non-submissions) for debugging' })
  @ApiResponse({ status: 200, description: 'List of all emails' })
  async getAllEmails(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.emailIntakeService.getAllEmails(
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('emails/recent')
  @ApiOperation({ summary: 'Get recent emails (last 24 hours) for debugging' })
  @ApiResponse({ status: 200, description: 'List of recent emails' })
  async getRecentEmails() {
    return this.emailIntakeService.getRecentEmails();
  }

  @Get('imap/check')
  @ApiOperation({ summary: 'Check IMAP connection and list recent emails in inbox' })
  @ApiResponse({ status: 200, description: 'IMAP inbox status' })
  async checkImap() {
    return this.emailListener.checkImapConnection();
  }

  @Post('reprocess/:emailMessageId')
  @ApiOperation({ summary: 'Reprocess an existing email by its database ID (useful for fixing failed emails)' })
  @ApiResponse({ status: 200, description: 'Email reprocessed' })
  async reprocessEmail(@Param('emailMessageId') emailMessageId: string) {
    try {
      // Get the email from database
      const emailData = await this.prisma.emailMessage.findUnique({
        where: { id: emailMessageId },
        include: { attachments: true },
      });
      
      if (!emailData) {
        throw new HttpException(`Email with ID ${emailMessageId} not found`, HttpStatus.NOT_FOUND);
      }

      const gmailMessageId = emailData.gmailMessageId;
      let emailBody = '';

      // Try to get the body from the stored raw MIME file in MinIO
      if (emailData.rawMimeStorageKey) {
        try {
          const minioClient = this.minioService.getClient();
          const dataStream = await minioClient.getObject('documents', emailData.rawMimeStorageKey);
          
          // Read the raw MIME file
          const chunks: Buffer[] = [];
          for await (const chunk of dataStream) {
            chunks.push(chunk);
          }
          const rawMime = Buffer.concat(chunks);
          
          // Parse it to get the body
          const { simpleParser } = await import('mailparser');
          const parsed = await simpleParser(rawMime);
          emailBody = parsed.text || parsed.html || '';
        } catch (mimeError) {
          console.warn(`Could not read raw MIME file for email body: ${mimeError}`);
          // Fall back to empty body - classification should still work with subject and attachments
        }
      }

      // If we still don't have a body and it's an IMAP email, try to re-fetch (but don't fail if it times out)
      if (!emailBody && gmailMessageId.startsWith('imap-')) {
        try {
          const uidStr = gmailMessageId.replace('imap-', '');
          const imapUid = parseInt(uidStr, 10);
          
          if (!isNaN(imapUid)) {
            console.log(`Attempting to re-fetch email body from IMAP UID ${imapUid} (this may timeout)`);
            const freshEmailData = await this.emailListener.fetchAndStoreEmail(imapUid);
            emailBody = freshEmailData.body || '';
          }
        } catch (imapError) {
          console.warn(`Could not re-fetch from IMAP (this is OK, using existing data): ${imapError}`);
          // Continue with existing data - classification should work with subject and attachments
        }
      }

      // Reset processing status to allow reprocessing
      await this.prisma.emailMessage.update({
        where: { id: emailMessageId },
        data: { 
          processingStatus: 'pending',
          errorMessage: null,
        },
      });

      // Now process it with the existing data (body may be empty, but subject and attachments should be enough)
      console.log(`Reprocessing email ${emailMessageId} with existing data (body length: ${emailBody.length})`);
      const result = await this.emailIntakeService.processEmail(
        gmailMessageId,
        emailBody,
      );

      return {
        success: true,
        message: 'Email reprocessed successfully',
        emailMessageId: emailData.id,
        result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      console.error('Error reprocessing email:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to reprocess email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

