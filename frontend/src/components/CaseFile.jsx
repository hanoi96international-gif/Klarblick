import { Trash2 } from "lucide-react";

function formatDate(value) {
  if (!value) return "kein Datum";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("de-DE");
}

export default function CaseFile({ reviews, onRemove, onClear }) {
  return (
    <div className="bg-panel border border-line rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-sm font-semibold">Fallakte ({reviews.length})</h2>
        {reviews.length > 0 && (
          <button onClick={onClear} className="text-xs text-muted hover:text-alarm transition-colors">
            Alle entfernen
          </button>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-xs text-muted">
          Noch keine Bewertungen. Trage sie einzeln ein oder importiere eine CSV-Datei.
        </p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {reviews.map((r) => (
            <li key={r.id} className="bg-ink border border-line rounded-md p-2.5 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-amber">{r.rating}★</span>
                <button
                  onClick={() => onRemove(r.id)}
                  aria-label={`Bewertung von ${r.reviewer || "unbekannt"} entfernen`}
                  className="text-muted hover:text-alarm transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="text-muted font-mono text-[10px] mb-1">
                {r.reviewer || "unbekannt"} · {formatDate(r.date)}
              </p>
              <p className="leading-snug">{r.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
