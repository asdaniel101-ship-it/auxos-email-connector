/**
 * One-time script to mark all existing emails in the database as 'done'
 * This prevents the system from reprocessing emails that were already handled
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function markAllEmailsAsDone() {
  try {
    console.log('Starting to mark all emails as done...');

    // Get count of emails that are not 'done'
    const pendingEmails = await prisma.emailMessage.findMany({
      where: {
        processingStatus: {
          not: 'done',
        },
      },
      select: {
        id: true,
        gmailMessageId: true,
        subject: true,
        processingStatus: true,
        isSubmission: true,
      },
    });

    console.log(`Found ${pendingEmails.length} emails that are not marked as 'done'`);

    if (pendingEmails.length === 0) {
      console.log('No emails to update. All emails are already marked as done.');
      return;
    }

    // Show what we're about to update
    console.log('\nEmails to update:');
    pendingEmails.forEach((email, idx) => {
      console.log(
        `  ${idx + 1}. ${email.gmailMessageId} - "${email.subject}" - Status: ${email.processingStatus} - Submission: ${email.isSubmission}`,
      );
    });

    // Update all to 'done'
    const result = await prisma.emailMessage.updateMany({
      where: {
        processingStatus: {
          not: 'done',
        },
      },
      data: {
        processingStatus: 'done',
        errorMessage: 'Marked as done by one-time script to prevent reprocessing',
      },
    });

    console.log(`\n✓ Successfully marked ${result.count} emails as 'done'`);
    console.log('These emails will no longer be reprocessed by the system.');

    // Also mark all emails in Gmail as read (if we have access)
    console.log('\nNote: You may want to manually mark these emails as read in Gmail to keep it in sync.');
  } catch (error) {
    console.error('Error marking emails as done:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
markAllEmailsAsDone()
  .then(() => {
    console.log('\nScript completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

