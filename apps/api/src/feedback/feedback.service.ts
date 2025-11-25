import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    this.initializeSmtp();
  }

  private async initializeSmtp() {
    try {
      const email = this.configService.get<string>('GMAIL_EMAIL') || 'auxoreachout@gmail.com';
      const password = this.configService.get<string>('GMAIL_APP_PASSWORD');

      if (!password) {
        this.logger.warn('GMAIL_APP_PASSWORD not set, feedback emails will not be sent');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: email,
          pass: password,
        },
      });

      // Verify connection
      await this.transporter.verify();
      this.logger.log('SMTP connection verified for feedback emails');
    } catch (error) {
      this.logger.error('Failed to initialize SMTP for feedback:', error);
    }
  }

  async sendFeedback(dto: CreateFeedbackDto) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    try {
      const email = this.configService.get<string>('GMAIL_EMAIL') || 'auxoreachout@gmail.com';

      const mailOptions = {
        from: email,
        to: email,
        subject: `Feedback from ${dto.name} (${dto.email})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e293b;">New Feedback/Interest Form Submission</h2>
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${this.escapeHtml(dto.name)}</p>
              <p><strong>Email:</strong> ${this.escapeHtml(dto.email)}</p>
              <p><strong>Message:</strong></p>
              <p style="white-space: pre-wrap; background-color: white; padding: 15px; border-radius: 4px; margin-top: 10px;">
                ${this.escapeHtml(dto.message)}
              </p>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
              This feedback was submitted through the Auxo website.
            </p>
          </div>
        `,
        text: `
New Feedback/Interest Form Submission

Name: ${dto.name}
Email: ${dto.email}

Message:
${dto.message}
        `.trim(),
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Feedback email sent from ${dto.email}`);

      return { success: true, message: 'Feedback sent successfully' };
    } catch (error) {
      this.logger.error('Failed to send feedback email:', error);
      throw new Error('Failed to send feedback email');
    }
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

