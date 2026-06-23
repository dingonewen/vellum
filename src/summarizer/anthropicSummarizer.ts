import Anthropic from "@anthropic-ai/sdk";
import type { EmailMessage } from "../nylas/types";
import type { Summarizer } from "./summarizer";
import { assemblePrompt, parseResponse } from "./prompt";

export function createAnthropicSummarizer(apiKey: string): Summarizer {
  const client = new Anthropic({ apiKey });

  return {
    async summarize(messages: EmailMessage[]) {
      const prompt = assemblePrompt(messages);

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
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
