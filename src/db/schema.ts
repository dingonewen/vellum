export const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id                 TEXT    PRIMARY KEY,
    anthropic_api_key  TEXT,
    created_at         INTEGER NOT NULL
  )
`;

export const CREATE_SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT    PRIMARY KEY,
    user_id    TEXT    NOT NULL REFERENCES users(id),
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )
`;

export const CREATE_GRANTS_TABLE = `
  CREATE TABLE IF NOT EXISTS grants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT    NOT NULL REFERENCES users(id),
    grant_id    TEXT    UNIQUE NOT NULL,
    email       TEXT    NOT NULL,
    created_at  INTEGER NOT NULL
  )
`;

export const CREATE_MESSAGES_TABLE = `
  CREATE TABLE IF NOT EXISTS messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id   TEXT    UNIQUE NOT NULL,
    grant_id     TEXT    NOT NULL,
    subject      TEXT,
    sender       TEXT    NOT NULL,
    snippet      TEXT,
    received_at  INTEGER NOT NULL,
    is_read      INTEGER NOT NULL DEFAULT 0,
    processed_at INTEGER,
    FOREIGN KEY (grant_id) REFERENCES grants(grant_id)
  )
`;

export const CREATE_MESSAGES_IDX = `
  CREATE INDEX IF NOT EXISTS idx_messages_grant_received
  ON messages (grant_id, received_at)
`;

export const CREATE_PENDING_MESSAGES_TABLE = `
  CREATE TABLE IF NOT EXISTS pending_messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id   TEXT    NOT NULL,
    grant_id     TEXT    NOT NULL,
    enqueued_at  INTEGER NOT NULL,
    claimed_at   INTEGER
  )
`;

export const CREATE_PENDING_IDX = `
  CREATE INDEX IF NOT EXISTS idx_pending_claimed
  ON pending_messages (claimed_at)
`;

export const CREATE_SCHEDULES_TABLE = `
  CREATE TABLE IF NOT EXISTS schedules (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    UNIQUE NOT NULL REFERENCES users(id),
    dest_email      TEXT    NOT NULL,
    cron_expr       TEXT    NOT NULL,
    last_summary_at INTEGER,
    next_fire_at    INTEGER NOT NULL,
    claimed_at      INTEGER,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
  )
`;

export const CREATE_SCHEDULES_IDX = `
  CREATE INDEX IF NOT EXISTS idx_schedules_next_fire
  ON schedules (next_fire_at, claimed_at)
`;
