import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChatMessageDto {
  @ApiProperty({ 
    description: 'The message content from the user', 
    example: 'We have 50 employees and need general liability insurance' 
  })
  @IsNotEmpty()
  @IsString()
  message!: string;
}

export class ChatMessageResponseDto {
  @ApiProperty({ description: 'Message ID' })
  id!: string;

  @ApiProperty({ description: 'Message role: user, assistant, or system' })
  role!: string;

  @ApiProperty({ description: 'Message content' })
  content!: string;

  @ApiProperty({ description: 'Timestamp' })
  createdAt!: Date;
}

export class ChatResponseDto {
  @ApiProperty({ description: 'Assistant reply message' })
  reply!: string;

  @ApiProperty({ description: 'Updated submission data' })
  submission!: any;

  @ApiProperty({ description: 'All messages in the conversation', type: [ChatMessageResponseDto] })
  messages!: ChatMessageResponseDto[];
}

