import { IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubmissionDto {
  @ApiProperty({ description: 'Business or company name', example: 'Acme Construction LLC' })
  @IsString()
  @MinLength(2)
  businessName!: string;

  @ApiPropertyOptional({ description: 'Street address', example: '123 Main St' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Austin' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State (2-letter code)', example: 'TX' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'ZIP code', example: '78701' })
  @IsOptional()
  @IsString()
  zip?: string;

  @ApiPropertyOptional({ 
    description: 'Brief overview of the business', 
    example: 'We are a commercial construction company specializing in office buildings.' 
  })
  @IsOptional()
  @IsString()
  overview?: string;
}