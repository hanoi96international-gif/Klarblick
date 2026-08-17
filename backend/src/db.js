// Datenhaltung. SQLite reicht für die Beta; für den Produktivbetrieb mit mehreren
// Instanzen ist ein Wechsel auf Postgres vorgesehen (siehe README).

import Database from "better-sqlite3";

import { config } from "./config.js";
import { decrypt, encrypt } from "./crypto.js";

export const db = new Database(config.databaseFile);

// WAL erlaubt gleichzeitiges Lesen während geschrieben wird — ohne das blockiert
// SQLite unter Last spürbar.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT,
    access_token TEXT,           -- verschlüsselt, siehe crypto.js
    refresh_token TEXT,          -- verschlüsselt
    token_expiry INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    business TEXT,
    source TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);
`);

const statements = {
  upsertUser: db.prepare(`
    INSERT INTO users (google_id, email, access_token, refresh_token, token_expiry)
    VALUES (@googleId, @email, @accessToken, @refreshToken, @tokenExpiry)
    ON CONFLICT(google_id) DO UPDATE SET
      email = excluded.email,
      access_token = excluded.access_token,
      -- Google liefert das Refresh-Token nur beim ersten Consent mit. Ein
      -- fehlender Wert darf den bestehenden also nicht überschreiben.
      refresh_token = COALESCE(excluded.refresh_token, users.refresh_token),
      token_expiry = excluded.token_expiry,
      updated_at = CURRENT_TIMESTAMP
  `),
  findUser: db.prepare("SELECT * FROM users WHERE google_id = ?"),
  insertWaitlist: db.prepare(`
    INSERT INTO waitlist (email, business, source)
    VALUES (@email, @business, @source)
    ON CONFLICT(email) DO NOTHING
  `),
  countWaitlist: db.prepare("SELECT COUNT(*) AS count FROM waitlist"),
};

/** Legt einen Nutzer an oder aktualisiert seine Tokens. Tokens werden verschlüsselt abgelegt. */
export function saveUserTokens({ googleId, email, accessToken, refreshToken, tokenExpiry }) {
  statements.upsertUser.run({
    googleId,
    email: email ?? null,
    accessToken: encrypt(accessToken, config.tokenEncryptionKey),
    refreshToken: encrypt(refreshToken, config.tokenEncryptionKey),
    tokenExpiry: tokenExpiry ?? null,
  });
}

/** Holt einen Nutzer samt entschlüsselter Tokens, oder null. */
export function getUserWithTokens(googleId) {
  const row = statements.findUser.get(googleId);
  if (!row) return null;

  return {
    id: row.id,
    googleId: row.google_id,
    email: row.email,
    accessToken: decrypt(row.access_token, config.tokenEncryptionKey),
    refreshToken: decrypt(row.refresh_token, config.tokenEncryptionKey),
    tokenExpiry: row.token_expiry,
  };
}

/**
 * Trägt eine E-Mail in die Warteliste ein.
 * @returns {{added: boolean}} added=false bedeutet: war schon eingetragen.
 */
export function addToWaitlist({ email, business, source }) {
  const result = statements.insertWaitlist.run({
    email,
    business: business ?? null,
    source: source ?? null,
  });
  return { added: result.changes > 0 };
}

export function waitlistCount() {
  return statements.countWaitlist.get().count;
}

export function closeDb() {
  db.close();
}
