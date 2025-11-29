import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FieldExtractionService } from '../src/email-intake/field-extraction.service';
import { EmailListenerService } from '../src/email-intake/email-listener.service';
import { DocumentClassifierService } from '../src/email-intake/document-classifier.service';
import { MinioService } from '../src/files/minio.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

async function testSubmissionExtraction() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const extractionService = app.get(FieldExtractionService);
  const emailListener = app.get(EmailListenerService);
  const docClassifier = app.get(DocumentClassifierService);
  const minioService = app.get(MinioService);

  const testDir = path.join(__dirname, '../test-submissions');
  
  // Find .eml file or email text file
  const emlFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.eml'));
  const emailTextFiles = fs.readdirSync(testDir).filter(f => 
    f.toLowerCase().includes('email') && (f.endsWith('.txt') || f.endsWith('.eml'))
  );
  
  let emailData: any;
  
  if (emlFiles.length > 0) {
    // Parse .eml file
    const emlFile = path.join(testDir, emlFiles[0]);
    console.log(`Processing .eml file: ${emlFiles[0]}\n`);
    const emlBuffer = fs.readFileSync(emlFile);
    emailData = await emailListener.parseAndStoreEml(emlBuffer);
  } else if (emailTextFiles.length > 0) {
    // Create mock email from text file and attachments
    const emailTextFile = path.join(testDir, emailTextFiles[0]);
    console.log(`Processing email text file: ${emailTextFiles[0]}\n`);
    const emailText = fs.readFileSync(emailTextFile, 'utf-8');
    
    // Parse email text to extract headers and body
    const lines = emailText.split('\n');
    let from = 'test@example.com';
    let to = 'auxoreachout@gmail.com';
    let subject = 'Test Submission';
    let body = emailText;
    
    // Try to extract headers if present
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i];
      if (line.toLowerCase().startsWith('from:')) {
        from = line.substring(5).trim();
      } else if (line.toLowerCase().startsWith('to:')) {
        to = line.substring(3).trim();
      } else if (line.toLowerCase().startsWith('subject:')) {
        subject = line.substring(8).trim();
        body = lines.slice(i + 1).join('\n');
        break;
      }
    }
    
    // Load all other files as attachments and store in MinIO
    const allFiles = fs.readdirSync(testDir).filter(f => 
      f !== emailTextFiles[0] && f !== 'README.md' && !f.startsWith('.')
    );
    
    const attachments: any[] = [];
    const minioClient = minioService.getClient();
    
    for (const file of allFiles) {
      const filePath = path.join(testDir, file);
      const content = fs.readFileSync(filePath);
      const ext = path.extname(file).toLowerCase();
      
      let contentType = 'text/plain';
      if (ext === '.pdf') contentType = 'application/pdf';
      else if (ext === '.csv') contentType = 'text/csv';
      else if (ext === '.xlsx' || ext === '.xls') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      else if (ext === '.docx' || ext === '.doc') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      
      // Generate storage key and store in MinIO
      const storageKey = `test-${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${file}`;
      await minioClient.putObject('documents', storageKey, content, content.length, {
        'Content-Type': contentType,
      });
      
      attachments.push({
        id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filename: file,
        contentType: contentType,
        size: content.length,
        storageKey: storageKey, // Required for DocumentParserService
      });
    }
    
    emailData = {
      id: `test-${Date.now()}`,
      from: from,
      to: to,
      subject: subject,
      body: body,
      receivedAt: new Date().toISOString(),
      attachments: attachments,
    };
  } else {
    console.error('No .eml file or email text file found in test-submissions folder');
    await app.close();
    return;
  }

  if (!emailData) {
    console.error('Failed to create email data');
    await app.close();
    return;
  }

  console.log('Email parsed:');
  console.log(`  From: ${emailData.from}`);
  console.log(`  Subject: ${emailData.subject}`);
  console.log(`  Attachments: ${emailData.attachments?.length || 0}\n`);

  // Classify documents
  const documentClassifications = await docClassifier.classifyAll(emailData.attachments || []);
  console.log('Document classifications:');
  for (const attachment of emailData.attachments || []) {
    const classification = documentClassifications.get(attachment.id) || 'other';
    console.log(`  ${attachment.filename}: ${classification}`);
  }
  console.log('');

  // Run extraction
  console.log('Starting field extraction...\n');
  const startTime = Date.now();
  
  try {
    const result = await extractionService.extract(emailData, documentClassifications);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n=== EXTRACTION COMPLETE (${duration}s) ===\n`);
    
    // Count extracted vs null
    const extracted = result.fieldExtractions.filter(fe => 
      fe.fieldValue !== null && fe.fieldValue !== undefined && fe.fieldValue !== ''
    );
    const nullFields = result.fieldExtractions.filter(fe => 
      fe.fieldValue === null || fe.fieldValue === undefined || fe.fieldValue === ''
    );
    
    console.log(`Total fields: ${result.fieldExtractions.length}`);
    console.log(`Extracted (non-null): ${extracted.length}`);
    console.log(`Null/Missing: ${nullFields.length}\n`);
    
    // Show extracted fields
    console.log('=== EXTRACTED FIELDS ===');
    extracted.forEach(fe => {
      console.log(`\n${fe.fieldPath}:`);
      console.log(`  Value: ${JSON.stringify(fe.fieldValue)}`);
      console.log(`  Source: ${fe.source}`);
      if (fe.llmReasoning) {
        const reasoning = fe.llmReasoning.length > 150 
          ? fe.llmReasoning.substring(0, 150) + '...'
          : fe.llmReasoning;
        console.log(`  Reasoning: ${reasoning}`);
      }
    });
    
    // Show null fields (first 20)
    console.log('\n\n=== NULL/MISSING FIELDS (first 20) ===');
    nullFields.slice(0, 20).forEach(fe => {
      console.log(`\n${fe.fieldPath}:`);
      if (fe.llmReasoning) {
        const reasoning = fe.llmReasoning.length > 150 
          ? fe.llmReasoning.substring(0, 150) + '...'
          : fe.llmReasoning;
        console.log(`  Reasoning: ${reasoning}`);
      } else {
        console.log(`  No reasoning available`);
      }
    });
    
    if (nullFields.length > 20) {
      console.log(`\n... and ${nullFields.length - 20} more null fields`);
    }
    
    // Show data structure
    console.log('\n\n=== EXTRACTED DATA STRUCTURE ===');
    console.log(JSON.stringify(result.data, null, 2));
    
  } catch (error) {
    console.error('Error during extraction:', error);
  } finally {
    await app.close();
  }
}

testSubmissionExtraction().catch(console.error);

