import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Create transporter using Gmail SMTP
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'auxoreachout@gmail.com',
        pass: process.env.EMAIL_PASSWORD || '', // Should be set in .env as an app-specific password
      },
    });
  }


  private async sendEmail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    try {
      const info = await this.transporter.sendMail(options);
      console.log('Email sent successfully:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      // Don't throw - email failures shouldn't break the main flow
      return null;
    }
  }

}

