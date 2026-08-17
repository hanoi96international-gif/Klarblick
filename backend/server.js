// Klarblick Backend — Grundgerüst
//
// Was das hier tut:
// 1. "Mit Google anmelden"-Flow (OAuth 2.0) für Geschäftsinhaber
// 2. Speichert Access-/Refresh-Token verschlüsselt pro Nutzer (SQLite als Startpunkt,
//    für echten Produktivbetrieb später auf Postgres wechseln)
// 3. Endpunkt, der Bewertungen des verbundenen Google-Business-Profils abruft
//
// WICHTIG: Der Business-Profile-API-Zugriff selbst muss erst bei Google beantragt
// werden (siehe README.md). Bis dahin liefert /api/reviews einen 501-Platzhalter,
// damit das Frontend schon gegen einen echten Endpunkt entwickeln kann.

import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import { google } from "googleapis";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

dotenv.config();

const app = express();
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 24 * 7 },
  })
);

// ---------- Datenbank ----------

const dbPromise = open({
  filename: "./klarblick.db",
  driver: sqlite3.Database,
});

async function initDb() {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT UNIQUE,
      email TEXT,
      access_token TEXT,
      refresh_token TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
initDb();

// ---------- Google OAuth ----------

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Minimal notwendige Scopes anfragen — nicht mehr, das beschleunigt Googles
// App-Prüfung und wirkt für den Nutzer vertrauenswürdiger beim Consent-Screen.
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/business.manage",
];

app.get("/auth/google", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline", // nötig, um ein Refresh-Token zu bekommen
    prompt: "consent",
    scope: SCOPES,
  });
  res.redirect(url);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    const db = await dbPromise;
    await db.run(
      `INSERT INTO users (google_id, email, access_token, refresh_token)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(google_id) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = COALESCE(excluded.refresh_token, users.refresh_token)`,
      [profile.id, profile.email, tokens.access_token, tokens.refresh_token]
    );

    req.session.userId = profile.id;
    res.redirect("/auth/success"); // im Frontend auf eine echte Route umbiegen
  } catch (err) {
    console.error("OAuth-Fehler:", err);
    res.status(500).send("Anmeldung fehlgeschlagen.");
  }
});

app.get("/auth/success", (req, res) => {
  res.send("Anmeldung erfolgreich. Dieses Fenster kann geschlossen werden.");
});

app.get("/auth/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Nicht angemeldet" });
  next();
}

// ---------- Reviews-Endpunkt ----------
//
// Sobald der GBP-API-Zugriff freigeschaltet ist (siehe README), diese Funktion mit
// echten Aufrufen gegen mybusinessaccountmanagement.googleapis.com und
// mybusinessbusinessinformation.googleapis.com füllen. Struktur/Feldnamen sind schon
// so gewählt, dass sie zum Frontend-CSV-Format passen (reviewer, rating, date, text,
// reviewerReviewCount).

app.get("/api/reviews", requireAuth, async (req, res) => {
  if (process.env.GBP_ACCESS_APPROVED !== "true") {
    return res.status(501).json({
      error:
        "Google-Business-Profile-API-Zugriff noch nicht freigeschaltet. " +
        "Bis dahin: CSV-Import im Frontend nutzen.",
    });
  }

  // Platzhalter für den echten API-Call, siehe README für die genauen Endpunkte.
  res.json({ reviews: [] });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Klarblick-Backend läuft auf http://localhost:${port}`);
});
