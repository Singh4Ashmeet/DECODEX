import nodemailer from 'nodemailer';
import CircuitBreaker from 'opossum';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
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

const deliverEmail = async (message: EmailMessage): Promise<void> => {
  await transporter.sendMail({
    from: process.env.GMAIL_USER || 'no-reply@decodex.local',
    ...message,
  });
};

const emailBreaker = new CircuitBreaker(deliverEmail, {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

emailBreaker.fallback(() => {
  console.error('Email delivery failed; the parent can try the action again later.');
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
