export const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT    PRIMARY KEY,
    created_at   INTEGER NOT NULL
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
    created_at  INTEGER NOT NULL,
    mailbox_type TEXT   NOT NULL DEFAULT 'other'
  )
`;

/** Migration: add mailbox_type to existing grants table if missing. */
export const MIGRATE_GRANTS_MAILBOX_TYPE = `
  ALTER TABLE grants ADD COLUMN mailbox_type TEXT NOT NULL DEFAULT 'other'
`;

export const CREATE_MANAGER_SETTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS manager_settings (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          TEXT UNIQUE NOT NULL REFERENCES users(id),
    digest_frequency TEXT    NOT NULL DEFAULT 'on_sensitive',
    updated_at       INTEGER NOT NULL
  )
`;
