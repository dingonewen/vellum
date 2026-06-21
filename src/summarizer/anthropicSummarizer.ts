import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import type { EmailMessage } from "../nylas/types";
import type { Summarizer } from "./summarizer";
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

  return `You are an AI assistant writing a concise email digest.
Analyze the following inbox messages and produce a summary that helps the reader quickly understand:
1. Which senders or threads need attention
2. Any questions or requests awaiting a reply
3. Any deadlines or time-sensitive items
4. A brief overview of other activity

Format your response as valid HTML suitable for an email body.
Use <h2> for section headings, <ul>/<li> for lists, <strong> for emphasis.
Do not include <html>, <head>, or <body> tags — just the inner content.
Be concise and genuinely useful. Do not just list subjects.

Messages (${messages.length} total):

${formatted.join("\n\n")}`;
}

export function parseResponse(text: string, messageCount: number): SummaryResult {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return {
    subject: `Your inbox digest — ${date} (${messageCount} message${messageCount !== 1 ? "s" : ""})`,
    htmlBody: text,
    generatedAt: Date.now(),
  };
}

export function createAnthropicSummarizer(): Summarizer {
  const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

  return {
    async summarize(messages: EmailMessage[]): Promise<SummaryResult> {
      const prompt = assemblePrompt(messages);

      const response = await client.messages.create({
        model: config.ANTHROPIC_MODEL,
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });

      const block = response.content[0];
      if (block.type !== "text") {
        throw new Error(`Unexpected response block type: ${block.type}`);
      }

      return parseResponse(block.text, messages.length);
    },
  };
}
