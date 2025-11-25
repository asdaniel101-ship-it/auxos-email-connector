import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SubmissionQAService {
  private readonly logger = new Logger(SubmissionQAService.name);

  /**
   * Run QA checks on extracted data
   */
  async runChecks(extractedData: any): Promise<{
    warnings: string[];
    confidenceFlags: string[];
  }> {
    const warnings: string[] = [];
    const confidenceFlags: string[] = [];

    // Date sanity checks
    if (extractedData.effectiveDate && extractedData.expirationDate) {
      const effective = new Date(extractedData.effectiveDate);
      const expiration = new Date(extractedData.expirationDate);

      if (expiration <= effective) {
        warnings.push('expiration_before_effective: Expiration date is before or equal to effective date');
      }

      if (effective < new Date()) {
        warnings.push('effective_date_in_past: Effective date is in the past');
      }

      // Check if dates are too far in the future (more than 1 year)
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      if (effective > oneYearFromNow) {
        warnings.push('effective_date_too_far_future: Effective date is more than 1 year in the future');
      }
    }

    // Submission metadata checks
    if (extractedData.submission) {
      if (!extractedData.submission.namedInsured) {
        confidenceFlags.push('missing_named_insured: Named insured not found');
      }
      if (!extractedData.submission.effectiveDate) {
        confidenceFlags.push('missing_effective_date: Effective date not found');
      }
    }

    // Building limit and property checks
    if (extractedData.locations && Array.isArray(extractedData.locations)) {
      for (const location of extractedData.locations) {
        if (location.buildings && Array.isArray(location.buildings)) {
          for (const building of location.buildings) {
            // Building limit checks
            if (building.buildingLimit !== null && building.buildingLimit !== undefined) {
              if (building.buildingLimit < 10000) {
                warnings.push(`building_limit_too_low_location_${location.locationNumber || 'unknown'}: Building limit $${building.buildingLimit.toLocaleString()} seems unusually low`);
              }
              if (building.buildingLimit > 100000000) {
                warnings.push(`building_limit_very_high_location_${location.locationNumber || 'unknown'}: Building limit $${building.buildingLimit.toLocaleString()} is very high - please verify`);
              }
            }

            // Square footage checks
            if (building.buildingSqFt !== null && building.buildingSqFt !== undefined) {
              if (building.buildingSqFt > 10000000) {
                warnings.push(`sqft_suspicious_location_${location.locationNumber || 'unknown'}: Square footage ${building.buildingSqFt.toLocaleString()} seems unusually large`);
              }
              if (building.buildingSqFt < 100) {
                warnings.push(`sqft_too_small_location_${location.locationNumber || 'unknown'}: Square footage ${building.buildingSqFt} seems unusually small`);
              }
            }

            // Year built checks
            if (building.yearBuilt !== null && building.yearBuilt !== undefined) {
              if (building.yearBuilt < 1800) {
                warnings.push(`year_built_suspicious_location_${location.locationNumber || 'unknown'}: Year built ${building.yearBuilt} is before 1800`);
              }
              if (building.yearBuilt > new Date().getFullYear()) {
                warnings.push(`year_built_future_location_${location.locationNumber || 'unknown'}: Year built ${building.yearBuilt} is in the future`);
              }
            }

            // Year renovated checks
            if (building.yearRenovated !== null && building.yearRenovated !== undefined) {
              if (building.yearRenovated < building.yearBuilt) {
                warnings.push(`renovation_before_built_location_${location.locationNumber || 'unknown'}: Renovation year ${building.yearRenovated} is before year built ${building.yearBuilt}`);
              }
            }

            // Coverage consistency checks
            if (building.buildingLimit && building.buildingSqFt) {
              const limitPerSqFt = building.buildingLimit / building.buildingSqFt;
              if (limitPerSqFt > 1000) {
                warnings.push(`high_limit_per_sqft_location_${location.locationNumber || 'unknown'}: $${limitPerSqFt.toFixed(2)} per sq ft seems high`);
              }
              if (limitPerSqFt < 10) {
                warnings.push(`low_limit_per_sqft_location_${location.locationNumber || 'unknown'}: $${limitPerSqFt.toFixed(2)} per sq ft seems low`);
              }
            }
          }
        }
      }
    }

    // Coverage checks
    if (extractedData.coverage) {
      if (extractedData.coverage.buildingLimit && extractedData.coverage.buildingLimit < 10000) {
        warnings.push('coverage_building_limit_too_low: Overall building limit seems unusually low');
      }

      if (extractedData.coverage.deductibleAllPeril && extractedData.coverage.deductibleAllPeril < 0) {
        warnings.push('deductible_negative: Deductible cannot be negative');
      }

      if (extractedData.coverage.coinsurancePercent) {
        if (extractedData.coverage.coinsurancePercent < 50 || extractedData.coverage.coinsurancePercent > 100) {
          warnings.push(`coinsurance_percent_unusual: Coinsurance ${extractedData.coverage.coinsurancePercent}% is outside typical range (50-100%)`);
        }
      }
    }

    // Loss history consistency
    if (extractedData.lossHistory) {
      const { lossHistoryPeriodYears, numberOfClaims, totalIncurredLoss, lossRunTextsPresent } = extractedData.lossHistory;
      
      if (lossHistoryPeriodYears && numberOfClaims === 0 && lossRunTextsPresent) {
        warnings.push('no_losses_but_loss_run_present: Loss run document present but no claims reported');
      }

      if (numberOfClaims && numberOfClaims > 0 && (!totalIncurredLoss || totalIncurredLoss === 0)) {
        warnings.push('claims_without_loss_amount: Claims reported but no total incurred loss amount');
      }

      if (totalIncurredLoss && totalIncurredLoss < 0) {
        warnings.push('negative_loss_amount: Total incurred loss cannot be negative');
      }

      if (lossHistoryPeriodYears && (lossHistoryPeriodYears < 1 || lossHistoryPeriodYears > 10)) {
        warnings.push(`unusual_loss_history_period: Loss history period of ${lossHistoryPeriodYears} years is unusual`);
      }
    }

    // Cross-document consistency checks
    if (extractedData.locations && extractedData.coverage) {
      // Check if building limits in locations match coverage limits
      const totalLocationLimits = extractedData.locations.reduce((sum: number, loc: any) => {
        return sum + (loc.buildings?.reduce((bSum: number, b: any) => bSum + (b.buildingLimit || 0), 0) || 0);
      }, 0);

      if (totalLocationLimits > 0 && extractedData.coverage.buildingLimit) {
        const difference = Math.abs(totalLocationLimits - extractedData.coverage.buildingLimit);
        const percentDiff = (difference / totalLocationLimits) * 100;
        
        if (percentDiff > 20) {
          warnings.push(`building_limit_mismatch: Location building limits ($${totalLocationLimits.toLocaleString()}) differ significantly from coverage limit ($${extractedData.coverage.buildingLimit.toLocaleString()})`);
        }
      }
    }

    this.logger.log(`QA checks completed: ${warnings.length} warnings, ${confidenceFlags.length} flags`);

    return { warnings, confidenceFlags };
  }
}

