import { Controller, Get, Post, Param, Body, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PartnersService } from './partners.service';
import { MatchingService } from './matching.service';
import { CreatePartnerDto } from './dto/create-partner.dto';

@ApiTags('partners')
@Controller('partners')
export class PartnersController {
  constructor(
    private readonly partnersService: PartnersService,
    private readonly matchingService: MatchingService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new partner' })
  create(@Body() createPartnerDto: CreatePartnerDto) {
    return this.partnersService.create(createPartnerDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all partners' })
  findAll() {
    return this.partnersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a partner by ID' })
  findOne(@Param('id') id: string) {
    return this.partnersService.findOne(id);
  }

  @Get(':id/leads')
  @ApiOperation({ summary: 'Get leads assigned to a partner' })
  async getLeads(@Param('id') id: string) {
    try {
      return await this.partnersService.getLeads(id);
    } catch (error) {
      throw error;
    }
  }

  @Post(':id/leads/:leadId/accept')
  @ApiOperation({ summary: 'Accept a lead' })
  acceptLead(@Param('id') partnerId: string, @Param('leadId') leadId: string) {
    return this.partnersService.acceptLead(partnerId, leadId);
  }

  @Post(':id/leads/:leadId/reject')
  @ApiOperation({ summary: 'Reject a lead' })
  rejectLead(@Param('id') partnerId: string, @Param('leadId') leadId: string) {
    return this.partnersService.rejectLead(partnerId, leadId);
  }

  @Patch(':id/appetite')
  @ApiOperation({ summary: 'Update partner appetite settings' })
  updateAppetite(@Param('id') id: string, @Body() data: Partial<CreatePartnerDto>) {
    return this.partnersService.updateAppetite(id, data);
  }

  @Post('match/:leadId')
  @ApiOperation({ summary: 'Match a lead to partners' })
  matchLead(@Param('leadId') leadId: string) {
    return this.matchingService.matchLeadToPartners(leadId);
  }
}

