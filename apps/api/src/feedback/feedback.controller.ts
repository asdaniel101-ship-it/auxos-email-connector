import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { Public } from '../common/decorators/public.decorator';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Submit feedback or interest form' })
  @ApiResponse({ status: 200, description: 'Feedback sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async create(@Body() createFeedbackDto: CreateFeedbackDto) {
    try {
      return await this.feedbackService.sendFeedback(createFeedbackDto);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to send feedback',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

