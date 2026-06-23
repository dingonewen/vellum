import { GoogleGenerativeAI } from "@google/generative-ai";
import type { EmailMessage } from "../nylas/types";
import type { Summarizer } from "./summarizer";
import { assemblePrompt, parseResponse } from "./prompt";

export function createGeminiSummarizer(apiKey: string): Summarizer {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  return {
    async summarize(messages: EmailMessage[]) {
      const prompt = assemblePrompt(messages);
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return parseResponse(text, messages.length);
    },
  };
}
