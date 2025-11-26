import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { MinioService } from '../files/minio.service';
import { FieldSchemaService } from '../field-schema/field-schema.service';
import imaps from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';

@Injectable()
export class EmailListenerService {
  private readonly logger = new Logger(EmailListenerService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly email: string;
  private readonly password: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private minioService: MinioService,
    private fieldSchemaService: FieldSchemaService,
  ) {
    this.email = this.configService.get<string>('GMAIL_EMAIL') || 'auxoreachout@gmail.com';
    this.password = (this.configService.get<string>('GMAIL_APP_PASSWORD') || 'xgpk xygb ctov epfx').replace(/\s/g, '');
    this.initializeSmtp();
  }

  /**
   * Initialize SMTP transporter for sending replies
   */
  private initializeSmtp() {
    // Use explicit host/port instead of service name to avoid DNS resolution issues
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.email,
        pass: this.password,
      },
      // Add connection timeout and retry options
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    
    // Verify connection on initialization
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error('SMTP connection verification failed:', error);
      } else {
        this.logger.log('SMTP connection verified successfully');
      }
    });
  }

  /**
   * Connect to IMAP and fetch emails
   */
  private async connectImap() {
    const config = {
      imap: {
        user: this.email,
        password: this.password,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 30000, // 30 seconds connection timeout
        authTimeout: 30000, // 30 seconds auth timeout
      },
    };

    return await imaps.connect(config);
  }

  /**
   * Parse .eml file content and store in database
   */
  async parseAndStoreEml(emlContent: Buffer | string): Promise<any> {
    this.logger.log('Parsing .eml file...');

    try {
      // Ensure we have a Buffer
      const buffer = Buffer.isBuffer(emlContent) ? emlContent : Buffer.from(emlContent);
      const parsed = await simpleParser(buffer);
      
      this.logger.log(`Successfully parsed .eml: ${parsed.subject || 'No subject'}, ${parsed.attachments?.length || 0} attachments`);
      return await this.storeParsedEmail(parsed, buffer);
    } catch (error) {
      this.logger.error('Error parsing .eml:', error);
      throw error;
    }
  }

  /**
   * Store parsed email in database and MinIO
   * @param parsed - Parsed email object
   * @param rawBuffer - Raw email buffer (optional, for .eml uploads)
   * @param imapUid - IMAP UID (optional, for IMAP-fetched emails)
   */
  private async storeParsedEmail(parsed: ParsedMail, rawBuffer?: Buffer, imapUid?: number): Promise<any> {
    // Generate unique ID for this email
    let gmailMessageId: string;
    
    if (imapUid !== undefined) {
      // For IMAP emails, use imap-{uid} format so we can track them
      gmailMessageId = `imap-${imapUid}`;
    } else if (rawBuffer && rawBuffer.length > 0) {
      // For .eml uploads, use a hash of the content to avoid duplicates
      const hash = crypto.createHash('sha256').update(rawBuffer).digest('hex');
      gmailMessageId = `eml-${hash.substring(0, 16)}`;
    } else {
      // Fallback to messageId or timestamp-based ID
      gmailMessageId = parsed.messageId || `eml-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    }
    const threadId = parsed.inReplyTo || gmailMessageId;

    // Extract email fields first (needed for both new and existing emails)
    // Extract FROM field properly (mailparser can structure this differently)
    let fromAddress = '';
    if (parsed.from) {
      if (typeof parsed.from === 'string') {
        fromAddress = parsed.from;
      } else if (parsed.from.text) {
        fromAddress = parsed.from.text;
      } else if (parsed.from.value && Array.isArray(parsed.from.value) && parsed.from.value.length > 0) {
        const firstFrom = parsed.from.value[0];
        if (typeof firstFrom === 'string') {
          fromAddress = firstFrom;
        } else if (firstFrom.address) {
          fromAddress = firstFrom.address;
        } else if (firstFrom.name && firstFrom.mailbox && firstFrom.host) {
          fromAddress = `${firstFrom.mailbox}@${firstFrom.host}`;
        } else if (firstFrom.name) {
          fromAddress = firstFrom.name;
        }
      } else if (parsed.from.address) {
        fromAddress = parsed.from.address;
      } else if (parsed.from.mailbox && parsed.from.host) {
        fromAddress = `${parsed.from.mailbox}@${parsed.from.host}`;
      }
    }

    // Extract TO field properly
    const toAddresses: string[] = [];
    if (parsed.to) {
      if (Array.isArray(parsed.to)) {
        parsed.to.forEach((t: any) => {
          if (typeof t === 'string') {
            toAddresses.push(t);
          } else if (t.address) {
            toAddresses.push(t.address);
          } else if (t.text) {
            toAddresses.push(t.text);
          } else if (t.mailbox && t.host) {
            toAddresses.push(`${t.mailbox}@${t.host}`);
          }
        });
      } else {
        if (typeof parsed.to === 'string') {
          toAddresses.push(parsed.to);
        } else if (parsed.to.address) {
          toAddresses.push(parsed.to.address);
        } else if (parsed.to.text) {
          toAddresses.push(parsed.to.text);
        } else if (parsed.to.mailbox && parsed.to.host) {
          toAddresses.push(`${parsed.to.mailbox}@${parsed.to.host}`);
        }
      }
    }

    // Extract CC field properly
    const ccAddresses: string[] = [];
    if (parsed.cc) {
      if (Array.isArray(parsed.cc)) {
        parsed.cc.forEach((c: any) => {
          if (typeof c === 'string') {
            ccAddresses.push(c);
          } else if (c.address) {
            ccAddresses.push(c.address);
          } else if (c.text) {
            ccAddresses.push(c.text);
          } else if (c.mailbox && c.host) {
            ccAddresses.push(`${c.mailbox}@${c.host}`);
          }
        });
      } else {
        if (typeof parsed.cc === 'string') {
          ccAddresses.push(parsed.cc);
        } else if (parsed.cc.address) {
          ccAddresses.push(parsed.cc.address);
        } else if (parsed.cc.text) {
          ccAddresses.push(parsed.cc.text);
        } else if (parsed.cc.mailbox && parsed.cc.host) {
          ccAddresses.push(`${parsed.cc.mailbox}@${parsed.cc.host}`);
        }
      }
    }

    // Extract subject
    const subject = parsed.subject || '';

    // Check if email already exists
    const existingEmail = await this.prisma.emailMessage.findUnique({
      where: { gmailMessageId },
      include: { attachments: true },
    });

    if (existingEmail) {
      this.logger.log(`Email with gmailMessageId ${gmailMessageId} already exists, updating with fresh data...`);
      
      // Update the existing email with fresh parsed data
      // This is important for reprocessing - we want to update with the complete data
      const updatedEmail = await this.prisma.emailMessage.update({
        where: { gmailMessageId },
        data: {
          from: fromAddress,
          to: toAddresses,
          cc: ccAddresses,
          subject: subject,
          receivedAt: parsed.date || existingEmail.receivedAt,
          // Don't update rawMimeStorageKey if it already exists (preserve original)
        },
        include: { attachments: true },
      });
      
      // Update attachments if we have fresh ones
      if (parsed.attachments && parsed.attachments.length > 0) {
        // Delete old attachments
        await this.prisma.emailAttachment.deleteMany({
          where: { emailMessageId: updatedEmail.id },
        });
        
        // Store new attachments
        const minioClient = this.minioService.getClient();
        const freshAttachments: any[] = [];
        
        for (let i = 0; i < parsed.attachments.length; i++) {
          const att = parsed.attachments[i];
          try {
            const attachmentId = crypto.randomBytes(16).toString('hex');
            const fileKey = `emails/attachments/${gmailMessageId}/${attachmentId}-${att.filename || 'attachment'}`;

            let contentBuffer: Buffer;
            if (Buffer.isBuffer(att.content)) {
              contentBuffer = att.content;
            } else if (typeof att.content === 'string') {
              contentBuffer = Buffer.from(att.content, att.encoding || 'base64');
            } else if (Array.isArray(att.content)) {
              contentBuffer = Buffer.concat(att.content);
            } else {
              continue;
            }

            const sizeBytes = contentBuffer.length;
            await minioClient.putObject('documents', fileKey, contentBuffer, sizeBytes, {
              'Content-Type': att.contentType || 'application/octet-stream',
            });

            const attachment = await this.prisma.emailAttachment.create({
              data: {
                emailMessageId: updatedEmail.id,
                filename: att.filename || 'unnamed',
                contentType: att.contentType || 'application/octet-stream',
                sizeBytes: sizeBytes,
                storageKey: fileKey,
                documentType: 'other',
              },
            });

            freshAttachments.push(attachment);
          } catch (attError) {
            this.logger.error(`Error storing attachment ${i + 1}:`, attError);
          }
        }
        
        this.logger.log(`Updated ${freshAttachments.length} attachments for email ${gmailMessageId}`);
        
      return {
        ...updatedEmail,
        attachments: freshAttachments,
        body: parsed.text || parsed.html || '',
        originalMessageId: parsed.messageId || null, // Add for reply threading
      };
    }
    
    return {
      ...updatedEmail,
      body: parsed.text || parsed.html || '',
      originalMessageId: parsed.messageId || null, // Add for reply threading
    };
    }

    // Store raw MIME in MinIO
    const rawMimeKey = `emails/raw/${gmailMessageId}.eml`;
    const minioClient = this.minioService.getClient();
    // Use provided raw buffer, or try to get from parsed.raw, or create empty
    const mimeBuffer = rawBuffer || (parsed.raw ? Buffer.from(parsed.raw) : Buffer.from(''));
    await minioClient.putObject('documents', rawMimeKey, mimeBuffer, mimeBuffer.length, {
      'Content-Type': 'message/rfc822',
    });

    this.logger.log(`Storing email: from="${fromAddress}", subject="${subject}", to=${toAddresses.length}, cc=${ccAddresses.length}`);

    // Extract original Message-ID from parsed email for proper threading
    const originalMessageId = parsed.messageId || null;

    // Store email message
    const emailMessage = await this.prisma.emailMessage.create({
      data: {
        gmailMessageId,
        threadId,
        from: fromAddress,
        to: toAddresses,
        cc: ccAddresses,
        subject: subject,
        receivedAt: parsed.date || new Date(),
        rawMimeStorageKey: rawMimeKey,
        processingStatus: 'pending',
      },
    });

    // Store attachments
    const attachments: any[] = [];
    this.logger.log(`Storing attachments: ${parsed.attachments?.length || 0} attachments found`);
    
    // Log detailed attachment info for debugging
    if (parsed.attachments && parsed.attachments.length > 0) {
      this.logger.log(`=== Attachment Details ===`);
      parsed.attachments.forEach((att: any, idx: number) => {
        const contentType = att.contentType || 'unknown';
        const filename = att.filename || 'unnamed';
        const contentTypeInfo = typeof att.content;
        const contentLength = att.content 
          ? (Buffer.isBuffer(att.content) ? att.content.length : (typeof att.content === 'string' ? att.content.length : (Array.isArray(att.content) ? att.content.length : 'unknown')))
          : 'null';
        this.logger.log(`  Raw attachment ${idx + 1}: filename="${filename}", contentType="${contentType}", content type=${contentTypeInfo}, content length=${contentLength}`);
      });
      this.logger.log(`========================`);
    }
    
    if (parsed.attachments && parsed.attachments.length > 0) {
      for (let i = 0; i < parsed.attachments.length; i++) {
        const att = parsed.attachments[i];
        try {
          this.logger.log(`Processing attachment ${i + 1}/${parsed.attachments.length}: ${att.filename || 'unnamed'}`);
          
          const attachmentId = crypto.randomBytes(16).toString('hex');
          const fileKey = `emails/attachments/${gmailMessageId}/${attachmentId}-${att.filename || 'attachment'}`;

          // Store attachment in MinIO
          // Handle different content types - could be Buffer, string, or array
          let contentBuffer: Buffer;
          if (Buffer.isBuffer(att.content)) {
            contentBuffer = att.content;
            this.logger.log(`  - Content is already a Buffer: ${contentBuffer.length} bytes`);
          } else if (typeof att.content === 'string') {
            // Try base64 first, then utf-8
            try {
              contentBuffer = Buffer.from(att.content, 'base64');
              this.logger.log(`  - Decoded from base64: ${contentBuffer.length} bytes`);
            } catch {
              contentBuffer = Buffer.from(att.content, 'utf-8');
              this.logger.log(`  - Decoded from utf-8: ${contentBuffer.length} bytes`);
            }
          } else if (Array.isArray(att.content)) {
            contentBuffer = Buffer.concat(att.content.map((chunk: any) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            this.logger.log(`  - Concatenated from array: ${contentBuffer.length} bytes`);
          } else {
            contentBuffer = Buffer.from(String(att.content));
            this.logger.log(`  - Converted from string: ${contentBuffer.length} bytes`);
          }

          const sizeBytes = contentBuffer.length;
          this.logger.log(`  - Final size: ${sizeBytes} bytes, Content-Type: ${att.contentType || 'application/octet-stream'}`);

          // Warn if attachment seems suspiciously small (might be incomplete)
          if (sizeBytes < 100 && (att.filename?.endsWith('.pdf') || att.filename?.endsWith('.xlsx') || att.filename?.endsWith('.docx'))) {
            this.logger.warn(`  - WARNING: Attachment ${att.filename} is very small (${sizeBytes} bytes) - may be incomplete or corrupted!`);
          }

          await minioClient.putObject('documents', fileKey, contentBuffer, sizeBytes, {
            'Content-Type': att.contentType || 'application/octet-stream',
          });

          const attachment = await this.prisma.emailAttachment.create({
            data: {
              emailMessageId: emailMessage.id,
              filename: att.filename || 'unnamed',
              contentType: att.contentType || 'application/octet-stream',
              sizeBytes: sizeBytes,
              storageKey: fileKey,
              documentType: 'other', // Will be classified later
            },
          });

          attachments.push(attachment);
          this.logger.log(`  - Successfully stored attachment: ${attachment.id}`);
        } catch (attError) {
          this.logger.error(`  - Error storing attachment ${i + 1}:`, attError);
          this.logger.error(`  - Attachment details: filename="${att.filename}", contentType="${att.contentType}", content type=${typeof att.content}`);
          // Continue with other attachments
        }
      }
    } else {
      this.logger.warn(`No attachments found in parsed email for ${gmailMessageId}`);
      this.logger.warn(`This could indicate an IMAP parsing issue - attachments might not have been extracted correctly`);
    }
    
    this.logger.log(`Successfully stored ${attachments.length} attachments for email ${gmailMessageId}`);

    return {
      ...emailMessage,
      attachments,
      body: parsed.text || parsed.html || '',
      originalMessageId, // Add this for reply threading (from parsed.messageId)
    };
  }

  /**
   * Fetch email from IMAP and store in database
   * Uses getPartData to fetch the complete message (root part contains entire RFC822)
   */
  async fetchAndStoreEmail(uid: number): Promise<any> {
    this.logger.log(`Fetching email from IMAP: ${uid}`);

    let connection: imaps.ImapSimple | null = null;
    try {
      connection = await this.connectImap();
      await connection.openBox('INBOX');

      // First, get the message structure
      const structSearch = await connection.search([['UID', uid]], { struct: true });
      if (!structSearch || structSearch.length === 0) {
        await connection.end();
        throw new Error(`Message with UID ${uid} not found`);
      }

      const structMessage = structSearch[0];
      const parts = imaps.getParts(structMessage.attributes.struct);
      
      this.logger.log(`Message UID ${uid} has ${parts.length} part(s) in structure`);

      // Now fetch the message with the full body
      const fetchOptions = {
        bodies: '', // Empty string means fetch the full message
        struct: true,
      };

      const messages = await connection.search([['UID', uid]], fetchOptions);
      if (!messages || messages.length === 0) {
        await connection.end();
        throw new Error(`Message with UID ${uid} not found`);
      }

      const message = messages[0];
      let fullMessage: Buffer | null = null;

      // Method 1: Check if message.parts has the full message (which === '')
      // This should contain the complete RFC822 message when bodies: '' is used
      if (message.parts) {
        this.logger.log(`Message has ${message.parts.length} part(s) in response`);
        message.parts.forEach((p: any, idx: number) => {
          const bodySize = p.body ? (Buffer.isBuffer(p.body) ? p.body.length : (typeof p.body === 'string' ? p.body.length : 'unknown')) : 'null';
          this.logger.log(`  Part ${idx}: which="${p.which}", body type=${typeof p.body}, body length=${bodySize}`);
        });
        
        const fullPart = message.parts.find((p: any) => p.which === '');
        if (fullPart) {
          this.logger.log(`Found full part (which === ''), body exists: ${!!fullPart.body}`);
          if (fullPart.body) {
            if (Buffer.isBuffer(fullPart.body)) {
              fullMessage = fullPart.body;
              this.logger.log(`Got complete message from buffer: ${fullMessage ? fullMessage.length : 0} bytes`);
            } else if (typeof fullPart.body === 'string') {
              this.logger.log(`Full part body is string, length: ${fullPart.body.length}`);
              this.logger.log(`First 200 chars of body string: ${fullPart.body.substring(0, 200)}`);
              
              // The issue: imap-simple with bodies: '' might not return the full message
              // It might only return headers or a partial message
              // Try multiple decoding strategies
              
              // Strategy 1: Try base64 (IMAP typically returns base64-encoded content)
              try {
                fullMessage = Buffer.from(fullPart.body, 'base64');
                this.logger.log(`Strategy 1 (base64): ${fullMessage.length} bytes`);
                
                // If base64 decode results in suspiciously small buffer, try other encodings
                if (fullMessage.length < 500 && fullPart.body.length > 500) {
                  this.logger.warn(`Base64 decode too small (${fullMessage.length} bytes from ${fullPart.body.length} chars), trying other strategies`);
                  
                  // Strategy 2: Try treating as raw binary (latin1 preserves all bytes)
                  const latin1Buffer = Buffer.from(fullPart.body, 'latin1');
                  this.logger.log(`Strategy 2 (latin1): ${latin1Buffer.length} bytes`);
                  
                  // Strategy 3: Try utf-8
                  const utf8Buffer = Buffer.from(fullPart.body, 'utf-8');
                  this.logger.log(`Strategy 3 (utf-8): ${utf8Buffer.length} bytes`);
                  
                  // Use the largest buffer
                  if (latin1Buffer.length > fullMessage.length) {
                    fullMessage = latin1Buffer;
                    this.logger.log(`Using latin1 buffer (${fullMessage.length} bytes)`);
                  }
                  if (utf8Buffer.length > fullMessage.length) {
                    fullMessage = utf8Buffer;
                    this.logger.log(`Using utf-8 buffer (${fullMessage.length} bytes)`);
                  }
                }
              } catch {
                // If base64 fails, try latin1 (preserves all bytes)
                fullMessage = Buffer.from(fullPart.body, 'latin1');
                this.logger.log(`Decoded from latin1 (fallback): ${fullMessage.length} bytes`);
              }
              
              // Log what we got
              if (fullMessage && fullMessage.length > 0) {
                this.logger.log(`Final decoded message: ${fullMessage.length} bytes`);
                this.logger.log(`First 200 bytes as text: ${fullMessage.toString('utf-8', 0, Math.min(200, fullMessage.length))}`);
              }
            } else {
              fullMessage = Buffer.from(String(fullPart.body));
              this.logger.log(`Converted to buffer: ${fullMessage.length} bytes`);
            }
          }
        } else {
          this.logger.warn(`No part with which === '' found in message.parts`);
        }
      }

      // Method 2: If message is too small, the issue is that bodies: '' isn't working correctly
      // Log what we actually received to debug
      if (!fullMessage || (fullMessage && fullMessage.length < 1000)) {
        this.logger.error(`CRITICAL: Only got ${fullMessage?.length || 0} bytes from IMAP fetch!`);
        this.logger.error(`This is way too small - a complete email should be at least several KB`);
        this.logger.error(`The .eml upload works because it has the complete raw MIME file`);
        this.logger.error(`For IMAP, we need to get the complete RFC822 message, but imap-simple's bodies: '' isn't working`);
        this.logger.error(`We may need to use the underlying node-imap connection directly with BODY[]`);
      }

      if (!fullMessage || fullMessage.length === 0) {
        await connection.end();
        throw new Error(`Could not extract message body from IMAP UID ${uid} - no body found`);
      }

      // Warn if message seems too small (likely incomplete)
      if (fullMessage.length < 500) {
        this.logger.warn(`Warning: Message UID ${uid} is very small (${fullMessage.length} bytes) - may be incomplete`);
      }

      this.logger.log(`Successfully fetched message UID ${uid}, raw size: ${fullMessage.length} bytes`);

      // Parse the raw message using the same method as .eml files
      const parsed = await simpleParser(fullMessage);
      
      // Log detailed parsing results for debugging
      const fromText = parsed.from?.text || 
                      (parsed.from?.value && Array.isArray(parsed.from.value) && parsed.from.value[0]?.address) ||
                      (parsed.from?.address) ||
                      (parsed.from?.mailbox && parsed.from?.host ? `${parsed.from.mailbox}@${parsed.from.host}` : null) ||
                      '(unknown)';
      
      this.logger.log(`Parsed email UID ${uid}:`);
      this.logger.log(`  - Subject: "${parsed.subject || '(no subject)'}"`);
      this.logger.log(`  - From: "${fromText}"`);
      this.logger.log(`  - Message-ID: "${parsed.messageId || '(no Message-ID)'}"`);
      this.logger.log(`  - In-Reply-To: "${parsed.inReplyTo || '(none)'}"`);
      this.logger.log(`  - References: "${parsed.references || '(none)'}"`);
      this.logger.log(`  - Body length: ${(parsed.text || parsed.html || '').length}`);
      this.logger.log(`  - Attachments found: ${parsed.attachments?.length || 0}`);
      if (parsed.attachments && parsed.attachments.length > 0) {
        parsed.attachments.forEach((att: any, idx: number) => {
          this.logger.log(`    Attachment ${idx + 1}: ${att.filename || 'unnamed'} (${att.contentType || 'unknown type'}, ${att.length || 'unknown size'} bytes)`);
        });
      } else {
        this.logger.warn(`  - No attachments found in parsed email!`);
      }

      // Mark email as read
      try {
        await connection.addFlags(uid, ['\\Seen']);
      } catch (flagError) {
        this.logger.warn(`Could not mark email ${uid} as read:`, flagError);
      }

      await connection.end();
      connection = null;

      // Pass the UID so we can use imap-{uid} as the gmailMessageId
      return await this.storeParsedEmail(parsed, fullMessage, uid);
    } catch (error) {
      if (connection) {
        try {
          await connection.end();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      this.logger.error(`Error fetching email ${uid}:`, error);
      throw error;
    }
  }

  /**
   * Get list of new unread messages addressed to auxoreachout@gmail.com
   * Also checks recent emails (last 24 hours) in case they were already read
   */
  async getNewMessages(): Promise<number[]> {
    this.logger.log('Fetching new messages from IMAP');

    try {
      const connection = await this.connectImap();
      await connection.openBox('INBOX');

      // First, try to get unread messages addressed to our email
      const searchCriteriaUnread = ['UNSEEN', ['TO', this.email]];
      const fetchOptions = {
        bodies: 'HEADER',
        struct: true,
      };

      let messages = await connection.search(searchCriteriaUnread, fetchOptions);
      let uids = messages.map((m: any) => m.attributes.uid);
      
      this.logger.log(`Found ${uids.length} unread messages addressed to ${this.email}`);

      // If no unread messages, also check recent emails (last 24 hours) that might have been auto-read
      if (uids.length === 0) {
        this.logger.log('No unread messages found, checking recent emails from last 24 hours...');
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0].replace(/-/g, '-');
        
        // Search for emails from last 24 hours addressed to our email
        const searchCriteriaRecent = [
          ['SINCE', yesterday],
          ['TO', this.email],
        ];
        
        messages = await connection.search(searchCriteriaRecent, fetchOptions);
        uids = messages.map((m: any) => m.attributes.uid);
        
        this.logger.log(`Found ${uids.length} recent messages (last 24h) addressed to ${this.email}`);
      }

      if (uids.length === 0) {
        await connection.end();
        this.logger.log('No new messages found');
        return [];
      }

      // Filter out emails FROM our own address to prevent infinite loops
      // We need to check the FROM header for each message
      const filteredUids: number[] = [];
      for (const uid of uids) {
        try {
          // Fetch just the header to check the FROM field
          const headerMessages = await connection.search([['UID', uid]], { 
            bodies: 'HEADER',
            struct: true,
          });
          
          if (headerMessages && headerMessages.length > 0) {
            const headerPart = headerMessages[0].parts?.find((p: any) => p.which === 'HEADER');
            if (headerPart && headerPart.body) {
              const headerStr = typeof headerPart.body === 'string' 
                ? headerPart.body 
                : headerPart.body.toString();
              
              // Extract FROM field
              const fromMatch = headerStr.match(/From:\s*(.+)/i);
              if (fromMatch) {
                const fromField = fromMatch[1].trim();
                // Check if FROM contains our email address
                if (fromField.toLowerCase().includes(this.email.toLowerCase())) {
                  this.logger.log(`Skipping email UID ${uid} - FROM our own address: ${fromField}`);
                  continue; // Skip this email
                }
              }
            }
          }
          
          filteredUids.push(uid);
        } catch (headerError) {
          // If we can't check the header, include it (better to process than skip incorrectly)
          this.logger.warn(`Could not check FROM header for UID ${uid}, including it:`, headerError);
          filteredUids.push(uid);
        }
      }

      // Check which ones we haven't processed yet
      const existing = await this.prisma.emailMessage.findMany({
        where: {
          gmailMessageId: { in: filteredUids.map((uid: number) => `imap-${uid}`) },
        },
        select: { gmailMessageId: true },
      });

      const existingIds = new Set(existing.map((e) => e.gmailMessageId));
      const newUids = filteredUids.filter((uid: number) => !existingIds.has(`imap-${uid}`));

      await connection.end();

      this.logger.log(`Found ${newUids.length} new unprocessed messages (out of ${filteredUids.length} filtered, ${uids.length} total)`);
      return newUids;
    } catch (error) {
      this.logger.error('Error fetching new messages:', error);
      throw error;
    }
  }

  /**
   * Check IMAP connection and list recent emails for debugging
   */
  async checkImapConnection(): Promise<any> {
    this.logger.log('Checking IMAP connection and listing recent emails...');

    try {
      const connection = await this.connectImap();
      await connection.openBox('INBOX');

      // Get all recent emails (last 24 hours) addressed to our email
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const searchCriteria = [
        ['SINCE', yesterday],
        ['TO', this.email],
      ];
      
      const fetchOptions = {
        bodies: 'HEADER',
        struct: true,
      };

      const messages = await connection.search(searchCriteria, fetchOptions);
      
      const emailList = messages.map((m: any) => {
        const uid = m.attributes.uid;
        const flags = m.attributes.flags || [];
        const date = m.attributes.date;
        const header = m.parts?.find((p: any) => p.which === 'HEADER')?.body || '';
        
        // Try to extract subject from header
        let subject = '';
        let from = '';
        try {
          const headerStr = typeof header === 'string' ? header : header.toString();
          const subjectMatch = headerStr.match(/Subject:\s*(.+)/i);
          const fromMatch = headerStr.match(/From:\s*(.+)/i);
          if (subjectMatch) subject = subjectMatch[1].trim();
          if (fromMatch) from = fromMatch[1].trim();
        } catch (e) {
          // Ignore parsing errors
        }

        return {
          uid,
          date: date ? new Date(date).toISOString() : null,
          isUnread: !flags.includes('\\Seen'),
          subject: subject || '(No subject)',
          from: from || '(Unknown)',
        };
      });

      await connection.end();

      return {
        success: true,
        email: this.email,
        totalEmails: emailList.length,
        unreadCount: emailList.filter((e: any) => e.isUnread).length,
        emails: emailList.sort((a: any, b: any) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA; // Most recent first
        }),
      };
    } catch (error) {
      this.logger.error('Error checking IMAP connection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send reply email via SMTP
   * Replies to all original recipients (To and CC)
   */
  async sendReply(emailData: any, packagedResponse: any, fieldExtractions: any[] = []) {
    this.logger.log(`Sending reply for email: ${emailData.gmailMessageId}`);

    if (!this.transporter) {
      throw new Error('SMTP transporter not initialized');
    }

    try {
      // Collect all recipients: original sender (from), all To recipients, and all CC recipients
      const allRecipients: string[] = [];
      
      // Add original sender
      if (emailData.from) {
        allRecipients.push(emailData.from);
      }
      
      // Add all To recipients
      if (emailData.to && Array.isArray(emailData.to)) {
        emailData.to.forEach((recipient: string) => {
          if (recipient && !allRecipients.includes(recipient)) {
            allRecipients.push(recipient);
          }
        });
      } else if (emailData.to && typeof emailData.to === 'string') {
        if (!allRecipients.includes(emailData.to)) {
          allRecipients.push(emailData.to);
        }
      }
      
      // Add all CC recipients
      if (emailData.cc && Array.isArray(emailData.cc)) {
        emailData.cc.forEach((recipient: string) => {
          if (recipient && !allRecipients.includes(recipient)) {
            allRecipients.push(recipient);
          }
        });
      } else if (emailData.cc && typeof emailData.cc === 'string') {
        if (!allRecipients.includes(emailData.cc)) {
          allRecipients.push(emailData.cc);
        }
      }

      // Remove our own email from recipients (we're sending FROM it, not TO it)
      const filteredRecipients = allRecipients.filter(recipient => 
        recipient.toLowerCase() !== this.email.toLowerCase()
      );

      if (filteredRecipients.length === 0) {
        this.logger.warn('No valid recipients found for reply, using original sender only');
        filteredRecipients.push(emailData.from || this.email);
      }

      // Use "Re: " prefix for proper threading, or keep original subject if it already starts with "Re:"
      let subject = emailData.subject || 'Submission';
      if (!subject.toLowerCase().startsWith('re:')) {
        subject = `Re: ${subject}`;
      }

      this.logger.log(`Sending reply to ${filteredRecipients.length} recipients: ${filteredRecipients.join(', ')}`);

      // Get the original Message-ID from the stored raw MIME file
      // This is critical for proper email threading
      let originalMessageId: string | undefined;
      let originalReferences: string | undefined;
      
      try {
        // First, try to re-parse the raw MIME file to get Message-ID using mailparser
        // This is more reliable than regex parsing
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
            
            // Re-parse with mailparser to get proper Message-ID
            const { simpleParser } = require('mailparser');
            const reParsed = await simpleParser(rawMime);
            
            if (reParsed.messageId) {
              // Ensure Message-ID has angle brackets if not already present
              originalMessageId = reParsed.messageId.trim();
              if (originalMessageId && !originalMessageId.startsWith('<')) {
                originalMessageId = `<${originalMessageId}>`;
              }
              this.logger.log(`Extracted Message-ID from raw MIME: ${originalMessageId}`);
            }
            
            // Build references header - include existing References, In-Reply-To, and Message-ID
            const refs: string[] = [];
            
            // Add existing References if present
            if (reParsed.references) {
              const refsArray = Array.isArray(reParsed.references) ? reParsed.references : [reParsed.references];
              refsArray.forEach((ref: string) => {
                const trimmed = ref.trim();
                if (trimmed && !refs.includes(trimmed)) {
                  refs.push(trimmed);
                }
              });
            }
            
            // Add In-Reply-To if present and not already in References
            if (reParsed.inReplyTo) {
              const inReplyTo = reParsed.inReplyTo.trim();
              if (inReplyTo && !refs.includes(inReplyTo)) {
                refs.push(inReplyTo);
              }
            }
            
            // Add the Message-ID itself
            if (originalMessageId && !refs.includes(originalMessageId)) {
              refs.push(originalMessageId);
            }
            
            if (refs.length > 0) {
              originalReferences = refs.join(' ');
              this.logger.log(`Built References header: ${originalReferences}`);
            } else if (originalMessageId) {
              originalReferences = originalMessageId;
            }
          } catch (mimeError) {
            this.logger.warn('Could not read/parse raw MIME file to extract Message-ID:', mimeError);
          }
        }
        
        // Fallback: use originalMessageId if it was passed in emailData
        if (!originalMessageId && emailData.originalMessageId) {
          originalMessageId = emailData.originalMessageId.trim();
          if (originalMessageId && !originalMessageId.startsWith('<')) {
            originalMessageId = `<${originalMessageId}>`;
          }
          if (originalMessageId) {
            originalReferences = originalMessageId;
            this.logger.log(`Using originalMessageId from emailData: ${originalMessageId}`);
          }
        }
        
        // Final fallback: construct a Message-ID format (not ideal for threading)
        if (!originalMessageId) {
          if (emailData.gmailMessageId && !emailData.gmailMessageId.startsWith('imap-') && !emailData.gmailMessageId.startsWith('eml-')) {
            // If gmailMessageId is already a proper Message-ID format, use it
            originalMessageId = emailData.gmailMessageId.trim();
            if (originalMessageId && !originalMessageId.startsWith('<')) {
              originalMessageId = `<${originalMessageId}>`;
            }
          } else {
            originalMessageId = `<${emailData.gmailMessageId}@auxo.local>`;
          }
          if (originalMessageId) {
            originalReferences = originalMessageId;
            this.logger.warn(`Using fallback Message-ID: ${originalMessageId}`);
          }
        }
        
        // Ensure Message-ID is properly formatted with angle brackets
        if (originalMessageId && !originalMessageId.startsWith('<')) {
          originalMessageId = `<${originalMessageId}>`;
        }
        
        this.logger.log(`Final Message-ID for reply: ${originalMessageId}`);
        this.logger.log(`Final References for reply: ${originalReferences}`);
      } catch (error) {
        this.logger.error('Error determining original Message-ID:', error);
        originalMessageId = `<${emailData.gmailMessageId}@auxo.local>`;
        originalReferences = originalMessageId;
      }

      // Build mail options with proper reply headers
      const htmlContent = await this.buildReplyHtml(packagedResponse, emailData.id, fieldExtractions);
      const mailOptions: nodemailer.SendMailOptions = {
        from: this.email,
        to: filteredRecipients, // Send to all recipients (Reply-All behavior)
        subject,
        text: this.buildReplyText(packagedResponse),
        html: htmlContent,
        attachments: [
          {
            filename: `Submission_${emailData.id}.json`,
            content: JSON.stringify(packagedResponse.json, null, 2),
            contentType: 'application/json',
          },
          // PDF attachment will be added when PDF generation is implemented
        ],
      };
      
      // Add reply headers if we have the Message-ID (critical for threading)
      if (originalMessageId) {
        mailOptions.inReplyTo = originalMessageId;
        this.logger.log(`Setting In-Reply-To header: ${originalMessageId}`);
      }
      
      if (originalReferences) {
        mailOptions.references = originalReferences;
        this.logger.log(`Setting References header: ${originalReferences}`);
      }
      
      // Also set replyTo to the original sender for proper threading
      if (emailData.from) {
        mailOptions.replyTo = emailData.from;
      }

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Reply sent successfully: ${info.messageId} to ${filteredRecipients.length} recipients`);
      return info;
    } catch (error) {
      this.logger.error('Error sending reply:', error);
      throw error;
    }
  }

  /**
   * Build plain text reply
   */
  private buildReplyText(packagedResponse: any): string {
    return `
Hi,

We processed your forwarded submission and extracted the key commercial property fields below.

Summary:
${packagedResponse.summary}

Key details:
${packagedResponse.table}

Attached:
- JSON: Submission data in structured format

Below is the full field table inline for quick copy/paste.

${packagedResponse.table}

Thanks,
The Auxo processor
    `.trim();
  }

  /**
   * Build HTML reply with modern, scannable design
   */
  private async buildReplyHtml(packagedResponse: any, emailMessageId: string, fieldExtractions: any[] = []): Promise<string> {
    // Get frontend URL from config or use default
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    
    // Use JSON data if available for better structure, otherwise parse the text table
    const htmlTable = packagedResponse.json 
      ? await this.convertJsonToHtml(packagedResponse.json, emailMessageId, fieldExtractions, frontendUrl)
      : this.convertTableToHtml(packagedResponse.table);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6; 
      color: #1f2937; 
      background-color: #f9fafb;
      padding: 20px;
    }
    .email-container {
      max-width: 800px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: visible;
    }
    .email-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px 32px;
    }
    .email-header h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .email-header p {
      font-size: 14px;
      opacity: 0.9;
    }
    .email-body {
      padding: 32px;
    }
    .greeting {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 24px;
    }
    .summary-card {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border-left: 4px solid #3b82f6;
      padding: 20px 24px;
      margin: 24px 0;
      border-radius: 6px;
    }
    .summary-card h2 {
      font-size: 18px;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
    }
    .summary-card h2::before {
      content: "📋";
      margin-right: 8px;
      font-size: 20px;
    }
    .summary-card p {
      font-size: 15px;
      line-height: 1.7;
      color: #1e3a8a;
    }
    .section {
      margin: 32px 0;
    }
    .section-header {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      background-color: #ffffff;
    }
    .details-table tr {
      border-bottom: 1px solid #e5e7eb;
    }
    .details-table tr:last-child {
      border-bottom: none;
    }
    .details-table td {
      padding: 12px 16px;
      font-size: 14px;
      word-wrap: break-word;
      overflow-wrap: break-word;
      white-space: normal;
      text-overflow: clip;
      overflow: visible;
    }
    .details-table td:first-child {
      font-weight: 600;
      color: #374151;
      width: 40%;
      vertical-align: top;
    }
    .details-table td:last-child {
      color: #1f2937;
    }
    .location-group {
      background-color: #f9fafb;
      border-radius: 6px;
      padding: 16px;
      margin: 16px 0;
      border-left: 3px solid #10b981;
    }
    .location-title {
      font-weight: 600;
      color: #059669;
      margin-bottom: 12px;
      font-size: 15px;
    }
    .building-group {
      background-color: #ffffff;
      border-radius: 4px;
      padding: 12px 16px;
      margin: 12px 0;
      border-left: 2px solid #34d399;
    }
    .building-title {
      font-weight: 600;
      color: #047857;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .value-highlight {
      color: #059669;
      font-weight: 600;
    }
    .value-money {
      color: #1d4ed8;
      font-weight: 600;
    }
    .value-na {
      color: #9ca3af;
      font-style: italic;
    }
    .attachments {
      background-color: #f9fafb;
      border-radius: 6px;
      padding: 16px 20px;
      margin: 24px 0;
    }
    .attachments h3 {
      font-size: 15px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
    }
    .attachments ul {
      list-style: none;
      padding: 0;
    }
    .attachments li {
      padding: 8px 0;
      font-size: 14px;
      color: #4b5563;
      display: flex;
      align-items: center;
    }
    .attachments li::before {
      content: "📎";
      margin-right: 8px;
    }
    .footer {
      background-color: #f9fafb;
      padding: 24px 32px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }
    .footer p {
      margin: 4px 0;
    }
    .note-box {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 10px 14px;
      margin: 16px 0;
      border-radius: 6px;
      font-size: 13px;
      color: #92400e;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Submission Processed Successfully</h1>
      <p>Commercial Property Insurance Submission</p>
    </div>
    
    <div class="email-body">
      <div class="greeting">
        <p>Hi,</p>
        <p style="margin-top: 8px;">We processed your forwarded submission and extracted the key commercial property fields below.</p>
      </div>
      
      <div class="summary-card">
        <h2>Summary</h2>
        <p>${this.escapeHtml(packagedResponse.summary)}</p>
      </div>

      <div class="note-box">
        Click on any extracted field to see the source submission document
      </div>

      ${htmlTable}

      <div class="attachments">
        <h3>Attachments</h3>
        <ul>
          <li>JSON: Submission data in structured format</li>
        </ul>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>Thanks,</strong></p>
      <p>The Auxos processor</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Get expected fields schema from field-schema.json (source of truth)
   * Same as used in submission details page
   */
  private async getExpectedFieldsSchema(): Promise<Record<string, unknown>> {
    return await this.fieldSchemaService.getExpectedSchema();
  }

  /**
   * Format value the same way as submission details page
   */
  private formatValueForEmail(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  }

  /**
   * Convert camelCase to Title Case (same as submission details page)
   */
  private formatFieldName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str: string) => str.toUpperCase())
      .trim();
  }

  /**
   * Render a section using schema-driven approach (same as submission details page)
   */
  private renderSectionForEmail(
    sectionName: string,
    sectionData: unknown,
    fieldExtractions: any[],
    prefix: string,
    emailMessageId: string,
    frontendUrl: string,
    expectedFieldsSchema: Record<string, unknown>
  ): string {
    // Normalize section name: remove spaces and convert to camelCase for lookup
    // e.g., "Loss History" -> "lossHistory", "Submission" -> "submission"
    const normalizedSectionName = sectionName.replace(/\s+/g, '').replace(/^./, (str) => str.toLowerCase());
    const schemaSection = expectedFieldsSchema[normalizedSectionName] || expectedFieldsSchema[sectionName.toLowerCase()];
    if (!schemaSection) {
      return '';
    }

    let html = '';
    const dataObj = (sectionData && typeof sectionData === 'object' && !Array.isArray(sectionData))
      ? sectionData as Record<string, unknown>
      : {};

    if (Array.isArray(schemaSection)) {
      // Handle array sections (like locations)
      const dataArray = Array.isArray(sectionData) ? sectionData : [];
      const schemaItem = schemaSection[0] as Record<string, unknown>;
      
      // If no items, show a message
      if (dataArray.length === 0) {
        html += '<div style="padding: 12px; color: #6b7280; font-style: italic;">No data available</div>';
        return html;
      }
      
      // Render each location/item
      dataArray.forEach((item: unknown, index: number) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const itemData = item as Record<string, unknown>;
          
          // Wrap location in location-group div (for locations section)
          if (sectionName.toLowerCase() === 'locations' || prefix === 'locations') {
            html += '<div class="location-group">';
            html += `<div class="location-title">Location ${itemData.locationNumber || 'N/A'}</div>`;
          }
          
          // Render all fields from schema
          Object.entries(schemaItem).forEach(([key, _schemaValue]) => {
            // Skip locationNumber if it's already shown in the title
            if ((sectionName.toLowerCase() === 'locations' || prefix === 'locations') && key === 'locationNumber') {
              return;
            }
            
            const value = itemData[key] !== undefined ? itemData[key] : null;
            const fieldPath = prefix ? `${prefix}[${index}].${key}` : `${index}.${key}`;
            const fieldName = this.formatFieldName(key);
            
            // Handle nested arrays (like buildings)
            if (key === 'buildings' && Array.isArray(schemaItem[key])) {
              const buildingsData = Array.isArray(value) ? value : [];
              const buildingSchema = (schemaItem[key] as unknown[])[0] as Record<string, unknown>;
              
              buildingsData.forEach((building: unknown, buildingIndex: number) => {
                if (building && typeof building === 'object' && !Array.isArray(building)) {
                  const buildingData = building as Record<string, unknown>;
                  
                  // Start building group
                  html += '<div class="building-group">';
                  html += `<div class="building-title">Building ${buildingData.buildingNumber || 'N/A'}${buildingData.buildingName ? ` - ${buildingData.buildingName}` : ''}</div>`;
                  
                  // Collect all building fields
                  const buildingFields: Array<{ key: string; value: unknown; path: string }> = [];
                  Object.entries(buildingSchema).forEach(([buildingKey, _buildingSchemaValue]) => {
                    const buildingValue = buildingData[buildingKey] !== undefined ? buildingData[buildingKey] : null;
                    const buildingFieldPath = prefix ? `${prefix}[${index}].buildings[${buildingIndex}].${buildingKey}` : `${index}.buildings[${buildingIndex}].${buildingKey}`;
                    const buildingFieldName = this.formatFieldName(buildingKey);
                    buildingFields.push({ key: buildingFieldName, value: buildingValue, path: buildingFieldPath });
                  });
                  
                  // Sort: extracted fields first
                  buildingFields.sort((a, b) => {
                    const aExtracted = this.isFieldExtracted(a.path, fieldExtractions).isExtracted;
                    const bExtracted = this.isFieldExtracted(b.path, fieldExtractions).isExtracted;
                    if (aExtracted && !bExtracted) return -1;
                    if (!aExtracted && bExtracted) return 1;
                    return 0;
                  });
                  
                  // Render building fields
                  buildingFields.forEach(field => {
                    html += this.renderKeyValue(field.key, field.value, true, field.path, emailMessageId, fieldExtractions, frontendUrl);
                  });
                  
                  html += '</div>';
                }
              });
            } else {
              // Regular location field
              html += this.renderKeyValue(fieldName, value, true, fieldPath, emailMessageId, fieldExtractions, frontendUrl);
            }
          });
          
          // Close location-group div
          if (sectionName.toLowerCase() === 'locations' || prefix === 'locations') {
            html += '</div>';
          }
        }
      });
    } else if (schemaSection && typeof schemaSection === 'object' && !Array.isArray(schemaSection)) {
      // Handle object sections (like submission, coverage, lossHistory)
      const schemaObj = schemaSection as Record<string, unknown>;
      
      // Special handling for lossHistory: normalize priorLosses or losses array to aggregate fields (if present)
      let normalizedDataObj = dataObj;
      if ((sectionName.toLowerCase() === 'losshistory' || prefix === 'lossHistory')) {
        if ((dataObj.priorLosses && Array.isArray(dataObj.priorLosses)) || 
            (dataObj.losses && Array.isArray(dataObj.losses))) {
          normalizedDataObj = this.normalizeLossHistoryFromPriorLosses(dataObj);
        }
      }
      
      // Merge schema fields with actual data fields, intelligently matching names
      const mergedFields = this.mergeFieldsWithData(schemaObj, normalizedDataObj, sectionName);
      
      // Collect all fields (from both schema and data)
      const fields: Array<{ key: string; value: unknown; path: string; dataKey: string; schemaKey: string }> = [];
      mergedFields.forEach(({ schemaKey, dataKey, value }) => {
        const fieldPath = prefix ? `${prefix}.${dataKey}` : dataKey;
        // Also try schema key path for field extraction lookup
        const schemaFieldPath = prefix ? `${prefix}.${schemaKey}` : schemaKey;
        const fieldName = this.formatFieldName(schemaKey);
        fields.push({ key: fieldName, value: value, path: fieldPath, dataKey, schemaKey });
      });
      
      // Sort: extracted fields first, then schema fields, then other fields
      fields.sort((a, b) => {
        // Check both data path and schema path for extractions
        const aExtracted = this.isFieldExtracted(a.path, fieldExtractions).isExtracted || 
                          this.isFieldExtracted(prefix ? `${prefix}.${a.dataKey}` : a.dataKey, fieldExtractions).isExtracted;
        const bExtracted = this.isFieldExtracted(b.path, fieldExtractions).isExtracted || 
                          this.isFieldExtracted(prefix ? `${prefix}.${b.dataKey}` : b.dataKey, fieldExtractions).isExtracted;
        if (aExtracted && !bExtracted) return -1;
        if (!aExtracted && bExtracted) return 1;
        
        // Then prioritize schema fields over data-only fields
        // Check if the schemaKey matches a schema field (schemaKey is the canonical name from schema)
        const aInSchema = schemaObj[a.schemaKey] !== undefined;
        const bInSchema = schemaObj[b.schemaKey] !== undefined;
        if (aInSchema && !bInSchema) return -1;
        if (!aInSchema && bInSchema) return 1;
        
        return 0;
      });
      
      // Render fields - try both data path and schema path for field extraction lookup
      fields.forEach(field => {
        // Try to find extraction using data key path first, then schema key path
        const dataPath = prefix ? `${prefix}.${field.dataKey}` : field.dataKey;
        const schemaPath = prefix ? `${prefix}.${field.key.toLowerCase().replace(/\s+/g, '')}` : field.key.toLowerCase().replace(/\s+/g, '');
        const extraction = fieldExtractions.find(fe => 
          fe.fieldPath === dataPath || 
          fe.fieldPath === schemaPath ||
          fe.fieldPath === field.path
        );
        
        // Use the path that has an extraction, or fall back to data path
        const fieldPath = extraction?.fieldPath || dataPath;
        html += this.renderKeyValue(field.key, field.value, false, fieldPath, emailMessageId, fieldExtractions, frontendUrl);
      });
    }

    return html;
  }

  /**
   * Convert JSON data directly to formatted HTML using schema-driven approach (same as submission details page)
   * Always shows ALL sections from schema, even if data is missing or null
   */
  private async convertJsonToHtml(data: any, emailMessageId: string, fieldExtractions: any[] = [], frontendUrl: string = 'http://localhost:3000'): Promise<string> {
    const expectedFieldsSchema = await this.getExpectedFieldsSchema();
    let html = '';
    
    // Always render all sections from schema, even if data is missing
    // Submission Information
    html += '<div class="section">';
    html += '<div class="section-header">Submission Information</div>';
    html += '<table class="details-table">';
    html += this.renderSectionForEmail('submission', data?.submission || {}, fieldExtractions, 'submission', emailMessageId, frontendUrl, expectedFieldsSchema);
    html += '</table></div>';
    
    // Locations & Buildings
    html += '<div class="section">';
    html += '<div class="section-header">Locations & Buildings</div>';
    // Use renderSectionForEmail for consistent nested field handling
    html += this.renderSectionForEmail('locations', data?.locations || [], fieldExtractions, 'locations', emailMessageId, frontendUrl, expectedFieldsSchema);
    html += '</div>';
    
    // Coverage & Limits
    html += '<div class="section">';
    html += '<div class="section-header">Coverage & Limits</div>';
    html += '<table class="details-table">';
    html += this.renderSectionForEmail('coverage', data?.coverage || {}, fieldExtractions, 'coverage', emailMessageId, frontendUrl, expectedFieldsSchema);
    html += '</table></div>';
    
    // Loss History
    html += '<div class="section">';
    html += '<div class="section-header">Loss History</div>';
    html += '<table class="details-table">';
    html += this.renderSectionForEmail('lossHistory', data?.lossHistory || {}, fieldExtractions, 'lossHistory', emailMessageId, frontendUrl, expectedFieldsSchema);
    html += '</table></div>';
    
    return html;
  }

  /**
   * Synchronous version of field name matching (no LLM fallback)
   */
  private matchFieldNameSync(
    dataFieldName: string, 
    schemaFieldNames: string[]
  ): string | null {
    const normalized = dataFieldName.toLowerCase().trim();
    
    // Exact match (case-insensitive)
    const exactMatch = schemaFieldNames.find(s => s.toLowerCase() === normalized);
    if (exactMatch) return exactMatch;
    
    // Common field name mappings/aliases (mapped to current schema field names)
    const fieldMappings: Record<string, string[]> = {
      'totalincurred': ['totalIncurred'],
      'totalincurredloss': ['totalIncurred'], // Map old name to new
      'causefloss': ['causeOfLoss'],
      'causeflossform': ['causeOfLoss'], // Map old name to new
      'lossdescription': ['lossDescription', 'lossNarrativeSummary'], // Both exist in schema
      'lossnarrativesummary': ['lossNarrativeSummary', 'lossDescription'], // Both exist in schema
      'namedinsured': ['namedInsured'],
      'carriername': ['carrierName'],
      'brokername': ['brokerName'],
      'effectivedate': ['effectiveDate'],
      'expirationdate': ['expirationDate'],
    };
    
    // Check mappings
    if (fieldMappings[normalized]) {
      for (const mappedName of fieldMappings[normalized]) {
        if (schemaFieldNames.includes(mappedName)) {
          return mappedName;
        }
      }
    }
    
    // Fuzzy match: remove common suffixes/prefixes and try again
    const fuzzyVariations = [
      normalized.replace(/loss$/, '').replace(/^total/, ''),
      normalized.replace(/form$/, ''),
      normalized.replace(/summary$/, ''),
      normalized.replace(/description$/, ''),
    ];
    
    for (const variation of fuzzyVariations) {
      if (variation && variation !== normalized) {
        const match = schemaFieldNames.find(s => 
          s.toLowerCase().includes(variation) || variation.includes(s.toLowerCase())
        );
        if (match) return match;
      }
    }
    
    return null;
  }

  /**
   * Intelligently match a field name from data to a schema field name
   * Uses deterministic matching first, with optional LLM fallback for complex cases
   */
  private async matchFieldName(
    dataFieldName: string, 
    schemaFieldNames: string[],
    sectionContext?: string,
    useLLMFallback: boolean = false
  ): Promise<string | null> {
    const normalized = dataFieldName.toLowerCase().trim();
    
    // Exact match (case-insensitive)
    const exactMatch = schemaFieldNames.find(s => s.toLowerCase() === normalized);
    if (exactMatch) return exactMatch;
    
    // Common field name mappings/aliases (mapped to current schema field names)
    const fieldMappings: Record<string, string[]> = {
      'totalincurred': ['totalIncurred'],
      'totalincurredloss': ['totalIncurred'], // Map old name to new
      'causefloss': ['causeOfLoss'],
      'causeflossform': ['causeOfLoss'], // Map old name to new
      'lossdescription': ['lossDescription', 'lossNarrativeSummary'], // Both exist in schema
      'lossnarrativesummary': ['lossNarrativeSummary', 'lossDescription'], // Both exist in schema
      'namedinsured': ['namedInsured'],
      'carriername': ['carrierName'],
      'brokername': ['brokerName'],
      'effectivedate': ['effectiveDate'],
      'expirationdate': ['expirationDate'],
    };
    
    // Check mappings
    if (fieldMappings[normalized]) {
      for (const mappedName of fieldMappings[normalized]) {
        if (schemaFieldNames.includes(mappedName)) {
          return mappedName;
        }
      }
    }
    
    // Fuzzy match: remove common suffixes/prefixes and try again
    const fuzzyVariations = [
      normalized.replace(/loss$/, '').replace(/^total/, ''),
      normalized.replace(/form$/, ''),
      normalized.replace(/summary$/, ''),
      normalized.replace(/description$/, ''),
    ];
    
    for (const variation of fuzzyVariations) {
      if (variation && variation !== normalized) {
        const match = schemaFieldNames.find(s => 
          s.toLowerCase().includes(variation) || variation.includes(s.toLowerCase())
        );
        if (match) return match;
      }
    }
    
    // LLM fallback for complex semantic matching (optional, disabled by default for performance)
    if (useLLMFallback && this.configService.get<string>('OPENAI_API_KEY')) {
      try {
        return await this.matchFieldNameWithLLM(dataFieldName, schemaFieldNames, sectionContext);
      } catch (error) {
        this.logger.warn(`LLM field matching failed for "${dataFieldName}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return null;
  }

  /**
   * Use LLM to semantically match a field name to schema fields
   * This is a fallback for cases where deterministic matching fails
   */
  private async matchFieldNameWithLLM(
    dataFieldName: string,
    schemaFieldNames: string[],
    sectionContext?: string
  ): Promise<string | null> {
    // Dynamic import for OpenAI
    let OpenAI: any;
    try {
      OpenAI = require('openai').default;
    } catch (e) {
      return null;
    }

    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) return null;

    const openai = new OpenAI({ apiKey });

    const prompt = `You are a data mapping expert. Match the following field name to the most appropriate schema field.

Data field name: "${dataFieldName}"
Section context: ${sectionContext || 'unknown'}
Available schema fields: ${schemaFieldNames.join(', ')}

Return ONLY the exact schema field name that best matches the data field name, or "null" if no good match exists.
Consider semantic meaning, not just string similarity.

Response format: Just the field name or "null"`;

    try {
      const response = await openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini', // Use cheaper model for this
        messages: [
          {
            role: 'system',
            content: 'You are a data mapping expert. Return only the field name or "null".',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.0,
        max_tokens: 50,
      });

      const matched = response.choices[0].message.content?.trim() || null;
      if (matched && matched !== 'null' && schemaFieldNames.includes(matched)) {
        return matched;
      }
    } catch (error) {
      this.logger.warn(`LLM field matching error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return null;
  }

  /**
   * Merge schema fields with actual data fields, intelligently matching field names
   * Returns a combined set of fields with values from data
   */
  private mergeFieldsWithData(
    schemaFields: Record<string, unknown>,
    dataFields: Record<string, unknown>,
    sectionContext?: string
  ): Array<{ schemaKey: string; dataKey: string; value: unknown }> {
    const schemaKeys = Object.keys(schemaFields);
    const dataKeys = Object.keys(dataFields);
    const merged: Array<{ schemaKey: string; dataKey: string; value: unknown }> = [];
    const usedDataKeys = new Set<string>();
    
    // First, match schema fields to data fields
    schemaKeys.forEach(schemaKey => {
      // Try exact match first
      if (dataKeys.includes(schemaKey) && !usedDataKeys.has(schemaKey)) {
        merged.push({ schemaKey, dataKey: schemaKey, value: dataFields[schemaKey] });
        usedDataKeys.add(schemaKey);
      } else {
        // Try intelligent matching (synchronous - no LLM fallback)
        const matchedKey = this.matchFieldNameSync(schemaKey, dataKeys.filter(k => !usedDataKeys.has(k)));
        if (matchedKey) {
          merged.push({ schemaKey, dataKey: matchedKey, value: dataFields[matchedKey] });
          usedDataKeys.add(matchedKey);
        } else {
          // Schema field not found in data - still include it with null
          merged.push({ schemaKey, dataKey: schemaKey, value: null });
        }
      }
    });
    
    // Then, add any remaining data fields that weren't matched to schema
    dataKeys.forEach(dataKey => {
      if (!usedDataKeys.has(dataKey)) {
        // Check if it's a close match to any schema field we already have
        const matchedSchemaKey = this.matchFieldNameSync(dataKey, schemaKeys);
        if (!matchedSchemaKey) {
          // This is a new field not in schema - include it
          merged.push({ schemaKey: dataKey, dataKey, value: dataFields[dataKey] });
        }
      }
    });
    
    return merged;
  }

  /**
   * Normalize loss history from priorLosses or losses array structure to aggregate fields
   * Converts: { priorLosses: [{ totalIncurred: 100000, ... }] } or { losses: [{ totalIncurred: 100000, ... }] }
   * To: { totalIncurred: 100000, numberOfClaims: 1, ... }
   */
  private normalizeLossHistoryFromPriorLosses(lossHistoryData: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...lossHistoryData };
    
    // Check for both 'priorLosses' and 'losses' arrays
    const lossesArray = (Array.isArray(lossHistoryData.priorLosses) && lossHistoryData.priorLosses.length > 0)
      ? lossHistoryData.priorLosses as Array<Record<string, unknown>>
      : (Array.isArray(lossHistoryData.losses) && lossHistoryData.losses.length > 0)
      ? lossHistoryData.losses as Array<Record<string, unknown>>
      : null;
    
    if (lossesArray) {
      // Aggregate fields from losses array
      let totalIncurred = 0;
      let largestSingleLoss = 0;
      let hasOpenClaims = false;
      let hasCatLosses = false;
      const claimCount = lossesArray.length;
      
      lossesArray.forEach((loss: Record<string, unknown>) => {
        const incurred = typeof loss.totalIncurred === 'number' ? loss.totalIncurred : 
                        typeof loss.incurred === 'number' ? loss.incurred : 0;
        totalIncurred += incurred;
        if (incurred > largestSingleLoss) {
          largestSingleLoss = incurred;
        }
        
        if (loss.open === true || loss.status === 'open' || loss.status === 'Open') {
          hasOpenClaims = true;
        }
        if (loss.catastrophe === true || loss.cat === true || loss.catastropheLoss === true) {
          hasCatLosses = true;
        }
      });
      
      // Map to expected aggregate fields (only if not already set)
      // Store as totalIncurred (canonical schema field name)
      if (normalized.totalIncurred === null || normalized.totalIncurred === undefined) {
        normalized.totalIncurred = totalIncurred > 0 ? totalIncurred : null;
      }
      if (normalized.numberOfClaims === null || normalized.numberOfClaims === undefined) {
        normalized.numberOfClaims = claimCount > 0 ? claimCount : null;
      }
      if (normalized.largestSingleLoss === null || normalized.largestSingleLoss === undefined) {
        normalized.largestSingleLoss = largestSingleLoss > 0 ? largestSingleLoss : null;
      }
      if (normalized.anyOpenClaims === null || normalized.anyOpenClaims === undefined) {
        normalized.anyOpenClaims = hasOpenClaims;
      }
      if (normalized.anyCatLosses === null || normalized.anyCatLosses === undefined) {
        normalized.anyCatLosses = hasCatLosses;
      }
    }
    
    // Remove both priorLosses and losses arrays from normalized output (we've aggregated them)
    delete normalized.priorLosses;
    delete normalized.losses;
    
    return normalized;
  }

  /**
   * Map priorLosses or losses array paths to aggregate field paths
   * e.g., "lossHistory.priorLosses[0].totalIncurred" -> "lossHistory.totalIncurred"
   * e.g., "lossHistory.losses[0].totalIncurred" -> "lossHistory.totalIncurred"
   */
  private mapPriorLossesPathToAggregate(fieldPath: string): string[] {
    const paths: string[] = [fieldPath]; // Always include original path
    
    // Check if this is a priorLosses or losses path
    if (fieldPath.includes('priorLosses[') || fieldPath.includes('losses[')) {
      const lossesMatch = fieldPath.match(/^lossHistory\.(?:priorLosses|losses)\[\d+\]\.(.+)$/);
      if (lossesMatch) {
        const fieldName = lossesMatch[1];
        // Map common losses fields to aggregate fields
        const fieldMapping: Record<string, string> = {
          'totalIncurredLoss': 'totalIncurred', // Map old name to new canonical name
          'incurred': 'totalIncurred',
          'paid': 'paidLoss',
          'reserve': 'outstandingReserve',
          'open': 'anyOpenClaims',
          'catastrophe': 'anyCatLosses',
          'cat': 'anyCatLosses',
        };
        
        const aggregateField = fieldMapping[fieldName.toLowerCase()];
        if (aggregateField) {
          paths.push(`lossHistory.${aggregateField}`);
        }
      }
    }
    
    return paths;
  }

  /**
   * Check if a field was extracted (has an extraction record with a non-null value)
   * Intelligently matches field paths, handling variations and alternate field names
   */
  private isFieldExtracted(fieldPath: string | undefined, fieldExtractions: any[]): { isExtracted: boolean; extractedValue: any } {
    if (!fieldPath) {
      return { isExtracted: false, extractedValue: null };
    }
    
    // Check direct path
    let extraction = fieldExtractions.find(fe => fe.fieldPath === fieldPath);
    
    // If not found, try intelligent matching
    if (!extraction) {
      const pathParts = fieldPath.split('.');
      if (pathParts.length >= 2) {
        const section = pathParts[0];
        const fieldName = pathParts.slice(1).join('.');
        
        // Try to find extractions with similar field names in the same section
        const sectionExtractions = fieldExtractions.filter(fe => fe.fieldPath.startsWith(section + '.'));
        const normalizedFieldName = fieldName.toLowerCase();
        
        // Try exact match (case-insensitive)
        extraction = sectionExtractions.find(fe => 
          fe.fieldPath.toLowerCase().endsWith('.' + normalizedFieldName)
        );
        
        // Try field name variations
        if (!extraction) {
          const fieldMappings: Record<string, string[]> = {
            'totalincurredloss': ['totalincurred'], // Map old name to new
            'totalincurred': ['totalincurred'], // Canonical name
            'causeflossform': ['causefloss', 'causeflossform'],
            'causefloss': ['causeflossform', 'causefloss'],
            'lossnarrativesummary': ['lossdescription', 'lossnarrativesummary'],
            'lossdescription': ['lossnarrativesummary', 'lossdescription'],
          };
          
          const variations = fieldMappings[normalizedFieldName] || [normalizedFieldName];
          for (const variation of variations) {
            extraction = sectionExtractions.find(fe => 
              fe.fieldPath.toLowerCase().endsWith('.' + variation)
            );
            if (extraction) break;
          }
        }
      }
    }
    
    // If not found and this is a lossHistory aggregate field, check priorLosses/losses paths and alternate field names
    if (!extraction && fieldPath.startsWith('lossHistory.')) {
        const aggregateField = fieldPath.replace('lossHistory.', '');
        
        // Check for alternate field name (e.g., totalIncurredLoss -> totalIncurred)
        const alternateField = aggregateField === 'totalIncurredLoss' ? 'totalIncurred' : null;
        if (alternateField) {
          const alternatePath = `lossHistory.${alternateField}`;
          extraction = fieldExtractions.find(fe => fe.fieldPath === alternatePath);
          if (extraction && extraction.fieldValue !== null && extraction.fieldValue !== undefined && extraction.fieldValue !== '') {
            return { isExtracted: true, extractedValue: extraction.fieldValue };
          }
        }
        
        // Look for any priorLosses or losses extractions that might map to this aggregate field
        const priorLossesExtractions = fieldExtractions.filter(fe => 
          (fe.fieldPath.includes('lossHistory.priorLosses[') || fe.fieldPath.includes('lossHistory.losses[')) && 
          fe.fieldValue !== null && 
          fe.fieldValue !== undefined && 
          fe.fieldValue !== ''
        );
        
        // If this is totalIncurred, sum up all priorLosses/losses totalIncurred values
        if (aggregateField === 'totalIncurred') {
        let sum = 0;
        priorLossesExtractions.forEach(fe => {
          if (fe.fieldPath.includes('.totalIncurred') || fe.fieldPath.includes('.incurred')) {
            const value = typeof fe.fieldValue === 'number' ? fe.fieldValue : 
                         typeof fe.fieldValue === 'string' ? parseFloat(fe.fieldValue) || 0 : 0;
            sum += value;
          }
        });
        if (sum > 0) {
          return { isExtracted: true, extractedValue: sum };
        }
      }
      
      // If this is numberOfClaims, count priorLosses/losses entries
      if (aggregateField === 'numberOfClaims') {
        const uniqueIndices = new Set(
          priorLossesExtractions
            .map(fe => fe.fieldPath.match(/(?:priorLosses|losses)\[(\d+)\]/)?.[1])
            .filter((idx): idx is string => idx !== undefined)
        );
        if (uniqueIndices.size > 0) {
          return { isExtracted: true, extractedValue: uniqueIndices.size };
        }
      }
      
      // For other fields, check if any priorLosses extraction maps to it
      const mappedPaths = this.mapPriorLossesPathToAggregate(fieldPath);
      for (const mappedPath of mappedPaths) {
        extraction = fieldExtractions.find(fe => fe.fieldPath === mappedPath);
        if (extraction && extraction.fieldValue !== null && extraction.fieldValue !== undefined && extraction.fieldValue !== '') {
          break;
        }
      }
    }
    
    if (extraction && extraction.fieldValue !== null && extraction.fieldValue !== undefined && extraction.fieldValue !== '') {
      return { isExtracted: true, extractedValue: extraction.fieldValue };
    }
    
    return { isExtracted: false, extractedValue: null };
  }

  /**
   * Render a key-value pair as a table row or div
   * Always shows the field - no filtering
   * Uses same formatting logic as submission details page
   */
  private renderKeyValue(
    key: string, 
    value: any, 
    asDiv: boolean = false,
    fieldPath?: string,
    emailMessageId?: string,
    fieldExtractions: any[] = [],
    frontendUrl: string = 'http://localhost:3000'
  ): string {
    // Check if this field was extracted (has an extraction record with a non-null value)
    const { isExtracted, extractedValue } = this.isFieldExtracted(fieldPath, fieldExtractions);
    
    // Use extracted value if available, otherwise use the value from data object
    const actualValue = isExtracted && extractedValue !== null ? extractedValue : value;
    
    // Format value the same way as submission details page
    const displayValue = this.formatValueForEmail(actualValue);
    
    // Apply additional formatting for email (money, percentages, etc.)
    const formattedValue = this.formatValue(displayValue);
    
    // Create hyperlink if field was extracted
    let valueHtml = formattedValue;
    if (isExtracted && fieldPath && emailMessageId) {
      const url = `${frontendUrl}/submission/${emailMessageId}?field=${encodeURIComponent(fieldPath)}&fromEmail=true`;
      valueHtml = `<a href="${url}" style="color: #3b82f6; text-decoration: underline; font-weight: 600;">${formattedValue}</a>`;
    }
    
    if (asDiv) {
      return `<div style="padding: 4px 0; font-size: 13px; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; text-overflow: clip; overflow: visible;"><strong style="color: #374151;">${this.escapeHtml(key)}:</strong> <span style="word-wrap: break-word; overflow-wrap: break-word; white-space: normal;">${valueHtml}</span></div>`;
    } else {
      return `<tr><td style="word-wrap: break-word; overflow-wrap: break-word; white-space: normal; text-overflow: clip; overflow: visible;">${this.escapeHtml(key)}</td><td style="word-wrap: break-word; overflow-wrap: break-word; white-space: normal; text-overflow: clip; overflow: visible;">${valueHtml}</td></tr>`;
    }
  }

  /**
   * Convert plain text table to formatted HTML
   */
  private convertTableToHtml(tableText: string): string {
    if (!tableText) return '';
    
    const lines = tableText.split('\n');
    let html = '';
    let currentSection = '';
    let inLocation = false;
    let inBuilding = false;
    let locationCount = 0;
    let buildingCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Check for section headers (all caps with underlines)
      if (line.match(/^[A-Z\s&]+$/) && line.length > 5 && !line.includes(':')) {
        // Close previous section if needed
        if (currentSection) {
          html += '</div>';
        }
        
        currentSection = line;
        html += `<div class="section">`;
        html += `<div class="section-header">${this.escapeHtml(line)}</div>`;
        html += `<table class="details-table">`;
        continue;
      }
      
      // Check for location header
      if (line.match(/^Location \d+:/i)) {
        if (inBuilding) {
          html += '</div>'; // Close building
          inBuilding = false;
        }
        if (inLocation) {
          html += '</div>'; // Close previous location
        }
        inLocation = true;
        locationCount++;
        html += `</table></div><div class="location-group">`;
        html += `<div class="location-title">${this.escapeHtml(line)}</div>`;
        continue;
      }
      
      // Check for building header
      if (line.match(/^\s+Building \d+:/i)) {
        if (inBuilding) {
          html += '</div>'; // Close previous building
        }
        inBuilding = true;
        buildingCount++;
        html += `<div class="building-group">`;
        html += `<div class="building-title">${this.escapeHtml(line.trim())}</div>`;
        continue;
      }
      
      // Parse key-value pairs
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        
        // Format value with appropriate styling
        let formattedValue = this.formatValue(value);
        
        if (inBuilding) {
          // Building details - keep in building group
          html += `<div style="padding: 4px 0; font-size: 13px;">`;
          html += `<strong style="color: #374151;">${this.escapeHtml(key.trim())}:</strong> `;
          html += `<span>${formattedValue}</span>`;
          html += `</div>`;
        } else if (inLocation) {
          // Location details
          html += `<div style="padding: 4px 0; font-size: 13px;">`;
          html += `<strong style="color: #374151;">${this.escapeHtml(key.trim())}:</strong> `;
          html += `<span>${formattedValue}</span>`;
          html += `</div>`;
        } else {
          // Regular table row
          html += `<tr>`;
          html += `<td>${this.escapeHtml(key.trim())}</td>`;
          html += `<td>${formattedValue}</td>`;
          html += `</tr>`;
        }
      }
    }
    
    // Close any open tags
    if (inBuilding) html += '</div>';
    if (inLocation) html += '</div>';
    if (currentSection) {
      html += '</table></div>';
    }
    
    return html;
  }

  /**
   * Format value with appropriate styling
   */
  private formatValue(value: string): string {
    if (!value || value === 'N/A' || value === 'n/a') {
      return `<span class="value-na">N/A</span>`;
    }
    
    // Check for money values
    if (value.startsWith('$')) {
      return `<span class="value-money">${this.escapeHtml(value)}</span>`;
    }
    
    // Check for percentages
    if (value.endsWith('%')) {
      return `<span class="value-highlight">${this.escapeHtml(value)}</span>`;
    }
    
    // Check for Yes/No
    if (value.toLowerCase() === 'yes' || value.toLowerCase() === 'no') {
      const color = value.toLowerCase() === 'yes' ? '#059669' : '#dc2626';
      return `<span style="color: ${color}; font-weight: 600;">${this.escapeHtml(value)}</span>`;
    }
    
    return this.escapeHtml(value);
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
