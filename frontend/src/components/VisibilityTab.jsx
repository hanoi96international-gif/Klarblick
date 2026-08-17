import { useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, Loader2, Radar, Sparkles } from "lucide-react";

import { checkVisibility } from "../api.js";

const EMPTY = { name: "", category: "", city: "" };

function scoreTone(score, total) {
  if (score === 0) return { label: "Nicht sichtbar", color: "#C2463D" };
  if (score < total) return { label: "Teilweise sichtbar", color: "#D9A441" };
  return { label: "Gut sichtbar", color: "#4FA69C" };
}

export default function VisibilityTab() {
  const [biz, setBiz] = useState(EMPTY);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const complete = biz.name.trim() && biz.category.trim() && biz.city.trim();

  async function run(event) {
    event.preventDefault();
    if (!complete || loading) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const data = await checkVisibility(biz);
      setResults(data.results);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const mentioned = results ? results.filter((r) => r.mentioned).length : 0;
  const tone = results ? scoreTone(mentioned, results.length) : null;

  return (
    <div className="grid md:grid-cols-5 gap-6">
      <div className="md:col-span-2 space-y-3">
        <form onSubmit={run} className="bg-panel border border-line rounded-lg p-4">
          <h2 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
            <Eye size={15} className="text-amber" />
            Unternehmen prüfen
          </h2>
          <div className="space-y-2">
            {[
              { key: "name", label: "Firmenname" },
              { key: "category", label: "Branche / Kategorie (z. B. Zahnarzt)" },
              { key: "city", label: "Stadt" },
            ].map(({ key, label }) => (
              <input
                key={key}
                placeholder={label}
                aria-label={label}
                value={biz[key]}
                onChange={(e) => setBiz((b) => ({ ...b, [key]: e.target.value }))}
                className="w-full bg-ink border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-amber"
              />
            ))}
            <button
              type="submit"
              disabled={!complete || loading}
              className="w-full bg-amber hover:bg-[#c99537] disabled:opacity-40 disabled:cursor-not-allowed text-ink font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Prüfe Anfragen…
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Sichtbarkeit testen
                </>
              )}
            </button>
            {error && (
              <p role="alert" className="text-xs text-alarm">
                {error}
              </p>
            )}
          </div>
        </form>

        <p className="bg-panel/60 border border-line rounded-lg p-3.5 text-xs text-muted leading-relaxed">
          Der Prototyp testet die Sichtbarkeit bei Claude, stellvertretend für KI-Suchsysteme.
          Eine Produktivversion würde zusätzlich ChatGPT-, Perplexity- und Gemini-APIs abfragen.
          Die Anfragen laufen über den Klarblick-Server, nicht aus deinem Browser.
        </p>
      </div>

      <div className="md:col-span-3">
        {loading ? (
          <div className="relative overflow-hidden h-64 border border-line rounded-lg flex items-center justify-center scan-sweep">
            <div className="text-center">
              <Sparkles size={32} className="text-amber mx-auto mb-3 animate-pulse" />
              <p className="font-mono text-xs text-muted">Empfehlungsanfragen laufen…</p>
            </div>
          </div>
        ) : results ? (
          <div className="space-y-4">
            <div className="bg-panel border border-line rounded-lg p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-display text-2xl font-semibold">
                  {mentioned}
                  <span className="text-base text-muted">/{results.length}</span>
                </p>
                <p className="text-xs text-muted">
                  Anfragen, in denen das Unternehmen genannt wurde
                </p>
              </div>
              <div
                className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap"
                style={{ color: tone.color, backgroundColor: `${tone.color}1A` }}
              >
                {tone.label}
              </div>
            </div>

            <ul className="space-y-2">
              {results.map((r, i) => (
                <li key={i} className="bg-panel border border-line rounded-lg p-3.5">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <p className="text-xs font-mono text-muted">Anfrage {i + 1}</p>
                    <span
                      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{
                        color: r.mentioned ? "#4FA69C" : "#C2463D",
                        backgroundColor: r.mentioned ? "#4FA69C1A" : "#C2463D1A",
                      }}
                    >
                      {r.mentioned ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                      {r.mentioned ? "Genannt" : "Nicht genannt"}
                    </span>
                  </div>
                  <p className="text-xs text-muted italic mb-2">„{r.prompt}"</p>
                  <p className="text-sm leading-snug whitespace-pre-wrap">{r.response}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-24 border border-dashed border-line rounded-lg">
            <Radar size={28} className="text-muted mb-3" />
            <p className="text-muted text-sm max-w-xs">
              Trage Firmenname, Branche und Stadt ein, um zu prüfen, ob das Unternehmen bei
              KI-Empfehlungen auftaucht.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
