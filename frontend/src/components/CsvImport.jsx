import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { CSV_TEMPLATE, parseReviewsCsv } from "@klarblick/detector";

import { downloadText } from "../lib/download.js";

export default function CsvImport({ onImport }) {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [status, setStatus] = useState(null);
  const fileInput = useRef(null);

  function ingest(raw, source) {
    const { reviews, skipped } = parseReviewsCsv(raw);
    if (reviews.length === 0) {
      setStatus({
        tone: "error",
        message: "Keine verwertbaren Zeilen gefunden. Enthält die Datei eine Textspalte?",
      });
      return;
    }
    onImport(reviews);
    setCsvText("");
    setStatus({
      tone: "ok",
      message:
        `${reviews.length} Bewertungen aus ${source} übernommen` +
        (skipped > 0 ? `, ${skipped} Zeile(n) ohne Text übersprungen.` : "."),
    });
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      ingest(await file.text(), file.name);
    } catch {
      setStatus({ tone: "error", message: "Datei konnte nicht gelesen werden." });
    } finally {
      event.target.value = ""; // dieselbe Datei soll erneut wählbar bleiben
    }
  }

  return (
    <div className="bg-panel border border-line rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-sm font-semibold">CSV-Import</h2>
        <button
          onClick={() => setOpen((s) => !s)}
          className="text-xs text-amber hover:underline"
          aria-expanded={open}
        >
          {open ? "Schließen" : "Öffnen"}
        </button>
      </div>

      {open && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            Spalten: Bewerter, Sterne, Datum, Text, AnzahlBewertungenKonto. Komma oder
            Semikolon als Trennzeichen, Kopfzeile optional.
          </p>

          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileInput.current?.click()}
            className="w-full flex items-center justify-center gap-2 border border-line hover:border-amber transition-colors rounded-md py-2 text-xs font-medium"
          >
            <Upload size={13} /> CSV-Datei auswählen
          </button>

          <p className="text-[10px] text-muted text-center">oder Inhalt einfügen</p>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="CSV-Inhalt hier einfügen…"
            aria-label="CSV-Inhalt"
            rows={4}
            className="w-full bg-ink border border-line rounded-md px-3 py-2 text-xs font-mono outline-none focus:border-amber resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => ingest(csvText, "der Zwischenablage")}
              disabled={!csvText.trim()}
              className="flex-1 bg-line hover:bg-[#333d52] disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-md py-2 text-xs font-medium"
            >
              Importieren
            </button>
            <button
              onClick={() => downloadText(CSV_TEMPLATE, "klarblick-vorlage.csv", "text/csv")}
              className="flex-1 flex items-center justify-center gap-1.5 border border-line hover:border-amber transition-colors rounded-md py-2 text-xs font-medium"
            >
              <Download size={13} /> Vorlage
            </button>
          </div>

          {status && (
            <p
              role="status"
              className={`text-xs ${status.tone === "error" ? "text-alarm" : "text-teal"}`}
            >
              {status.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
