// Sabotage-Detektor: neun Signale aus drei unabhängigen Beweiskategorien.
//
// Grundgedanke: kein einzelnes Signal beweist etwas. Erst wenn eine Bewertung in
// mehreren *Kategorien* auffällt (statistisch, textuell, verhaltensbasiert),
// steigt die Konfidenz — genau so kombiniert die veröffentlichte Forschung zur
// Fake-Review-Erkennung ihre Merkmalsgruppen (u. a. Lim et al., Fei et al.,
// Savage et al., Li et al. zur bimodalen Verteilung).

import {
  FLAGGED_THRESHOLD,
  FLAG_CATEGORY,
  FLAG_WEIGHTS,
  NEGATIVE_RATING_MAX,
  THRESHOLDS,
} from "./constants.js";
import { genericityScore, hasSpamStyle, jaccard, sentimentScore } from "./text.js";

const HOUR_MS = 36e5;
const DAY_MS = 864e5;

/** Parst ein Datum zu einem Zeitstempel, oder null wenn unbrauchbar. */
export function parseDate(d) {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : t;
}

function isNegative(review) {
  return Number(review.rating) <= NEGATIVE_RATING_MAX;
}

/**
 * Analysiert eine Fallakte von Bewertungen.
 *
 * @param {Array<{id?: string, reviewer?: string, rating: number|string, date?: string, text?: string, reviewerReviewCount?: number|string}>} reviews
 * @returns {{results: Array<object>, bimodalWarning: boolean, summary: object}}
 */
export function analyzeReviews(reviews) {
  const input = Array.isArray(reviews) ? reviews : [];
  const results = input.map((r, i) => ({
    ...r,
    id: r.id ?? `review-${i}`,
    flags: [],
    risk: 0,
  }));

  const byId = new Map(results.map((r) => [r.id, r]));

  function flag(id, name, points) {
    const target = byId.get(id);
    if (!target || target.flags.includes(name)) return;
    target.flags.push(name);
    target.risk += points;
  }

  // ---- 1 + 2. Zeitliche Häufung und Ausbruch nach Stille (statistisch) ----
  //
  // Eine negative Bewertung gilt als gehäuft, wenn eine weitere negative Bewertung
  // innerhalb von 48 Stunden liegt. Da die Liste zeitlich sortiert ist, genügt der
  // Blick auf die direkten Nachbarn.
  //
  // Ein Ausbruch zählt zusätzlich als "nach Stille", wenn vor der ersten Bewertung
  // der Häufung mindestens 14 Tage ohne negative Bewertung lagen. Liegt gar keine
  // frühere negative Bewertung vor, lässt sich keine Ruhephase belegen — dann wird
  // bewusst *nicht* markiert, sonst würde die jeweils älteste Häufung eines jeden
  // Datensatzes automatisch als Ausbruch gelten.
  const negatives = results
    .filter(isNegative)
    .map((r) => ({ id: r.id, t: parseDate(r.date) }))
    .filter((r) => r.t !== null)
    .sort((a, b) => a.t - b.t);

  const velocityWindow = THRESHOLDS.velocityWindowHours * HOUR_MS;
  const silenceGap = THRESHOLDS.silenceGapDays * DAY_MS;

  let clusterStart = null;
  for (let i = 0; i < negatives.length; i++) {
    const linkedToPrev = i > 0 && negatives[i].t - negatives[i - 1].t <= velocityWindow;
    const linkedToNext =
      i < negatives.length - 1 && negatives[i + 1].t - negatives[i].t <= velocityWindow;

    if (!linkedToPrev && !linkedToNext) {
      clusterStart = null;
      continue;
    }

    flag(negatives[i].id, "velocity", FLAG_WEIGHTS.velocity);

    if (!linkedToPrev) clusterStart = i; // erste Bewertung einer neuen Häufung
    const start = clusterStart ?? i;
    const hasEarlierNegative = start > 0;
    const gapBeforeCluster = hasEarlierNegative
      ? negatives[start].t - negatives[start - 1].t
      : null;

    if (gapBeforeCluster !== null && gapBeforeCluster >= silenceGap) {
      flag(negatives[i].id, "silence", FLAG_WEIGHTS.silence);
    }
  }

  // ---- 3. Textähnlichkeit unter negativen Bewertungen (textuell) ----
  const negativeResults = results.filter(isNegative);
  for (let i = 0; i < negativeResults.length; i++) {
    for (let j = i + 1; j < negativeResults.length; j++) {
      if (jaccard(negativeResults[i].text, negativeResults[j].text) >= THRESHOLDS.similarityMin) {
        flag(negativeResults[i].id, "similarity", FLAG_WEIGHTS.similarity);
        flag(negativeResults[j].id, "similarity", FLAG_WEIGHTS.similarity);
      }
    }
  }

  // ---- 4. Generizität (textuell) ----
  for (const r of results) {
    if (!isNegative(r)) continue;
    const g = genericityScore(r.text);
    if (g >= THRESHOLDS.genericityMin) {
      flag(r.id, "generic", Math.round(g * 0.3));
    }
  }

  // ---- 5. Abweichung vom Gesamtschnitt (statistisch) ----
  // Verglichen wird gegen den Schnitt aller *übrigen* Bewertungen, damit die
  // Bewertung selbst ihren eigenen Referenzwert nicht verschiebt.
  const ratings = results.map((r) => Number(r.rating));
  const ratingSum = ratings.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  for (let i = 0; i < results.length; i++) {
    if (results.length < 2) break;
    const own = ratings[i];
    if (!Number.isFinite(own)) continue;
    const avgOthers = (ratingSum - own) / (results.length - 1);
    if (Math.abs(own - avgOthers) >= THRESHOLDS.ratingDeviationMin && isNegative(results[i])) {
      flag(results[i].id, "deviation", FLAG_WEIGHTS.deviation);
    }
  }

  // ---- 6. Konto mit nur einer einzigen Bewertung (verhaltensbasiert) ----
  for (const r of results) {
    const count = Number(r.reviewerReviewCount);
    if (Number.isFinite(count) && count === 1 && isNegative(r)) {
      flag(r.id, "single-account", FLAG_WEIGHTS["single-account"]);
    }
  }

  // ---- 7. Text passt nicht zur Sternezahl (textuell) ----
  for (const r of results) {
    const s = sentimentScore(r.text);
    const rating = Number(r.rating);
    const min = THRESHOLDS.sentimentMismatchMin;
    if ((rating <= NEGATIVE_RATING_MAX && s >= min) || (rating >= 4 && s <= -min)) {
      flag(r.id, "sentiment-mismatch", FLAG_WEIGHTS["sentiment-mismatch"]);
    }
  }

  // ---- 8. Auffällige Schreibweise (textuell) ----
  for (const r of results) {
    if (isNegative(r) && hasSpamStyle(r.text)) {
      flag(r.id, "caps", FLAG_WEIGHTS.caps);
    }
  }

  // ---- 9. Gleicher Name mehrfach (verhaltensbasiert) ----
  const nameCounts = new Map();
  for (const r of results) {
    const key = (r.reviewer || "").trim().toLowerCase();
    if (!key) continue;
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }
  for (const r of results) {
    const key = (r.reviewer || "").trim().toLowerCase();
    if (key && nameCounts.get(key) > 1) {
      flag(r.id, "duplicate-reviewer", FLAG_WEIGHTS["duplicate-reviewer"]);
    }
  }

  // ---- Konfidenz über Kategoriegrenzen hinweg ----
  const scored = results.map((r) => {
    const categories = new Set(r.flags.map((f) => FLAG_CATEGORY[f]));
    return {
      ...r,
      risk: Math.min(r.risk, 99),
      categoryCount: categories.size,
      confidence:
        categories.size >= 2 ? "hoch" : categories.size === 1 ? "erste-hinweise" : "keine",
    };
  });

  return {
    results: scored,
    bimodalWarning: detectBimodal(input),
    summary: summarize(scored),
  };
}

/**
 * Fallweites Signal: eine bimodale Verteilung (fast nur 1★ und 5★, kaum etwas
 * dazwischen) ist ein dokumentiertes Muster koordinierter Kampagnen. Organisches
 * Feedback verteilt sich gleichmäßiger.
 */
export function detectBimodal(reviews) {
  const hist = [0, 0, 0, 0, 0, 0];
  let counted = 0;
  for (const r of reviews) {
    const n = Number(r.rating);
    if (n >= 1 && n <= 5) {
      hist[n] += 1;
      counted += 1;
    }
  }
  if (counted < THRESHOLDS.bimodalMinReviews) return false;
  const extremeShare = (hist[1] + hist[5]) / counted;
  const midShare = (hist[2] + hist[3] + hist[4]) / counted;
  return (
    extremeShare >= THRESHOLDS.bimodalExtremeShare && midShare <= THRESHOLDS.bimodalMidShare
  );
}

function summarize(scored) {
  return {
    total: scored.length,
    flagged: scored.filter((r) => r.risk >= FLAGGED_THRESHOLD).length,
    highConfidence: scored.filter((r) => r.confidence === "hoch").length,
  };
}
