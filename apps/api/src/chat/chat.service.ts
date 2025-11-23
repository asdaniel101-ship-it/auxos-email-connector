import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatService {
  private openai: OpenAI | undefined;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      console.warn('OPENAI_API_KEY not found - chat will use fallback extraction only');
    }
  }

  async processMessage(sessionId: string, dto: ChatMessageDto) {
    // Load session with lead and conversation history
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        lead: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    // Save user message
    await this.prisma.conversationMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: dto.message,
      },
    });

    // Use unified AI orchestrator - single LLM call that does everything
    const result = await this.processWithUnifiedAI(dto.message, session);

    // Update lead with extracted fields
    if (result.fieldUpdates && Object.keys(result.fieldUpdates).length > 0 && session.lead) {
      // Normalize revenue values - handle k/m suffixes from LLM
      if (result.fieldUpdates.annualRevenue) {
        const rev = result.fieldUpdates.annualRevenue;
        if (typeof rev === 'string') {
          // Handle string values like "300k", "300000", "@300k", etc.
          const revStr = rev.replace(/[^\dkmKM.]/g, '').toLowerCase();
          if (revStr.includes('k')) {
            const num = parseFloat(revStr.replace('k', ''));
            if (!isNaN(num)) {
              result.fieldUpdates.annualRevenue = num * 1000;
            }
          } else if (revStr.includes('m')) {
            const num = parseFloat(revStr.replace('m', ''));
            if (!isNaN(num)) {
              result.fieldUpdates.annualRevenue = num * 1000000;
            }
          } else {
            const num = parseFloat(revStr);
            if (!isNaN(num)) {
              result.fieldUpdates.annualRevenue = num;
            }
          }
        }
      }
      
      await this.updateLeadFields(session.lead.id, result.fieldUpdates);
      // Reload lead to get updated values
      session.lead = await this.prisma.lead.findUnique({
        where: { id: session.lead.id },
      });
    }

    // Save assistant message
    const assistantMessage = await this.prisma.conversationMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: result.message,
        fieldUpdates: result.fieldUpdates || null,
      },
    });

    // Update completion percentage
    if (session.lead) {
      const newCompletionPercentage = this.calculateCompletion(
        session.lead,
        result.fieldUpdates || {},
        session.vertical
      );
      await this.prisma.lead.update({
        where: { id: session.lead.id },
        data: { completionPercentage: newCompletionPercentage },
      });
    }

    return {
      message: result.message,
      fieldUpdates: result.fieldUpdates || {},
      messageId: assistantMessage.id,
    };
  }

  /**
   * Unified AI Processing: Single LLM call that extracts fields AND generates response
   * This is how ChatGPT actually works - it doesn't separate concerns
   */
  private async processWithUnifiedAI(userMessage: string, session: any): Promise<{
    message: string;
    fieldUpdates: any;
  }> {
    // If OpenAI is not available, use fallback extraction
    if (!this.openai) {
      console.warn('OpenAI not available, using fallback extraction');
      const context = this.buildContext(session);
      const conversationHistory = session.messages.map((m) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));
      const lastQuestion = conversationHistory
        .filter(m => m.role === 'assistant')
        .slice(-1)[0]?.content || '';
      const fieldSchema = this.getFieldSchemaForVertical(context.vertical, context.businessType);
      const missingFields = context.missingFields || [];
      const currentField = this.determineCurrentField(lastQuestion, missingFields, fieldSchema);
      const fieldUpdates = this.fallbackExtractFields(userMessage, context, currentField);
      const updatedMissingFields = missingFields.filter(field => !fieldUpdates[field]);
      const nextField = updatedMissingFields.length > 0 ? updatedMissingFields[0] : null;
      const message = this.generateFallbackResponse(userMessage, fieldUpdates, nextField, context);
      return { message, fieldUpdates };
    }

    // Build context
    const context = this.buildContext(session);
    const conversationHistory = session.messages.map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }));

    // Get the LAST question asked (most recent assistant message)
    const lastQuestion = conversationHistory
      .filter(m => m.role === 'assistant')
      .slice(-1)[0]?.content || '';

    // Get field schema
    const fieldSchema = this.getFieldSchemaForVertical(context.vertical, context.businessType);
    let missingFields = context.missingFields || [];
    
    // CRITICAL: Remove fields that are already answered from missingFields
    // This prevents asking the same question twice
    const answeredFields = context.answeredFields || [];
    missingFields = missingFields.filter(field => !answeredFields.includes(field));
    
    // Determine which field we're currently asking about
    const currentField = this.determineCurrentField(lastQuestion, missingFields, fieldSchema);
    
    // CRITICAL: Do quick extraction first to know what will be filled
    const quickExtraction = this.fallbackExtractFields(userMessage, context, currentField);
    
    // Update missingFields to exclude fields that will be extracted
    const updatedMissingFields = missingFields.filter(field => !quickExtraction[field]);
    const nextField = updatedMissingFields.length > 0 ? updatedMissingFields[0] : null;
    const nextFieldInfo = nextField ? fieldSchema[nextField] : null;

    // Build unified system prompt
    const systemPrompt = `You are a helpful, conversational business intake assistant for ${context.vertical === 'insurance' ? 'commercial insurance quotes' : 'small business lending'}. You conduct natural interviews to collect business information.

YOUR JOB:
1. Understand what the user is saying in natural language
2. Extract information ONLY for the field that was just asked about (don't extract multiple fields from one answer)
3. Generate a friendly, conversational response
4. Always ask the next question to continue the conversation

CURRENT STATE:
- Business Type: ${context.businessType || 'Not specified'}
- Vertical: ${context.vertical}
- Completion: ${context.completionPercentage}%

DATA ALREADY COLLECTED:
${JSON.stringify(
  Object.entries(context.currentData)
    .filter(([_, v]) => v !== null && v !== undefined && v !== '')
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
  null,
  2
)}

LAST QUESTION ASKED: "${lastQuestion}"
CURRENT FIELD BEING ASKED ABOUT: ${currentField ? JSON.stringify({ fieldName: currentField, ...fieldSchema[currentField] }, null, 2) : 'None - starting conversation'}

MISSING FIELDS TO COLLECT (in order):
${JSON.stringify(
  updatedMissingFields.slice(0, 8).map(fieldName => ({
    fieldName,
    ...fieldSchema[fieldName],
  })),
  null,
  2
)}

FIELDS BEING EXTRACTED FROM THIS MESSAGE:
${JSON.stringify(quickExtraction, null, 2)}

IMPORTANT: The fields listed above in "FIELDS BEING EXTRACTED" will be filled, so DO NOT ask about them again. Move to the next missing field.

NEXT FIELD TO ASK ABOUT (after current one):
${nextFieldInfo ? JSON.stringify({ fieldName: nextField, ...nextFieldInfo }, null, 2) : 'All required fields collected'}

CRITICAL FIELD EXTRACTION RULES:
1. ONLY extract the field that matches the LAST QUESTION ASKED
2. If the last question was about employees, and user says "3", extract ONLY employeeCountTotal: 3
3. If the last question was about years, and user says "3", extract ONLY yearsInOperation: 3
4. Don't extract multiple fields from one answer - be precise
5. If user says "I run a restaurant" and last question was about business type, extract businessDescription
6. If the answer doesn't match the current question, don't extract anything (ask for clarification)
7. For revenue: Extract from formats like "$300k", "300k", "@300k", "#300k", "300000", "$300,000" - convert "k" to thousands, "m" to millions
8. For coverages: Extract from "General Liability", "GL", "Workers Comp", "WC", "BOP", etc. - return as array like ["GL", "WC"]
9. For "Do you currently have insurance?" question:
   - If user says "Yes" or "Yes, [carrier]" (e.g., "Yes, Chubb"), extract the carrier name if provided
   - If user says "No" or "I don't have insurance", don't extract anything and move to next question
10. For currentCarrier: Extract carrier name from any format - "I use Chubb", "Chubb", "I'm with State Farm", "State Farm Insurance", "Yes, Chubb", etc. Just extract the carrier name (e.g., "Chubb", "State Farm")
11. If user says "I don't know" or "I don't have insurance" for currentCarrier, don't extract anything and move to next question
11. For currentPolicyTypes: Extract as an array of coverage codes. User might say "General Liability and Workers Comp" → extract as ["GL", "WC"]. Support formats like "GL, WC, BOP" or "I have general liability and workers comp"
12. For currentPremiumTotal: Extract dollar amounts like "$5000", "$5,000 per year", "$500/month" (convert monthly to annual by multiplying by 12)
13. If user says "I don't know" for currentPremiumTotal, acknowledge and say "No problem! We'll help you find a better rate" then move to next question

HANDLING "RECOMMEND" OR "WHAT DO YOU RECOMMEND" REQUESTS:
- If user asks for recommendations (e.g., "what do you recommend", "recommend to me", "what should I get"):
  - For insurance coverages: Provide specific recommendations based on their business type
  - Example for restaurant: "For restaurants, I typically recommend General Liability (GL), Workers' Compensation (WC), and Business Owners Policy (BOP). These cover customer injuries, employee injuries, and property damage. Would you like to start with these?"
  - Extract the recommended coverages if they agree, or ask which ones they want
  - Then continue to the next question
- Don't just repeat the same question - provide helpful recommendations!

CONVERSATION RULES:
1. ALWAYS ask the next question - never just acknowledge and stop (unless 100% complete)
2. Be natural and conversational like ChatGPT
3. DON'T repeat the user's answer back to them - just acknowledge briefly and move on
4. Example: User says "3" → Response: "Perfect! How many years has your business been in operation?" (NOT "Got it! 3 employees")
5. Keep the conversation flowing - one question at a time
6. If the user's answer is unclear, ask a clarifying question
7. If user asks for recommendations, PROVIDE THEM - don't just repeat the question
8. NEVER use field names in your questions - always use human-readable text. For example, ask "What is your current carrier?" NOT "Can you tell me about currentCarrier?"
9. When asking about current carrier, use: "Do you currently have insurance? If so, what is your current carrier?" or "What is your current carrier?"

RESPONSE FORMAT (JSON only, no markdown):
{
  "message": "Your natural conversational response that includes the next question",
  "fieldUpdates": {
    "fieldName": "extracted value"
  }
}

EXAMPLES:
Last question: "What kind of business do you run?"
User: "I run a restaurant"
Response: {
  "message": "Great! How many employees does your business have?",
  "fieldUpdates": {
    "businessDescription": "restaurant"
  }
}

Last question: "How many employees does your business have?"
User: "3"
Response: {
  "message": "Perfect! How many years has your business been in operation?",
  "fieldUpdates": {
    "employeeCountTotal": 3
  }
}

Last question: "How many years has your business been in operation?"
User: "5"
Response: {
  "message": "Got it! What's your approximate annual revenue?",
  "fieldUpdates": {
    "yearsInOperation": 5
  }
}

Last question: "What's your approximate annual revenue?"
User: "@300k" or "#300k" or "300k"
Response: {
  "message": "Perfect! What types of insurance coverage are you looking for?",
  "fieldUpdates": {
    "annualRevenue": 300000
  }
}

Last question: "What types of insurance coverage are you looking for?"
User: "What do you recommend"
Response: {
  "message": "For restaurants, I typically recommend General Liability (GL), Workers' Compensation (WC), and Business Owners Policy (BOP). These cover customer injuries, employee injuries, and property damage. Would you like to start with these?",
  "fieldUpdates": {}
}

Last question: "What types of insurance coverage are you looking for?"
User: "General Liability"
Response: {
  "message": "Great! Would you like to add Workers' Compensation or a Business Owners Policy as well?",
  "fieldUpdates": {
    "desiredCoverages": ["GL"]
  }
}

SPECIAL FLOW FOR INSURANCE QUESTIONS (SPLIT INTO TWO QUESTIONS):
1. FIRST ask: "Do you currently have insurance?"
2. If user says "Yes" or "Yes, [carrier name]" (e.g., "Yes, Chubb"):
   - Extract carrier name if provided (e.g., "Chubb")
   - If carrier extracted, IMMEDIATELY ask: "Great! What types of coverage do you currently have? (e.g., General Liability, Workers Comp, BOP, Property Insurance)"
   - If no carrier in response, ask: "What is your current carrier?"
3. If user says "No" or "I don't have insurance":
   - DON'T extract currentCarrier
   - DON'T ask about policy types or premium
   - Move to next question
4. After extracting currentCarrier, IMMEDIATELY ask about currentPolicyTypes: "Great! What types of coverage do you currently have? (e.g., General Liability, Workers Comp, BOP, Property Insurance)"
5. After extracting currentPolicyTypes, IMMEDIATELY ask about currentPremiumTotal: "Perfect! How much are you currently paying for your insurance? (It's okay if you don't know)"
6. If user says "I don't know" or "I'm not sure" for premium, respond: "No problem! We'll help you find a better rate. [Next question]"
7. If user provides a premium amount, extract it and say: "Perfect! We'll help you find a better rate. [Next question]"
8. NEVER ask about currentCarrier twice - if it's already been asked, move on
9. For currentPolicyTypes, extract as an array of coverage codes (e.g., ["GL", "WC", "BOP"])

Last question: "Do you currently have insurance?"
User: "Yes, Chubb"
Response: {
  "message": "Great! What types of coverage do you currently have? (e.g., General Liability, Workers Comp, BOP, Property Insurance)",
  "fieldUpdates": {
    "currentCarrier": "Chubb"
  }
}

Last question: "Do you currently have insurance?"
User: "Yes"
Response: {
  "message": "What is your current carrier?",
  "fieldUpdates": {}
}

Last question: "Do you currently have insurance?"
User: "No"
Response: {
  "message": "[Next question based on missing fields]",
  "fieldUpdates": {}
}

Last question: "What types of coverage do you currently have?"
User: "General Liability and Workers Comp"
Response: {
  "message": "Perfect! How much are you currently paying for your insurance? (It's okay if you don't know)",
  "fieldUpdates": {
    "currentPolicyTypes": ["GL", "WC"]
  }
}

Last question: "How much are you currently paying for your insurance?"
User: "I don't know"
Response: {
  "message": "No problem! We'll help you find a better rate. [Next question based on missing fields]",
  "fieldUpdates": {}
}

Last question: "How much are you currently paying for your insurance?"
User: "$5000 per year"
Response: {
  "message": "Perfect! We'll help you find a better rate. [Next question based on missing fields]",
  "fieldUpdates": {
    "currentPremiumTotal": 5000
  }
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse JSON response
      let jsonText = responseText.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Extract JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      let response;
      try {
        response = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('JSON parse error. Raw response:', responseText);
        console.error('Parse error:', parseError);
        
        // Fallback: try to extract fields manually and generate response
        // Re-determine current field in case it wasn't set
        const fallbackCurrentField = currentField || this.determineCurrentField(lastQuestion, missingFields, fieldSchema);
        const fieldUpdates = this.fallbackExtractFields(userMessage, context, fallbackCurrentField);
        const message = this.generateFallbackResponse(userMessage, fieldUpdates, nextField, context);
        
        return {
          message,
          fieldUpdates,
        };
      }

      // Validate response
      if (!response.message) {
        console.warn('AI response missing message field:', response);
        const message = this.generateFallbackResponse(userMessage, response.fieldUpdates || {}, nextField, context);
        response.message = message;
      }

      // CRITICAL: Validate that only the current field is extracted (not multiple fields)
      if (currentField && response.fieldUpdates) {
        const extractedFieldNames = Object.keys(response.fieldUpdates);
        if (extractedFieldNames.length > 1) {
          console.warn(`AI extracted multiple fields (${extractedFieldNames.join(', ')}), but only ${currentField} was asked about. Filtering...`);
          // Only keep the field that matches the current question
          const filteredUpdates: any = {};
          if (response.fieldUpdates[currentField] !== undefined) {
            filteredUpdates[currentField] = response.fieldUpdates[currentField];
          }
          response.fieldUpdates = filteredUpdates;
        } else if (extractedFieldNames.length === 1 && extractedFieldNames[0] !== currentField) {
          console.warn(`AI extracted ${extractedFieldNames[0]} but current field is ${currentField}. Keeping extraction but may be incorrect.`);
        }
      }

      // Check if user is asking for recommendations
      const userMsgLower = userMessage.toLowerCase().trim();
      const isRecommendationRequest = userMsgLower.includes('recommend') || 
                                      userMsgLower.includes('what should') ||
                                      userMsgLower.includes('what do you suggest') ||
                                      userMsgLower.includes('suggest');
      
      // If asking for recommendations about coverages, provide them
      if (isRecommendationRequest && currentField === 'desiredCoverages') {
        const businessType = context.businessType || 'business';
        let recommendation = '';
        if (businessType === 'restaurant') {
          recommendation = 'For restaurants, I typically recommend General Liability (GL), Workers\' Compensation (WC), and Business Owners Policy (BOP). These cover customer injuries, employee injuries, and property damage. Would you like to start with these?';
        } else if (businessType === 'retail') {
          recommendation = 'For retail shops, I typically recommend General Liability (GL), Workers\' Compensation (WC), and Business Owners Policy (BOP). These cover customer injuries, employee injuries, and inventory/property damage. Would you like to start with these?';
        } else {
          recommendation = 'I typically recommend General Liability (GL), Workers\' Compensation (WC), and Business Owners Policy (BOP) for most small businesses. These provide comprehensive coverage. Would you like to start with these?';
        }
        response.message = recommendation;
        // Don't extract fields yet - wait for user to confirm
        response.fieldUpdates = {};
      }

      // Check if message is repeating the user's answer unnecessarily
      const responseMsgLower = response.message.toLowerCase();
      
      // If the response contains the exact user answer (like "Got it! restaurant" or "3 employees"), simplify it
      if (userMsgLower.length < 20 && !isRecommendationRequest && responseMsgLower.includes(userMsgLower)) {
        // Extract just the question part
        const questionMatch = response.message.match(/[.!?]\s*(.+)$/);
        if (questionMatch) {
          response.message = `Perfect! ${questionMatch[1]}`;
        } else {
          // Fallback: just use the next question
          const nextQuestion = this.getQuestionForField(nextField, context);
          response.message = `Perfect! ${nextQuestion}`;
        }
      }

      // Ensure message ends with a question if not 100% complete
      if (context.completionPercentage < 100 && !response.message.trim().endsWith('?')) {
        const fallbackQuestion = this.getQuestionForField(nextField, context);
        if (fallbackQuestion) {
          response.message += ` ${fallbackQuestion}`;
        }
      }

      // Merge quick extraction with AI extraction (AI might catch things fallback missed)
      const finalFieldUpdates = { ...quickExtraction, ...(response.fieldUpdates || {}) };
      
      // SPECIAL FLOW: Check if currentPolicyTypes was just extracted FIRST (takes priority)
      // This must be checked BEFORE currentCarrier to ensure proper flow
      const existingPolicyTypes = context.currentData.currentPolicyTypes || [];
      const hasExistingPolicyTypes = Array.isArray(existingPolicyTypes) && existingPolicyTypes.length > 0;
      const extractedPolicyTypes = finalFieldUpdates.currentPolicyTypes;
      const policyTypesJustExtracted = extractedPolicyTypes && 
                                       Array.isArray(extractedPolicyTypes) && 
                                       extractedPolicyTypes.length > 0 &&
                                       !hasExistingPolicyTypes;
      
      if (policyTypesJustExtracted) {
        // User provided policy types, so ask about premium - OVERRIDE any AI response
        response.message = `Perfect! How much are you currently paying for your insurance? (It's okay if you don't know)`;
        // Don't change fieldUpdates - keep the policy types extraction
      } else {
        // SPECIAL FLOW: Handle "Do you currently have insurance?" question
        if (currentField === 'hasCurrentInsurance') {
          const userMsgLower = userMessage.toLowerCase().trim();
          const saidNo = userMsgLower === "no" || userMsgLower === "nope" || 
                        userMsgLower.includes("i don't have") || userMsgLower.includes("i dont have") ||
                        userMsgLower.includes("none") || userMsgLower.includes("no insurance");
          
          if (saidNo) {
            // User doesn't have insurance - move to next question, skip carrier/policy/premium
            const nextQuestion = this.getQuestionForField(nextField, context);
            response.message = `Got it. ${nextQuestion}`;
            // Clear any carrier extraction that might have happened
            delete finalFieldUpdates.currentCarrier;
          } else if (finalFieldUpdates.currentCarrier) {
            // User said "Yes, Chubb" - carrier was extracted, ask about policy types
            response.message = `Great! What types of coverage do you currently have? (e.g., General Liability, Workers Comp, BOP, Property Insurance)`;
          } else {
            // User said "Yes" without carrier - ask for carrier
            response.message = `What is your current carrier?`;
          }
        } else {
          // SPECIAL FLOW: If currentCarrier was just extracted and user didn't say "I don't know",
          // automatically ask about current policy types first, then premium
          // Check if carrier was just extracted (exists in updates but not in current data)
          const carrierJustExtracted = finalFieldUpdates.currentCarrier && 
                                       (!context.currentData.currentCarrier || context.currentData.currentCarrier === '');
          
          if (carrierJustExtracted) {
            const userMsgLower = userMessage.toLowerCase().trim();
            const saidDontKnow = userMsgLower.includes("don't know") || userMsgLower.includes("dont know") || 
                                userMsgLower.includes("no idea") || userMsgLower.includes("not sure") ||
                                userMsgLower.includes("i don't have") || userMsgLower.includes("i dont have") ||
                                userMsgLower.includes("none") || userMsgLower.includes("no carrier") ||
                                userMsgLower.includes("no insurance");
            
            if (!saidDontKnow) {
              // User provided a carrier, so ask about current policy types first
              response.message = `Great! What types of coverage do you currently have? (e.g., General Liability, Workers Comp, BOP, Property Insurance)`;
              // Don't change fieldUpdates - keep the carrier extraction
            }
          }
        }
      }
      
      // SPECIAL FLOW: If currentPremiumTotal was just asked about and user said "I don't know",
      // acknowledge and move on
      if (currentField === 'currentPremiumTotal') {
        const userMsgLower = userMessage.toLowerCase().trim();
        const saidDontKnow = userMsgLower.includes("don't know") || userMsgLower.includes("dont know") || 
                            userMsgLower.includes("no idea") || userMsgLower.includes("not sure") ||
                            userMsgLower.includes("unsure") || userMsgLower.includes("i'm not sure");
        
        if (saidDontKnow && !finalFieldUpdates.currentPremiumTotal) {
          // User doesn't know premium - acknowledge and move to next question
          const nextQuestion = this.getQuestionForField(nextField, context);
          response.message = `No problem! We'll help you find a better rate. ${nextQuestion}`;
        } else if (finalFieldUpdates.currentPremiumTotal) {
          // User provided premium - acknowledge and move to next question
          const nextQuestion = this.getQuestionForField(nextField, context);
          response.message = `Perfect! We'll help you find a better rate. ${nextQuestion}`;
        }
      }
      
      return {
        message: response.message,
        fieldUpdates: finalFieldUpdates,
      };
    } catch (error) {
      console.error('Error processing with unified AI:', error);
      console.error('User message was:', userMessage);
      console.error('Error details:', error instanceof Error ? error.message : error);
      
      // Fallback extraction and response
      const lastQuestion = conversationHistory
        .filter(m => m.role === 'assistant')
        .slice(-1)[0]?.content || '';
      const currentField = this.determineCurrentField(lastQuestion, context.missingFields || [], fieldSchema);
      const fieldUpdates = this.fallbackExtractFields(userMessage, context, currentField);
      const message = this.generateFallbackResponse(userMessage, fieldUpdates, nextField, context);
      
      return {
        message,
        fieldUpdates,
      };
    }
  }

  /**
   * Determine which field the last question was asking about
   */
  private determineCurrentField(lastQuestion: string, missingFields: string[], fieldSchema: any): string | null {
    if (!lastQuestion) return missingFields[0] || null;

    const questionLower = lastQuestion.toLowerCase();

    // Match question patterns to fields
    if (questionLower.includes('business') && questionLower.includes('run') || questionLower.includes('kind of business')) {
      return 'businessDescription';
    }
    if (questionLower.includes('employee')) {
      return 'employeeCountTotal';
    }
    if (questionLower.includes('year') && (questionLower.includes('operation') || questionLower.includes('business'))) {
      return 'yearsInOperation';
    }
    if (questionLower.includes('revenue') || questionLower.includes('sales')) {
      return 'annualRevenue';
    }
    if (questionLower.includes('coverage') || questionLower.includes('insurance')) {
      return 'desiredCoverages';
    }
    if (questionLower.includes('do you currently have insurance') && !questionLower.includes('carrier')) {
      return 'hasCurrentInsurance';
    }
    if (questionLower.includes('current carrier') || questionLower.includes('what is your current carrier') ||
        questionLower.includes('who is your') && questionLower.includes('carrier') ||
        questionLower.includes('which carrier') || questionLower.includes('what carrier')) {
      return 'currentCarrier';
    }
    if (questionLower.includes('current premium') || questionLower.includes('current quote') || 
        questionLower.includes('how much') && (questionLower.includes('premium') || questionLower.includes('pay'))) {
      return 'currentPremiumTotal';
    }
    if (questionLower.includes('current coverage') || questionLower.includes('current policy') ||
        questionLower.includes('types of coverage') && questionLower.includes('currently have') ||
        questionLower.includes('what types') && questionLower.includes('currently')) {
      return 'currentPolicyTypes';
    }
    if (questionLower.includes('funding') || questionLower.includes('loan amount')) {
      return 'amountRequested';
    }
    if (questionLower.includes('purpose')) {
      return 'fundingPurpose';
    }

    // Default to first missing field
    return missingFields[0] || null;
  }

  /**
   * Fallback field extraction when LLM fails - only extract for the current field
   */
  private fallbackExtractFields(userMessage: string, context: any, currentField: string | null): any {
    const msg = userMessage.toLowerCase().trim();
    const updates: any = {};

    // Only extract for the current field being asked about
    if (!currentField) {
      // If no current field, try to infer from message content
      if (msg.includes('restaurant') || msg.includes('cafe') || msg.includes('bakery') || msg.includes('retail') || msg.includes('shop') || msg.includes('store')) {
        updates.businessDescription = userMessage;
      }
      return updates;
    }

    // Extract based on the specific field being asked
    switch (currentField) {
      case 'businessDescription':
        if (msg.includes('restaurant') || msg.includes('cafe') || msg.includes('bakery') || 
            msg.includes('retail') || msg.includes('shop') || msg.includes('store') ||
            msg.includes('contractor') || msg.includes('construction') || msg.length > 5) {
          updates.businessDescription = userMessage;
        }
        break;

      case 'employeeCountTotal':
        const employeeMatch = userMessage.match(/(\d+)\s*(?:employees?|workers?|people|staff)/i);
        if (employeeMatch) {
          updates.employeeCountTotal = parseInt(employeeMatch[1]);
        } else if (/^\s*\d+\s*$/.test(userMessage)) {
          // Standalone number when asking about employees
          updates.employeeCountTotal = parseInt(userMessage.trim());
        }
        break;

      case 'yearsInOperation':
        const yearsMatch = userMessage.match(/(\d+)\s*(?:years?|yrs?)/i);
        if (yearsMatch) {
          updates.yearsInOperation = parseInt(yearsMatch[1]);
        } else if (/^\s*\d+\s*$/.test(userMessage)) {
          // Standalone number when asking about years
          updates.yearsInOperation = parseInt(userMessage.trim());
        }
        break;

      case 'annualRevenue':
        // Handle various formats: $300k, 300k, @300k, #300k, 300000, $300,000, etc.
        // Remove any non-digit, non-letter characters except $, @, #, k, m
        const cleanedMsg = userMessage.replace(/[^\d$@#kmKM]/g, '');
        const revenueMatch = cleanedMsg.match(/(?:[$@#])?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(million|mil|m|k|thousand)?/i) || 
                            userMessage.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(million|mil|m|k|thousand|K|M)/i);
        if (revenueMatch) {
          let amount = parseFloat(revenueMatch[1].replace(/,/g, ''));
          const unit = revenueMatch[2]?.toLowerCase();
          if (unit === 'million' || unit === 'mil' || unit === 'm' || unit === 'M') {
            amount *= 1000000;
          } else if (unit === 'k' || unit === 'K' || unit === 'thousand') {
            amount *= 1000;
          }
          // Also check if it's just a number that looks like revenue (e.g., 300000 = 300k)
          if (!unit && amount >= 100000) {
            // Assume it's already in dollars
          } else if (!unit && amount < 100000 && amount >= 10) {
            // Could be in thousands, but be conservative - only if it's clearly revenue context
            // For now, assume it's already in the right unit
          }
          if (amount >= 10000) {
            updates.annualRevenue = amount;
          }
        }
        break;

      case 'desiredCoverages':
        const coverages: string[] = [];
        if (msg.includes('general liability') || msg.includes('gl')) coverages.push('GL');
        if (msg.includes('workers comp') || msg.includes('wc')) coverages.push('WC');
        if (msg.includes('bop') || msg.includes('business owners')) coverages.push('BOP');
        if (coverages.length > 0) {
          updates.desiredCoverages = coverages;
        }
        break;

      case 'hasCurrentInsurance':
        // Handle "Do you currently have insurance?" question
        // Check for "No" first
        if (msg === "no" || msg === "nope" || msg.includes("i don't have") || msg.includes("i dont have") ||
            msg.includes("none") || msg.includes("no insurance") || msg.includes("don't have insurance")) {
          // User doesn't have insurance - return empty updates, skip carrier/policy/premium questions
          return updates; // Let AI handle the response and move to next question
        }
        
        // If user says "Yes" or "Yes, [carrier]", extract carrier if provided
        if (msg.startsWith("yes") || msg.startsWith("yeah") || msg.startsWith("yep") || msg.startsWith("yup")) {
          // Try to extract carrier name from "Yes, Chubb" format
          const yesCarrierMatch = userMessage.match(/yes,?\s+(.+)/i);
          if (yesCarrierMatch && yesCarrierMatch[1]) {
            const carrierPart = yesCarrierMatch[1].trim();
            // Try to extract carrier name
            const commonCarriers = [
              'chubb', 'state farm', 'allstate', 'geico', 'progressive', 'farmers',
              'liberty mutual', 'travelers', 'nationwide', 'hartford', 'aig', 'zurich',
              'hiscox', 'cna', 'markel', 'usaa', 'american family', 'erie', 'safeco'
            ];
            
            let extractedCarrier: string | null = null;
            const carrierPartLower = carrierPart.toLowerCase();
            
            for (const carrier of commonCarriers) {
              if (carrierPartLower.includes(carrier.toLowerCase())) {
                extractedCarrier = carrier.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                break;
              }
            }
            
            // If not found in common list, use the carrier part as-is (if it's short)
            if (!extractedCarrier && carrierPart.length < 50 && !carrierPart.includes('?')) {
              extractedCarrier = carrierPart;
            }
            
            if (extractedCarrier) {
              updates.currentCarrier = extractedCarrier;
            }
          }
          // If just "Yes" without carrier, don't extract anything - AI will ask for carrier
        }
        break;

      case 'currentCarrier':
        // Check for "I don't know" or "don't have insurance" FIRST
        if (msg.includes("don't know") || msg.includes("dont know") || msg.includes("no idea") || 
            msg.includes("not sure") || msg.includes("i don't have") || msg.includes("i dont have") ||
            msg.includes("none") || msg.includes("no carrier") || msg.includes("no insurance") ||
            msg === "no" || msg === "nope") {
          // User doesn't have a carrier - return empty updates, don't extract anything
          return updates; // Return empty updates, let AI handle the response and move to next question
        }
        
        // Extract carrier name from various formats
        // Common insurance carriers
        const carrierPatterns = [
          /(?:i use|i have|i'm with|with|carrier is|insurance is|my carrier|my insurance)\s+([A-Z][A-Za-z\s&]+?)(?:\s|$|\.|,)/i,
          /(?:chubb|state farm|allstate|geico|progressive|farmers|liberty mutual|travelers|nationwide|hartford|aig|zurich|hiscox|cna|markel)/i,
        ];
        
        // Try to match common carrier names
        const commonCarriers = [
          'chubb', 'state farm', 'allstate', 'geico', 'progressive', 'farmers',
          'liberty mutual', 'travelers', 'nationwide', 'hartford', 'aig', 'zurich',
          'hiscox', 'cna', 'markel', 'usaa', 'american family', 'erie', 'safeco'
        ];
        
        let extractedCarrier: string | null = null;
        
        // Try to find carrier name in common list
        for (const carrier of commonCarriers) {
          if (msg.includes(carrier.toLowerCase())) {
            extractedCarrier = carrier.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            break;
          }
        }
        
        // If not found in common list, try pattern matching
        if (!extractedCarrier) {
          for (const pattern of carrierPatterns) {
            const match = userMessage.match(pattern);
            if (match && match[1]) {
              extractedCarrier = match[1].trim();
              // Clean up common prefixes/suffixes
              extractedCarrier = extractedCarrier.replace(/^(my|the|our|a|an)\s+/i, '');
              extractedCarrier = extractedCarrier.replace(/\s+(insurance|carrier|company)$/i, '');
              break;
            }
          }
        }
        
        // If still not found, and message is short (likely just carrier name), use the whole message
        if (!extractedCarrier && userMessage.trim().length < 50 && !msg.includes('?') && !msg.includes('how')) {
          extractedCarrier = userMessage.trim();
        }
        
        if (extractedCarrier) {
          updates.currentCarrier = extractedCarrier;
        }
        break;

      case 'currentPolicyTypes':
        // Extract policy types/coverages from various formats
        // Check for "I don't know" first
        if (msg.includes("don't know") || msg.includes("dont know") || msg.includes("no idea") || 
            msg.includes("not sure") || msg.includes("i don't know") || msg.includes("unsure")) {
          // User doesn't know - don't extract, let AI handle
          return updates;
        }
        
        const policyTypes: string[] = [];
        // Extract coverage types
        if (msg.includes('general liability') || msg.includes('gl')) policyTypes.push('GL');
        if (msg.includes('workers comp') || msg.includes('workers compensation') || msg.includes('wc')) policyTypes.push('WC');
        if (msg.includes('bop') || msg.includes('business owners policy') || msg.includes('business owners')) policyTypes.push('BOP');
        if (msg.includes('property insurance') || msg.includes('property')) policyTypes.push('PROPERTY');
        if (msg.includes('liquor liability') || msg.includes('liquor')) policyTypes.push('LIQUOR');
        if (msg.includes('professional liability') || msg.includes('e&o') || msg.includes('errors and omissions')) policyTypes.push('E&O');
        if (msg.includes('cyber liability') || msg.includes('cyber')) policyTypes.push('CYBER');
        if (msg.includes('commercial auto') || msg.includes('auto') && msg.includes('commercial')) policyTypes.push('AUTO');
        if (msg.includes('product liability') || msg.includes('product')) policyTypes.push('PRODUCT');
        if (msg.includes('builders risk') || msg.includes('builders')) policyTypes.push('BUILDERS');
        
        if (policyTypes.length > 0) {
          updates.currentPolicyTypes = policyTypes;
        } else if (userMessage.trim().length < 100) {
          // If message is short and contains common coverage terms, try to extract
          const coverageTerms = userMessage.split(/[,\s]+/).map(t => t.trim().toLowerCase());
          for (const term of coverageTerms) {
            if (term === 'gl' || term === 'general' || term === 'liability') policyTypes.push('GL');
            if (term === 'wc' || term === 'workers' || term === 'comp') policyTypes.push('WC');
            if (term === 'bop') policyTypes.push('BOP');
          }
          if (policyTypes.length > 0) {
            updates.currentPolicyTypes = [...new Set(policyTypes)]; // Remove duplicates
          }
        }
        break;

      case 'currentPremiumTotal':
        // Extract premium amount - handle various formats
        // Check for "I don't know" first
        if (msg.includes("don't know") || msg.includes("dont know") || msg.includes("no idea") || 
            msg.includes("not sure") || msg.includes("i don't know") || msg.includes("unsure")) {
          // User doesn't know - don't extract, let AI handle
          return updates;
        }
        
        // Extract dollar amounts
        const premiumMatch = userMessage.match(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:per\s+)?(?:year|annual|month|monthly)?/i);
        if (premiumMatch) {
          let amount = parseFloat(premiumMatch[1].replace(/,/g, ''));
          // If it's monthly, multiply by 12
          if (msg.includes('month') || msg.includes('monthly')) {
            amount *= 12;
          }
          if (amount > 0) {
            updates.currentPremiumTotal = amount;
          }
        }
        break;
    }

    return updates;
  }

  /**
   * Generate fallback response when LLM fails - don't repeat user's answer
   */
  private generateFallbackResponse(userMessage: string, extractedFields: any, nextField: string | null, context: any): string {
    const hasExtractedFields = Object.keys(extractedFields).length > 0;
    const nextQuestion = this.getQuestionForField(nextField, context);
    
    if (hasExtractedFields) {
      // Just acknowledge briefly and move to next question - don't repeat the answer
      return `Perfect! ${nextQuestion}`;
    } else {
      // No fields extracted - ask clarifying question or move to next
      return `I understand. ${nextQuestion}`;
    }
  }

  /**
   * Get question for a specific field
   */
  private getQuestionForField(fieldName: string | null, context: any): string {
    if (!fieldName) {
      return 'Is there anything else you\'d like to add?';
    }

    const questions: Record<string, string> = {
      businessDescription: 'What kind of business do you run?',
      employeeCountTotal: 'How many employees does your business have?',
      yearsInOperation: 'How many years has your business been in operation?',
      annualRevenue: 'What\'s your approximate annual revenue?',
      desiredCoverages: 'What types of insurance coverage are you looking for? (e.g., General Liability, Workers Comp, BOP)',
      currentCarrier: 'What is your current carrier?',
      hasCurrentInsurance: 'Do you currently have insurance?',
      currentPremiumTotal: 'How much are you currently paying for your insurance? (It\'s okay if you don\'t know)',
      currentPolicyTypes: 'What types of coverage do you currently have? (e.g., General Liability, Workers Comp, BOP, Property Insurance)',
      amountRequested: 'How much funding are you looking for?',
      fundingPurpose: 'What will you use this funding for?',
      seatingCapacity: 'How many seats does your restaurant have?',
      servesAlcohol: 'Do you serve alcohol?',
      inventoryValue: 'What\'s the approximate value of your inventory?',
    };

    return questions[fieldName] || `Can you tell me about ${fieldName}?`;
  }

  /**
   * Build comprehensive context for AI
   */
  private buildContext(session: any): any {
    const lead = session.lead || {};
    const answered = this.getAnsweredQuestions(lead);

    // Get all fields that need to be collected
    const requiredFields = this.getAllRequiredFields(session.vertical, session.businessType);
    const missingFields = requiredFields.filter(field => !answered[field.name]);

    return {
      vertical: session.vertical,
      businessType: session.businessType,
      currentData: {
        businessDescription: lead.businessDescription,
        employeeCountTotal: lead.employeeCountTotal,
        yearsInOperation: lead.yearsInOperation,
        annualRevenue: lead.annualRevenue ? Number(lead.annualRevenue) : null,
        // Insurance fields
        currentCarrier: lead.currentCarrier,
        currentPolicyTypes: lead.currentPolicyTypes || [],
        desiredCoverages: lead.desiredCoverages || [],
        currentPremiumTotal: lead.currentPremiumTotal ? Number(lead.currentPremiumTotal) : null,
        claimsPast3YearsCount: lead.claimsPast3YearsCount,
        // Restaurant fields
        seatingCapacity: lead.seatingCapacity,
        servesAlcohol: lead.servesAlcohol,
        alcoholRevenuePercent: lead.alcoholRevenuePercent ? Number(lead.alcoholRevenuePercent) : null,
        deliveryOrCatering: lead.deliveryOrCatering,
        cookingMethods: lead.cookingMethods,
        // Retail fields
        inventoryValue: lead.inventoryValue ? Number(lead.inventoryValue) : null,
        securitySystems: lead.securitySystems,
        // Lending fields
        fundingPurpose: lead.fundingPurpose,
        amountRequested: lead.amountRequested ? Number(lead.amountRequested) : null,
        desiredTermMonths: lead.desiredTermMonths,
        averageBankBalance: lead.averageBankBalance ? Number(lead.averageBankBalance) : null,
      },
      answeredFields: Object.keys(answered).filter(key => answered[key]),
      missingFields: missingFields.map(f => f.name),
      completionPercentage: lead.completionPercentage || 0,
    };
  }

  /**
   * Get all required fields for a vertical and business type
   */
  private getAllRequiredFields(vertical: string, businessType: string | null): Array<{ name: string; label: string; type: string; required: boolean }> {
    const baseFields = [
      { name: 'businessDescription', label: 'Business Description', type: 'text', required: true },
      { name: 'employeeCountTotal', label: 'Employee Count', type: 'number', required: true },
      { name: 'yearsInOperation', label: 'Years in Operation', type: 'number', required: true },
      { name: 'annualRevenue', label: 'Annual Revenue', type: 'decimal', required: true },
    ];

    if (vertical === 'insurance') {
      const insuranceFields = [
        { name: 'desiredCoverages', label: 'Desired Coverages', type: 'array', required: true },
        { name: 'hasCurrentInsurance', label: 'Has Current Insurance', type: 'boolean', required: false },
        { name: 'currentCarrier', label: 'Current Insurance Carrier', type: 'string', required: false },
        { name: 'currentPolicyTypes', label: 'Current Policy Types', type: 'array', required: false },
        { name: 'currentPremiumTotal', label: 'Current Premium', type: 'decimal', required: false },
        { name: 'claimsPast3YearsCount', label: 'Claims Past 3 Years', type: 'number', required: false },
      ];

      if (businessType === 'restaurant') {
        return [
          ...baseFields,
          ...insuranceFields,
          { name: 'seatingCapacity', label: 'Seating Capacity', type: 'number', required: false },
          { name: 'servesAlcohol', label: 'Serves Alcohol', type: 'boolean', required: false },
          { name: 'alcoholRevenuePercent', label: 'Alcohol Revenue %', type: 'decimal', required: false },
          { name: 'deliveryOrCatering', label: 'Delivery or Catering', type: 'boolean', required: false },
          { name: 'cookingMethods', label: 'Cooking Methods', type: 'text', required: false },
        ];
      }

      if (businessType === 'retail') {
        return [
          ...baseFields,
          ...insuranceFields,
          { name: 'inventoryValue', label: 'Inventory Value', type: 'decimal', required: false },
          { name: 'securitySystems', label: 'Security Systems', type: 'text', required: false },
          { name: 'onsiteCustomersPerDayEstimate', label: 'Customers Per Day', type: 'number', required: false },
        ];
      }

      return [...baseFields, ...insuranceFields];
    } else {
      // Lending
      return [
        ...baseFields,
        { name: 'amountRequested', label: 'Loan Amount Requested', type: 'decimal', required: true },
        { name: 'fundingPurpose', label: 'Funding Purpose', type: 'text', required: true },
        { name: 'desiredTermMonths', label: 'Desired Term (Months)', type: 'number', required: false },
        { name: 'averageBankBalance', label: 'Average Bank Balance', type: 'decimal', required: false },
        { name: 'creditScoreRangeSelfReported', label: 'Credit Score Range', type: 'string', required: false },
      ];
    }
  }

  /**
   * Get field schema for AI understanding
   */
  private getFieldSchemaForVertical(vertical: string, businessType: string | null): any {
    const fields = this.getAllRequiredFields(vertical, businessType);
    
    return fields.reduce((acc, field) => {
      acc[field.name] = {
        label: field.label,
        type: field.type,
        required: field.required,
        description: this.getFieldDescription(field.name, vertical, businessType),
      };
      return acc;
    }, {} as any);
  }

  /**
   * Get human-readable description for a field
   */
  private getFieldDescription(fieldName: string, vertical: string, businessType: string | null): string {
    const descriptions: Record<string, string> = {
      businessDescription: 'What kind of business they run (e.g., restaurant, retail shop, contractor)',
      employeeCountTotal: 'Total number of employees (full-time, part-time, seasonal)',
      yearsInOperation: 'How many years the business has been operating',
      annualRevenue: 'Approximate annual gross revenue or sales',
      desiredCoverages: 'Types of insurance coverage needed (e.g., GL, WC, BOP)',
      currentCarrier: 'Current insurance company name (if they have insurance)',
      currentPolicyTypes: 'Current insurance policy types they have',
      currentPremiumTotal: 'Current annual insurance premium amount',
      claimsPast3YearsCount: 'Number of insurance claims in past 3 years',
      seatingCapacity: 'Number of seats in the restaurant',
      servesAlcohol: 'Whether the restaurant serves alcohol (true/false)',
      alcoholRevenuePercent: 'Percentage of revenue from alcohol sales',
      deliveryOrCatering: 'Whether they offer delivery or catering (true/false)',
      cookingMethods: 'Cooking methods used (e.g., fryers, open flame, grill)',
      inventoryValue: 'Approximate value of inventory',
      securitySystems: 'Security systems in place (e.g., alarms, cameras)',
      onsiteCustomersPerDayEstimate: 'Estimated number of customers per day',
      amountRequested: 'Loan amount they are requesting',
      fundingPurpose: 'What they will use the funding for (e.g., working capital, inventory, expansion)',
      desiredTermMonths: 'Desired loan term in months',
      averageBankBalance: 'Average bank account balance',
      creditScoreRangeSelfReported: 'Self-reported credit score range',
    };

    return descriptions[fieldName] || `Field: ${fieldName}`;
  }

  private getAnsweredQuestions(lead: any): any {
    if (!lead) {
      return {};
    }

    const answered: any = {};
    const fields = [
      'businessDescription',
      'employeeCountTotal',
      'yearsInOperation',
      'annualRevenue',
      'desiredCoverages',
      'amountRequested',
      'currentCarrier',
      'currentPolicyTypes',
      'currentPremiumTotal',
      'hasCurrentInsurance', // Add this to track if insurance question was asked
      'seatingCapacity',
      'servesAlcohol',
      'inventoryValue',
      'fundingPurpose',
    ];

    for (const field of fields) {
      const value = lead[field];
      if (Array.isArray(value)) {
        answered[field] = value.length > 0;
      } else if (typeof value === 'boolean') {
        answered[field] = value !== null && value !== undefined;
      } else {
        answered[field] = value !== null && value !== undefined && value !== '';
      }
    }

    // Special handling: If currentCarrier exists, mark hasCurrentInsurance as answered
    if (answered.currentCarrier) {
      answered.hasCurrentInsurance = true;
    }
    // If user said "No" to insurance, mark hasCurrentInsurance as answered (we track this via currentCarrier being null but question was asked)
    // We'll track this via conversation history check instead

    return answered;
  }

  private calculateCompletion(lead: any, newUpdates: any, vertical: string): number {
    const updatedLead = { ...lead, ...newUpdates };
    const requiredFields = this.getRequiredFieldsForVertical(vertical);
    const filled = requiredFields.filter((field) => {
      const value = updatedLead[field];
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== null && value !== undefined && value !== '';
    }).length;
    return Math.round((filled / requiredFields.length) * 100);
  }

  private getRequiredFieldsForVertical(vertical: string): string[] {
    const baseFields = [
      'businessDescription',
      'employeeCountTotal',
      'yearsInOperation',
      'annualRevenue',
    ];
    if (vertical === 'insurance') {
      return [...baseFields, 'desiredCoverages'];
    } else {
      return [...baseFields, 'amountRequested'];
    }
  }

  private async updateLeadFields(leadId: string, fieldUpdates: any) {
    const updateData: any = {};
    
    for (const [key, value] of Object.entries(fieldUpdates)) {
      if (value !== null && value !== undefined) {
        // Handle array fields
        if (key === 'desiredCoverages' || key === 'currentPolicyTypes') {
          // If it's already an array, use it; otherwise convert to array
          if (Array.isArray(value)) {
            updateData[key] = value;
          } else {
            // If it's a string like "GL" or "General Liability", extract the code
            const str = String(value).toLowerCase();
            const coverageMap: Record<string, string> = {
              'general liability': 'GL',
              'gl': 'GL',
              'workers comp': 'WC',
              'workers compensation': 'WC',
              'wc': 'WC',
              'business owners policy': 'BOP',
              'bop': 'BOP',
            };
            const code = coverageMap[str] || str.toUpperCase();
            updateData[key] = [code];
          }
        } else if (key === 'annualRevenue') {
          // Ensure revenue is a number (should already be normalized, but double-check)
          if (typeof value === 'string') {
            const num = parseFloat(value.replace(/[^\d.]/g, ''));
            if (!isNaN(num)) {
              updateData[key] = num;
            }
          } else {
            updateData[key] = value;
          }
        } else {
          updateData[key] = value;
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: updateData,
      });
    }
  }
}
