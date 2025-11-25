import { Controller, Get, Post, Param, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all leads' })
  findAll() {
    return this.leadsService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a lead by ID' })
  @ApiResponse({ status: 200, description: 'Lead found' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Post(':id/confirm')
  @Public()
  @ApiOperation({ summary: 'Mark lead as ready for matching' })
  async confirm(@Param('id') id: string) {
    await this.leadsService.markReadyForMatch(id);
    return { message: 'Lead marked as ready for matching' };
  }

  @Patch(':id/completion')
  @Public()
  @ApiOperation({ summary: 'Update lead completion percentage' })
  updateCompletion(@Param('id') id: string) {
    return this.leadsService.updateCompletionPercentage(id);
  }

  @Patch(':id')
  @Public()
  @ApiOperation({ summary: 'Update lead fields' })
  async update(@Param('id') id: string, @Body() updateData: any) {
    return this.leadsService.update(id, updateData);
  }
}

