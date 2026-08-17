// Bewertungen aus dem verbundenen Google-Business-Profil.
//
// Der API-Zugriff muss bei Google beantragt werden (siehe README, Schritt 2).
// Bis zur Freigabe antwortet der Endpunkt bewusst mit 501 statt mit erfundenen
// Daten — das Frontend kann dagegen bereits entwickeln und weicht auf den
// CSV-Import aus.

import { Router } from "express";

import { config } from "../config.js";
import { getUserWithTokens } from "../db.js";
import { clientForUser } from "../google.js";

export const reviewsRouter = Router();

export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Nicht angemeldet" });
  }
  next();
}

reviewsRouter.get("/", requireAuth, async (req, res) => {
  if (!config.google.accessApproved) {
    return res.status(501).json({
      error:
        "Google-Business-Profile-API-Zugriff noch nicht freigeschaltet. " +
        "Bis dahin: CSV-Import im Dashboard nutzen.",
      csvImportAvailable: true,
    });
  }

  const user = getUserWithTokens(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: "Nicht angemeldet" });
  }

  try {
    // Eigener Client je Request — clientForUser() setzt die Tokens nur auf dieser
    // Instanz, sodass parallele Anfragen anderer Nutzer unberührt bleiben.
    const auth = clientForUser(user);

    // Sobald die Freigabe vorliegt, hier die föderierten GBP-APIs aufrufen:
    //   mybusinessaccountmanagement.googleapis.com/v1  → Konto- und Standort-IDs
    //   mybusinessbusinessinformation.googleapis.com/v1 → Standortdetails
    //   mybusiness.googleapis.com/v4/accounts/*/locations/*/reviews → Bewertungen
    //
    // Die Antwortfelder auf das Format des Detektors abbilden:
    //   reviewer.displayName → reviewer
    //   starRating           → rating
    //   createTime           → date
    //   comment              → text
    void auth;

    res.json({ reviews: [] });
  } catch (err) {
    console.error("Abruf der Bewertungen fehlgeschlagen:", err);
    res.status(502).json({ error: "Bewertungen konnten nicht abgerufen werden." });
  }
});
