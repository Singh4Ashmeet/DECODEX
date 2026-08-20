import { NextFunction, Response } from 'express';
import { query } from '../db';
import { AuthRequest } from './auth';

export interface ConsentStatus {
  consent_granted: boolean;
  consent_date: string | null;
}

interface ConsentRecord {
  consent_date: string | Date;
}

export const getConsentStatus = async (studentId: string): Promise<ConsentStatus> => {
  const result = await query(
    [
      'SELECT consent_date',
      'FROM parent_student_links',
      'WHERE student_id = $1',
      'AND consent_granted = TRUE',
      'AND withdrawn_at IS NULL',
      "AND consent_date >= NOW() - INTERVAL '365 days'",
      'ORDER BY consent_date DESC',
      'LIMIT 1',
    ].join('\n'),
    [studentId]
  );
  const consent = result.rows[0] as ConsentRecord | undefined;

  return {
    consent_granted: Boolean(consent),
    consent_date: consent ? toIsoTimestamp(consent.consent_date) : null,
  };
};

export const requireConsent = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
  }

  try {
    const consentStatus = await getConsentStatus(req.user.id);

    if (!consentStatus.consent_granted) {
      return res.status(403).json({
        error: {
          code: 'CONSENT_REQUIRED',
          message: 'A parent needs to confirm consent before voice recording can be used. You can still read passages and use text-based practice.',
        },
      });
    }

    next();
  } catch {
    console.error('Failed to verify parental consent.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to verify parental consent' } });
  }
};

function toIsoTimestamp(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}
