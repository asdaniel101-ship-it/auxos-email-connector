import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  async matchLeadToPartners(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        session: true,
      },
    });

    if (!lead) {
      throw new Error(`Lead with ID ${leadId} not found`);
    }

    const vertical = lead.session.vertical;
    const partners = await this.prisma.partner.findMany({
      where: {
        verticals: {
          has: vertical,
        },
      },
    });

    const matches: string[] = [];

    for (const partner of partners) {
      if (this.isMatch(lead, partner, vertical)) {
        matches.push(partner.id);
        
        // Create assignment if it doesn't exist
        await this.prisma.leadAssignment.upsert({
          where: {
            leadId_partnerId: {
              leadId: lead.id,
              partnerId: partner.id,
            },
          },
          create: {
            leadId: lead.id,
            partnerId: partner.id,
            status: 'PENDING',
          },
          update: {},
        });
      }
    }

    // Update lead status if matches found
    if (matches.length > 0) {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { status: 'ASSIGNED' },
      });
    }

    return { matchedPartners: matches.length, partnerIds: matches };
  }

  private isMatch(lead: any, partner: any, vertical: string): boolean {
    if (vertical === 'insurance') {
      return this.matchesInsuranceCriteria(lead, partner);
    } else if (vertical === 'lending') {
      return this.matchesLendingCriteria(lead, partner);
    }
    return false;
  }

  private matchesInsuranceCriteria(lead: any, partner: any): boolean {
    // State match
    if (partner.statesServed && partner.statesServed.length > 0) {
      if (!lead.primaryState || !partner.statesServed.includes(lead.primaryState)) {
        return false;
      }
    }

    // Industry match
    if (partner.preferredIndustries && partner.preferredIndustries.length > 0) {
      // Simple matching - could be enhanced with NAICS code mapping
      const leadIndustry = lead.naicsCode || lead.businessDescription?.toLowerCase() || '';
      const matchesIndustry = partner.preferredIndustries.some((industry: string) =>
        leadIndustry.includes(industry.toLowerCase())
      );
      if (!matchesIndustry) {
        return false;
      }
    }

    // Employee count range
    if (lead.employeeCountTotal !== null && lead.employeeCountTotal !== undefined) {
      if (partner.minEmployeeCount && lead.employeeCountTotal < partner.minEmployeeCount) {
        return false;
      }
      if (partner.maxEmployeeCount && lead.employeeCountTotal > partner.maxEmployeeCount) {
        return false;
      }
    }

    // Revenue range
    if (lead.annualRevenue !== null && lead.annualRevenue !== undefined) {
      if (partner.minRevenue && lead.annualRevenue < partner.minRevenue) {
        return false;
      }
      if (partner.maxRevenue && lead.annualRevenue > partner.maxRevenue) {
        return false;
      }
    }

    // Coverage types (if specified)
    if (partner.coverageTypesInterested && partner.coverageTypesInterested.length > 0) {
      if (lead.desiredCoverages && lead.desiredCoverages.length > 0) {
        const hasMatchingCoverage = lead.desiredCoverages.some((coverage: string) =>
          partner.coverageTypesInterested.includes(coverage)
        );
        if (!hasMatchingCoverage) {
          return false;
        }
      }
    }

    return true;
  }

  private matchesLendingCriteria(lead: any, partner: any): boolean {
    // State match
    if (partner.statesServed && partner.statesServed.length > 0) {
      if (!lead.primaryState || !partner.statesServed.includes(lead.primaryState)) {
        return false;
      }
    }

    // Monthly revenue
    if (lead.avgMonthlyRevenue !== null && lead.avgMonthlyRevenue !== undefined) {
      if (partner.minMonthlyRevenue && lead.avgMonthlyRevenue < partner.minMonthlyRevenue) {
        return false;
      }
    }

    // Time in business
    if (lead.yearsInOperation !== null && lead.yearsInOperation !== undefined) {
      const monthsInBusiness = lead.yearsInOperation * 12;
      if (partner.minTimeInBusinessMonths && monthsInBusiness < partner.minTimeInBusinessMonths) {
        return false;
      }
    }

    // Loan amount
    if (lead.amountRequested !== null && lead.amountRequested !== undefined) {
      if (partner.maxLoanAmount && lead.amountRequested > partner.maxLoanAmount) {
        return false;
      }
    }

    return true;
  }
}

