import { IsString, IsEmail, IsOptional, IsArray, IsNumber, IsIn, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePartnerDto {
  @ApiProperty({ description: 'Partner name', example: 'ABC Insurance Brokerage' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Contact email', example: 'contact@abcinsurance.com' })
  @IsEmail()
  contactEmail!: string;

  @ApiProperty({ description: 'Verticals this partner serves', example: ['insurance'] })
  @IsArray()
  @IsString({ each: true })
  verticals!: string[];

  // Insurance appetite
  @ApiPropertyOptional({ description: 'States served', example: ['CA', 'NY', 'TX'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  statesServed?: string[];

  @ApiPropertyOptional({ description: 'Preferred industries', example: ['restaurant', 'retail'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredIndustries?: string[];

  @ApiPropertyOptional({ description: 'Minimum employee count' })
  @IsOptional()
  @IsNumber()
  minEmployeeCount?: number;

  @ApiPropertyOptional({ description: 'Maximum employee count' })
  @IsOptional()
  @IsNumber()
  maxEmployeeCount?: number;

  @ApiPropertyOptional({ description: 'Minimum revenue' })
  @IsOptional()
  @IsNumber()
  minRevenue?: number;

  @ApiPropertyOptional({ description: 'Maximum revenue' })
  @IsOptional()
  @IsNumber()
  maxRevenue?: number;

  @ApiPropertyOptional({ description: 'Coverage types interested in', example: ['GL', 'BOP', 'WC'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coverageTypesInterested?: string[];

  // Lending appetite
  @ApiPropertyOptional({ description: 'Minimum monthly revenue' })
  @IsOptional()
  @IsNumber()
  minMonthlyRevenue?: number;

  @ApiPropertyOptional({ description: 'Minimum time in business (months)' })
  @IsOptional()
  @IsNumber()
  minTimeInBusinessMonths?: number;

  @ApiPropertyOptional({ description: 'Maximum loan amount' })
  @IsOptional()
  @IsNumber()
  maxLoanAmount?: number;

  @ApiPropertyOptional({ description: 'Risk tolerance', enum: ['low', 'medium', 'high'] })
  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high'])
  riskTolerance?: string;
}

