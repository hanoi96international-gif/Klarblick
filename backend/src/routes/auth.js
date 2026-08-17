import crypto from "node:crypto";
import { Router } from "express";

import { config, googleConfigured } from "../config.js";
import { saveUserTokens } from "../db.js";
import { buildAuthUrl, exchangeCodeForProfile } from "../google.js";

export const authRouter = Router();

authRouter.get("/google", (req, res) => {
  if (!googleConfigured) {
    return res.status(503).json({
      error: "Google-Anmeldung ist auf diesem Server nicht konfiguriert.",
    });
  }

  // State gegen CSRF: Google spiegelt ihn zurück, wir vergleichen mit der Sitzung.
  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;
  res.redirect(buildAuthUrl(state));
});

authRouter.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${config.frontendUrl}?auth=abgebrochen`);
  }
  if (!code || !state || state !== req.session.oauthState) {
    return res.status(400).send("Ungültige Anmeldeanfrage.");
  }
  delete req.session.oauthState;

  try {
    const { tokens, profile } = await exchangeCodeForProfile(code);

    saveUserTokens({
      googleId: profile.id,
      email: profile.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: tokens.expiry_date,
    });

    // Sitzungs-ID nach der Anmeldung wechseln (Session Fixation).
    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        console.error("Sitzung konnte nicht erneuert werden:", regenerateError);
        return res.status(500).send("Anmeldung fehlgeschlagen.");
      }
      req.session.userId = profile.id;
      res.redirect(`${config.frontendUrl}?auth=ok`);
    });
  } catch (err) {
    console.error("OAuth-Fehler:", err);
    res.status(500).send("Anmeldung fehlgeschlagen.");
  }
});

authRouter.get("/me", (req, res) => {
  res.json({ signedIn: Boolean(req.session.userId) });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ signedIn: false }));
});
