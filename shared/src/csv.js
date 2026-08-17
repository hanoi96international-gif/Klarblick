// CSV-Import für Bewertungen.
//
// Der frühere Parser hat schlicht an jedem Komma getrennt. Damit zerfiel jede
// Bewertung, deren Text ein Komma enthält — also praktisch jede echte Bewertung,
// inklusive der mitgelieferten Vorlage. Hier steht deshalb ein Parser nach
// RFC 4180: Anführungszeichen, verdoppelte Anführungszeichen als Escape und
// Zeilenumbrüche innerhalb von Feldern werden korrekt behandelt.
//
// Zusätzlich wird das Trennzeichen erkannt: deutsche Excel-Installationen
// exportieren standardmäßig mit Semikolon, nicht mit Komma.

const DELIMITERS = [",", ";", "\t"];

/** Erzeugt eine ID — funktioniert im Browser wie in Node. */
export function newId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Rät das Trennzeichen anhand der ersten Zeile außerhalb von Anführungszeichen.
 * Gewinner ist das Zeichen mit den meisten Treffern.
 */
export function detectDelimiter(raw) {
  const firstLine = raw.split(/\r?\n/, 1)[0] ?? "";
  let best = ",";
  let bestCount = 0;
  for (const d of DELIMITERS) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Zerlegt CSV-Text in Zeilen aus Feldern.
 *
 * @param {string} raw
 * @param {string} [delimiter] Erkennung erfolgt automatisch, wenn nicht gesetzt.
 * @returns {string[][]}
 */
export function parseDelimited(raw, delimiter) {
  const text = String(raw ?? "").replace(/^﻿/, ""); // Byte Order Mark entfernen
  const d = delimiter || detectDelimiter(text);

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // verdoppeltes Anführungszeichen = ein echtes
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === d) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // Teil eines CRLF — wird beim \n behandelt
    } else {
      field += ch;
    }
  }

  row.push(field);
  rows.push(row);

  // Vollständig leere Zeilen verwerfen (typisch am Dateiende)
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// Erlaubte Spaltenüberschriften je Feld, klein geschrieben und ohne Sonderzeichen.
const HEADER_ALIASES = {
  reviewer: ["bewerter", "reviewer", "name", "autor", "author", "verfasser"],
  rating: ["sterne", "rating", "bewertung", "stars", "sternebewertung"],
  date: ["datum", "date", "zeitpunkt", "createtime", "erstellt"],
  text: ["text", "kommentar", "comment", "review", "bewertungstext", "inhalt"],
  reviewerReviewCount: [
    "anzahlbewertungenkonto",
    "anzahlbewertungen",
    "reviewcount",
    "reviewerreviewcount",
    "kontobewertungen",
  ],
};

function normalizeHeader(cell) {
  return String(cell || "")
    .toLowerCase()
    .replace(/[\s_.-]/g, "")
    .trim();
}

/** Ordnet eine Kopfzeile den bekannten Feldern zu, oder null wenn es keine ist. */
export function mapHeader(cells) {
  const normalized = cells.map(normalizeHeader);
  const mapping = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalized.findIndex((c) => aliases.includes(c));
    if (idx !== -1) mapping[field] = idx;
  }
  // Als Kopfzeile gilt sie nur, wenn sich Text und mindestens ein weiteres Feld
  // zuordnen lassen — sonst ist es vermutlich schon eine Datenzeile.
  return Object.keys(mapping).length >= 2 && mapping.text !== undefined ? mapping : null;
}

const POSITIONAL = {
  reviewer: 0,
  rating: 1,
  date: 2,
  text: 3,
  reviewerReviewCount: 4,
};

/**
 * Liest CSV-Text in Bewertungsobjekte ein.
 *
 * Erkennt die Kopfzeile selbst; fehlt sie, gilt die Spaltenreihenfolge der
 * Vorlage (Bewerter, Sterne, Datum, Text, AnzahlBewertungenKonto).
 *
 * @param {string} raw
 * @returns {{reviews: Array<object>, skipped: number}}
 */
export function parseReviewsCsv(raw) {
  const rows = parseDelimited(raw);
  if (rows.length === 0) return { reviews: [], skipped: 0 };

  const headerMapping = mapHeader(rows[0]);
  const mapping = headerMapping || POSITIONAL;
  const dataRows = headerMapping ? rows.slice(1) : rows;

  const reviews = [];
  let skipped = 0;

  for (const cells of dataRows) {
    const pick = (field) => {
      const idx = mapping[field];
      return idx === undefined ? "" : (cells[idx] ?? "").trim();
    };

    const text = pick("text");
    if (!text) {
      skipped++;
      continue;
    }

    const ratingRaw = pick("rating").replace(",", ".");
    const rating = Number.parseFloat(ratingRaw);

    reviews.push({
      id: newId(),
      reviewer: pick("reviewer"),
      rating: Number.isFinite(rating) ? Math.min(5, Math.max(1, Math.round(rating))) : 1,
      date: pick("date"),
      text,
      reviewerReviewCount: pick("reviewerReviewCount"),
    });
  }

  return { reviews, skipped };
}

export const CSV_TEMPLATE = `Bewerter,Sterne,Datum,Text,AnzahlBewertungenKonto
M. K.,1,2026-08-10T09:00,"Absolute Katastrophe, nie wieder!",1
T. R.,1,2026-08-10T11:30,"Unterirdisch, absolute Katastrophe.",1
S. Berger,5,2026-07-02T14:00,"Herr Wagner hat unsere Heizung fair repariert.",14`;
