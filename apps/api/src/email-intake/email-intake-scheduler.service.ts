import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailIntakeService } from './email-intake.service';

@Injectable()
export class EmailIntakeSchedulerService {
  private readonly logger = new Logger(EmailIntakeSchedulerService.name);

  constructor(private emailIntakeService: EmailIntakeService) {}

  /**
   * Poll for new emails every 30 seconds
   * This runs automatically in the background
   */
  @Cron('*/30 * * * * *') // Every 30 seconds
  async handleEmailPolling() {
    try {
      const result = await this.emailIntakeService.pollForNewEmails();
      // Only log the essential info: how many new emails found
      if (result.newEmailsFound > 0) {
        this.logger.log(`Found ${result.newEmailsFound} new email(s)`);
      }
    } catch (error) {
      this.logger.error('Error in scheduled email polling:', error);
      // Don't throw - allow polling to continue on next cycle
    }
  }
}
