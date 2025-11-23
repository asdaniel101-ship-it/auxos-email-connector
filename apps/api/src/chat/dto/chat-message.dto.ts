import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({ description: 'User message content', example: 'I run a restaurant with 15 employees' })
  @IsString()
  @MinLength(1)
  message!: string;
}

