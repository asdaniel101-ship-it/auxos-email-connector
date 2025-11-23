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

  async sendIntakeEmail(sessionId: string, intakeData: any) {
    const subject = `INTAKE [${sessionId}]`;
    
    const body = this.formatIntakeEmailBody(intakeData);

    return this.sendEmail({
      from: 'auxoreachout@gmail.com',
      to: 'auxoreachout@gmail.com',
      subject,
      text: body,
      html: this.formatIntakeEmailBodyHTML(intakeData),
    });
  }

  async sendSubmissionEmail(leadId: string, leadData: any) {
    const subject = `SUBMISSION [${leadId}]`;
    
    const body = this.formatSubmissionEmailBody(leadData);

    return this.sendEmail({
      from: 'auxoreachout@gmail.com',
      to: 'auxoreachout@gmail.com',
      subject,
      text: body,
      html: this.formatSubmissionEmailBodyHTML(leadData),
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

  private formatIntakeEmailBody(data: any): string {
    return `
NEW INTAKE SUBMISSION

Session ID: ${data.sessionId}
Vertical: ${data.vertical}
Business Type: ${data.businessType || 'N/A'}

Business Information:
- Business Name: ${data.businessName || 'N/A'}
- Owner Name: ${data.ownerName || 'N/A'}
- Email: ${data.email || 'N/A'}
- Phone: ${data.phone || 'N/A'}

Address:
- Street: ${data.address || 'N/A'}
- City: ${data.city || 'N/A'}
- State: ${data.state || 'N/A'}
- ZIP: ${data.zip || 'N/A'}

Additional Information:
- How did you hear: ${data.howDidYouHear || 'N/A'}
${data.vertical === 'insurance' ? `- Desired Coverages: ${data.desiredCoverages?.join(', ') || 'N/A'}` : ''}
${data.vertical === 'insurance' ? `- Actively Looking for Insurance: ${data.activelyLookingForInsurance ? 'Yes' : 'No'}` : ''}

Submitted at: ${new Date().toISOString()}
    `.trim();
  }

  private formatIntakeEmailBodyHTML(data: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { padding: 20px; background-color: #f9fafb; }
    .section { margin-bottom: 20px; }
    .section-title { font-weight: bold; color: #4F46E5; margin-bottom: 10px; }
    .field { margin: 5px 0; }
    .field-label { font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h2>NEW INTAKE SUBMISSION</h2>
  </div>
  <div class="content">
    <div class="section">
      <div class="section-title">Session Information</div>
      <div class="field"><span class="field-label">Session ID:</span> ${data.sessionId}</div>
      <div class="field"><span class="field-label">Vertical:</span> ${data.vertical}</div>
      <div class="field"><span class="field-label">Business Type:</span> ${data.businessType || 'N/A'}</div>
    </div>
    
    <div class="section">
      <div class="section-title">Business Information</div>
      <div class="field"><span class="field-label">Business Name:</span> ${data.businessName || 'N/A'}</div>
      <div class="field"><span class="field-label">Owner Name:</span> ${data.ownerName || 'N/A'}</div>
      <div class="field"><span class="field-label">Email:</span> ${data.email || 'N/A'}</div>
      <div class="field"><span class="field-label">Phone:</span> ${data.phone || 'N/A'}</div>
    </div>
    
    <div class="section">
      <div class="section-title">Address</div>
      <div class="field"><span class="field-label">Street:</span> ${data.address || 'N/A'}</div>
      <div class="field"><span class="field-label">City:</span> ${data.city || 'N/A'}</div>
      <div class="field"><span class="field-label">State:</span> ${data.state || 'N/A'}</div>
      <div class="field"><span class="field-label">ZIP:</span> ${data.zip || 'N/A'}</div>
    </div>
    
    <div class="section">
      <div class="section-title">Additional Information</div>
      <div class="field"><span class="field-label">How did you hear:</span> ${data.howDidYouHear || 'N/A'}</div>
      ${data.vertical === 'insurance' ? `<div class="field"><span class="field-label">Desired Coverages:</span> ${data.desiredCoverages?.join(', ') || 'N/A'}</div>` : ''}
      ${data.vertical === 'insurance' ? `<div class="field"><span class="field-label">Actively Looking for Insurance:</span> ${data.activelyLookingForInsurance ? 'Yes' : 'No'}</div>` : ''}
    </div>
    
    <div class="section">
      <div class="field"><span class="field-label">Submitted at:</span> ${new Date().toLocaleString()}</div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private formatSubmissionEmailBody(leadData: any): string {
    const lead = leadData.lead || leadData;
    const session = leadData.session || leadData.session;
    
    const formatCurrency = (value: number | null | undefined) => {
      if (!value) return 'N/A';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    const formatNumber = (value: number | null | undefined) => {
      if (!value) return 'N/A';
      return new Intl.NumberFormat('en-US').format(value);
    };

    return `
NEW SUBMISSION TO CARRIER

Lead ID: ${lead.id}
Session ID: ${session?.id || 'N/A'}
Vertical: ${session?.vertical || 'N/A'}
Status: ${lead.status || 'N/A'}
Completion: ${lead.completionPercentage || 0}%

Business Information:
- Business Name: ${lead.legalBusinessName || 'N/A'}
- Owner Name: ${lead.ownerName || 'N/A'}
- Owner Email: ${lead.ownerEmail || 'N/A'}
- Owner Phone: ${lead.ownerPhone || 'N/A'}

Address:
- Street: ${lead.primaryAddress || 'N/A'}
- City: ${lead.primaryCity || 'N/A'}
- State: ${lead.primaryState || 'N/A'}
- ZIP: ${lead.primaryZip || 'N/A'}

Business Details:
- Business Type: ${session?.businessType || 'N/A'}
- Employees: ${formatNumber(lead.employeeCountTotal)}
- Annual Revenue: ${formatCurrency(lead.annualRevenue)}
- Years in Operation: ${formatNumber(lead.yearsInOperation)}
- Business Description: ${lead.businessDescription || 'N/A'}

${session?.vertical === 'insurance' ? `
Insurance Details:
- Desired Coverages: ${lead.desiredCoverages?.join(', ') || 'N/A'}
- Current Carrier: ${lead.currentCarrier || 'N/A'}
- Current Policy Types: ${lead.currentPolicyTypes?.join(', ') || 'N/A'}
- Current Premium: ${formatCurrency(lead.currentPremiumTotal)}
- Actively Looking: ${lead.activelyLookingForInsurance ? 'Yes' : 'No'}
` : ''}

${session?.vertical === 'lending' ? `
Lending Details:
- Amount Requested: ${formatCurrency(lead.amountRequested)}
- Funding Purpose: ${lead.fundingPurpose || 'N/A'}
` : ''}

${lead.extractedFields && lead.extractedFields.length > 0 ? `
Extracted Fields from Documents:
${lead.extractedFields.map((field: any) => 
  `- ${field.fieldName}: ${field.fieldValue} (${field.confidence ? Math.round(field.confidence * 100) : 'N/A'}% confidence, from ${field.document?.fileName || 'unknown'})`
).join('\n')}
` : ''}

Submitted at: ${new Date().toISOString()}
    `.trim();
  }

  private formatSubmissionEmailBodyHTML(leadData: any): string {
    const lead = leadData.lead || leadData;
    const session = leadData.session || leadData.session;
    
    const formatCurrency = (value: number | null | undefined) => {
      if (!value) return 'N/A';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    const formatNumber = (value: number | null | undefined) => {
      if (!value) return 'N/A';
      return new Intl.NumberFormat('en-US').format(value);
    };

    const extractedFieldsHTML = lead.extractedFields && lead.extractedFields.length > 0
      ? `
        <div class="section">
          <div class="section-title">Extracted Fields from Documents</div>
          ${lead.extractedFields.map((field: any) => `
            <div class="field">
              <span class="field-label">${field.fieldName}:</span> ${field.fieldValue}
              <span style="color: #666; font-size: 0.9em;">
                (${field.confidence ? Math.round(field.confidence * 100) : 'N/A'}% confidence, from ${field.document?.fileName || 'unknown'})
              </span>
            </div>
          `).join('')}
        </div>
      `
      : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #10B981; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { padding: 20px; background-color: #f9fafb; }
    .section { margin-bottom: 20px; padding: 15px; background-color: white; border-radius: 5px; border-left: 4px solid #10B981; }
    .section-title { font-weight: bold; color: #10B981; margin-bottom: 10px; font-size: 1.1em; }
    .field { margin: 5px 0; }
    .field-label { font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h2>NEW SUBMISSION TO CARRIER</h2>
  </div>
  <div class="content">
    <div class="section">
      <div class="section-title">Lead Information</div>
      <div class="field"><span class="field-label">Lead ID:</span> ${lead.id}</div>
      <div class="field"><span class="field-label">Session ID:</span> ${session?.id || 'N/A'}</div>
      <div class="field"><span class="field-label">Vertical:</span> ${session?.vertical || 'N/A'}</div>
      <div class="field"><span class="field-label">Status:</span> ${lead.status || 'N/A'}</div>
      <div class="field"><span class="field-label">Completion:</span> ${lead.completionPercentage || 0}%</div>
    </div>
    
    <div class="section">
      <div class="section-title">Business Information</div>
      <div class="field"><span class="field-label">Business Name:</span> ${lead.legalBusinessName || 'N/A'}</div>
      <div class="field"><span class="field-label">Owner Name:</span> ${lead.ownerName || 'N/A'}</div>
      <div class="field"><span class="field-label">Owner Email:</span> ${lead.ownerEmail || 'N/A'}</div>
      <div class="field"><span class="field-label">Owner Phone:</span> ${lead.ownerPhone || 'N/A'}</div>
    </div>
    
    <div class="section">
      <div class="section-title">Address</div>
      <div class="field"><span class="field-label">Street:</span> ${lead.primaryAddress || 'N/A'}</div>
      <div class="field"><span class="field-label">City:</span> ${lead.primaryCity || 'N/A'}</div>
      <div class="field"><span class="field-label">State:</span> ${lead.primaryState || 'N/A'}</div>
      <div class="field"><span class="field-label">ZIP:</span> ${lead.primaryZip || 'N/A'}</div>
    </div>
    
    <div class="section">
      <div class="section-title">Business Details</div>
      <div class="field"><span class="field-label">Business Type:</span> ${session?.businessType || 'N/A'}</div>
      <div class="field"><span class="field-label">Employees:</span> ${formatNumber(lead.employeeCountTotal)}</div>
      <div class="field"><span class="field-label">Annual Revenue:</span> ${formatCurrency(lead.annualRevenue)}</div>
      <div class="field"><span class="field-label">Years in Operation:</span> ${formatNumber(lead.yearsInOperation)}</div>
      <div class="field"><span class="field-label">Business Description:</span> ${lead.businessDescription || 'N/A'}</div>
    </div>
    
    ${session?.vertical === 'insurance' ? `
    <div class="section">
      <div class="section-title">Insurance Details</div>
      <div class="field"><span class="field-label">Desired Coverages:</span> ${lead.desiredCoverages?.join(', ') || 'N/A'}</div>
      <div class="field"><span class="field-label">Current Carrier:</span> ${lead.currentCarrier || 'N/A'}</div>
      <div class="field"><span class="field-label">Current Policy Types:</span> ${lead.currentPolicyTypes?.join(', ') || 'N/A'}</div>
      <div class="field"><span class="field-label">Current Premium:</span> ${formatCurrency(lead.currentPremiumTotal)}</div>
      <div class="field"><span class="field-label">Actively Looking:</span> ${lead.activelyLookingForInsurance ? 'Yes' : 'No'}</div>
    </div>
    ` : ''}
    
    ${session?.vertical === 'lending' ? `
    <div class="section">
      <div class="section-title">Lending Details</div>
      <div class="field"><span class="field-label">Amount Requested:</span> ${formatCurrency(lead.amountRequested)}</div>
      <div class="field"><span class="field-label">Funding Purpose:</span> ${lead.fundingPurpose || 'N/A'}</div>
    </div>
    ` : ''}
    
    ${extractedFieldsHTML}
    
    <div class="section">
      <div class="field"><span class="field-label">Submitted at:</span> ${new Date().toLocaleString()}</div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}

