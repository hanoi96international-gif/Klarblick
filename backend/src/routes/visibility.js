// AI-Sichtbarkeits-Check.
//
// Der Aufruf lief früher direkt aus dem Browser gegen api.anthropic.com — ohne
// Schlüssel, also immer erfolglos, und mit Schlüssel wäre dieser für jeden
// Besucher im Netzwerk-Tab sichtbar gewesen. Deshalb läuft die Anfrage jetzt
// serverseitig: der Schlüssel verlässt den Server nie.

import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";

import { anthropicConfigured, config } from "../config.js";

export const visibilityRouter = Router();

const MAX_FIELD_LENGTH = 120;

/** Die Formulierungen, mit denen ein Kunde real nach einem Anbieter suchen würde. */
export function visibilityPrompts(category, city) {
  return [
    `Nenne mir die 5 besten Anbieter für ${category} in ${city}. Nur eine kurze Liste mit Namen, keine Erklärung.`,
    `Ich suche jemanden für ${category} in ${city}. Wen empfiehlst du?`,
    `Welche Firma für ${category} in ${city} hat den besten Ruf?`,
    `Top-Empfehlung für ${category} in ${city}?`,
    `Vergleiche die bekanntesten Anbieter für ${category} in ${city}.`,
  ];
}

/** Sammelt den Textanteil einer Antwort. */
function extractText(message) {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

let client = null;
function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return client;
}

function validate(body) {
  const fields = ["name", "category", "city"];
  const cleaned = {};

  for (const field of fields) {
    const value = typeof body?.[field] === "string" ? body[field].trim() : "";
    if (!value) return { error: `Feld "${field}" fehlt.` };
    if (value.length > MAX_FIELD_LENGTH) {
      return { error: `Feld "${field}" ist zu lang (max. ${MAX_FIELD_LENGTH} Zeichen).` };
    }
    cleaned[field] = value;
  }
  return { value: cleaned };
}

visibilityRouter.post("/", async (req, res) => {
  if (!anthropicConfigured) {
    return res.status(503).json({
      error:
        "Der AI-Sichtbarkeits-Check ist auf diesem Server nicht konfiguriert " +
        "(ANTHROPIC_API_KEY fehlt).",
    });
  }

  const { value, error } = validate(req.body);
  if (error) return res.status(400).json({ error });

  const { name, category, city } = value;
  const prompts = visibilityPrompts(category, city);
  const needle = name.toLowerCase();

  try {
    const outcomes = await Promise.all(
      prompts.map(async (prompt) => {
        const message = await getClient().messages.create({
          model: config.anthropic.model,
          max_tokens: 4096,
          // Kurze Empfehlungslisten brauchen keine tiefe Analyse; niedriger
          // Aufwand hält Latenz und Kosten unten. Das Nachdenken selbst bleibt
          // aktiv — abgeschaltet neigt das Modell dazu, interne Marker in die
          // sichtbare Antwort zu schreiben.
          output_config: { effort: "low" },
          messages: [{ role: "user", content: prompt }],
        });

        if (message.stop_reason === "refusal") {
          return {
            prompt,
            response: "Für diese Anfrage wurde keine Antwort erzeugt.",
            mentioned: false,
            refused: true,
          };
        }

        const text = extractText(message);
        return {
          prompt,
          response: text,
          mentioned: text.toLowerCase().includes(needle),
          refused: false,
        };
      })
    );

    res.json({
      business: { name, category, city },
      results: outcomes,
      score: outcomes.filter((o) => o.mentioned).length,
      total: outcomes.length,
      model: config.anthropic.model,
    });
  } catch (err) {
    // Typisierte Fehlerklassen statt Textvergleich — von spezifisch nach allgemein.
    if (err instanceof Anthropic.RateLimitError) {
      const retryAfter = err.headers?.["retry-after"];
      if (retryAfter) res.set("Retry-After", retryAfter);
      return res.status(429).json({
        error: "Zu viele Anfragen an den KI-Dienst. Bitte in einer Minute erneut versuchen.",
      });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic-Schlüssel ungültig:", err.message);
      return res.status(503).json({ error: "Der KI-Dienst ist gerade nicht verfügbar." });
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return res.status(504).json({ error: "Der KI-Dienst antwortet nicht. Bitte erneut versuchen." });
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`Anthropic-Fehler ${err.status}:`, err.message);
      return res.status(502).json({ error: "Die Anfrage an den KI-Dienst ist fehlgeschlagen." });
    }

    console.error("Unerwarteter Fehler im Sichtbarkeits-Check:", err);
    res.status(500).json({ error: "Unerwarteter Fehler." });
  }
});
