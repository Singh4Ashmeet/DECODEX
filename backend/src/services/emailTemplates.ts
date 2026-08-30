/**
 * HTML email templates for Decodex transactional emails.
 *
 * All templates use:
 * - Table-based layout for maximum email client compatibility
 * - Inline styles (no <style> blocks — many clients strip them)
 * - Decodex brand colors: primary #2563EB, surface #F8FAFC
 * - Mobile-responsive via max-width on the container table
 * - Always paired with a plain-text fallback
 */

const BRAND = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  surface: '#F8FAFC',
  surfaceAlt: '#EEF2FF',
  text: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  success: '#059669',
  white: '#FFFFFF',
};

/**
 * Wraps content in the standard Decodex email shell.
 */
function shell(title: string, previewText: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(previewText)}</div>

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.surface};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <!-- Inner container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${BRAND.white};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header bar -->
          <tr>
            <td style="background-color:${BRAND.primary};padding:24px 32px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:${BRAND.white};letter-spacing:-0.01em;">Decodex</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${BRAND.border};text-align:center;">
              <p style="margin:0;font-size:12px;color:${BRAND.textMuted};line-height:1.5;">
                Decodex &mdash; Educational reading &amp; screening platform<br>
                <a href="https://decodex-mu.vercel.app/privacy" style="color:${BRAND.primary};text-decoration:none;">Privacy Policy</a>
                &nbsp;&middot;&nbsp;
                <a href="https://decodex-mu.vercel.app/terms" style="color:${BRAND.primary};text-decoration:none;">Terms of Service</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Minimal HTML escaping. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Renders a CTA button (table-based for Outlook compat). */
function ctaButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px 0;">
      <tr>
        <td style="background-color:${BRAND.primary};border-radius:10px;">
          <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:${BRAND.white};text-decoration:none;letter-spacing:0.02em;">${esc(label)}</a>
        </td>
      </tr>
    </table>`;
}

// ────────────────────────────────────────────────────────────────────────────
// Consent email
// ────────────────────────────────────────────────────────────────────────────

export interface ConsentEmailParams {
  studentName: string;
  consentLink: string;
}

export function consentEmailHtml({ studentName, consentLink }: ConsentEmailParams): string {
  return shell(
    'Parental consent needed',
    `${studentName}'s account needs your consent before voice recording can be enabled.`,
    `
    <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:${BRAND.text};">Parental Consent Required</h2>

    <p style="margin:0 0 16px 0;font-size:15px;color:${BRAND.text};line-height:1.6;">
      Hello,
    </p>

    <p style="margin:0 0 16px 0;font-size:15px;color:${BRAND.text};line-height:1.6;">
      <strong>${esc(studentName)}</strong>'s account on <strong>Decodex</strong> &mdash; an educational reading platform &mdash; needs your consent before voice recording can be enabled.
    </p>

    <!-- Info card -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;background-color:${BRAND.surfaceAlt};border-radius:10px;border-left:4px solid ${BRAND.primary};">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;color:${BRAND.text};">What you're consenting to</p>
          <ul style="margin:0;padding:0 0 0 18px;font-size:14px;color:${BRAND.textMuted};line-height:1.7;">
            <li>Voice recording during reading practice sessions</li>
            <li>Storage of audio to track reading progress over time</li>
            <li>You may withdraw consent and request data deletion at any time</li>
          </ul>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px 0;font-size:15px;color:${BRAND.text};line-height:1.6;">
      Click the button below to review the full consent information and verify your relationship:
    </p>

    ${ctaButton(consentLink, 'Review & Verify Consent')}

    <p style="margin:16px 0 0 0;font-size:13px;color:${BRAND.textMuted};line-height:1.5;">
      Or copy this link:<br>
      <a href="${esc(consentLink)}" style="color:${BRAND.primary};word-break:break-all;text-decoration:none;">${esc(consentLink)}</a>
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0 0 0;border-top:1px solid ${BRAND.border};">
      <tr>
        <td style="padding:16px 0 0 0;">
          <p style="margin:0;font-size:13px;color:${BRAND.textMuted};line-height:1.5;">
            If you did not expect this email, you can safely ignore it.
          </p>
        </td>
      </tr>
    </table>
    `
  );
}

export function consentEmailText(studentName: string, consentLink: string): string {
  return [
    `Hello,`,
    ``,
    `${studentName}'s account on Decodex needs your consent before voice recording can be enabled.`,
    ``,
    `Decodex is an educational reading platform that helps students practise and understand reading patterns.`,
    ``,
    `What you're consenting to:`,
    `  • Voice recording during reading practice sessions`,
    `  • Storage of audio to track reading progress over time`,
    `  • You may withdraw consent and request data deletion at any time`,
    ``,
    `Review the consent information and verify your relationship here:`,
    consentLink,
    ``,
    `If you did not expect this email, you can safely ignore it.`,
  ].join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// Password reset / set password email
// ────────────────────────────────────────────────────────────────────────────

export interface PasswordResetEmailParams {
  resetLink: string;
}

export function passwordResetEmailHtml({ resetLink }: PasswordResetEmailParams): string {
  return shell(
    'Set your password',
    'A Decodex parent account has been created for you. Set your password to get started.',
    `
    <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:${BRAND.text};">Set Your Password</h2>

    <p style="margin:0 0 16px 0;font-size:15px;color:${BRAND.text};line-height:1.6;">
      Hello,
    </p>

    <p style="margin:0 0 16px 0;font-size:15px;color:${BRAND.text};line-height:1.6;">
      A <strong>Decodex parent account</strong> has been created for you. Click the button below to set your password and access your dashboard.
    </p>

    ${ctaButton(resetLink, 'Set Your Password')}

    <p style="margin:16px 0 0 0;font-size:13px;color:${BRAND.textMuted};line-height:1.5;">
      Or copy this link:<br>
      <a href="${esc(resetLink)}" style="color:${BRAND.primary};word-break:break-all;text-decoration:none;">${esc(resetLink)}</a>
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0 0 0;border-top:1px solid ${BRAND.border};">
      <tr>
        <td style="padding:16px 0 0 0;">
          <p style="margin:0;font-size:13px;color:${BRAND.textMuted};line-height:1.5;">
            This link expires in <strong>24 hours</strong>. If you did not expect this email, you can safely ignore it.
          </p>
        </td>
      </tr>
    </table>
    `
  );
}

export function passwordResetEmailText(resetLink: string): string {
  return [
    `Hello,`,
    ``,
    `A Decodex parent account has been created for you.`,
    ``,
    `Click the link below to set your password and access your account:`,
    resetLink,
    ``,
    `This link expires in 24 hours.`,
    ``,
    `If you did not expect this email, you can safely ignore it.`,
  ].join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// Consent withdrawal email
// ────────────────────────────────────────────────────────────────────────────

export interface WithdrawalEmailParams {
  studentName: string;
}

export function consentWithdrawalEmailHtml({ studentName }: WithdrawalEmailParams): string {
  return shell(
    'Consent withdrawn',
    `Your consent for ${studentName}'s Decodex account has been withdrawn.`,
    `
    <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:${BRAND.text};">Consent Withdrawn</h2>

    <p style="margin:0 0 16px 0;font-size:15px;color:${BRAND.text};line-height:1.6;">
      Hello,
    </p>

    <p style="margin:0 0 16px 0;font-size:15px;color:${BRAND.text};line-height:1.6;">
      Your consent for <strong>${esc(studentName)}</strong>'s Decodex account has been withdrawn.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;background-color:${BRAND.surfaceAlt};border-radius:10px;border-left:4px solid ${BRAND.textMuted};">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;color:${BRAND.text};">What happens next</p>
          <ul style="margin:0;padding:0 0 0 18px;font-size:14px;color:${BRAND.textMuted};line-height:1.7;">
            <li>Voice recording is now disabled for this account</li>
            <li>Stored reading data will be deleted in 30 days</li>
            <li>Data deletion is permanent and cannot be undone</li>
          </ul>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:14px;color:${BRAND.textMuted};line-height:1.6;">
      You can contact the school or Decodex support if you have questions.
    </p>
    `
  );
}

export function consentWithdrawalEmailText(studentName: string): string {
  return [
    `Hello,`,
    ``,
    `Your consent for ${studentName}'s Decodex account has been withdrawn.`,
    `Voice recording is now disabled for this account.`,
    ``,
    `Stored reading data will be deleted in 30 days unless another parent has active consent.`,
    ``,
    `You can contact the school or Decodex support if you have questions.`,
  ].join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// Data deletion email
// ────────────────────────────────────────────────────────────────────────────

export interface DataDeletionEmailParams {
  studentName: string;
}

export function dataDeletionEmailHtml({ studentName }: DataDeletionEmailParams): string {
  return shell(
    'Reading data deleted',
    `Stored reading data for ${studentName}'s Decodex account has been deleted.`,
    `
    <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:${BRAND.text};">Data Deleted</h2>

    <p style="margin:0 0 16px 0;font-size:15px;color:${BRAND.text};line-height:1.6;">
      Hello,
    </p>

    <p style="margin:0 0 16px 0;font-size:15px;color:${BRAND.text};line-height:1.6;">
      The stored reading data for <strong>${esc(studentName)}</strong>'s Decodex account has been deleted following the consent withdrawal.
    </p>

    <p style="margin:0;font-size:14px;color:${BRAND.textMuted};line-height:1.6;">
      The student account and consent record remain available for account management and compliance purposes. You can contact the school or Decodex support if you have questions.
    </p>
    `
  );
}

export function dataDeletionEmailText(studentName: string): string {
  return [
    `Hello,`,
    ``,
    `The stored reading data for ${studentName}'s Decodex account has been deleted following the consent withdrawal.`,
    `The student account and consent record remain available for account management and compliance purposes.`,
    ``,
    `You can contact the school or Decodex support if you have questions.`,
  ].join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// Consent renewal email
// ────────────────────────────────────────────────────────────────────────────

export interface ConsentRenewalEmailParams {
  studentName: string;
  renewLink: string;
}

export function consentRenewalEmailHtml({ studentName, renewLink }: ConsentRenewalEmailParams): string {
  return shell(
    'Consent renewal needed',
    `Your parental consent for ${studentName}'s Decodex account is expiring soon.`,
    `
    <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:${BRAND.text};">Consent Renewal Required</h2>

    <p style="margin:0 0 16px 0;font-size:15px;color:${BRAND.text};line-height:1.6;">
      Hello,
    </p>

    <p style="margin:0 0 16px 0;font-size:15px;color:${BRAND.text};line-height:1.6;">
      Your parental consent for <strong>${esc(studentName)}</strong>'s Decodex account is expiring soon. Consent must be renewed annually to continue using voice recording features.
    </p>

    ${ctaButton(renewLink, 'Renew Consent')}

    <p style="margin:16px 0 0 0;font-size:13px;color:${BRAND.textMuted};line-height:1.5;">
      Or copy this link:<br>
      <a href="${esc(renewLink)}" style="color:${BRAND.primary};word-break:break-all;text-decoration:none;">${esc(renewLink)}</a>
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0 0 0;border-top:1px solid ${BRAND.border};">
      <tr>
        <td style="padding:16px 0 0 0;">
          <p style="margin:0;font-size:13px;color:${BRAND.textMuted};line-height:1.5;">
            If you no longer wish to use Decodex, you can ignore this email.
          </p>
        </td>
      </tr>
    </table>
    `
  );
}

export function consentRenewalEmailText(studentName: string, renewLink: string): string {
  return [
    `Hello,`,
    ``,
    `Your parental consent for ${studentName}'s Decodex account is expiring soon.`,
    `Consent must be renewed annually to continue using voice recording features.`,
    ``,
    `Please click the link below to renew consent:`,
    renewLink,
    ``,
    `If you have questions, contact the school or Decodex support.`,
    ``,
    `If you no longer wish to use Decodex, you can ignore this email.`,
  ].join('\n');
}
