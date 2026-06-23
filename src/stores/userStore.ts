import type { Db } from "../db";

export interface User {
  id: string;
  createdAt: number;
}

export interface UserStore {
  create(id: string): void;
  findById(id: string): User | null;
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
          .prepare(`SELECT id, created_at AS createdAt FROM users WHERE id = ?`)
          .get(id) as User | undefined) ?? null
      );
    },
  };
}
