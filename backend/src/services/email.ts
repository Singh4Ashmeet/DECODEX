import { Resend } from 'resend';
import CircuitBreaker from 'opossum';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Resend client — initialised lazily so tests / local dev without a key
// don't crash on import.
// ---------------------------------------------------------------------------
const resendKey = process.env.RESEND_API_KEY || '';

function getResendClient(): Resend {
  if (!resendKey) {
    throw new Error(
      'RESEND_API_KEY is not configured. Set it in your Render environment.',
    );
  }
  return new Resend(resendKey);
}

const FROM_ADDRESS = process.env.EMAIL_FROM || 'Decodex <onboarding@resend.dev>';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------
interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// ---------------------------------------------------------------------------
// Local disk capture — writes every email to email-captures/ for dev/test
// inspection.  Silently skipped in production (directory may not exist).
// ---------------------------------------------------------------------------
const EMAIL_LOG_DIR = path.join(__dirname, '..', '..', 'email-captures');

function captureToDisk(message: EmailMessage): void {
  try {
    if (!fs.existsSync(EMAIL_LOG_DIR)) {
      fs.mkdirSync(EMAIL_LOG_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${message.to.replace(/[^a-zA-Z0-9@.]/g, '_')}.json`;
    fs.writeFileSync(
      path.join(EMAIL_LOG_DIR, filename),
      JSON.stringify({ from: FROM_ADDRESS, ...message, capturedAt: new Date().toISOString() }, null, 2),
      'utf-8',
    );
    console.log(`[EmailCapture] Email logged to ${filename}`);
  } catch (logErr) {
    console.warn('[EmailCapture] Failed to log email to disk:', logErr);
  }
}

// ---------------------------------------------------------------------------
// Core delivery function — sends via Resend API.
// ---------------------------------------------------------------------------
const deliverEmail = async (message: EmailMessage): Promise<void> => {
  // Always capture locally for dev/test inspection
  captureToDisk(message);

  // Validate API key before attempting delivery
  if (!resendKey) {
    console.error(
      '[Email] RESEND_API_KEY not configured — email will NOT be delivered. ' +
      'Set it in your Render environment.',
    );
    throw new Error('RESEND_API_KEY not configured');
  }

  const resend = getResendClient();

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  if (error) {
    console.error('[Email] Resend API returned error:', JSON.stringify(error));
    throw new Error(`Resend API error: ${error.message || JSON.stringify(error)}`);
  }

  console.log('[Email] Resend accepted:', { id: data?.id, to: message.to });
};

// ---------------------------------------------------------------------------
// Circuit breaker — wraps deliverEmail so a single SMTP failure doesn't
// crash the request.  After `volumeThreshold` failures the circuit opens
// and all calls go through the fallback (which re-throws).
// ---------------------------------------------------------------------------
const emailBreaker = new CircuitBreaker(deliverEmail, {
  timeout: 15000,
  errorThresholdPercentage: 50,
  resetTimeout: 60000,
  volumeThreshold: 3,
});

emailBreaker.on('open', () => {
  console.error('[Email] Circuit breaker OPEN — email delivery is failing. Emails will be blocked until the circuit half-opens.');
});
emailBreaker.on('halfOpen', () => {
  console.log('[Email] Circuit breaker half-open — testing email delivery.');
});
emailBreaker.on('close', () => {
  console.log('[Email] Circuit breaker closed — email delivery is healthy.');
});
emailBreaker.on('failure', (err: Error) => {
  console.error('[Email] Send failed:', {
    message: err?.message,
    stack: err?.stack?.split('\n').slice(0, 3).join(' | '),
    timestamp: new Date().toISOString(),
  });
});

emailBreaker.fallback(() => {
  throw new Error('[Email] Delivery failed — circuit breaker fallback');
});

const sendEmail = async (message: EmailMessage): Promise<void> => {
  await emailBreaker.fire(message);
};

// ---------------------------------------------------------------------------
// Template imports — kept exactly as before
// ---------------------------------------------------------------------------
import {
  consentEmailHtml, consentEmailText,
  passwordResetEmailHtml, passwordResetEmailText,
  consentWithdrawalEmailHtml, consentWithdrawalEmailText,
  dataDeletionEmailHtml, dataDeletionEmailText,
  consentRenewalEmailHtml, consentRenewalEmailText,
} from './emailTemplates';

// ---------------------------------------------------------------------------
// Exported send functions — public API unchanged
// ---------------------------------------------------------------------------

export const sendConsentEmail = async (to: string, token: string, studentName: string): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const consentLink = frontendUrl + '/consent/' + token;

  await sendEmail({
    to,
    subject: 'Parental consent needed for Decodex',
    text: consentEmailText(studentName, consentLink),
    html: consentEmailHtml({ studentName, consentLink }),
  });
};

export const sendConsentWithdrawalEmail = async (to: string, studentName: string): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Consent withdrawn for ' + studentName + "'s Decodex account",
    text: consentWithdrawalEmailText(studentName),
    html: consentWithdrawalEmailHtml({ studentName }),
  });
};

export const sendDataDeletionEmail = async (to: string, studentName: string): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Reading data deleted for ' + studentName + "'s Decodex account",
    text: dataDeletionEmailText(studentName),
    html: dataDeletionEmailHtml({ studentName }),
  });
};

export const sendConsentRenewalEmail = async (to: string, studentName: string): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const renewLink = frontendUrl + '/consent/renew';

  await sendEmail({
    to,
    subject: 'Consent renewal needed for ' + studentName + "'s Decodex account",
    text: consentRenewalEmailText(studentName, renewLink),
    html: consentRenewalEmailHtml({ studentName, renewLink }),
  });
};

export const sendPasswordResetEmail = async (to: string, token: string): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = frontendUrl + '/set-password/' + token;

  await sendEmail({
    to,
    subject: 'Set your password for Decodex parent account',
    text: passwordResetEmailText(resetLink),
    html: passwordResetEmailHtml({ resetLink }),
  });
};
