// Konfiguration aus der Umgebung, einmal beim Start geprüft.
//
// Fehlende Werte sollen den Server sofort mit einer klaren Meldung stoppen und
// nicht erst beim ersten Nutzer-Request in einen unverständlichen Fehler laufen.

import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

function required(name, hint) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Umgebungsvariable ${name} fehlt. ${hint}`);
  }
  return value;
}

function optional(name, fallback) {
  return process.env[name] || fallback;
}

/** Prüft, dass ein Schlüssel 32 Byte hat (AES-256). */
function parseEncryptionKey(raw) {
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY muss 32 Byte als Hex sein (64 Zeichen). " +
        'Erzeugen mit: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return key;
}

export const config = {
  isProduction,
  port: Number(optional("PORT", "3000")),

  // In der Entwicklung darf ein Zufallswert genügen; produktiv würden damit bei
  // jedem Neustart alle Sitzungen ungültig, deshalb dort Pflicht.
  sessionSecret: isProduction
    ? required("SESSION_SECRET", "Zufälligen Wert setzen, sonst sind alle Sitzungen fälschbar.")
    : optional("SESSION_SECRET", crypto.randomBytes(32).toString("hex")),

  tokenEncryptionKey: parseEncryptionKey(
    isProduction
      ? required("TOKEN_ENCRYPTION_KEY", "Google-Refresh-Tokens dürfen nicht im Klartext liegen.")
      : optional("TOKEN_ENCRYPTION_KEY", crypto.randomBytes(32).toString("hex"))
  ),

  databaseFile: optional("DATABASE_FILE", "./klarblick.db"),

  // Schützt den Export der Warteliste. Ohne gesetzten Wert ist der Export
  // abgeschaltet — lieber nicht erreichbar als ungeschützt erreichbar.
  adminToken: optional("ADMIN_TOKEN", ""),

  google: {
    clientId: optional("GOOGLE_CLIENT_ID", ""),
    clientSecret: optional("GOOGLE_CLIENT_SECRET", ""),
    redirectUri: optional("GOOGLE_REDIRECT_URI", "http://localhost:3000/auth/google/callback"),
    accessApproved: optional("GBP_ACCESS_APPROVED", "false") === "true",
  },

  anthropic: {
    apiKey: optional("ANTHROPIC_API_KEY", ""),
    model: optional("ANTHROPIC_MODEL", "claude-opus-5"),
  },

  // Woher das Frontend und die Landingpage kommen dürfen. Kommagetrennt.
  allowedOrigins: optional(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  /** Nach erfolgreicher Google-Anmeldung wird hierhin zurückgeleitet. */
  frontendUrl: optional("FRONTEND_URL", "http://localhost:5173"),
};

/** Ist der Google-OAuth-Flow überhaupt konfiguriert? */
export const googleConfigured = Boolean(config.google.clientId && config.google.clientSecret);

/** Ist der AI-Sichtbarkeits-Check konfiguriert? */
export const anthropicConfigured = Boolean(config.anthropic.apiKey);
