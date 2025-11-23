import { IsString, IsEmail, IsOptional, IsIn, MinLength, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CreateSessionDto {
  @ApiProperty({ description: 'Vertical type', enum: ['insurance', 'lending'], example: 'insurance' })
  @IsString()
  @IsIn(['insurance', 'lending'])
  vertical!: string;

  @ApiPropertyOptional({ description: 'Business type', enum: ['restaurant', 'retail', 'services', 'other'] })
  @IsOptional()
  @IsString()
  @IsIn(['restaurant', 'retail', 'services', 'other'])
  businessType?: string;

  @ApiProperty({ description: 'Business name', example: 'Acme Restaurant LLC' })
  @IsString()
  @MinLength(2)
  businessName!: string;

  @ApiProperty({ description: 'Owner name', example: 'John Doe' })
  @IsString()
  @MinLength(2)
  ownerName!: string;

  @ApiProperty({ description: 'Owner email', example: 'john@acme.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'Owner phone', example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'How did you hear about us?' })
  @IsOptional()
  @IsString()
  howDidYouHear?: string;

  @ApiPropertyOptional({ description: 'Business street address', example: '123 Main Street' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Business city', example: 'San Francisco' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Business state (2-letter code)', example: 'CA' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Business ZIP code', example: '94102' })
  @IsOptional()
  @IsString()
  zip?: string;

  @ApiPropertyOptional({ 
    description: 'Desired insurance coverages (for insurance vertical)', 
    example: ['GL', 'WC', 'BOP'],
    type: [String],
    isArray: true
  })
  @Expose()
  @IsOptional()
  @IsArray({ message: 'desiredCoverages must be an array' })
  @IsString({ each: true, message: 'Each coverage must be a string' })
  desiredCoverages?: string[];

  @ApiPropertyOptional({ 
    description: 'Actively looking for insurance (for insurance vertical)', 
    example: true
  })
  @Expose()
  @IsOptional()
  @IsBoolean()
  activelyLookingForInsurance?: boolean;
}

