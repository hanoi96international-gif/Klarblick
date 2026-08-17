// Zusammenbau der Express-Anwendung. Getrennt vom Serverstart, damit Tests die
// App ohne offenen Port hochfahren können.

import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import helmet from "helmet";

import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { reviewsRouter } from "./routes/reviews.js";
import { visibilityRouter } from "./routes/visibility.js";
import { waitlistRouter } from "./routes/waitlist.js";

/** Vorgaben für den Produktivbetrieb. Tests überschreiben sie gezielt. */
export const DEFAULT_RATE_LIMITS = {
  /** Grundlimit für alle API-Routen. */
  api: { windowMs: 60_000, limit: 60 },
  /** Ein Sichtbarkeits-Check kostet fünf Modellanfragen — deutlich strenger. */
  visibility: { windowMs: 60 * 60_000, limit: 10 },
  /** Gegen automatisiertes Zumüllen der Warteliste. */
  waitlist: { windowMs: 60 * 60_000, limit: 5 },
};

export function createApp({ sessionStore, rateLimits } = {}) {
  const limits = { ...DEFAULT_RATE_LIMITS, ...rateLimits };
  const app = express();

  // Hinter einem Reverse Proxy (Railway, Render, Fly) steht die echte Client-IP
  // im X-Forwarded-For. Ohne diese Zeile sieht das Rate-Limiting nur die Proxy-IP
  // und würde alle Nutzer gemeinsam ausbremsen.
  if (config.isProduction) app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Anfragen ohne Origin (curl, Server-zu-Server) durchlassen.
        if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error("Herkunft nicht erlaubt"));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.use(
    session({
      name: "klarblick.sid",
      store: sessionStore,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.isProduction,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    })
  );

  app.get("/healthz", (req, res) => {
    res.json({ status: "ok", uptime: Math.round(process.uptime()) });
  });

  const limiter = (options, message) =>
    rateLimit({
      ...options,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: message },
    });

  app.use("/api", limiter(limits.api, "Zu viele Anfragen. Bitte kurz warten."));

  app.use("/auth", authRouter);
  app.use("/api/reviews", reviewsRouter);
  app.use(
    "/api/visibility",
    limiter(
      limits.visibility,
      "Stündliches Limit für Sichtbarkeits-Prüfungen erreicht. Bitte später erneut."
    ),
    visibilityRouter
  );
  // Das strenge Limit gilt nur für das Eintragen. Der Zähler ist eine billige
  // Leseanfrage und läuft weiter unter dem allgemeinen /api-Limit.
  app.post(
    "/api/waitlist",
    limiter(limits.waitlist, "Zu viele Anmeldeversuche. Bitte später erneut.")
  );
  app.use("/api/waitlist", waitlistRouter);

  app.use((req, res) => {
    res.status(404).json({ error: "Nicht gefunden" });
  });

  // Letzte Instanz: niemals einen Stacktrace an den Client geben.
  app.use((err, req, res, _next) => {
    console.error("Unbehandelter Fehler:", err);
    res.status(err.status || 500).json({ error: "Unerwarteter Serverfehler." });
  });

  return app;
}
