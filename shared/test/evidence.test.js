import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzeReviews } from "../src/detector.js";
import { buildEvidenceReport } from "../src/evidence.js";

const CREATED_AT = new Date("2026-08-17T10:00:00Z");

function campaignCase() {
  return analyzeReviews([
    {
      id: "a",
      reviewer: "M. K.",
      rating: 1,
      date: "2026-08-10T09:00",
      text: "Absolute Katastrophe, nie wieder!",
      reviewerReviewCount: "1",
    },
    {
      id: "b",
      reviewer: "T. R.",
      rating: 1,
      date: "2026-08-10T11:30",
      text: "Absolute Katastrophe, nie wieder hier.",
      reviewerReviewCount: "1",
    },
    {
      id: "c",
      reviewer: "S. Berger",
      rating: 5,
      date: "2026-07-02T14:00",
      text: "Herr Wagner hat unsere Heizung am 2. Juli in 3 Stunden repariert, fair im Preis.",
      reviewerReviewCount: "14",
    },
  ]);
}

describe("buildEvidenceReport", () => {
  it("nennt Anzahl, Score, Konfidenz und Gründe je auffälliger Bewertung", () => {
    const report = buildEvidenceReport(campaignCase(), { createdAt: CREATED_AT });
    assert.match(report, /BEWEISPAKET/);
    assert.match(report, /Anzahl auffälliger Bewertungen: 2/);
    assert.match(report, /Risikoscore: \d+\/100/);
    assert.match(report, /Konfidenz: hoch/);
    assert.match(report, /Zeitliche Häufung/);
  });

  it("führt unauffällige Bewertungen nicht auf", () => {
    const report = buildEvidenceReport(campaignCase(), { createdAt: CREATED_AT });
    assert.ok(!report.includes("S. Berger"), "positive Bewertung darf nicht im Beweispaket stehen");
  });

  it("übernimmt den Firmennamen, wenn er übergeben wurde", () => {
    const report = buildEvidenceReport(campaignCase(), {
      businessName: "Heizung Wagner GmbH",
      createdAt: CREATED_AT,
    });
    assert.match(report, /Unternehmen: Heizung Wagner GmbH/);
  });

  it("enthält immer den Hinweis auf den heuristischen Charakter", () => {
    const report = buildEvidenceReport(campaignCase(), { createdAt: CREATED_AT });
    assert.match(report, /heuristische Ersteinschätzung/);
    assert.match(report, /nicht als alleinigen Beweis/);
  });

  it("formuliert einen sauberen Bericht, wenn nichts auffällig war", () => {
    const analysis = analyzeReviews([
      { id: "a", reviewer: "A", rating: 5, date: "2026-01-01", text: "Alles gut gelaufen am 3. Mai." },
    ]);
    const report = buildEvidenceReport(analysis, { createdAt: CREATED_AT });
    assert.match(report, /keine Bewertung als auffällig/);
  });

  it("weist auf die Kampagnen-Verteilung hin, wenn sie erkannt wurde", () => {
    const analysis = analyzeReviews(
      [1, 1, 1, 5, 5, 5].map((rating, i) => ({
        id: `r${i}`,
        reviewer: `P${i}`,
        rating,
        date: "2026-08-10T09:00",
        text: rating === 1 ? "totaler mist" : "war super, danke",
      }))
    );
    assert.equal(analysis.bimodalWarning, true);
    const report = buildEvidenceReport(analysis, { createdAt: CREATED_AT });
    assert.match(report, /GESAMTBILD/);
    assert.match(report, /bimodale Verteilung/);
  });
});
