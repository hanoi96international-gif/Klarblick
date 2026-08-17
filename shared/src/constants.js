// Schwellwerte, Kategorien und Beschriftungen an einer Stelle, damit Dashboard,
// Beweispaket-Export und Tests garantiert dieselben Werte benutzen.

/** Ab diesem Risikoscore gilt eine Bewertung als auffällig (Zählung, Export). */
export const FLAGGED_THRESHOLD = 30;

/** Ab diesem Risikoscore gilt eine Bewertung als hochriskant. */
export const HIGH_RISK_THRESHOLD = 60;

/** Bewertungen bis einschließlich dieser Sternezahl gelten als negativ. */
export const NEGATIVE_RATING_MAX = 2;

export const THRESHOLDS = {
  /** Maximaler Abstand zwischen zwei negativen Bewertungen für eine Häufung (Stunden). */
  velocityWindowHours: 48,
  /** Mindestruhe vor einer Häufung, damit sie als Ausbruch nach Stille zählt (Tage). */
  silenceGapDays: 14,
  /** Jaccard-Ähnlichkeit, ab der zwei Texte als auffällig ähnlich gelten. */
  similarityMin: 0.35,
  /** Generizitätswert, ab dem eine Bewertung als inhaltsleer markiert wird. */
  genericityMin: 45,
  /** Abweichung vom Schnitt der übrigen Bewertungen, ab der markiert wird (Sterne). */
  ratingDeviationMin: 2.5,
  /** Sentiment-Betrag, ab dem Text und Sternezahl als widersprüchlich gelten. */
  sentimentMismatchMin: 2,
  /** Mindestzahl Bewertungen, bevor die Kampagnen-Warnung überhaupt greift. */
  bimodalMinReviews: 6,
  /** Anteil 1★+5★, ab dem die Verteilung als bimodal gilt. */
  bimodalExtremeShare: 0.8,
  /** Anteil 2★–4★, unter dem die Verteilung als bimodal gilt. */
  bimodalMidShare: 0.2,
};

/** Risikopunkte je Signal. */
export const FLAG_WEIGHTS = {
  velocity: 25,
  silence: 20,
  similarity: 30,
  deviation: 15,
  "single-account": 20,
  "sentiment-mismatch": 20,
  caps: 10,
  "duplicate-reviewer": 15,
  // "generic" wird proportional zum Generizitätswert vergeben, siehe detector.js
};

// Welcher Beweiskategorie ein Signal angehört. Die veröffentlichte Forschung zur
// Fake-Review-Erkennung behandelt statistische, textuelle und verhaltensbasierte
// Signale als einander ergänzend: eine Bewertung, die in mehreren Kategorien
// auffällt, ist deutlich verdächtiger als eine, die mehrfach innerhalb derselben
// Kategorie auffällt (zwei textuelle Eigenheiten können schlicht am Schreibstil
// liegen).
export const FLAG_CATEGORY = {
  velocity: "statistical",
  silence: "statistical",
  deviation: "statistical",
  similarity: "textual",
  generic: "textual",
  "sentiment-mismatch": "textual",
  caps: "textual",
  "single-account": "behavioral",
  "duplicate-reviewer": "behavioral",
};

export const FLAG_LABELS = {
  velocity: "Zeitliche Häufung",
  silence: "Ausbruch nach langer Stille",
  similarity: "Ähnlicher Text wie andere Bewertung",
  generic: "Generisch, kaum konkrete Details",
  deviation: "Weicht stark vom Gesamtschnitt ab",
  "single-account": "Konto mit nur dieser einen Bewertung",
  "sentiment-mismatch": "Text passt nicht zur Sternebewertung",
  caps: "Auffällige Schreibweise (Caps/Ausrufezeichen)",
  "duplicate-reviewer": "Name mehrfach in der Fallakte",
};

export const CONFIDENCE_LABELS = {
  hoch: { label: "Hohe Konfidenz", color: "#C2463D" },
  "erste-hinweise": { label: "Erste Hinweise", color: "#D9A441" },
  keine: { label: "—", color: "#8B93A7" },
};

/** Einstufung eines Risikoscores in Label und Farbe. */
export function riskLabel(risk) {
  if (risk >= HIGH_RISK_THRESHOLD) return { label: "Hohes Risiko", color: "#C2463D" };
  if (risk >= FLAGGED_THRESHOLD) return { label: "Auffällig", color: "#D9A441" };
  return { label: "Unauffällig", color: "#4FA69C" };
}
