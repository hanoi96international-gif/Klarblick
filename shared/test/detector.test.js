import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzeReviews, detectBimodal } from "../src/detector.js";
import { FLAG_CATEGORY } from "../src/constants.js";

/** Baut eine Bewertung mit sinnvollen Vorgabewerten. */
function review(overrides = {}) {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    reviewer: "Jemand",
    rating: 5,
    date: "2026-01-01T12:00",
    text: "Wir haben am 3. Januar 2 Fenster einbauen lassen, Herr Wagner war pünktlich und fair.",
    reviewerReviewCount: "12",
    ...overrides,
  };
}

/** Findet das Ergebnis zu einer ID. */
function byId(analysis, id) {
  const found = analysis.results.find((r) => r.id === id);
  assert.ok(found, `Bewertung ${id} fehlt im Ergebnis`);
  return found;
}

describe("Zeitliche Häufung (velocity)", () => {
  it("markiert zwei negative Bewertungen innerhalb von 48 Stunden", () => {
    const a = analyzeReviews([
      review({ id: "a", rating: 1, date: "2026-08-10T09:00" }),
      review({ id: "b", rating: 1, date: "2026-08-10T11:30" }),
    ]);
    assert.ok(byId(a, "a").flags.includes("velocity"));
    assert.ok(byId(a, "b").flags.includes("velocity"));
  });

  it("markiert nicht, wenn die Bewertungen weit auseinanderliegen", () => {
    const a = analyzeReviews([
      review({ id: "a", rating: 1, date: "2026-08-01T09:00" }),
      review({ id: "b", rating: 1, date: "2026-08-20T09:00" }),
    ]);
    assert.ok(!byId(a, "a").flags.includes("velocity"));
    assert.ok(!byId(a, "b").flags.includes("velocity"));
  });

  it("ignoriert positive Bewertungen bei der Häufung", () => {
    const a = analyzeReviews([
      review({ id: "a", rating: 5, date: "2026-08-10T09:00" }),
      review({ id: "b", rating: 5, date: "2026-08-10T11:00" }),
    ]);
    assert.ok(!byId(a, "a").flags.includes("velocity"));
  });

  it("ignoriert Bewertungen ohne verwertbares Datum", () => {
    const a = analyzeReviews([
      review({ id: "a", rating: 1, date: "" }),
      review({ id: "b", rating: 1, date: "kein datum" }),
    ]);
    assert.ok(!byId(a, "a").flags.includes("velocity"));
    assert.ok(!byId(a, "b").flags.includes("velocity"));
  });
});

describe("Ausbruch nach Stille (silence)", () => {
  it("markiert eine Häufung, der eine lange Ruhephase vorausging", () => {
    const a = analyzeReviews([
      review({ id: "alt", rating: 1, date: "2026-06-01T10:00" }),
      review({ id: "neu1", rating: 1, date: "2026-07-05T10:00" }),
      review({ id: "neu2", rating: 1, date: "2026-07-05T14:00" }),
    ]);
    assert.ok(byId(a, "neu1").flags.includes("silence"));
    assert.ok(byId(a, "neu2").flags.includes("silence"));
    assert.ok(!byId(a, "alt").flags.includes("silence"));
  });

  it("markiert die früheste Häufung nicht, weil sich davor keine Ruhe belegen lässt", () => {
    // Ohne vorherige negative Bewertung ist unbekannt, ob es überhaupt eine
    // Ruhephase gab. Früher galt dieser Fall automatisch als Ausbruch und hat
    // jeden Datensatz mit 20 Risikopunkten zu hoch bewertet.
    const a = analyzeReviews([
      review({ id: "a", rating: 1, date: "2026-08-10T09:00" }),
      review({ id: "b", rating: 1, date: "2026-08-10T11:30" }),
    ]);
    assert.ok(byId(a, "a").flags.includes("velocity"));
    assert.ok(!byId(a, "a").flags.includes("silence"));
    assert.ok(!byId(a, "b").flags.includes("silence"));
  });

  it("markiert nicht, wenn die Ruhephase kürzer als 14 Tage war", () => {
    const a = analyzeReviews([
      review({ id: "alt", rating: 1, date: "2026-07-01T10:00" }),
      review({ id: "neu1", rating: 1, date: "2026-07-08T10:00" }),
      review({ id: "neu2", rating: 1, date: "2026-07-08T14:00" }),
    ]);
    assert.ok(byId(a, "neu1").flags.includes("velocity"));
    assert.ok(!byId(a, "neu1").flags.includes("silence"));
  });
});

describe("Textähnlichkeit (similarity)", () => {
  it("markiert zwei nahezu gleichlautende negative Bewertungen", () => {
    const a = analyzeReviews([
      review({ id: "a", rating: 1, text: "Absolute Katastrophe, nie wieder hier" }),
      review({ id: "b", rating: 1, text: "Absolute Katastrophe, nie wieder!" }),
    ]);
    assert.ok(byId(a, "a").flags.includes("similarity"));
    assert.ok(byId(a, "b").flags.includes("similarity"));
  });

  it("markiert inhaltlich verschiedene Beschwerden nicht", () => {
    const a = analyzeReviews([
      review({ id: "a", rating: 1, text: "Die Heizung wurde am 4. Mai falsch angeschlossen." }),
      review({ id: "b", rating: 1, text: "Termin dreimal verschoben, niemand hat angerufen." }),
    ]);
    assert.ok(!byId(a, "a").flags.includes("similarity"));
  });
});

describe("Generizität (generic)", () => {
  it("markiert kurze, inhaltsleere Beschwerden", () => {
    const a = analyzeReviews([review({ id: "a", rating: 1, text: "totaler mist" })]);
    assert.ok(byId(a, "a").flags.includes("generic"));
  });

  it("markiert konkrete Beschwerden mit Details nicht", () => {
    const a = analyzeReviews([
      review({
        id: "a",
        rating: 1,
        text: "Am 12. März wurde ein Kostenvoranschlag über 450 Euro zugesagt, abgerechnet wurden 890 Euro von Herrn Meier.",
      }),
    ]);
    assert.ok(!byId(a, "a").flags.includes("generic"));
  });
});

describe("Abweichung vom Gesamtschnitt (deviation)", () => {
  it("markiert einen Ausreißer nach unten in einem sonst guten Profil", () => {
    const a = analyzeReviews([
      review({ id: "gut1", rating: 5 }),
      review({ id: "gut2", rating: 5 }),
      review({ id: "gut3", rating: 5 }),
      review({ id: "gut4", rating: 5 }),
      review({ id: "schlecht", rating: 1, text: "Die Rechnung war am 5. Mai um 200 Euro zu hoch." }),
    ]);
    assert.ok(byId(a, "schlecht").flags.includes("deviation"));
    assert.ok(!byId(a, "gut1").flags.includes("deviation"));
  });

  it("markiert nichts bei nur einer einzigen Bewertung", () => {
    const a = analyzeReviews([review({ id: "a", rating: 1 })]);
    assert.ok(!byId(a, "a").flags.includes("deviation"));
  });
});

describe("Konto mit einer einzigen Bewertung (single-account)", () => {
  it("markiert eine negative Bewertung von einem Konto mit genau einer Bewertung", () => {
    const a = analyzeReviews([review({ id: "a", rating: 1, reviewerReviewCount: "1" })]);
    assert.ok(byId(a, "a").flags.includes("single-account"));
  });

  it("markiert etablierte Konten nicht", () => {
    const a = analyzeReviews([review({ id: "a", rating: 1, reviewerReviewCount: "37" })]);
    assert.ok(!byId(a, "a").flags.includes("single-account"));
  });

  it("markiert nicht, wenn die Kontozahl gar nicht angegeben wurde", () => {
    const a = analyzeReviews([review({ id: "a", rating: 1, reviewerReviewCount: "" })]);
    assert.ok(!byId(a, "a").flags.includes("single-account"));
  });
});

describe("Text passt nicht zur Sternezahl (sentiment-mismatch)", () => {
  it("markiert eine 1★-Bewertung mit durchweg positivem Text", () => {
    const a = analyzeReviews([
      review({ id: "a", rating: 1, text: "Super freundlich und sehr kompetent, top." }),
    ]);
    assert.ok(byId(a, "a").flags.includes("sentiment-mismatch"));
  });

  it("markiert eine 5★-Bewertung mit durchweg negativem Text", () => {
    const a = analyzeReviews([
      review({ id: "a", rating: 5, text: "Unfreundlich, respektlos, reine Abzocke." }),
    ]);
    assert.ok(byId(a, "a").flags.includes("sentiment-mismatch"));
  });

  it("markiert stimmige Bewertungen nicht", () => {
    const a = analyzeReviews([
      review({ id: "a", rating: 5, text: "Sehr freundlich, kompetent und schnell." }),
    ]);
    assert.ok(!byId(a, "a").flags.includes("sentiment-mismatch"));
  });
});

describe("Auffällige Schreibweise (caps)", () => {
  it("markiert viele Ausrufezeichen", () => {
    const a = analyzeReviews([review({ id: "a", rating: 1, text: "Betrug!!! Niemals!!!" })]);
    assert.ok(byId(a, "a").flags.includes("caps"));
  });

  it("markiert durchgehende Großschreibung", () => {
    const a = analyzeReviews([review({ id: "a", rating: 1, text: "ABSOLUT UNBRAUCHBARE ARBEIT" })]);
    assert.ok(byId(a, "a").flags.includes("caps"));
  });

  it("markiert normal geschriebene Beschwerden nicht", () => {
    const a = analyzeReviews([
      review({ id: "a", rating: 1, text: "Der Termin am 4. Juni wurde ohne Absage nicht eingehalten." }),
    ]);
    assert.ok(!byId(a, "a").flags.includes("caps"));
  });
});

describe("Mehrfach genutzter Name (duplicate-reviewer)", () => {
  it("markiert beide Bewertungen desselben Namens", () => {
    const a = analyzeReviews([
      review({ id: "a", reviewer: "M. Klein", rating: 1 }),
      review({ id: "b", reviewer: "m. klein ", rating: 1 }),
    ]);
    assert.ok(byId(a, "a").flags.includes("duplicate-reviewer"));
    assert.ok(byId(a, "b").flags.includes("duplicate-reviewer"));
  });

  it("markiert leere Namen nicht als Dublette", () => {
    const a = analyzeReviews([
      review({ id: "a", reviewer: "", rating: 1 }),
      review({ id: "b", reviewer: "", rating: 1 }),
    ]);
    assert.ok(!byId(a, "a").flags.includes("duplicate-reviewer"));
  });
});

describe("Konfidenz über Kategoriegrenzen", () => {
  it("meldet hohe Konfidenz erst bei mindestens zwei Beweiskategorien", () => {
    const a = analyzeReviews([
      review({ id: "a", rating: 1, date: "2026-08-10T09:00", text: "totaler mist" }),
      review({ id: "b", rating: 1, date: "2026-08-10T11:00", text: "totaler mist" }),
    ]);
    const r = byId(a, "a");
    const categories = new Set(r.flags.map((f) => FLAG_CATEGORY[f]));
    assert.ok(categories.size >= 2, `nur Kategorien: ${[...categories]}`);
    assert.equal(r.confidence, "hoch");
  });

  it("meldet bei einer einzelnen Kategorie nur erste Hinweise", () => {
    const a = analyzeReviews([
      review({
        id: "a",
        rating: 1,
        reviewerReviewCount: "1",
        date: "",
        text: "Der Kostenvoranschlag vom 8. April über 300 Euro wurde von Frau Berger nicht eingehalten.",
      }),
    ]);
    const r = byId(a, "a");
    assert.deepEqual(r.flags, ["single-account"]);
    assert.equal(r.confidence, "erste-hinweise");
  });

  it("meldet ohne Auffälligkeit keine Konfidenz", () => {
    const a = analyzeReviews([review({ id: "a", rating: 5 })]);
    assert.equal(byId(a, "a").confidence, "keine");
    assert.equal(byId(a, "a").risk, 0);
  });
});

describe("Kampagnen-Warnung (bimodale Verteilung)", () => {
  it("warnt bei fast ausschließlich 1★ und 5★", () => {
    const reviews = [1, 1, 1, 5, 5, 5].map((rating, i) => review({ id: `r${i}`, rating }));
    assert.equal(detectBimodal(reviews), true);
    assert.equal(analyzeReviews(reviews).bimodalWarning, true);
  });

  it("warnt nicht bei gleichmäßiger Verteilung", () => {
    const reviews = [1, 2, 3, 4, 5, 4].map((rating, i) => review({ id: `r${i}`, rating }));
    assert.equal(detectBimodal(reviews), false);
  });

  it("warnt nicht bei zu wenigen Bewertungen", () => {
    const reviews = [1, 1, 5].map((rating, i) => review({ id: `r${i}`, rating }));
    assert.equal(detectBimodal(reviews), false);
  });
});

describe("Robustheit", () => {
  it("kommt mit einer leeren Fallakte zurecht", () => {
    const a = analyzeReviews([]);
    assert.deepEqual(a.results, []);
    assert.equal(a.bimodalWarning, false);
    assert.equal(a.summary.total, 0);
  });

  it("kommt mit fehlender Eingabe zurecht", () => {
    assert.equal(analyzeReviews(undefined).results.length, 0);
    assert.equal(analyzeReviews(null).results.length, 0);
  });

  it("vergibt IDs, wenn keine mitgeliefert wurden", () => {
    const a = analyzeReviews([{ rating: 1, text: "x" }, { rating: 5, text: "y" }]);
    assert.equal(new Set(a.results.map((r) => r.id)).size, 2);
  });

  it("deckelt den Risikoscore bei 99", () => {
    // Bewertung, die möglichst viele Signale gleichzeitig auslöst.
    const reviews = [
      review({
        id: "a",
        reviewer: "X",
        rating: 1,
        date: "2026-08-10T09:00",
        text: "TOTALER MIST!!! NIE WIEDER!!!",
        reviewerReviewCount: "1",
      }),
      review({
        id: "b",
        reviewer: "X",
        rating: 1,
        date: "2026-08-10T10:00",
        text: "TOTALER MIST!!! NIE WIEDER!!!",
        reviewerReviewCount: "1",
      }),
      review({ id: "c", rating: 5 }),
      review({ id: "d", rating: 5 }),
      review({ id: "e", rating: 5 }),
      review({ id: "f", rating: 5 }),
    ];
    const a = analyzeReviews(reviews);
    assert.ok(byId(a, "a").risk <= 99);
    assert.ok(byId(a, "a").risk >= 60, `erwartet hohes Risiko, war ${byId(a, "a").risk}`);
  });

  it("zählt auffällige Bewertungen in der Zusammenfassung", () => {
    const a = analyzeReviews([
      review({ id: "a", rating: 1, date: "2026-08-10T09:00", text: "totaler mist" }),
      review({ id: "b", rating: 1, date: "2026-08-10T11:00", text: "totaler mist" }),
      review({ id: "c", rating: 5 }),
    ]);
    assert.equal(a.summary.total, 3);
    assert.equal(a.summary.flagged, 2);
    assert.equal(a.summary.highConfidence, 2);
  });

  it("verändert die übergebenen Bewertungen nicht", () => {
    const original = review({ id: "a", rating: 1, text: "totaler mist" });
    const copy = { ...original };
    analyzeReviews([original]);
    assert.deepEqual(original, copy);
  });
});
