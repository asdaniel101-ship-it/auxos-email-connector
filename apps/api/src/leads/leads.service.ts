import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        session: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
            documents: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        fieldCandidates: {
          orderBy: { createdAt: 'desc' },
        },
        extractedFields: {
          include: {
            document: true,
          },
        },
        assignments: {
          include: {
            partner: true,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    return lead;
  }

  async updateCompletionPercentage(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        session: true,
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    // Calculate completion percentage based on required fields
    const requiredFields = this.getRequiredFields(lead.session.vertical);
    const filledFields = this.countFilledFields(lead, requiredFields);
    const completionPercentage = Math.round((filledFields / requiredFields.length) * 100);

    return this.prisma.lead.update({
      where: { id: leadId },
      data: { completionPercentage },
    });
  }

  async markReadyForMatch(leadId: string) {
    return this.prisma.lead.update({
      where: { id: leadId },
      data: { status: 'READY_FOR_MATCH' },
    });
  }

  private getRequiredFields(vertical: string): string[] {
    const baseFields = [
      'legalBusinessName',
      'primaryAddress',
      'primaryCity',
      'primaryState',
      'primaryZip',
      'employeeCountTotal',
      'annualRevenue',
      'businessDescription',
    ];

    if (vertical === 'insurance') {
      return [...baseFields, 'desiredCoverages'];
    } else if (vertical === 'lending') {
      return [...baseFields, 'amountRequested', 'fundingPurpose'];
    }

    return baseFields;
  }

  private countFilledFields(lead: any, requiredFields: string[]): number {
    return requiredFields.filter((field) => {
      const value = lead[field];
      return value !== null && value !== undefined && value !== '';
    }).length;
  }

  async findAll() {
    return this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        session: true,
        assignments: {
          include: {
            partner: true,
          },
        },
      },
    });
  }

  async update(id: string, updateData: any) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    // Update the lead with provided data
    const updated = await this.prisma.lead.update({
      where: { id },
      data: updateData,
    });

    // Recalculate completion percentage
    await this.updateCompletionPercentage(id);

    return updated;
  }
}

