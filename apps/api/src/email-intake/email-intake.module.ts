import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailIntakeService } from './email-intake.service';
import { EmailIntakeController } from './email-intake.controller';
import { EmailListenerService } from './email-listener.service';
import { SubmissionClassifierService } from './submission-classifier.service';
import { DocumentClassifierService } from './document-classifier.service';
import { FieldExtractionService } from './field-extraction.service';
import { SubmissionQAService } from './submission-qa.service';
import { ResponsePackagerService } from './response-packager.service';
import { EmailIntakeSchedulerService } from './email-intake-scheduler.service';
import { DocumentParserService } from './document-parser.service';
import { PrismaModule } from '../prisma.module';
import { EmailModule } from '../email/email.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, EmailModule, FilesModule],
  providers: [
    EmailIntakeService,
    EmailListenerService,
    SubmissionClassifierService,
    DocumentClassifierService,
    DocumentParserService,
    FieldExtractionService,
    SubmissionQAService,
    ResponsePackagerService,
    EmailIntakeSchedulerService,
  ],
  controllers: [EmailIntakeController],
  exports: [EmailIntakeService],
})
export class EmailIntakeModule {}

