// Beweispaket: der eigentliche Wert für den Kunden. Es geht als Anhang an die
// eigene Google-Meldung, muss also für einen Menschen ohne Vorkenntnisse lesbar
// sein und darf nichts behaupten, was die Heuristik nicht hergibt.

import { FLAGGED_THRESHOLD, FLAG_LABELS, riskLabel } from "./constants.js";

const DISCLAIMER = [
  "Hinweis: Dies ist eine heuristische Ersteinschätzung auf Basis von Zeitmuster,",
  "Textähnlichkeit, Bewertungsabweichung, Kontosignalen und weiteren Mustern aus",
  "veröffentlichter Forschung zu Fake-Review-Erkennung. Für eine Google-Meldung als",
  "unterstützendes Dokument verwenden, nicht als alleinigen Beweis.",
].join("\n");

/**
 * Baut den Textbericht zu einer Analyse.
 *
 * @param {{results: Array<object>, bimodalWarning: boolean}} analysis
 * @param {{businessName?: string, createdAt?: Date}} [options]
 * @returns {string}
 */
export function buildEvidenceReport(analysis, options = {}) {
  const { businessName, createdAt = new Date() } = options;
  const flagged = analysis.results
    .filter((r) => r.risk >= FLAGGED_THRESHOLD)
    .sort((a, b) => b.risk - a.risk);

  const header = [
    "BEWEISPAKET — Verdächtige Bewertungsmuster",
    businessName ? `Unternehmen: ${businessName}` : null,
    `Erstellt: ${createdAt.toLocaleString("de-DE")}`,
    `Geprüfte Bewertungen: ${analysis.results.length}`,
    `Anzahl auffälliger Bewertungen: ${flagged.length}`,
  ].filter(Boolean);

  const campaign = analysis.bimodalWarning
    ? [
        "",
        "GESAMTBILD: Die Bewertungen häufen sich fast ausschließlich bei 1★ und 5★,",
        "kaum etwas dazwischen. Diese bimodale Verteilung tritt bei organischem",
        "Feedback selten auf und gilt als Hinweis auf eine koordinierte Kampagne.",
      ]
    : [];

  const entries = flagged.map((r, i) => {
    const rl = riskLabel(r.risk);
    return [
      "",
      `${i + 1}. Bewertung von "${r.reviewer || "unbekannt"}" — ${r.rating}★ — ${
        r.date || "kein Datum"
      }`,
      `   Risikoscore: ${r.risk}/100 (${rl.label})`,
      `   Konfidenz: ${r.confidence === "hoch" ? "hoch (mehrere Beweiskategorien)" : "erste Hinweise (eine Beweiskategorie)"}`,
      `   Gründe: ${r.flags.map((f) => FLAG_LABELS[f] ?? f).join("; ")}`,
      `   Text: "${r.text}"`,
    ].join("\n");
  });

  const body =
    flagged.length === 0
      ? ["", "In dieser Fallakte wurde keine Bewertung als auffällig eingestuft."]
      : entries;

  return [...header, ...campaign, ...body, "", DISCLAIMER].join("\n");
}
