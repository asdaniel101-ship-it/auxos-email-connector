import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // Get email credentials - check both EMAIL_USER/EMAIL_PASSWORD and GMAIL_EMAIL/GMAIL_APP_PASSWORD
    const email = this.configService.get<string>('GMAIL_EMAIL') || 
                  process.env.EMAIL_USER || 
                  'auxosreachout@gmail.com';
    const password = (this.configService.get<string>('GMAIL_APP_PASSWORD') || 
                     process.env.EMAIL_PASSWORD || 
                     '').replace(/\s/g, ''); // Remove spaces from app password
    
    // Create transporter using Gmail SMTP
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: email,
        pass: password,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
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

