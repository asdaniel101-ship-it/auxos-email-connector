import { Body, Controller, Get, Post, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { CreateChatMessageDto } from './dto/chat-message.dto';
import { RegisterDocumentsDto } from './dto/register-documents.dto';
import { getTemporalClient } from '../workflows.client';

@ApiTags('submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly svc: SubmissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all submissions' })
  @ApiResponse({ status: 200, description: 'Returns array of submissions' })
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single submission by ID' })
  @ApiParam({ name: 'id', description: 'Submission ID' })
  @ApiResponse({ status: 200, description: 'Returns submission with messages and documents' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/extracted-fields')
  @ApiOperation({ summary: 'Get extracted fields for a submission' })
  @ApiParam({ name: 'id', description: 'Submission ID' })
  @ApiResponse({ status: 200, description: 'Returns extracted fields with metadata' })
  getExtractedFields(@Param('id') id: string) {
    return this.svc.getExtractedFields(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new submission' })
  @ApiResponse({ status: 201, description: 'Submission created successfully' })
  create(@Body() body: CreateSubmissionDto) {
    return this.svc.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a submission (for auto-save)' })
  @ApiParam({ name: 'id', description: 'Submission ID' })
  @ApiResponse({ status: 200, description: 'Submission updated successfully' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  update(@Param('id') id: string, @Body() body: UpdateSubmissionDto) {
    return this.svc.update(id, body);
  }

  @Post(':id/chat')
  @ApiOperation({ summary: 'Send a chat message and get AI response' })
  @ApiParam({ name: 'id', description: 'Submission ID' })
  @ApiResponse({ status: 200, description: 'Returns AI reply and updated submission' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async chat(@Param('id') id: string, @Body() body: CreateChatMessageDto) {
    // Get current submission
    const submission = await this.svc.findOne(id);

    // Handle special chat start trigger (don't save as user message)
    if (body.message === '__START_CHAT__') {
      // Check if messages already exist (to prevent duplicates)
      if (submission.messages && submission.messages.length > 0) {
        // Messages already exist, just return them
        return {
          reply: submission.messages[submission.messages.length - 1].content,
          submission: submission,
          messages: submission.messages,
        };
      }
      
      // Generate welcome message
      const welcomeMsg = `Hi! I'm here to help you get the right insurance coverage for ${submission.businessName}. 

I'll guide you through **4 essential questions** to find the perfect coverage for your business:

📋 **Questions I'll ask:**
1. How many employees do you have?
2. How long has your business been in operation?
3. What industry or type of business are you in?
4. Confirm the insurance coverages I recommend for you

Plus a couple of optional bonus questions to get you the best rates!

Let's get started! 🚀`;
      
      // Save welcome message
      await this.svc.addChatMessage(id, 'assistant', welcomeMsg);
      
      // Save Question 1
      const q1 = '**Question 1 of 4:** How many employees does your business have?\n\n(This helps us understand your business size and determine appropriate coverage levels)';
      await this.svc.addChatMessage(id, 'assistant', q1);
      
      // Return both messages - fetch fresh to ensure we get the latest state
      const finalSubmission = await this.svc.findOne(id);
      
      // Additional check: if somehow we have more than 2 messages now (race condition),
      // return only the first 2 unique messages
      const uniqueMessages = finalSubmission.messages?.filter((msg, index, self) => 
        index === self.findIndex(m => m.content === msg.content && m.role === msg.role)
      ) || [];
      
      return {
        reply: q1,
        submission: { ...finalSubmission, messages: uniqueMessages },
        messages: uniqueMessages,
      };
    }

    // Save user message (only for real user messages, not the start trigger)
    await this.svc.addChatMessage(id, 'user', body.message);

    // Check if user is accepting recommended coverages
    if (/looks good|sounds good|perfect|yes|that works|correct|right|approve|okay|ok/i.test(body.message.toLowerCase()) &&
        submission.industryCode && submission.employeeCount &&
        !submission.insuranceNeeds) {

      // Get recommended coverages for the detected industry
      const industryKeyword = submission.industryLabel?.toLowerCase().includes('construction') ? 'construction' :
                              submission.industryLabel?.toLowerCase().includes('food') ? 'restaurant' :
                              submission.industryLabel?.toLowerCase().includes('retail') ? 'retail' :
                              submission.industryLabel?.toLowerCase().includes('technical') ? 'technology' :
                              submission.industryLabel?.toLowerCase().includes('health') ? 'healthcare' :
                              submission.industryLabel?.toLowerCase().includes('consulting') ? 'consulting' :
                              submission.industryLabel?.toLowerCase().includes('manufacturing') ? 'manufacturing' : null;

      if (industryKeyword) {
        const recommended = this.svc.getRecommendedCoverages(industryKeyword);
        if (recommended.length > 0) {
          await this.svc.update(id, { insuranceNeeds: recommended.join(',') });
          const recLabels = recommended.map(c => `✓ ${c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`).join('\n');
          const aiReply = `Perfect! I've added these coverages to your submission:\n\n${recLabels}\n\n**All essential questions answered!** 🎉\n\n**Bonus question (optional):** Do you know how many insurance claims your business has had in the past 3-5 years?\n\n(This can help get better rates. You can say 'skip' if you don't know)`;
          
          await this.svc.addChatMessage(id, 'assistant', aiReply);
          const finalSubmission = await this.svc.findOne(id);
          
          return {
            reply: aiReply,
            submission: finalSubmission,
            messages: finalSubmission.messages,
          };
        }
      }
    }

    // Analyze the message to extract data (with context awareness)
    const analysis = this.svc.analyzeMessage(body.message, submission);

    // Update submission with extracted data FIRST
    const updateData: any = {};
    
    // Mandatory fields
    if (analysis.employeeCount) {
      updateData.employeeCount = analysis.employeeCount;
    }
    if (analysis.yearsInOperation) {
      updateData.yearsInOperation = analysis.yearsInOperation;
    }
    
    // Optional fields
    if (analysis.revenue) {
      updateData.revenue = analysis.revenue;
    }
    if (analysis.riskToleranceLevel) {
      updateData.riskToleranceLevel = analysis.riskToleranceLevel;
    }
    if (analysis.keyAssets) {
      updateData.keyAssets = analysis.keyAssets;
    }
    if (analysis.growthPlans) {
      updateData.growthPlans = analysis.growthPlans;
    }
    
    // Nice to have fields
    if (analysis.totalClaimsCount !== undefined) {
      updateData.totalClaimsCount = analysis.totalClaimsCount;
    }
    if (analysis.totalClaimsLoss) {
      updateData.totalClaimsLoss = analysis.totalClaimsLoss;
    }
    
    // Handle "skip" or "none" for nice-to-have fields
    if (/skip|none|no|don't know|not sure/i.test(body.message.toLowerCase())) {
      if (/claims?|history/i.test(body.message.toLowerCase()) && !submission.totalClaimsCount) {
        updateData.totalClaimsCount = 0;
        updateData.totalClaimsLoss = 0;
      }
    }
    
    if (analysis.insuranceNeeds) {
      // Merge with existing needs
      const existingNeeds = submission.insuranceNeeds 
        ? submission.insuranceNeeds.split(',') 
        : [];
      const allNeeds = [...new Set([...existingNeeds, ...analysis.insuranceNeeds])];
      updateData.insuranceNeeds = allNeeds.join(',');
    }
    if (analysis.industryKeywords && analysis.industryKeywords.length > 0) {
      // Simple industry mapping (expand this in production)
      const industryMap: any = {
        construction: { code: '236', label: 'Construction of Buildings' },
        contractor: { code: '238', label: 'Specialty Trade Contractors' },
        restaurant: { code: '722', label: 'Food Services and Drinking Places' },
        retail: { code: '44-45', label: 'Retail Trade' },
        technology: { code: '541', label: 'Professional, Scientific, and Technical Services' },
        healthcare: { code: '621', label: 'Ambulatory Health Care Services' },
        consulting: { code: '5416', label: 'Management Consulting Services' },
        manufacturing: { code: '31-33', label: 'Manufacturing' },
      };
      const industry = industryMap[analysis.industryKeywords[0]];
      if (industry) {
        updateData.industryCode = industry.code;
        updateData.industryLabel = industry.label;
      }
    }

    // CRITICAL: Update submission BEFORE generating response
    // This ensures generateResponse sees the latest data
    let updatedSubmission = submission;
    if (Object.keys(updateData).length > 0) {
      updatedSubmission = await this.svc.update(id, updateData);
    }

    // Generate AI response using the UPDATED submission
    const aiReply = this.svc.generateResponse(analysis, updatedSubmission);

    // Save assistant message
    await this.svc.addChatMessage(id, 'assistant', aiReply);

    // Get all messages
    const finalSubmission = await this.svc.findOne(id);

    return {
      reply: aiReply,
      submission: finalSubmission,
      messages: finalSubmission.messages,
    };
  }

  @Post(':id/documents')
  @ApiOperation({ summary: 'Register uploaded documents and trigger extraction' })
  @ApiParam({ name: 'id', description: 'Submission ID' })
  @ApiResponse({ status: 200, description: 'Documents registered and extraction started' })
  async registerDocuments(@Param('id') id: string, @Body() body: RegisterDocumentsDto) {
    // Register documents in database
    const documents = await this.svc.registerDocuments(id, body.files);
    
    // Trigger extraction workflow for each document (don't wait for completion)
    const client = await getTemporalClient();
    const workflowPromises = documents.map(async (doc) => {
      const workflowId = `extract-doc-${doc.id}`;
      try {
        await client.workflow.start('extractDocumentWorkflow', {
          taskQueue: 'agent-queue',
          workflowId,
          args: [{ documentId: doc.id, submissionId: id }],
        });
        return { documentId: doc.id, workflowId, status: 'started' };
      } catch (error) {
        console.error(`Failed to start extraction for document ${doc.id}:`, error);
        return { documentId: doc.id, workflowId, status: 'failed', error: String(error) };
      }
    });

    const workflows = await Promise.all(workflowPromises);

    return { 
      documents,
      workflows,
      message: `Registered ${documents.length} document(s) and started extraction` 
    };
  }

  @Post(':id/extract-document')
  @ApiOperation({ summary: 'Extract and verify document content' })
  @ApiParam({ name: 'id', description: 'Submission ID' })
  @ApiResponse({ status: 200, description: 'Returns extraction results' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async extractDocument(
    @Param('id') id: string,
    @Body() body: { fileKey: string }
  ) {
    // Verify submission exists
    await this.svc.findOne(id);

    // Start the document extraction workflow
    const client = await getTemporalClient();
    const handle = await client.workflow.start('extractDocumentWorkflow', {
      args: [id, body.fileKey],
      taskQueue: 'agent-queue',
      workflowId: `extract-doc-${id}-${Date.now()}`,
    });

    // Wait for the workflow to complete (with timeout)
    const result = await handle.result();

    return {
      workflowId: handle.workflowId,
      ...result,
    };
  }

  @Post('start-workflow')
  @ApiOperation({ summary: 'Start a Temporal workflow (legacy endpoint)' })
  async startWorkflow(@Body() body: { id: string }) {
    const client = await getTemporalClient();
    const handle = await client.workflow.start('submissionWorkflow', {
      args: [body.id],
      taskQueue: 'agent-queue',
      workflowId: `submission-${body.id}`,
    });
    return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId };
  }
}
