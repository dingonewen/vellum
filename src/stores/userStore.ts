import type { Db } from "../db";

export type LlmProvider = "anthropic" | "gemini" | "openai";

export interface User {
  id: string;
  llmProvider: LlmProvider | null;
  llmApiKey: string | null;
  createdAt: number;
}

export interface UserStore {
  create(id: string): void;
  findById(id: string): User | null;
  setLlmConfig(id: string, provider: LlmProvider, apiKey: string): void;
}

export function createUserStore(db: Db): UserStore {
  return {
    create(id: string): void {
      db.prepare(
        `INSERT INTO users (id, created_at) VALUES (?, ?)`
      ).run(id, Date.now());
    },

    findById(id: string): User | null {
      return (
        (db
          .prepare(
            `SELECT id, llm_provider AS llmProvider, llm_api_key AS llmApiKey,
                    created_at AS createdAt
             FROM users WHERE id = ?`
          )
          .get(id) as User | undefined) ?? null
      );
    },

    setLlmConfig(id: string, provider: LlmProvider, apiKey: string): void {
      db.prepare(
        `UPDATE users SET llm_provider = ?, llm_api_key = ? WHERE id = ?`
      ).run(provider, apiKey, id);
    },
  };
}
