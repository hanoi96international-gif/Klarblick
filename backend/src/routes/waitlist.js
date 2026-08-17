// Beta-Warteliste. Das Formular auf der Landingpage war bisher ein Platzhalter
// mit onsubmit="return false" — Interessenten gingen also verloren.

import { Router } from "express";

import { addToWaitlist, waitlistCount } from "../db.js";

export const waitlistRouter = Router();

// Bewusst pragmatisch: ausführliche RFC-5322-Prüfungen lehnen mehr gültige
// Adressen ab als sie ungültige fangen. Die echte Prüfung ist die Bestätigungsmail.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

waitlistRouter.post("/", (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const business = typeof req.body?.business === "string" ? req.body.business.trim() : "";

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return res.status(400).json({ error: "Bitte eine gültige E-Mail-Adresse angeben." });
  }

  try {
    const { added } = addToWaitlist({
      email,
      business: business.slice(0, 200) || null,
      source: req.get("referer") || null,
    });

    // Auch bei einer bereits eingetragenen Adresse dieselbe Antwort: sonst ließe
    // sich über das Formular herausfinden, wer bereits auf der Liste steht.
    res.status(201).json({
      ok: true,
      alreadyRegistered: !added,
      message: "Danke! Wir melden uns, sobald die Beta startet.",
    });
  } catch (err) {
    console.error("Warteliste-Eintrag fehlgeschlagen:", err);
    res.status(500).json({ error: "Eintrag fehlgeschlagen. Bitte später erneut versuchen." });
  }
});

// Nur die Gesamtzahl, keine Adressen — als Fortschrittsanzeige für die Landingpage.
waitlistRouter.get("/count", (req, res) => {
  res.json({ count: waitlistCount() });
});
