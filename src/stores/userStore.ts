import type { Db } from "../db";

export interface User {
  id: string;
  anthropicApiKey: string | null;
  createdAt: number;
}

export interface UserStore {
  create(id: string): void;
  findById(id: string): User | null;
  setApiKey(id: string, apiKey: string): void;
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
            `SELECT id, anthropic_api_key AS anthropicApiKey, created_at AS createdAt
             FROM users WHERE id = ?`
          )
          .get(id) as User | undefined) ?? null
      );
    },

    setApiKey(id: string, apiKey: string): void {
      db.prepare(
        `UPDATE users SET anthropic_api_key = ? WHERE id = ?`
      ).run(apiKey, id);
    },
  };
}
