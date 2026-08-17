// Serverstart. Die App selbst liegt in app.js, damit Tests sie ohne Port laden können.

import SqliteStoreFactory from "better-sqlite3-session-store";
import session from "express-session";

import { createApp } from "./app.js";
import { anthropicConfigured, config, googleConfigured } from "./config.js";
import { closeDb, db } from "./db.js";

const SqliteStore = SqliteStoreFactory(session);

// Der Standard-Sitzungsspeicher von express-session hält alles im Arbeitsspeicher:
// Neustarts melden alle Nutzer ab, und der Speicher wächst unbegrenzt.
const sessionStore = new SqliteStore({
  client: db,
  expired: { clear: true, intervalMs: 15 * 60 * 1000 },
});

const app = createApp({ sessionStore });

const server = app.listen(config.port, () => {
  console.log(`Klarblick-Backend läuft auf http://localhost:${config.port}`);
  if (!googleConfigured) {
    console.warn("Hinweis: Google-Anmeldung inaktiv (GOOGLE_CLIENT_ID/SECRET fehlen).");
  }
  if (!anthropicConfigured) {
    console.warn("Hinweis: AI-Sichtbarkeits-Check inaktiv (ANTHROPIC_API_KEY fehlt).");
  }
  if (!config.google.accessApproved) {
    console.warn("Hinweis: Google-Business-Profile-API noch nicht freigeschaltet — CSV-Import nutzen.");
  }
});

function shutdown(signal) {
  console.log(`${signal} empfangen, fahre herunter…`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  // Falls offene Verbindungen das Schließen blockieren, nicht ewig hängen bleiben.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
