import type { EmailMessage } from "../nylas/types";
import type { SummaryResult } from "./types";

const SNIPPET_MAX_CHARS = 300;

export function assemblePrompt(messages: EmailMessage[]): string {
  if (messages.length === 0) {
    return "The inbox has no new messages in this period.";
  }

  const formatted = messages.map((msg) => {
    const date = new Date(msg.receivedAt * 1000).toISOString();
    const snippet = msg.snippet.slice(0, SNIPPET_MAX_CHARS);
    const status = msg.isRead ? "read" : "unread";
    return `- [${date}] From: ${msg.sender.name ?? msg.sender.email} <${msg.sender.email}>
  Subject: ${msg.subject}
  Status: ${status}
  Preview: ${snippet}`;
  });

  return `You are an AI assistant writing a concise, well-designed email digest.
Analyze the following inbox messages and produce a summary that helps the reader quickly understand what matters.

Structure your response into these four sections (omit any section that has nothing to report):
1. 🔴 Needs Attention — senders or threads requiring action or a decision
2. 💬 Awaiting Your Reply — questions or requests where the reader is the bottleneck
3. ⏰ Deadlines & Time-Sensitive — anything with an explicit or implied deadline
4. 📬 Everything Else — brief overview of low-priority activity

Writing style:
- Lead with the sender name and the core ask, not the subject line
- Be direct and specific — "Alex is waiting on your approval for the Q3 budget" not "Email about budget"
- If a section is empty, skip it entirely

Formatting rules (this will be rendered in an email client):
- Use inline CSS on every element — no <style> blocks, no class attributes
- Section headings: <h3 style="margin: 24px 0 8px; font-size: 15px; font-family: -apple-system, sans-serif; color: #1a1a1a;">
- Each item: <div style="margin: 0 0 12px; padding: 10px 14px; border-left: 3px solid #6366f1; background: #f8f8ff; font-family: -apple-system, sans-serif; font-size: 14px; color: #333; line-height: 1.5;">
- Sender name in <strong>
- Do not include <html>, <head>, <body>, or <ul>/<li> tags

Messages (${messages.length} total):

${formatted.join("\n\n")}`;
}

export function parseResponse(text: string, messageCount: number): SummaryResult {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const count = `${messageCount} message${messageCount !== 1 ? "s" : ""}`;

  const htmlBody = `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="background:#6366f1;padding:24px 28px;border-radius:8px 8px 0 0;">
    <div style="color:#fff;font-size:20px;font-weight:700;">📧 Morning Email Digest</div>
    <div style="color:#c7d2fe;font-size:13px;margin-top:4px;">📅 ${date} · ${count}</div>
  </div>
  <div style="padding:20px 28px;background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    ${text}
  </div>
  <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px;">
    Sent by emailorning · <a href="#" style="color:#6366f1;text-decoration:none;">Manage preferences</a>
  </div>
</div>`;

  return {
    subject: `📧 Morning Email Digest (${count}) - 📅 ${date}`,
    htmlBody,
    generatedAt: Date.now(),
  };
}
