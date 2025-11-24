import { Controller, Post, Get, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(':sessionId')
  @ApiOperation({ summary: 'Send a chat message' })
  @ApiResponse({ status: 200, description: 'Message processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async sendMessage(@Param('sessionId') sessionId: string, @Body() dto: ChatMessageDto) {
    try {
      if (!dto.message || !dto.message.trim()) {
        throw new HttpException('Message cannot be empty', HttpStatus.BAD_REQUEST);
      }
      return await this.chatService.processMessage(sessionId, dto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('Error in chat controller:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to process message',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':sessionId/skip')
  @ApiOperation({ summary: 'Skip the current question' })
  @ApiResponse({ status: 200, description: 'Question skipped successfully' })
  async skipQuestion(@Param('sessionId') sessionId: string) {
    try {
      return await this.chatService.skipCurrentQuestion(sessionId);
    } catch (error) {
      console.error('Error skipping question:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to skip question',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get conversation history' })
  async getHistory(@Param('sessionId') sessionId: string) {
    // This would be handled by sessions endpoint, but keeping for API completeness
    return { message: 'Use GET /sessions/:id to get conversation history' };
  }
}

