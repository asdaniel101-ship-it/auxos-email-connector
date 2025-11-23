import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePartnerDto } from './dto/create-partner.dto';

@Injectable()
export class PartnersService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreatePartnerDto) {
    return this.prisma.partner.create({
      data: {
        name: data.name,
        contactEmail: data.contactEmail,
        verticals: data.verticals,
        statesServed: data.statesServed || [],
        preferredIndustries: data.preferredIndustries || [],
        minEmployeeCount: data.minEmployeeCount,
        maxEmployeeCount: data.maxEmployeeCount,
        minRevenue: data.minRevenue,
        maxRevenue: data.maxRevenue,
        coverageTypesInterested: data.coverageTypesInterested || [],
        minMonthlyRevenue: data.minMonthlyRevenue,
        minTimeInBusinessMonths: data.minTimeInBusinessMonths,
        maxLoanAmount: data.maxLoanAmount,
        riskTolerance: data.riskTolerance,
      },
    });
  }

  async findAll() {
    return this.prisma.partner.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            lead: {
              include: {
                session: true,
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!partner) {
      throw new NotFoundException(`Partner with ID ${id} not found`);
    }

    return partner;
  }

  async getLeads(partnerId: string) {
    try {
      // Get all leads (not just assigned ones) for this partner's vertical
      const partner = await this.prisma.partner.findUnique({
        where: { id: partnerId },
        select: { verticals: true },
      });

      if (!partner) {
        throw new NotFoundException(`Partner with ID ${partnerId} not found`);
      }

    // Build where clause - if partner has verticals, filter by them; otherwise show all
    const whereClause: any = {
      status: {
        in: ['READY_FOR_MATCH', 'ASSIGNED', 'DRAFT', 'IN_PROGRESS'],
      },
    };

    if (partner.verticals && partner.verticals.length > 0) {
      whereClause.session = {
        vertical: {
          in: partner.verticals,
        },
      };
    }

    // Get all leads that match the partner's verticals (or all if no verticals specified)
    const allLeads = await this.prisma.lead.findMany({
      where: whereClause,
      include: {
        session: {
          select: {
            id: true,
            vertical: true,
            businessType: true,
            createdAt: true,
          },
        },
        extractedFields: {
          include: {
            document: {
              select: {
                id: true,
                fileName: true,
                docType: true,
              },
            },
          },
        },
        assignments: {
          where: { partnerId },
          select: {
            status: true,
            assignedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

      // Map leads and include assignment info if exists
      return allLeads.map((lead) => {
        const assignment = lead.assignments[0];
        return {
          ...lead,
          assignmentStatus: assignment?.status || 'UNASSIGNED',
          assignedAt: assignment?.assignedAt || null,
          extractedFields: lead.extractedFields,
        };
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to load leads: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async acceptLead(partnerId: string, leadId: string) {
    return this.prisma.leadAssignment.update({
      where: {
        leadId_partnerId: {
          leadId,
          partnerId,
        },
      },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
    });
  }

  async rejectLead(partnerId: string, leadId: string) {
    return this.prisma.leadAssignment.update({
      where: {
        leadId_partnerId: {
          leadId,
          partnerId,
        },
      },
      data: {
        status: 'REJECTED',
        respondedAt: new Date(),
      },
    });
  }

  async updateAppetite(partnerId: string, data: Partial<CreatePartnerDto>) {
    return this.prisma.partner.update({
      where: { id: partnerId },
      data: {
        statesServed: data.statesServed,
        preferredIndustries: data.preferredIndustries,
        minEmployeeCount: data.minEmployeeCount,
        maxEmployeeCount: data.maxEmployeeCount,
        minRevenue: data.minRevenue,
        maxRevenue: data.maxRevenue,
        coverageTypesInterested: data.coverageTypesInterested,
        minMonthlyRevenue: data.minMonthlyRevenue,
        minTimeInBusinessMonths: data.minTimeInBusinessMonths,
        maxLoanAmount: data.maxLoanAmount,
        riskTolerance: data.riskTolerance,
      },
    });
  }
}

