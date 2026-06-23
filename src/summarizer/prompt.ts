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

  return `You are an AI assistant writing a refined, literary email digest — elegant and unhurried in tone.
Analyze the following inbox messages and produce a summary that helps the reader understand what matters most.

Structure your response into these four sections (omit any section that has nothing to report):
1. 🔴 Needs Attention — senders or threads requiring action or a decision
2. 💬 Awaiting Your Reply — questions or requests where the reader is the bottleneck
3. ⏰ Deadlines & Time-Sensitive — anything with an explicit or implied deadline
4. 📬 Everything Else — brief overview of lower-priority correspondence

Writing style:
- Lead with the sender's name and the core ask, not the subject line
- Be direct and specific — "Alex is awaiting your approval for the Q3 budget" not "Email about budget"
- Prefer measured, precise prose over bullet-point terseness
- If a section is empty, skip it entirely

Formatting rules (this will be rendered inside an email client — inline CSS only):
- Use inline CSS on every element — no <style> blocks, no class attributes
- Section headings: <h3 style="margin: 24px 0 8px; font-size: 15px; font-family: Georgia, 'Times New Roman', serif; color: #4A2C17; letter-spacing: 0.04em; border-bottom: 1px solid #E8DCC8; padding-bottom: 6px;">
- Each item: <div style="margin: 0 0 14px; padding: 11px 15px; border-left: 3px solid #C4A35A; background: #FDF8F0; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; color: #2C1810; line-height: 1.65;">
- Sender name in <strong style="color: #7C4F2A;">
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

  const htmlBody = `<div style="max-width:600px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;background:#FDF8F0;">
  <div style="background:#4A2C17;padding:28px 32px;border-bottom:3px solid #C4A35A;">
    <div style="color:#F5EFE4;font-size:22px;font-weight:700;letter-spacing:0.02em;">Vellum</div>
    <div style="color:#E8DCC8;font-size:13px;margin-top:2px;letter-spacing:0.12em;text-transform:uppercase;font-style:italic;">Morning Dispatch</div>
    <div style="color:#C4A35A;font-size:13px;margin-top:6px;letter-spacing:0.06em;">${date} &nbsp;·&nbsp; ${count}</div>
  </div>
  <div style="padding:24px 32px;background:#FFFDF7;border:1px solid #E8DCC8;border-top:none;">
    ${text}
  </div>
  <div style="text-align:center;padding:18px;color:#8B7355;font-size:12px;font-style:italic;">
    Delivered by Vellum &nbsp;·&nbsp; <a href="#" style="color:#C4A35A;text-decoration:none;">Manage preferences</a>
  </div>
</div>`;

  return {
    subject: `Vellum · Morning Dispatch — ${count} · ${date}`,
    htmlBody,
    generatedAt: Date.now(),
  };
}
