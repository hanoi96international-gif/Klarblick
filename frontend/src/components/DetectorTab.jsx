import { useState } from "react";
import { FileSearch, Loader2, Radar, ShieldAlert } from "lucide-react";
import { analyzeReviews, buildEvidenceReport, newId } from "@klarblick/detector";

import AnalysisResults from "./AnalysisResults.jsx";
import CaseFile from "./CaseFile.jsx";
import CsvImport from "./CsvImport.jsx";
import ReviewForm, { emptyReview } from "./ReviewForm.jsx";
import { downloadText } from "../lib/download.js";

// Beispielfall beim ersten Öffnen: zwei koordiniert wirkende Einträge und eine
// glaubwürdige Bewertung, damit sofort erkennbar ist, was das Werkzeug leistet.
const DEMO_REVIEWS = [
  {
    id: newId(),
    reviewer: "M. K.",
    rating: 1,
    date: "2026-08-10T09:00",
    text: "Absolute Katastrophe, nie wieder!",
    reviewerReviewCount: "1",
  },
  {
    id: newId(),
    reviewer: "T. R.",
    rating: 1,
    date: "2026-08-10T11:30",
    text: "Unterirdisch, absolute Katastrophe.",
    reviewerReviewCount: "1",
  },
  {
    id: newId(),
    reviewer: "S. Berger",
    rating: 5,
    date: "2026-07-02T14:00",
    text: "Herr Wagner hat unsere Heizung am 2. Juli innerhalb von 3 Stunden repariert, sehr fair im Preis.",
    reviewerReviewCount: "14",
  },
];

export default function DetectorTab() {
  const [reviews, setReviews] = useState(DEMO_REVIEWS);
  const [draft, setDraft] = useState(emptyReview);
  const [analysis, setAnalysis] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [businessName, setBusinessName] = useState("");

  // Jede Änderung an der Fallakte macht ein vorheriges Ergebnis ungültig.
  function updateReviews(updater) {
    setReviews(updater);
    setAnalysis(null);
  }

  function runScan() {
    setScanning(true);
    // Kurze Verzögerung, damit die Analyse als eigener Schritt wahrnehmbar ist.
    setTimeout(() => {
      setAnalysis(analyzeReviews(reviews));
      setScanning(false);
    }, 600);
  }

  function exportEvidence() {
    if (!analysis) return;
    downloadText(
      buildEvidenceReport(analysis, { businessName: businessName.trim() || undefined }),
      "beweispaket-verdaechtige-bewertungen.txt"
    );
  }

  return (
    <div className="grid md:grid-cols-5 gap-6">
      <div className="md:col-span-2 space-y-4">
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Name des Unternehmens (für das Beweispaket)"
          aria-label="Name des Unternehmens"
          className="w-full bg-panel border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber"
        />

        <ReviewForm
          draft={draft}
          onChange={setDraft}
          onAdd={(review) => {
            updateReviews((prev) => [...prev, review]);
            setDraft(emptyReview());
          }}
        />

        <CaseFile
          reviews={reviews}
          onRemove={(id) => updateReviews((prev) => prev.filter((r) => r.id !== id))}
          onClear={() => updateReviews([])}
        />

        <CsvImport onImport={(imported) => updateReviews((prev) => [...prev, ...imported])} />

        <button
          onClick={runScan}
          disabled={reviews.length < 2 || scanning}
          className="w-full bg-amber hover:bg-[#c99537] disabled:opacity-40 disabled:cursor-not-allowed text-ink font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors"
        >
          {scanning ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Analysiere Muster…
            </>
          ) : (
            <>
              <FileSearch size={16} /> Muster analysieren
            </>
          )}
        </button>
        {reviews.length < 2 && (
          <p className="text-xs text-muted text-center">
            Mindestens zwei Bewertungen nötig — Muster zeigen sich erst im Vergleich.
          </p>
        )}
      </div>

      <div className="md:col-span-3">
        {scanning ? (
          <div className="relative overflow-hidden h-64 border border-line rounded-lg flex items-center justify-center scan-sweep">
            <div className="text-center">
              <Radar size={32} className="text-amber mx-auto mb-3 animate-pulse" />
              <p className="font-mono text-xs text-muted">
                Zeitmuster · Textähnlichkeit · Kontosignale
              </p>
            </div>
          </div>
        ) : analysis ? (
          <AnalysisResults analysis={analysis} onExport={exportEvidence} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-24 border border-dashed border-line rounded-lg">
            <ShieldAlert size={28} className="text-muted mb-3" />
            <p className="text-muted text-sm max-w-xs">
              Füge mindestens zwei Bewertungen hinzu und starte die Analyse, um verdächtige
              Muster zu erkennen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
