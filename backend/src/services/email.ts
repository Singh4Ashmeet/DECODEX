import nodemailer from 'nodemailer';
import CircuitBreaker from 'opossum';
import fs from 'fs';
import path from 'path';

// Support configurable SMTP — defaults to Gmail, but can be overridden
// with SMTP_HOST / SMTP_PORT / SMTP_SECURE for local dev (e.g. Mailpit).
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT) || 465;
const smtpSecure = process.env.SMTP_SECURE !== 'false';

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: process.env.GMAIL_USER || '',
    pass: process.env.GMAIL_APP_PASSWORD || '',
  },
});

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

const EMAIL_LOG_DIR = path.join(__dirname, '..', '..', 'email-captures');

const deliverEmail = async (message: EmailMessage): Promise<void> => {
  // Always log email to disk for local dev / test inspection
  try {
    if (!fs.existsSync(EMAIL_LOG_DIR)) {
      fs.mkdirSync(EMAIL_LOG_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${message.to.replace(/[^a-zA-Z0-9@.]/g, '_')}.json`;
    fs.writeFileSync(
      path.join(EMAIL_LOG_DIR, filename),
      JSON.stringify({ from: process.env.GMAIL_USER || 'no-reply@decodex.local', ...message, capturedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
    console.log(`[EmailCapture] Email logged to ${filename}`);
  } catch (logErr) {
    console.warn('[EmailCapture] Failed to log email to disk:', logErr);
  }

  // Validate SMTP credentials before attempting delivery
  const smtpUser = process.env.GMAIL_USER || '';
  const smtpPass = process.env.GMAIL_APP_PASSWORD || '';
  if (!smtpUser || !smtpPass) {
    console.error('[Email] SMTP credentials not configured — GMAIL_USER and/or GMAIL_APP_PASSWORD are missing. ' +
      'Email will NOT be delivered. Set these in your Render environment.');
    throw new Error('SMTP credentials not configured (GMAIL_USER / GMAIL_APP_PASSWORD)');
  }

  await transporter.sendMail({
    from: smtpUser,
    ...message,
  });
};

const emailBreaker = new CircuitBreaker(deliverEmail, {
  timeout: 15000,
  errorThresholdPercentage: 50,
  resetTimeout: 60000,
  volumeThreshold: 3,
});

// Log the actual SMTP error when the circuit opens or a call fails
emailBreaker.on('open', () => {
  console.error('[Email] Circuit breaker OPEN — SMTP is failing. Emails will be blocked until the circuit half-opens.');
});
emailBreaker.on('halfOpen', () => {
  console.log('[Email] Circuit breaker half-open — testing SMTP connection.');
});
emailBreaker.on('close', () => {
  console.log('[Email] Circuit breaker closed — SMTP is healthy.');
});
emailBreaker.on('failure', (err: Error) => {
  console.error('[Email] SMTP send failed:', {
    message: err?.message,
    stack: err?.stack?.split('\n').slice(0, 3).join(' | '),
    timestamp: new Date().toISOString(),
  });
});

emailBreaker.fallback(() => {
  // The fallback runs when the circuit is open or the call times out.
  // Re-throw so callers know the email was NOT delivered.
  // (The actual error was already logged by the 'failure' event handler above.)
  throw new Error('[Email] Delivery failed — circuit breaker fallback');
});

const sendEmail = async (message: EmailMessage): Promise<void> => {
  await emailBreaker.fire(message);
};

export const sendConsentEmail = async (to: string, token: string, studentName: string): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const consentLink = frontendUrl + '/consent/' + token;

  await sendEmail({
    to,
    subject: 'Parental consent needed for Decodex',
    text: [
      'Hello,',
      '',
      'Decodex is an educational reading platform that helps students practise and understand reading patterns.',
      '',
      studentName + "'s account needs your consent before voice recording can be used. Decodex retains the recorded audio to allow you to review " + studentName + "'s reading progress over time. You may request deletion of this data at any time by contacting Decodex support or withdrawing consent.",
      '',
      'Review the consent information and verify your relationship here:',
      consentLink,
      '',
      'If you did not expect this email, you can ignore it.',
    ].join('\n'),
  });
};

export const sendConsentWithdrawalEmail = async (to: string, studentName: string): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Consent withdrawn for ' + studentName + "'s Decodex account",
    text: [
      'Hello,',
      '',
      "Your consent for " + studentName + "'s Decodex account has been withdrawn.",
      'Voice recording is now disabled for this account.',
      '',
      'Stored reading data will be deleted in 30 days unless another parent has active consent for the account.',
      '',
      'You can contact the school or Decodex support if you have questions.',
    ].join('\n'),
  });
};

export const sendDataDeletionEmail = async (to: string, studentName: string): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Reading data deleted for ' + studentName + "'s Decodex account",
    text: [
      'Hello,',
      '',
      "The stored reading data for " + studentName + "'s Decodex account has been deleted following the consent withdrawal.",
      'The student account and consent record remain available for account management and compliance purposes.',
      '',
      'You can contact the school or Decodex support if you have questions.',
    ].join('\n'),
  });
};

export const sendConsentRenewalEmail = async (to: string, studentName: string): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const consentLink = frontendUrl + '/consent/renew';

  await sendEmail({
    to,
    subject: 'Consent renewal needed for ' + studentName + "'s Decodex account",
    text: [
      'Hello,',
      '',
      'Your parental consent for ' + studentName + "'s Decodex account is expiring soon.",
      'Consent must be renewed annually to continue using voice recording features.',
      '',
      'Please click the link below to renew consent:',
      consentLink,
      '',
      'If you have questions, contact the school or Decodex support.',
      '',
      'If you no longer wish to use Decodex, you can ignore this email.',
    ].join('\n'),
  });
};

export const sendPasswordResetEmail = async (to: string, token: string): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = frontendUrl + '/set-password/' + token;

  await sendEmail({
    to,
    subject: 'Set your password for Decodex parent account',
    text: [
      'Hello,',
      '',
      'A Decodex parent account has been created for you using this email address.',
      '',
      'Click the link below to set your password and access your account:',
      resetLink,
      '',
      'This link expires in 24 hours.',
      '',
      'If you did not expect this email, you can ignore it.',
    ].join('\n'),
  });
};
