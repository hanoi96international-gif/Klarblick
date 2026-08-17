import { AlertTriangle, CheckCircle2, Download } from "lucide-react";
import {
  CONFIDENCE_LABELS,
  FLAGGED_THRESHOLD,
  FLAG_LABELS,
  HIGH_RISK_THRESHOLD,
  riskLabel,
} from "@klarblick/detector";

function ResultCard({ review }) {
  const risk = riskLabel(review.risk);
  const confidence = CONFIDENCE_LABELS[review.confidence];

  return (
    <li className="bg-panel border border-line rounded-lg p-3.5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 text-xs font-mono text-muted flex-wrap">
          <span>{review.reviewer || "unbekannt"}</span>
          <span>·</span>
          <span>{review.rating}★</span>
          {review.confidence !== "keine" && (
            <span className="font-semibold" style={{ color: confidence.color }}>
              · {confidence.label}
            </span>
          )}
        </div>
        <div
          className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ color: risk.color, backgroundColor: `${risk.color}1A` }}
        >
          {review.risk >= HIGH_RISK_THRESHOLD ? (
            <AlertTriangle size={12} />
          ) : (
            <CheckCircle2 size={12} />
          )}
          {risk.label} · {review.risk}/100
        </div>
      </div>

      <p className="text-sm mb-2">{review.text}</p>

      {review.flags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {review.flags.map((flag) => (
            <li
              key={flag}
              className="text-[10px] font-mono text-muted border border-line rounded px-1.5 py-0.5"
            >
              {FLAG_LABELS[flag] ?? flag}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function AnalysisResults({ analysis, onExport }) {
  const flaggedCount = analysis.results.filter((r) => r.risk >= FLAGGED_THRESHOLD).length;
  const sorted = [...analysis.results].sort((a, b) => b.risk - a.risk);

  return (
    <div className="space-y-4">
      {analysis.bimodalWarning && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg p-3.5 text-sm"
          style={{ background: "#C2463D1A", border: "1px solid #C2463D" }}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-alarm" />
          <p>
            <span className="font-semibold">Verdacht auf koordinierte Kampagne:</span> Die
            Bewertungen häufen sich fast nur bei 1★ und 5★, kaum in der Mitte. Dieses Muster
            tritt bei organischem Feedback selten auf.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 bg-panel border border-line rounded-lg p-4">
        <div>
          <p className="font-display text-2xl font-semibold">
            {flaggedCount}{" "}
            <span className="text-sm font-normal text-muted">
              von {analysis.results.length} auffällig
            </span>
          </p>
          <p className="text-xs text-muted">
            Heuristische Ersteinschätzung, kein Rechtsgutachten
          </p>
        </div>
        <button
          onClick={onExport}
          disabled={flaggedCount === 0}
          className="flex items-center gap-2 bg-line hover:bg-[#333d52] disabled:opacity-30 disabled:cursor-not-allowed rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors"
        >
          <Download size={14} /> Beweispaket
        </button>
      </div>

      <ul className="space-y-2">
        {sorted.map((review) => (
          <ResultCard key={review.id} review={review} />
        ))}
      </ul>
    </div>
  );
}
