import { Plus } from "lucide-react";
import { newId } from "@klarblick/detector";

const FIELD =
  "w-full bg-ink border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-amber";

export function emptyReview() {
  return {
    id: newId(),
    reviewer: "",
    rating: 1,
    date: "",
    text: "",
    reviewerReviewCount: "",
  };
}

export default function ReviewForm({ draft, onChange, onAdd }) {
  const set = (patch) => onChange({ ...draft, ...patch });

  function submit(event) {
    event.preventDefault();
    if (!draft.text.trim()) return;
    onAdd({ ...draft, id: newId() });
  }

  return (
    <form onSubmit={submit} className="bg-panel border border-line rounded-lg p-4">
      <h2 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
        <Plus size={15} className="text-amber" />
        Bewertung hinzufügen
      </h2>
      <div className="space-y-2">
        <input
          placeholder="Name des Bewerters (optional)"
          aria-label="Name des Bewerters"
          value={draft.reviewer}
          onChange={(e) => set({ reviewer: e.target.value })}
          className={FIELD}
        />
        <div className="flex gap-2">
          <select
            value={draft.rating}
            aria-label="Sternebewertung"
            onChange={(e) => set({ rating: Number(e.target.value) })}
            className="bg-ink border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-amber"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} ★
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            aria-label="Zeitpunkt der Bewertung"
            value={draft.date}
            onChange={(e) => set({ date: e.target.value })}
            className={`${FIELD} flex-1 font-mono text-xs`}
          />
        </div>
        <input
          type="number"
          min="0"
          placeholder="Bewertungen dieses Kontos gesamt"
          title="Wie viele Bewertungen das Konto insgesamt geschrieben hat, falls auf Google sichtbar. Ein Konto mit genau einer Bewertung ist ein Warnsignal."
          aria-label="Anzahl bisheriger Bewertungen des Kontos"
          value={draft.reviewerReviewCount}
          onChange={(e) => set({ reviewerReviewCount: e.target.value })}
          className={`${FIELD} text-xs`}
        />
        <textarea
          placeholder="Bewertungstext"
          aria-label="Bewertungstext"
          value={draft.text}
          onChange={(e) => set({ text: e.target.value })}
          rows={3}
          className={`${FIELD} resize-none`}
        />
        <button
          type="submit"
          disabled={!draft.text.trim()}
          className="w-full bg-line hover:bg-[#333d52] disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-md py-2 text-sm font-medium"
        >
          Zur Fallakte hinzufügen
        </button>
      </div>
    </form>
  );
}
