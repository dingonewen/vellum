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
}

export const PERSONAS: Record<string, PersonaConfig> = {
  tifa: {
    name: 'Tifa Lockhart',
    role: 'a procurement manager at Shinra Manufacturing',
    grantType: 'buyer_inbox',
    emoji: '🤖',
    label: 'Agent',
    managerGrantType: 'manager_inbox',
  },
  cloud: {
    name: 'Cloud Strife',
    role: 'a business contact. Adapt your role to the email: if discussing POs/shipments act as a supplier; if it is HR/facilities/spam do NOT reply; if the sender is clearly not your department, politely redirect or ignore',
    grantType: 'other',
    emoji: '☁️',
    label: 'Cloud Agent',
    managerGrantType: 'buyer_inbox',
  },
};
