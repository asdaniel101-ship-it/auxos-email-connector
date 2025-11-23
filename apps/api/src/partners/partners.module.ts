import { Module } from '@nestjs/common';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';
import { MatchingService } from './matching.service';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PartnersController],
  providers: [PartnersService, MatchingService],
  exports: [PartnersService, MatchingService],
})
export class PartnersModule {}

