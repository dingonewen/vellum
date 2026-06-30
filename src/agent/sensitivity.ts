/**
 * Sensitivity detector — pure function, no external dependencies.
 * Flags emails that should NOT be auto-replied and require human review.
 *
 * Uses keyword matching for high-precision situations where getting it
 * wrong is unacceptable (payments, legal, urgent meetings).
 */

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bwire\s*transfer\b/i,              reason: 'wire transfer' },
  { pattern: /\bpayment\s*(terms|due|required)\b/i, reason: 'payment terms' },
  { pattern: /\b(invoice|billing|receipt)\b/i,     reason: 'invoice/billing' },
  { pattern: /\b(refund|chargeback|dispute)\b/i,    reason: 'refund/dispute' },
  { pattern: /\bcontract\s*(review|renewal|sign)\b/i, reason: 'contract' },
  { pattern: /\burgen(t)?\s*(meeting|call)\b/i,     reason: 'urgent meeting' },
  { pattern: /\b(legal|counsel|attorney|sue|liab(le|ility))\b/i, reason: 'legal' },
  { pattern: /\b(confidential|privileged)\b/i,      reason: 'confidential' },
  { pattern: /\bpric(e|ing)\s*(increase|change|adjust)\b/i, reason: 'price change' },
  { pattern: /\btermin(ate|ation)\s*(contract|agreement)\b/i, reason: 'termination' },
];

export interface SensitivityResult {
  sensitive: boolean;
  reasons: string[];
}

/**
 * Check an email for sensitive content that requires human review.
 *
 * @param subject  Email subject line
 * @param body     Email body (plain text — strip HTML first)
 * @returns        Whether the email is sensitive and why
 */
export function checkSensitivity(subject: string, body: string): SensitivityResult {
  const reasons: string[] = [];
  const combined = `${subject}\n${body}`;

  for (const { pattern, reason } of SENSITIVE_PATTERNS) {
    if (pattern.test(combined)) {
      reasons.push(reason);
    }
  }

  return {
    sensitive: reasons.length > 0,
    reasons,
  };
}
