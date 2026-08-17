import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CSV_TEMPLATE,
  detectDelimiter,
  mapHeader,
  parseDelimited,
  parseReviewsCsv,
} from "../src/csv.js";

describe("parseDelimited", () => {
  it("hält Kommas innerhalb von Anführungszeichen zusammen", () => {
    // Genau der Fall, an dem der frühere Parser gescheitert ist.
    const rows = parseDelimited('A,1,"Absolute Katastrophe, nie wieder!",9');
    assert.deepEqual(rows, [["A", "1", "Absolute Katastrophe, nie wieder!", "9"]]);
  });

  it("liest verdoppelte Anführungszeichen als einzelnes Zeichen", () => {
    const rows = parseDelimited('A,"Er sagte ""nein"" zu mir"');
    assert.equal(rows[0][1], 'Er sagte "nein" zu mir');
  });

  it("erlaubt Zeilenumbrüche innerhalb eines Feldes", () => {
    const rows = parseDelimited('A,"Zeile eins\nZeile zwei"\nB,"kurz"');
    assert.equal(rows.length, 2);
    assert.equal(rows[0][1], "Zeile eins\nZeile zwei");
    assert.equal(rows[1][0], "B");
  });

  it("kommt mit CRLF-Zeilenenden zurecht", () => {
    const rows = parseDelimited("A,1\r\nB,2\r\n");
    assert.deepEqual(rows, [["A", "1"], ["B", "2"]]);
  });

  it("entfernt ein führendes Byte Order Mark", () => {
    const rows = parseDelimited("﻿Bewerter,Sterne");
    assert.equal(rows[0][0], "Bewerter");
  });

  it("verwirft vollständig leere Zeilen", () => {
    const rows = parseDelimited("A,1\n\n\nB,2\n");
    assert.equal(rows.length, 2);
  });
});

describe("detectDelimiter", () => {
  it("erkennt Semikolon, wie deutsches Excel es exportiert", () => {
    assert.equal(detectDelimiter("Bewerter;Sterne;Datum;Text"), ";");
  });

  it("erkennt Komma", () => {
    assert.equal(detectDelimiter("Bewerter,Sterne,Datum,Text"), ",");
  });

  it("zählt Trennzeichen innerhalb von Anführungszeichen nicht mit", () => {
    assert.equal(detectDelimiter('"a;b;c;d;e",1,2'), ",");
  });

  it("erkennt Tabulator", () => {
    assert.equal(detectDelimiter("Bewerter\tSterne\tText"), "\t");
  });
});

describe("mapHeader", () => {
  it("erkennt die deutsche Kopfzeile der Vorlage", () => {
    const mapping = mapHeader(["Bewerter", "Sterne", "Datum", "Text", "AnzahlBewertungenKonto"]);
    assert.deepEqual(mapping, {
      reviewer: 0,
      rating: 1,
      date: 2,
      text: 3,
      reviewerReviewCount: 4,
    });
  });

  it("erkennt englische Spaltennamen in abweichender Reihenfolge", () => {
    const mapping = mapHeader(["Text", "Rating", "Date", "Reviewer"]);
    assert.equal(mapping.text, 0);
    assert.equal(mapping.rating, 1);
    assert.equal(mapping.reviewer, 3);
  });

  it("hält eine Datenzeile nicht für eine Kopfzeile", () => {
    assert.equal(mapHeader(["M. K.", "1", "2026-08-10T09:00", "War schlecht"]), null);
  });
});

describe("parseReviewsCsv", () => {
  it("liest die mitgelieferte Vorlage vollständig und unverstümmelt ein", () => {
    const { reviews, skipped } = parseReviewsCsv(CSV_TEMPLATE);
    assert.equal(reviews.length, 3);
    assert.equal(skipped, 0);
    // Der Text muss ungekürzt ankommen — hier ist der alte Parser abgeschnitten.
    assert.equal(reviews[0].text, "Absolute Katastrophe, nie wieder!");
    assert.equal(reviews[0].reviewerReviewCount, "1");
    assert.equal(reviews[2].reviewer, "S. Berger");
    assert.equal(reviews[2].rating, 5);
  });

  it("verarbeitet Semikolon-getrennte Dateien", () => {
    const raw = 'Bewerter;Sterne;Datum;Text\nM. K.;1;2026-08-10;"Schlecht, sehr schlecht"';
    const { reviews } = parseReviewsCsv(raw);
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].text, "Schlecht, sehr schlecht");
    assert.equal(reviews[0].rating, 1);
  });

  it("fällt ohne Kopfzeile auf die Spaltenreihenfolge der Vorlage zurück", () => {
    const { reviews } = parseReviewsCsv('M. K.,1,2026-08-10,"Text hier",3');
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].reviewer, "M. K.");
    assert.equal(reviews[0].text, "Text hier");
  });

  it("überspringt Zeilen ohne Text und meldet sie zurück", () => {
    const raw = "Bewerter,Sterne,Datum,Text\nA,1,2026-08-10,\nB,2,2026-08-11,Etwas Text";
    const { reviews, skipped } = parseReviewsCsv(raw);
    assert.equal(reviews.length, 1);
    assert.equal(skipped, 1);
  });

  it("versteht ein Dezimalkomma in der Sternespalte", () => {
    const raw = 'Bewerter,Sterne,Datum,Text\nA,"4,5",2026-08-10,Text hier';
    const { reviews } = parseReviewsCsv(raw);
    assert.equal(reviews[0].rating, 5);
  });

  it("begrenzt Sterne außerhalb des gültigen Bereichs auf 1 bis 5", () => {
    const raw = "Bewerter,Sterne,Datum,Text\nB,9,2026-08-10,zu hoch\nC,0,2026-08-10,zu niedrig";
    const { reviews } = parseReviewsCsv(raw);
    assert.deepEqual(reviews.map((r) => r.rating), [5, 1]);
  });

  it("fällt bei unlesbarer Sternezahl auf 1 zurück", () => {
    const raw = "Bewerter,Sterne,Datum,Text\nD,keine Ahnung,2026-08-10,Text";
    const { reviews } = parseReviewsCsv(raw);
    assert.equal(reviews[0].rating, 1);
  });

  it("liefert bei leerer Eingabe eine leere Liste statt zu werfen", () => {
    assert.deepEqual(parseReviewsCsv(""), { reviews: [], skipped: 0 });
    assert.deepEqual(parseReviewsCsv("   \n  "), { reviews: [], skipped: 0 });
  });

  it("vergibt eindeutige IDs", () => {
    const { reviews } = parseReviewsCsv(CSV_TEMPLATE);
    assert.equal(new Set(reviews.map((r) => r.id)).size, reviews.length);
  });
});
