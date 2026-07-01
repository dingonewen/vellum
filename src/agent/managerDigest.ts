import type { DraftStore } from './orchestrator';

export interface DigestEntry {
  subject: string;
  from: string;
  classification: string;
  draftBodyPreview: string;
  savedAt: number;
}

/**
 * Build an HTML digest email summarizing pending drafts and a daily report
 * for the manager.
 */
export function buildDigestHtml(
  drafts: Array<{
    email: { subject: string; sender: { email: string; name?: string } };
    classification: { reason: string };
    draft: { body: string };
    savedAt: number;
  }>,
  autoReplyCount: number,
  ignoredCount: number,
): string {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const draftRows = drafts.length === 0
    ? '<p style="color:#666;">No pending approvals today.</p>'
    : drafts.map(d => {
        const from = d.email.sender.name ?? d.email.sender.email;
        const time = new Date(d.savedAt).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit',
        });
        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #eee;">
              <strong>${d.email.subject}</strong><br/>
              <span style="color:#666;">From: ${from} · ${time}</span><br/>
              <span style="color:#888;">${d.classification.reason}</span>
            </td>
            <td style="padding:10px;border-bottom:1px solid #eee;color:#666;font-size:13px;">
              ${d.draft.body.replace(/<[^>]+>/g, '').slice(0, 120)}...
            </td>
          </tr>`;
      }).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#333;">📋 Daily Agent Digest — ${dateStr}</h2>

      <div style="background:#e8f5e9;padding:12px;border-radius:8px;margin:16px 0;">
        <strong>Today's summary:</strong>
        <ul style="margin:8px 0;">
          <li>✅ ${autoReplyCount} auto-replied</li>
          <li>🗑️ ${ignoredCount} ignored (spam / wrong person)</li>
          <li>📝 ${drafts.length} pending approval</li>
        </ul>
      </div>

      <h3 style="color:#c62828;">Pending Your Approval (${drafts.length})</h3>
      <table style="width:100%;border-collapse:collapse;">
        ${draftRows}
      </table>

      <p style="color:#999;margin-top:24px;font-size:12px;">
        Reply to this email with "approve all" to send all drafts,
        or "approve <number>" to send a specific one.
      </p>
    </div>`;
}

/**
 * Generate the daily manager digest.
 *
 * Reads from the draft store and builds a summary. The caller is
 * responsible for sending the email via Nylas.
 */
export function generateManagerDigest(draftStore: DraftStore): {
  subject: string;
  htmlBody: string;
  draftCount: number;
} {
  const drafts = draftStore.list();
  // Sort newest first
  drafts.sort((a, b) => b.savedAt - a.savedAt);

  const htmlBody = buildDigestHtml(drafts, 0, 0); // counts filled by caller

  return {
    subject: `📋 Agent Digest — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    htmlBody,
    draftCount: drafts.length,
  };
}
