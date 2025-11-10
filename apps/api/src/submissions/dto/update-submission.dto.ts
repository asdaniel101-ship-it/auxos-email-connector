import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateSubmissionDto } from './create-submission.dto';
import { Type } from 'class-transformer';
import { Decimal } from '@prisma/client/runtime/library';

export class UpdateSubmissionDto extends PartialType(CreateSubmissionDto) {
  // ===== MANDATORY FIELDS =====
  @ApiPropertyOptional({ description: 'Years in operation - How long the business has been active', example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  yearsInOperation?: number;

  @ApiPropertyOptional({ description: 'Number of employees - Total full-time and part-time staff', example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  employeeCount?: number;

  @ApiPropertyOptional({ description: 'Additional physical locations (JSON array)', example: '[{"address":"456 Oak Ave","city":"Dallas","state":"TX","zip":"75201"}]' })
  @IsOptional()
  @IsString()
  additionalLocations?: string;

  // ===== OPTIONAL FIELDS (Coverage Discovery) =====
  @ApiPropertyOptional({ description: 'Industry code (NAICS)', example: '236' })
  @IsOptional()
  @IsString()
  industryCode?: string;

  @ApiPropertyOptional({ description: 'Industry label', example: 'Construction of Buildings' })
  @IsOptional()
  @IsString()
  industryLabel?: string;

  @ApiPropertyOptional({ description: 'Annual revenue - Reported gross annual income', example: 1500000.00 })
  @IsOptional()
  @Type(() => Number)
  revenue?: number | Decimal;

  @ApiPropertyOptional({ description: 'Risk tolerance level: low/medium/high', example: 'medium' })
  @IsOptional()
  @IsString()
  riskToleranceLevel?: string;

  @ApiPropertyOptional({ description: 'Current insurance coverages and carriers', example: 'General Liability with State Farm' })
  @IsOptional()
  @IsString()
  currentCoverages?: string;

  @ApiPropertyOptional({ 
    description: 'Comma-separated insurance needs', 
    example: 'general_liability,workers_comp' 
  })
  @IsOptional()
  @IsString()
  insuranceNeeds?: string;

  @ApiPropertyOptional({ description: 'Does the business sell alcohol? yes / no / unknown', example: 'yes' })
  @IsOptional()
  @IsString()
  alcoholServiceStatus?: 'yes' | 'no' | 'unknown';

  @ApiPropertyOptional({ description: 'Approximate percent of revenue from alcohol sales', example: 25 })
  @IsOptional()
  @Type(() => Number)
  alcoholSalesPercentage?: number | Decimal;

  @ApiPropertyOptional({ description: 'Whether alcohol sales info is known or unknown', example: 'unknown' })
  @IsOptional()
  @IsString()
  alcoholSalesInfoStatus?: 'unknown' | 'known';

  @ApiPropertyOptional({ description: 'Key assets: equipment, vehicles, property, IP', example: 'Fleet of 10 trucks, warehouse building' })
  @IsOptional()
  @IsString()
  keyAssets?: string;

  @ApiPropertyOptional({ description: 'Digital infrastructure and cybersecurity overview', example: 'Cloud-based CRM, basic firewall' })
  @IsOptional()
  @IsString()
  digitalInfrastructureProfile?: string;

  @ApiPropertyOptional({ description: 'Growth plans or expansion intentions', example: 'Planning to open 2 new locations next year' })
  @IsOptional()
  @IsString()
  growthPlans?: string;

  // ===== NICE TO HAVE FIELDS =====
  @ApiPropertyOptional({ description: 'Total number of insurance claims in past 3-5 years', example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  totalClaimsCount?: number;

  @ApiPropertyOptional({ description: 'Total dollar amount of claims in past 3-5 years', example: 25000.00 })
  @IsOptional()
  @Type(() => Number)
  totalClaimsLoss?: number | Decimal;

  // ===== SUBMISSION AGENT FIELDS =====
  @ApiPropertyOptional({ description: 'Tax Identification Number (EIN)', example: '12-3456789' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ description: 'Business registration certificate reference', example: 'doc_cert_123' })
  @IsOptional()
  @IsString()
  businessRegistrationCert?: string;

  @ApiPropertyOptional({ description: 'Financial statements reference', example: 'doc_financials_456' })
  @IsOptional()
  @IsString()
  financialStatements?: string;

  @ApiPropertyOptional({ description: 'Proof of address reference', example: 'doc_address_789' })
  @IsOptional()
  @IsString()
  proofOfAddress?: string;

  @ApiPropertyOptional({ description: 'Ownership structure breakdown', example: 'John Doe 60%, Jane Smith 40%' })
  @IsOptional()
  @IsString()
  ownershipStructure?: string;

  @ApiPropertyOptional({ description: 'Prior insurance documents reference', example: 'doc_prior_001' })
  @IsOptional()
  @IsString()
  priorInsuranceDocs?: string;

  @ApiPropertyOptional({ description: 'De-identified employee list or summary', example: '20 office staff, 30 field workers' })
  @IsOptional()
  @IsString()
  employeeList?: string;

  @ApiPropertyOptional({ description: 'Safety manuals reference', example: 'doc_safety_002' })
  @IsOptional()
  @IsString()
  safetyManuals?: string;

  // ===== STATUS & METADATA =====
  @ApiPropertyOptional({ description: 'Submission status', example: 'in_review' })
  @IsOptional()
  @IsString()
  status?: string;
}
