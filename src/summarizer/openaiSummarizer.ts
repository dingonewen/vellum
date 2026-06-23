import OpenAI from "openai";
import type { EmailMessage } from "../nylas/types";
import type { Summarizer } from "./summarizer";
import { assemblePrompt, parseResponse } from "./prompt";
import { LLM_MODELS } from "./models";

export function createOpenAISummarizer(apiKey: string): Summarizer {
  const client = new OpenAI({ apiKey });

  return {
    async summarize(messages: EmailMessage[]) {
      const prompt = assemblePrompt(messages);

      const response = await client.chat.completions.create({
        model: LLM_MODELS.openai,
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.choices[0]?.message.content;
      if (!text) throw new Error("Empty response from OpenAI");

      return parseResponse(text, messages.length);
    },
  };
}
