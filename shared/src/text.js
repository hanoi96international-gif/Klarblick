// Textmerkmale für die Bewertungsanalyse. Bewusst einfach gehalten und ohne
// externe Abhängigkeiten: jedes Merkmal muss sich einem Kunden in einem Satz
// erklären lassen, sonst taugt es nicht als Beweismittel.

const PUNCTUATION = /[.,!?;:()"„“”'’]/g;

/** Zerlegt Text in eine Menge kleingeschriebener Wörter ab drei Zeichen. */
export function tokenize(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(PUNCTUATION, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

/** Jaccard-Ähnlichkeit zweier Texte über ihre Wortmengen (0 bis 1). */
export function jaccard(a, b) {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const GENERIC_PHRASES = [
  "nie wieder",
  "finger weg",
  "absolute abzocke",
  "katastrophe",
  "unterirdisch",
  "totaler mist",
  "nicht zu empfehlen",
  "schlechtester service",
  "würde ich nie",
];

/**
 * Wie inhaltsleer ein Text ist (0 bis 100). Echte Beschwerden nennen typischerweise
 * Zeitpunkte, Beträge oder Namen — Fälschungen bleiben oft allgemein.
 */
export function genericityScore(text) {
  const t = (text || "").toLowerCase();
  const wordCount = tokenize(text).size;
  const hasNumbers = /\d/.test(t);
  const hasProperNoun = /\b[A-ZÄÖÜ][a-zäöü]{2,}\b/.test(text || "");
  let score = 0;
  if (wordCount < 8) score += 35;
  if (!hasNumbers) score += 15;
  if (!hasProperNoun) score += 10;
  for (const p of GENERIC_PHRASES) {
    if (t.includes(p)) score += 15;
  }
  return Math.min(score, 100);
}

export const POSITIVE_WORDS = [
  "super", "toll", "freundlich", "empfehlenswert", "zufrieden", "kompetent",
  "schnell", "professionell", "top", "perfekt", "hervorragend", "sauber",
  "fair", "herzlich", "kompetenz", "great", "amazing", "excellent",
];

export const NEGATIVE_WORDS = [
  "schlecht", "katastrophe", "unfreundlich", "enttäuscht", "nie wieder",
  "abzocke", "unterirdisch", "frech", "respektlos", "chaos", "versagen",
  "horrible", "terrible", "awful", "scam",
];

/** Grobes Stimmungsmaß: positive Treffer minus negative Treffer. */
export function sentimentScore(text) {
  const t = (text || "").toLowerCase();
  let score = 0;
  for (const w of POSITIVE_WORDS) if (t.includes(w)) score += 1;
  for (const w of NEGATIVE_WORDS) if (t.includes(w)) score -= 1;
  return score;
}

/** Schreit der Text (viele Großbuchstaben oder Ausrufezeichen)? */
export function hasSpamStyle(text) {
  const t = text || "";
  const letters = t.replace(/[^a-zA-ZäöüÄÖÜß]/g, "");
  const capsRatio =
    letters.length > 8 ? letters.replace(/[^A-ZÄÖÜ]/g, "").length / letters.length : 0;
  const exclamations = (t.match(/!/g) || []).length;
  return capsRatio >= 0.3 || exclamations >= 3;
}
