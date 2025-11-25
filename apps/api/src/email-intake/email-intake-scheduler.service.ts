import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailIntakeService } from './email-intake.service';

@Injectable()
export class EmailIntakeSchedulerService {
  private readonly logger = new Logger(EmailIntakeSchedulerService.name);

  constructor(private emailIntakeService: EmailIntakeService) {}

  /**
   * Poll for new emails every 60 seconds
   * This runs automatically in the background
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleEmailPolling() {
    this.logger.log('Running scheduled email polling...');
    
    try {
      const result = await this.emailIntakeService.pollForNewEmails();
      this.logger.log(`Scheduled polling completed: ${result.processed} messages processed`);
    } catch (error) {
      this.logger.error('Error in scheduled email polling:', error);
      // Don't throw - allow polling to continue on next cycle
    }
  }
}

