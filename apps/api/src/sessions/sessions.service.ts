import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async create(data: CreateSessionDto) {
    // Create session and lead together
    const session = await this.prisma.session.create({
      data: {
        vertical: data.vertical,
        businessType: data.businessType,
        ownerName: data.ownerName,
        email: data.email,
        phone: data.phone,
        howDidYouHear: data.howDidYouHear,
        status: 'IN_PROGRESS',
        lead: {
          create: {
            status: 'DRAFT',
            completionPercentage: 0,
            legalBusinessName: data.businessName,
            ownerName: data.ownerName,
            ownerEmail: data.email,
            ownerPhone: data.phone,
            primaryAddress: data.address,
            primaryCity: data.city,
            primaryState: data.state,
            primaryZip: data.zip,
            // Set desired coverages if provided (for insurance vertical)
            desiredCoverages: data.desiredCoverages || [],
            // Set actively looking for insurance if provided (for insurance vertical)
            activelyLookingForInsurance: data.activelyLookingForInsurance ?? false,
          },
        },
        messages: {
          create: {
            role: 'assistant',
            content: data.vertical === 'insurance'
              ? "Hi! I'm here to help you get better insurance quotes. First, can you tell me what kind of business you run?"
              : "Hi! I'm here to help you find small business funding. First, can you tell me what kind of business you run?",
          },
        },
      },
      include: {
        lead: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Send intake email notification
    try {
      await this.emailService.sendIntakeEmail(session.id, {
        sessionId: session.id,
        vertical: data.vertical,
        businessType: data.businessType,
        businessName: data.businessName,
        ownerName: data.ownerName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        howDidYouHear: data.howDidYouHear,
        desiredCoverages: data.desiredCoverages,
        activelyLookingForInsurance: data.activelyLookingForInsurance,
      });
    } catch (error) {
      console.error('Failed to send intake email:', error);
      // Don't fail the request if email fails
    }

    return session;
  }

  async findOne(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        lead: {
          include: {
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
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    return session;
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.session.update({
      where: { id },
      data: { status },
    });
  }

  async findAll() {
    return this.prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        lead: true,
        _count: {
          select: {
            messages: true,
            documents: true,
          },
        },
      },
    });
  }
}

