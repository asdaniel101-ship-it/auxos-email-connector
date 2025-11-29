import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FieldExtractionService } from '../src/email-intake/field-extraction.service';

const emailBody = `SUBJECT: New Property Submission – Greenway Plaza Retail Center – 6/15/2026



Hi Team,



Attached is a new commercial property submission for Greenway Plaza Retail Center, a multi-tenant neighborhood strip center located in Austin, TX.



Effective Date: 06/15/2026

Expiration Date: 06/15/2027

Line of Business: Commercial Property

Requested Coverage: Building, BPP for LRO items, and Loss of Rents

Requested Limit: $22,000,000 TIV

Deductible: $25,000 All Other Perils / 2% Wind/Hail / $100,000 Named Storm

Cause of Loss Form: Special



Key details:

- Single location, 11 tenants, approximately 60,000 sq ft

- Construction: Masonry non-combustible, built 2006, recent roof overlay in 2021

- Occupancy mix: restaurant, coffee shop, nail salon, dry cleaner (no on-premise cleaning), small gym, and various retail

- Sprinklered: Partial (anchor space and restaurant bays)

- Clean 5-year loss history



Attachments include:

1. ACORD 140 – Commercial Property Section

2. SOV for Greenway Plaza

3. 5-year Property loss runs

4. Lessor's Risk Only (LRO) supplemental



Please review and advise on indicative terms and any engineering requirements.



Best,

Jordan Lee

Account Executive

Lone Star Commercial Insurance`;

async function testExtraction() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const extractionService = app.get(FieldExtractionService);

  const emailData = {
    from: 'jordan.lee@lonestarinsurance.com',
    to: 'team@example.com',
    subject: 'New Property Submission – Greenway Plaza Retail Center – 6/15/2026',
    body: emailBody,
    receivedAt: new Date().toISOString(),
    attachments: [],
  };

  const documentClassifications = new Map<string, string>();

  console.log('Starting extraction test...\n');
  
  try {
    const result = await extractionService.extract(emailData, documentClassifications);
    
    console.log('\n=== EXTRACTION RESULTS ===\n');
    console.log('Extracted Data:');
    console.log(JSON.stringify(result.data, null, 2));
    
    console.log('\n\nField Extractions:');
    console.log(`Total fields: ${result.fieldExtractions.length}`);
    console.log('\nExtracted fields (non-null):');
    result.fieldExtractions
      .filter(fe => fe.fieldValue !== null && fe.fieldValue !== undefined && fe.fieldValue !== '')
      .forEach(fe => {
        console.log(`\n${fe.fieldPath}:`);
        console.log(`  Value: ${fe.fieldValue}`);
        console.log(`  Source: ${fe.source}`);
        if (fe.llmReasoning) {
          console.log(`  Reasoning: ${fe.llmReasoning.substring(0, 200)}...`);
        }
      });
    
    console.log('\n\nNull fields:');
    const nullFields = result.fieldExtractions.filter(fe => 
      fe.fieldValue === null || fe.fieldValue === undefined || fe.fieldValue === ''
    );
    console.log(`Total null fields: ${nullFields.length}`);
    nullFields.slice(0, 10).forEach(fe => {
      console.log(`  ${fe.fieldPath} - ${fe.llmReasoning ? 'Has reasoning' : 'No reasoning'}`);
    });
    if (nullFields.length > 10) {
      console.log(`  ... and ${nullFields.length - 10} more null fields`);
    }
    
  } catch (error) {
    console.error('Error during extraction:', error);
  } finally {
    await app.close();
  }
}

testExtraction().catch(console.error);

