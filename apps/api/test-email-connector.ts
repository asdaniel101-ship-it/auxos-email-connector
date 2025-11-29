import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';
import * as path from 'path';

// Load environment variables - try multiple paths
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });
// Also try relative path
if (!process.env.EMAIL_PASSWORD) {
  dotenv.config({ path: './.env' });
}

async function testEmailConnector() {
  console.log('Testing Email Connector...\n');
  
  const emailUser = process.env.EMAIL_USER || 'auxosreachout@gmail.com';
  const emailPassword = process.env.EMAIL_PASSWORD;

  if (!emailPassword) {
    console.error('❌ ERROR: EMAIL_PASSWORD is not set in .env file');
    console.log('Please set EMAIL_PASSWORD in apps/api/.env');
    process.exit(1);
  }

  console.log(`📧 Email User: ${emailUser}`);
  console.log(`🔑 Password: ${emailPassword ? '***' + emailPassword.slice(-4) : 'NOT SET'}\n`);

  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });

  // Test connection
  console.log('🔌 Testing SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');
  } catch (error) {
    console.error('❌ SMTP connection failed:', error);
    process.exit(1);
  }

  // Send test email
  console.log('📤 Sending test email...');
  const testEmail = {
    from: emailUser,
    to: emailUser,
    subject: 'TEST EMAIL CONNECTOR - ' + new Date().toISOString(),
    text: `
This is a test email from the Auxo email connector.

If you receive this email, the email connector is working correctly!

Test Details:
- Sent at: ${new Date().toLocaleString()}
- From: ${emailUser}
- To: ${emailUser}
- Branch: test-email-connector
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { padding: 20px; background-color: #f9fafb; }
    .success { color: #10B981; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h2>✅ Email Connector Test</h2>
  </div>
  <div class="content">
    <p class="success">This is a test email from the Auxo email connector.</p>
    <p>If you receive this email, the email connector is working correctly!</p>
    <hr>
    <p><strong>Test Details:</strong></p>
    <ul>
      <li>Sent at: ${new Date().toLocaleString()}</li>
      <li>From: ${emailUser}</li>
      <li>To: ${emailUser}</li>
      <li>Branch: test-email-connector</li>
    </ul>
  </div>
</body>
</html>
    `.trim(),
  };

  try {
    const info = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}\n`);
    console.log('📬 Please check your inbox at:', emailUser);
  } catch (error) {
    console.error('❌ Failed to send test email:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
    process.exit(1);
  }
}

// Run the test
testEmailConnector()
  .then(() => {
    console.log('\n✨ Email connector test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Email connector test failed:', error);
    process.exit(1);
  });

