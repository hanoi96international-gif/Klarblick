import { useState } from "react";
import { Radar } from "lucide-react";

import DetectorTab from "./components/DetectorTab.jsx";
import VisibilityTab from "./components/VisibilityTab.jsx";

const TABS = [
  { id: "detektor", label: "Sabotage-Detektor" },
  { id: "sichtbarkeit", label: "AI-Sichtbarkeit" },
];

export default function App() {
  const [tab, setTab] = useState("detektor");

  return (
    <div className="min-h-screen w-full bg-ink text-parchment">
      <header className="border-b border-line px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-amber flex items-center justify-center">
            <Radar size={20} className="text-ink" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold leading-tight">Klarblick</h1>
            <p className="text-xs text-muted font-mono">Fallakte · lokale Unternehmen</p>
          </div>
        </div>

        <nav
          aria-label="Bereiche"
          className="flex gap-1 bg-panel border border-line rounded-lg p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.id ? "bg-amber text-ink" : "text-muted hover:text-parchment"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === "detektor" ? <DetectorTab /> : <VisibilityTab />}
      </main>

      <footer className="max-w-5xl mx-auto px-6 pb-10 text-xs text-muted">
        Klarblick deckt Manipulationsmuster auf und liefert Belege. Es erstellt keine
        Bewertungen und verspricht keine Löschung — die Meldung an Google bleibt bei dir.
      </footer>
    </div>
  );
}
