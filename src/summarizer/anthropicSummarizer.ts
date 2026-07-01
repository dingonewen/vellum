import Anthropic from "@anthropic-ai/sdk";
import type { EmailMessage } from "../nylas/types";
import type { Summarizer } from "./summarizer";
import { assemblePrompt, parseResponse } from "./prompt";
import { LLM_MODELS } from "./models";

export function createAnthropicSummarizer(apiKey: string, baseUrl?: string): Summarizer {
  const client = new Anthropic({
    apiKey,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  });

  return {
    async summarize(messages: EmailMessage[]) {
      const prompt = assemblePrompt(messages);

      const response = await client.messages.create({
        model: LLM_MODELS.anthropic,
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock) {
        throw new Error('No text block in response');
      }

      return parseResponse(textBlock.text, messages.length);
    },
  };
}
