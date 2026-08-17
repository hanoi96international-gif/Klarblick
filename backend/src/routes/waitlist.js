// Beta-Warteliste. Das Formular auf der Landingpage war bisher ein Platzhalter
// mit onsubmit="return false" — Interessenten gingen also verloren.

import crypto from "node:crypto";
import { Router } from "express";

import { config } from "../config.js";
import { addToWaitlist, listWaitlist, waitlistCount } from "../db.js";

export const waitlistRouter = Router();

/**
 * Vergleicht zwei Zeichenketten in konstanter Zeit. Ein gewöhnlicher Vergleich
 * bricht beim ersten abweichenden Zeichen ab und verrät über die Antwortzeit
 * nach und nach den richtigen Wert.
 */
function tokenStimmt(uebergeben, erwartet) {
  const a = Buffer.from(String(uebergeben));
  const b = Buffer.from(String(erwartet));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Schützt den Export mit dem ADMIN_TOKEN aus der Umgebung. */
function requireAdmin(req, res, next) {
  if (!config.adminToken) {
    return res.status(503).json({
      error: "Export ist nicht konfiguriert (ADMIN_TOKEN fehlt).",
    });
  }
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !tokenStimmt(token, config.adminToken)) {
    return res.status(401).json({ error: "Nicht berechtigt" });
  }
  next();
}

/** Maskiert ein Feld für die CSV-Ausgabe nach RFC 4180. */
function csvFeld(wert) {
  const s = String(wert ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

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

/**
 * Export der Warteliste. Ohne diesen Endpunkt wären die gesammelten Adressen nur
 * über direkten Datenbankzugriff erreichbar — die Anmeldungen wären praktisch
 * wertlos.
 *
 *   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
 *        https://api.klarblick.de/api/waitlist/export > warteliste.csv
 */
waitlistRouter.get("/export", requireAdmin, (req, res) => {
  const eintraege = listWaitlist();

  if (req.query.format === "json") {
    return res.json({ count: eintraege.length, entries: eintraege });
  }

  const zeilen = [
    "email,unternehmen,angemeldet_am",
    ...eintraege.map((e) =>
      [csvFeld(e.email), csvFeld(e.business), csvFeld(e.created_at)].join(",")
    ),
  ];

  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="klarblick-warteliste.csv"');
  // Byte Order Mark, damit Excel die Umlaute richtig anzeigt.
  res.send("\uFEFF" + zeilen.join("\n") + "\n");
});
