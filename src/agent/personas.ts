/**
 * Persona registry — maps persona names to their email agent configs.
 *
 * Add new personas here; the unified daemon CLI reads from this registry.
 */
export interface PersonaConfig {
  /** Display name used in email signatures and prompts. */
  name: string;
  /** Role description injected into the LLM reply prompt. */
  role: string;
  /** mailbox_type in the grants table. */
  grantType: string;
  /** Emoji shown in console logs for this persona. */
  emoji: string;
  /** Label used in digest subject lines (e.g. "Agent Digest" vs "Cloud Agent Digest"). */
  label: string;
  /**
   * mailbox_type for the manager who receives digests.
   * If omitted, digests go to the persona's own email.
   */
  managerGrantType?: string;
  /**
   * Context description injected into the classifier prompt so it understands
   * what kind of inbox this persona monitors (e.g. "supplier sales rep inbox"
   * vs "procurement buyer inbox").
   */
  classifierContext?: string;
  /**
   * Persona archetype — tunes the reply generator's business rules.
   * - "buyer": procurement manager receiving supplier emails
   * - "supplier": sales rep receiving buyer inquiries / POs
   * - "multi": multi-role — adapt rules based on email context
   */
  archetype?: 'buyer' | 'supplier' | 'multi';
}

export const PERSONAS: Record<string, PersonaConfig> = {
  tifa: {
    name: 'Tifa Lockhart',
    role: 'a procurement manager at Shinra Manufacturing',
    grantType: 'buyer_inbox',
    emoji: '🤖',
    label: 'Agent',
    managerGrantType: 'manager_inbox',
    classifierContext: 'a procurement buyer at a manufacturing company monitoring her work inbox',
    archetype: 'buyer',
  },
  cloud: {
    name: 'Cloud Strife',
    role: 'a business contact. Adapt your role to the email: if discussing POs/shipments act as a supplier; if it is HR/facilities/spam do NOT reply; if the sender is clearly not your department, politely redirect or ignore',
    grantType: 'other',
    emoji: '☁️',
    label: 'Cloud Agent',
    managerGrantType: 'buyer_inbox',
    classifierContext: 'a multi-role contact. Your inbox receives a mix: replies to supplier emails (PO confirmations, order updates from buyers), random spam, HR broadcasts, misdirected emails, and occasional business inquiries. Only supplier-related business emails should be auto_replied — everything else should be ignored or drafted',
    archetype: 'multi',
  },
};
