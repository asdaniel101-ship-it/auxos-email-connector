import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.submission.findMany({ 
      orderBy: { createdAt: 'desc' },
      include: {
        messages: true,
        documents: true,
      }
    });
  }

  async findOne(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!submission) {
      throw new NotFoundException(`Submission with ID ${id} not found`);
    }

    return submission;
  }

  create(data: CreateSubmissionDto) {
    return this.prisma.submission.create({
      data: {
        businessName: data.businessName,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        overview: data.overview,
        status: 'draft',
      },
      include: {
        messages: true,
        documents: true,
      }
    });
  }

  async update(id: string, data: UpdateSubmissionDto) {
    // Check if submission exists
    await this.findOne(id);

    return this.prisma.submission.update({
      where: { id },
      data,
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async addChatMessage(submissionId: string, role: string, content: string) {
    return this.prisma.chatMessage.create({
      data: {
        submissionId,
        role,
        content,
      },
    });
  }

  /**
   * Industry-specific recommended coverages
   */
  private industryRecommendations: Record<string, { 
    coverages: string[]; 
    reasoning: string;
  }> = {
    construction: {
      coverages: ['general_liability', 'workers_compensation', 'commercial_auto', 'builders_risk'],
      reasoning: "Construction businesses typically need protection against on-site injuries, property damage, and vehicle-related incidents"
    },
    restaurant: {
      coverages: ['general_liability', 'workers_compensation', 'liquor_liability', 'property'],
      reasoning: "Restaurants face risks from customer injuries, food-related claims, and employee accidents"
    },
    retail: {
      coverages: ['general_liability', 'property', 'product_liability', 'business_interruption'],
      reasoning: "Retail businesses need coverage for customer injuries, inventory loss, and revenue protection"
    },
    technology: {
      coverages: ['professional_liability', 'cyber_liability', 'general_liability'],
      reasoning: "Tech companies face risks from data breaches, software errors, and professional mistakes"
    },
    healthcare: {
      coverages: ['professional_liability', 'general_liability', 'cyber_liability'],
      reasoning: "Healthcare providers need protection against malpractice claims and patient data breaches"
    }
  };

  /**
   * Industry alternatives for correction
   */
  private industryOptions = [
    { keyword: 'construction', label: 'Construction of Buildings', code: '236' },
    { keyword: 'contractor', label: 'Specialty Trade Contractors', code: '238' },
    { keyword: 'restaurant', label: 'Food Services and Drinking Places', code: '722' },
    { keyword: 'retail', label: 'Retail Trade', code: '44-45' },
    { keyword: 'technology', label: 'Professional, Scientific, and Technical Services', code: '541' },
    { keyword: 'software', label: 'Software Publishers', code: '5112' },
    { keyword: 'healthcare', label: 'Ambulatory Health Care Services', code: '621' },
    { keyword: 'consulting', label: 'Management Consulting Services', code: '5416' },
    { keyword: 'manufacturing', label: 'Manufacturing', code: '31-33' },
  ];

  /**
   * Analyze user message and extract structured data with context awareness
   * This is a simple keyword-based approach for MVP
   * In production, you'd use an LLM like GPT-4 or Claude
   */
  analyzeMessage(message: string, currentSubmission?: any): {
    employeeCount?: number;
    yearsInOperation?: number;
    revenue?: number;
    insuranceNeeds?: string[];
    industryKeywords?: string[];
    totalClaimsCount?: number;
    totalClaimsLoss?: number;
    riskToleranceLevel?: string;
    keyAssets?: string;
    growthPlans?: string;
    isCorrection?: boolean;
    requestingIndustryOptions?: boolean;
    invalidAnswer?: string;
  } {
    const result: any = {};
    const answered = currentSubmission ? this.getAnsweredQuestions(currentSubmission) : {
      employeeCount: false,
      yearsInOperation: false,
      industry: false,
      coverages: false,
    };

    // Check if user is correcting/disputing the industry
    if (/not|wrong|incorrect|actually|that's not right|no,/i.test(message) && 
        /industry|business|type/i.test(message)) {
      result.isCorrection = true;
      result.requestingIndustryOptions = true;
    }

    // SMART EXTRACTION: Look for standalone numbers first, then use context
    const standaloneNumber = message.match(/^\s*(\d+)\s*$/);
    
    // Extract employee count (specific pattern or standalone number if that's the current question)
    const employeePattern = /(\d+)\s*(employees?|workers?|staff|people)/i;
    const employeeMatch = message.match(employeePattern);
    if (employeeMatch) {
      result.employeeCount = parseInt(employeeMatch[1]);
    } else if (standaloneNumber && !answered.employeeCount) {
      // If user just typed a number and we're on the employee question, interpret it as employee count
      result.employeeCount = parseInt(standaloneNumber[1]);
    }

    // Extract years in operation (specific pattern or standalone number if that's the current question)
    const yearsPattern = /(\d+)\s*(years?|yrs?)\s*(?:in\s*)?(operation|business|old)?/i;
    const yearsMatch = message.match(yearsPattern);
    if (yearsMatch && /years?|yrs?/i.test(message)) {
      result.yearsInOperation = parseInt(yearsMatch[1]);
    } else if (standaloneNumber && answered.employeeCount && !answered.yearsInOperation) {
      // If user just typed a number and we're on the years question, interpret it as years
      result.yearsInOperation = parseInt(standaloneNumber[1]);
    } else if (answered.employeeCount && !answered.yearsInOperation && employeeMatch) {
      // User said something like "10 employees" when we're asking about years
      result.invalidAnswer = `I see you mentioned "${employeeMatch[0]}", but I'm asking about how many years your business has been in operation.`;
    }

    // Extract revenue (looking for dollar amounts)
    const revenuePattern = /\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(million|mil|m|k|thousand)?/i;
    const revenueMatch = message.match(revenuePattern);
    if (revenueMatch && /revenue|sales|income|earnings/i.test(message)) {
      let amount = parseFloat(revenueMatch[1].replace(/,/g, ''));
      const unit = revenueMatch[2]?.toLowerCase();
      if (unit === 'million' || unit === 'mil' || unit === 'm') {
        amount *= 1000000;
      } else if (unit === 'k' || unit === 'thousand') {
        amount *= 1000;
      }
      result.revenue = amount;
    }

    // Extract claims history
    const claimsCountPattern = /(\d+)\s*claims?/i;
    const claimsCountMatch = message.match(claimsCountPattern);
    if (claimsCountMatch) {
      result.totalClaimsCount = parseInt(claimsCountMatch[1]);
    }

    const claimsLossPattern = /\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(million|mil|m|k|thousand)?\s*(?:in\s*)?(?:claims|losses)/i;
    const claimsLossMatch = message.match(claimsLossPattern);
    if (claimsLossMatch) {
      let amount = parseFloat(claimsLossMatch[1].replace(/,/g, ''));
      const unit = claimsLossMatch[2]?.toLowerCase();
      if (unit === 'million' || unit === 'mil' || unit === 'm') {
        amount *= 1000000;
      } else if (unit === 'k' || unit === 'thousand') {
        amount *= 1000;
      }
      result.totalClaimsLoss = amount;
    }

    // Extract risk tolerance
    if (/low\s*risk|conservative|minimal\s*risk/i.test(message)) {
      result.riskToleranceLevel = 'low';
    } else if (/high\s*risk|aggressive|maximum\s*risk/i.test(message)) {
      result.riskToleranceLevel = 'high';
    } else if (/medium\s*risk|moderate|balanced/i.test(message)) {
      result.riskToleranceLevel = 'medium';
    }

    // Extract key assets
    if (/vehicles?|trucks?|fleet|equipment|machinery|building|property|warehouse/i.test(message)) {
      result.keyAssets = message;
    }

    // Extract growth plans
    if (/expanding|growth|new location|opening|planning|hiring|scale/i.test(message)) {
      result.growthPlans = message;
    }

    // Extract insurance types
    const needs: string[] = [];
    if (/general liability|liability insurance/i.test(message)) {
      needs.push('general_liability');
    }
    if (/workers? comp/i.test(message)) {
      needs.push('workers_compensation');
    }
    if (/professional liability|errors? and omissions?|e&o/i.test(message)) {
      needs.push('professional_liability');
    }
    if (/cyber|data breach/i.test(message)) {
      needs.push('cyber_liability');
    }
    if (/property insurance|building insurance/i.test(message)) {
      needs.push('property');
    }
    if (/commercial auto|vehicle insurance/i.test(message)) {
      needs.push('commercial_auto');
    }
    if (/liquor|alcohol/i.test(message)) {
      needs.push('liquor_liability');
    }
    if (/product liability/i.test(message)) {
      needs.push('product_liability');
    }
    if (needs.length > 0) {
      result.insuranceNeeds = needs;
    }

    // Extract industry keywords
    const industries: string[] = [];
    if (/construction|contractor|builder/i.test(message)) {
      industries.push('construction');
    }
    if (/restaurant|food service|cafe/i.test(message)) {
      industries.push('restaurant');
    }
    if (/retail|store|shop/i.test(message)) {
      industries.push('retail');
    }
    if (/tech|software|IT|technology/i.test(message)) {
      industries.push('technology');
    }
    if (/healthcare|medical|doctor|clinic/i.test(message)) {
      industries.push('healthcare');
    }
    if (/consulting|consultant/i.test(message)) {
      industries.push('consulting');
    }
    if (/manufacturing|factory/i.test(message)) {
      industries.push('manufacturing');
    }
    if (industries.length > 0) {
      result.industryKeywords = industries;
    }

    return result;
  }

  /**
   * Determine which questions have been answered
   */
  getAnsweredQuestions(submission: any): {
    employeeCount: boolean;
    yearsInOperation: boolean;
    industry: boolean;
    coverages: boolean;
  } {
    return {
      employeeCount: submission.employeeCount !== null && submission.employeeCount !== undefined,
      yearsInOperation: submission.yearsInOperation !== null && submission.yearsInOperation !== undefined,
      industry: !!(submission.industryCode && submission.industryLabel),
      coverages: !!(submission.insuranceNeeds && submission.insuranceNeeds.length > 0),
    };
  }

  /**
   * Generate an AI response based on extracted data
   * This is a simple template-based approach
   * In production, you'd use an LLM to generate natural responses
   */
  generateResponse(analysis: any, currentSubmission: any): string {
    const parts: string[] = [];
    const answered = this.getAnsweredQuestions(currentSubmission);

    // Handle industry correction request
    if (analysis.requestingIndustryOptions) {
      parts.push("No problem! Let me help you find the right industry. Which of these best describes your business?\n");
      
      const options = this.industryOptions.slice(0, 5).map((opt, idx) => 
        `${idx + 1}. ${opt.label}`
      );
      parts.push(options.join('\n'));
      parts.push('\n\nJust tell me the number or name that fits best!');
      
      return parts.join('');
    }

    // STEP-BY-STEP QUESTION FLOW
    
    // Step 1: Employee Count (if not answered)
    if (!answered.employeeCount) {
      if (analysis.employeeCount) {
        // User just answered, acknowledge and move to next question
        return `Perfect! ${analysis.employeeCount} employees. That helps me understand your business size.\n\n**Next question:** How many years has your business been in operation?`;
      }
      
      // Check if user provided an invalid answer
      if (analysis.invalidAnswer) {
        return `I didn't quite catch that. ${analysis.invalidAnswer}\n\nLet me ask again: **Question 1 of 4:** How many employees does your business have?\n\nYou can just type a number like "25" or "25 employees"`;
      }
      
      // Ask the question
      return "**Question 1 of 4:** How many employees does your business have?\n\n(This helps us understand your business size and determine appropriate coverage levels)";
    }

    // Step 2: Years in Operation (if not answered)
    if (!answered.yearsInOperation) {
      if (analysis.yearsInOperation) {
        // User just answered, acknowledge and move to next question
        return `Great! ${analysis.yearsInOperation} years in operation shows you have an established business.\n\n**Next question:** What industry or type of business are you in?\n\n(e.g., construction, restaurant, retail, technology, healthcare, etc.)`;
      }
      
      // Check if user provided an invalid answer
      if (analysis.invalidAnswer) {
        return `I didn't quite catch that. ${analysis.invalidAnswer}\n\nLet me ask again: **Question 2 of 4:** How many years has your business been in operation?\n\nYou can just type a number like "5" or "5 years"`;
      }
      
      // Ask the question (only if employee count was already answered)
      if (answered.employeeCount) {
        return "**Question 2 of 4:** How many years has your business been in operation?\n\n(This helps us assess your business stability and risk profile)";
      }
      // If we somehow got here without employee count, go back to Q1
      return "**Question 1 of 4:** How many employees does your business have?\n\n(This helps us understand your business size and determine appropriate coverage levels)";
    }

    // Step 3: Industry (if not answered)
    if (!answered.industry) {
      if (analysis.industryKeywords && analysis.industryKeywords.length > 0) {
        const industry = analysis.industryKeywords[0];
        const industryLabel = currentSubmission.industryLabel || industry;
        
        // Now that we have industry and employee count, suggest coverages
        const recommendations = this.industryRecommendations[industry];
        if (recommendations) {
          const recLabels = recommendations.coverages.map((cov) => 
            `• ${cov.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`
          );
          
          return `Excellent! Based on your ${industryLabel.toLowerCase()} business with ${currentSubmission.employeeCount} employees, I recommend these insurance coverages:\n\n${recLabels.join('\n')}\n\n💡 **Why these?** ${recommendations.reasoning}\n\n**Question 4 of 4:** Does this coverage package look good, or would you like to add/remove any coverages?\n\n(You can say "looks good", or tell me what to add/remove)`;
        }
      }
      // Ask the question (only if previous questions were answered)
      if (answered.employeeCount && answered.yearsInOperation) {
        return "**Question 3 of 4:** What industry or type of business are you in?\n\n(e.g., construction, restaurant, retail, technology, healthcare, consulting, manufacturing)";
      }
      // If we got here without the previous answers, something went wrong - go back
      if (!answered.yearsInOperation) {
        return "**Question 2 of 4:** How many years has your business been in operation?\n\n(This helps us assess your business stability and risk profile)";
      }
      return "**Question 1 of 4:** How many employees does your business have?\n\n(This helps us understand your business size and determine appropriate coverage levels)";
    }

    // Step 4: Coverage confirmation and modifications (if not answered)
    if (!answered.coverages) {
      // Check if user is accepting the recommendations
      if (/looks good|sounds good|perfect|yes|that works|correct|right|approve/i.test(analysis.industryKeywords?.[0] || '')) {
        // This is handled in the controller
        return ""; // Will be replaced by controller
      }
      
      // Check if user wants to modify
      if (analysis.insuranceNeeds && analysis.insuranceNeeds.length > 0) {
        const needsLabels = analysis.insuranceNeeds.map((need: string) => 
          need.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
        );
        return `Got it! I've updated your coverages: ${needsLabels.join(', ')}.\n\nAnything else you'd like to add or remove? Or are we good to proceed?`;
      }
      
      // Fallback: If we somehow got here without industry-specific recommendations, suggest generic coverages
      const genericCoverages = [
        '• General Liability',
        '• Workers Compensation',
        '• Professional Liability (E&O)',
        '• Property Insurance'
      ];
      return `**Question 4 of 4:** Based on your business, I recommend these common coverages:\n\n${genericCoverages.join('\n')}\n\n💡 **Why these?** These are the most common coverages that protect businesses from general risks, employee injuries, professional mistakes, and property damage.\n\nDoes this coverage package look good, or would you like to add/remove any coverages?\n\n(You can say "looks good", or tell me what to add/remove)`;
    }

    // All mandatory questions answered - ask nice-to-have (only once each)
    if (!currentSubmission.totalClaimsCount && !currentSubmission.totalClaimsLoss && !analysis.totalClaimsCount) {
      if (/skip|none|no|don't know|not sure|zero|0/i.test(analysis.industryKeywords?.[0] || '')) {
        // User skipped claims question, move to revenue
        return "No problem! **Bonus question:** What's your approximate annual revenue?\n\n(This helps us size your coverage appropriately. You can skip this by saying 'skip')";
      }
      return "Perfect! All the essential questions are answered. 🎉\n\n**Bonus question (optional):** Do you know how many insurance claims your business has had in the past 3-5 years?\n\n(This can help get better rates. You can say 'skip' if you don't know)";
    }

    // If claims question was answered (not skipped), ask revenue
    if (!currentSubmission.revenue && !analysis.revenue && (currentSubmission.totalClaimsCount !== null || analysis.totalClaimsCount !== undefined)) {
      if (/skip|none|no|don't know|not sure|prefer not/i.test(analysis.industryKeywords?.[0] || '')) {
        // User skipped revenue, we're done
        return this.generateCompletionSummary(currentSubmission);
      }
      return "**Final bonus question (optional):** What's your approximate annual revenue?\n\n(This helps us size your coverage appropriately. You can skip this by saying 'skip')";
    }

    // All done - show completion summary
    return this.generateCompletionSummary(currentSubmission);
  }

  /**
   * Generate the completion summary
   */
  private generateCompletionSummary(submission: any): string {
    const parts: string[] = [];
    parts.push("✅ **All done!** Here's what I've gathered:\n");
    
    const summary: string[] = [];
    if (submission.employeeCount) {
      summary.push(`• **Employees:** ${submission.employeeCount}`);
    }
    if (submission.yearsInOperation) {
      summary.push(`• **Years in operation:** ${submission.yearsInOperation}`);
    }
    if (submission.industryLabel) {
      summary.push(`• **Industry:** ${submission.industryLabel}`);
    }
    if (submission.insuranceNeeds) {
      const needs = submission.insuranceNeeds.split(',').map((n: string) => 
        n.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      );
      summary.push(`• **Coverage:** ${needs.join(', ')}`);
    }
    if (submission.revenue) {
      summary.push(`• **Revenue:** $${Number(submission.revenue).toLocaleString()}`);
    }
    if (submission.totalClaimsCount !== null && submission.totalClaimsCount !== undefined) {
      summary.push(`• **Past claims:** ${submission.totalClaimsCount}`);
    }
    
    parts.push(summary.join('\n'));
    parts.push("\n\n🎉 **You're all set!** Click the button below to finish and review your complete submission!");
    
    return parts.join('');
  }

  /**
   * Get recommended coverages for an industry
   */
  getRecommendedCoverages(industry: string): string[] {
    return this.industryRecommendations[industry]?.coverages || [];
  }

  /**
   * Register uploaded documents for a submission
   */
  async registerDocuments(submissionId: string, files: Array<{ fileName: string; fileKey: string; fileSize: number; mimeType: string }>) {
    // Verify submission exists
    await this.findOne(submissionId);

    // Create document records
    const documents = await Promise.all(
      files.map((file) =>
        this.prisma.document.create({
          data: {
            submissionId,
            fileName: file.fileName,
            fileKey: file.fileKey,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            processingStatus: 'pending',
          },
        })
      )
    );

    return documents;
  }

  /**
   * Get extracted fields for a submission
   */
  async getExtractedFields(submissionId: string) {
    return this.prisma.extractedField.findMany({
      where: { submissionId },
      include: {
        document: {
          select: {
            fileName: true,
            documentType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
