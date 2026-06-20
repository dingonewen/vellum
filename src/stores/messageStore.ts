import type { Db } from "../db";
import type { EmailMessage } from "../nylas/types";

const STALE_CLAIM_TTL_MS = 60 * 60 * 1000;

export interface PendingMessage {
  id: number;
  messageId: string;
  grantId: string;
}

export interface MessageStore {
  enqueue(messageId: string, grantId: string): void;
  claimBatch(limit: number): PendingMessage[];
  deletePending(id: number): void;
  upsertMessage(message: EmailMessage, grantId: string): void;
}

export function createMessageStore(db: Db): MessageStore {
  const claimBatch = db.transaction((limit: number): PendingMessage[] => {
    db.prepare(
      `UPDATE pending_messages SET claimed_at = NULL
       WHERE claimed_at IS NOT NULL AND claimed_at < ?`
    ).run(Date.now() - STALE_CLAIM_TTL_MS);

    const rows = db
      .prepare(
        `SELECT id, message_id AS messageId, grant_id AS grantId
         FROM pending_messages WHERE claimed_at IS NULL LIMIT ?`
      )
      .all(limit) as PendingMessage[];

    if (rows.length === 0) return [];

    const placeholders = rows.map(() => "?").join(",");
    db.prepare(
      `UPDATE pending_messages SET claimed_at = ? WHERE id IN (${placeholders})`
    ).run(Date.now(), ...rows.map((r) => r.id));

    return rows;
  });

  return {
    enqueue(messageId: string, grantId: string): void {
      db.prepare(
        `INSERT INTO pending_messages (message_id, grant_id, enqueued_at) VALUES (?, ?, ?)`
      ).run(messageId, grantId, Date.now());
    },

    claimBatch(limit: number): PendingMessage[] {
      return claimBatch(limit);
    },

    deletePending(id: number): void {
      db.prepare(`DELETE FROM pending_messages WHERE id = ?`).run(id);
    },

    upsertMessage(message: EmailMessage, grantId: string): void {
      db.prepare(
        `INSERT OR IGNORE INTO messages
           (message_id, grant_id, subject, sender, snippet, received_at, is_read, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        message.id,
        grantId,
        message.subject,
        JSON.stringify(message.sender),
        message.snippet,
        message.receivedAt,
        message.isRead ? 1 : 0,
        Date.now()
      );
    },
  };
}
