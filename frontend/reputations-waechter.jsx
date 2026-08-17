import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  Radar,
  Plus,
  Trash2,
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileSearch,
  Eye,
} from "lucide-react";

// ---------- Helper: heuristic analysis ----------

function tokenize(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[.,!?;:()"„“”'’]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccard(a, b) {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function parseDate(d) {
  const t = Date.parse(d);
  return isNaN(t) ? null : t;
}

const GENERIC_PHRASES = [
  "nie wieder",
  "finger weg",
  "absolute abzocke",
  "katastrophe",
  "unterirdisch",
  "totaler mist",
  "nicht zu empfehlen",
  "schlechtester service",
  "würde ich nie",
];

function genericityScore(text) {
  const t = (text || "").toLowerCase();
  const wordCount = tokenize(text).size;
  const hasNumbers = /\d/.test(t);
  const hasProperNoun = /\b[A-ZÄÖÜ][a-zäöü]{2,}\b/.test(text || "");
  let score = 0;
  if (wordCount < 8) score += 35;
  if (!hasNumbers) score += 15;
  if (!hasProperNoun) score += 10;
  GENERIC_PHRASES.forEach((p) => {
    if (t.includes(p)) score += 15;
  });
  return Math.min(score, 100);
}

const POSITIVE_WORDS = [
  "super", "toll", "freundlich", "empfehlenswert", "zufrieden", "kompetent",
  "schnell", "professionell", "top", "perfekt", "hervorragend", "sauber",
  "fair", "herzlich", "kompetenz", "great", "amazing", "excellent",
];
const NEGATIVE_WORDS = [
  "schlecht", "katastrophe", "unfreundlich", "enttäuscht", "nie wieder",
  "abzocke", "unterirdisch", "frech", "respektlos", "chaos", "versagen",
  "horrible", "terrible", "awful", "scam",
];

function sentimentScore(text) {
  const t = (text || "").toLowerCase();
  let score = 0;
  POSITIVE_WORDS.forEach((w) => {
    if (t.includes(w)) score += 1;
  });
  NEGATIVE_WORDS.forEach((w) => {
    if (t.includes(w)) score -= 1;
  });
  return score;
}

function spamStyleScore(text) {
  const t = text || "";
  const letters = t.replace(/[^a-zA-ZäöüÄÖÜß]/g, "");
  const capsRatio =
    letters.length > 8
      ? (letters.replace(/[^A-ZÄÖÜ]/g, "").length / letters.length)
      : 0;
  const exclamations = (t.match(/!/g) || []).length;
  return capsRatio >= 0.3 || exclamations >= 3;
}

// Which broad evidence category each flag belongs to. Published fake-review
// research treats statistical, textual and behavioral/network signals as
// complementary — a review flagged across multiple categories is much more
// likely to be genuinely suspicious than one flagged repeatedly within a
// single category (e.g. two textual quirks that both stem from a slightly
// unusual writing style).
const FLAG_CATEGORY = {
  velocity: "statistical",
  silence: "statistical",
  deviation: "statistical",
  similarity: "textual",
  generic: "textual",
  "sentiment-mismatch": "textual",
  caps: "textual",
  "single-account": "behavioral",
  "duplicate-reviewer": "behavioral",
};

function analyzeReviews(reviews) {
  const negatives = reviews.filter((r) => Number(r.rating) <= 2);
  const results = reviews.map((r) => ({ ...r, flags: [], risk: 0 }));

  // 1. Velocity clusters among negative reviews within 48h, with a bonus
  // if the cluster breaks a long quiet period (the strongest published
  // signal for paid/coordinated campaigns: bursts after silence).
  const negWithTime = negatives
    .map((r) => ({ ...r, t: parseDate(r.date) }))
    .filter((r) => r.t !== null)
    .sort((a, b) => a.t - b.t);

  for (let i = 0; i < negWithTime.length; i++) {
    for (let j = i + 1; j < negWithTime.length; j++) {
      const diffH = Math.abs(negWithTime[j].t - negWithTime[i].t) / 36e5;
      if (diffH <= 48) {
        const prevGapDays =
          i === 0 ? Infinity : (negWithTime[i].t - negWithTime[i - 1].t) / 864e5;
        const isAfterSilence = prevGapDays >= 14;
        [negWithTime[i].id, negWithTime[j].id].forEach((id) => {
          const target = results.find((r) => r.id === id);
          if (target && !target.flags.includes("velocity")) {
            target.flags.push("velocity");
            target.risk += 25;
          }
          if (target && isAfterSilence && !target.flags.includes("silence")) {
            target.flags.push("silence");
            target.risk += 20;
          }
        });
      }
    }
  }

  // 2. Text similarity among negative reviews
  for (let i = 0; i < negatives.length; i++) {
    for (let j = i + 1; j < negatives.length; j++) {
      const sim = jaccard(negatives[i].text, negatives[j].text);
      if (sim >= 0.35) {
        [negatives[i].id, negatives[j].id].forEach((id) => {
          const target = results.find((r) => r.id === id);
          if (target && !target.flags.includes("similarity")) {
            target.flags.push("similarity");
            target.risk += 30;
          }
        });
      }
    }
  }

  // 3. Genericity on negatives
  results.forEach((r) => {
    if (Number(r.rating) <= 2) {
      const g = genericityScore(r.text);
      if (g >= 45) {
        r.flags.push("generic");
        r.risk += Math.round(g * 0.3);
      }
    }
  });

  // 4. Rating deviation: how far a review sits from the average of all
  // *other* reviews for this business (Savage et al. anomalous rating
  // deviation signal).
  const allRatings = reviews.map((r) => Number(r.rating));
  results.forEach((r, idx) => {
    const others = allRatings.filter((_, i) => i !== idx);
    if (others.length === 0) return;
    const avg = others.reduce((a, b) => a + b, 0) / others.length;
    const dev = Math.abs(Number(r.rating) - avg);
    if (dev >= 2.5 && Number(r.rating) <= 2) {
      r.flags.push("deviation");
      r.risk += 15;
    }
  });

  // 5. Single-review account: an account with exactly one review on
  // record, posting a negative rating, is a classic spam-account signal
  // (Lim et al., Fei et al.). Only applies if the count was provided.
  results.forEach((r) => {
    const count = Number(r.reviewerReviewCount);
    if (!isNaN(count) && count === 1 && Number(r.rating) <= 2) {
      r.flags.push("single-account");
      r.risk += 20;
    }
  });

  // 6. Sentiment/rating mismatch: text sentiment disagrees strongly with
  // the star rating given (e.g. a 1-star review written in glowing terms,
  // or vice versa) — a known tell for templated or mislabeled fake reviews.
  results.forEach((r) => {
    const s = sentimentScore(r.text);
    const rating = Number(r.rating);
    if (rating <= 2 && s >= 2) {
      r.flags.push("sentiment-mismatch");
      r.risk += 20;
    } else if (rating >= 4 && s <= -2) {
      r.flags.push("sentiment-mismatch");
      r.risk += 20;
    }
  });

  // 7. Spam-style writing: excessive caps or exclamation marks correlate
  // with low-effort spam/bot-generated content in text-based detection
  // studies.
  results.forEach((r) => {
    if (Number(r.rating) <= 2 && spamStyleScore(r.text)) {
      r.flags.push("caps");
      r.risk += 10;
    }
  });

  // 8. Duplicate reviewer: the same name posting more than once is either
  // a returning customer (fine) or, combined with other flags, a sign of
  // a small pool of accounts being reused for a campaign.
  const nameCounts = {};
  results.forEach((r) => {
    const key = (r.reviewer || "").trim().toLowerCase();
    if (!key) return;
    nameCounts[key] = (nameCounts[key] || 0) + 1;
  });
  results.forEach((r) => {
    const key = (r.reviewer || "").trim().toLowerCase();
    if (key && nameCounts[key] > 1) {
      r.flags.push("duplicate-reviewer");
      r.risk += 15;
    }
  });

  // 9. Confidence: count how many distinct evidence *categories*
  // (statistical / textual / behavioral) a review triggered. Multi-category
  // corroboration is the core idea behind combining feature types in the
  // published detection literature, and it materially reduces false
  // positives compared to summing same-category flags alone.
  const scored = results.map((r) => {
    const categories = new Set(r.flags.map((f) => FLAG_CATEGORY[f]));
    return {
      ...r,
      risk: Math.min(r.risk, 99),
      categoryCount: categories.size,
      confidence:
        categories.size >= 2
          ? "hoch"
          : categories.size === 1
          ? "erste-hinweise"
          : "keine",
    };
  });

  // Case-level signal: bimodal rating distribution (mostly 1s and 5s, few
  // in between) is a documented pattern for coordinated campaigns (Li et
  // al., bimodal distribution and co-bursting).
  const hist = [0, 0, 0, 0, 0, 0];
  reviews.forEach((r) => {
    const n = Number(r.rating);
    if (n >= 1 && n <= 5) hist[n] += 1;
  });
  const total = reviews.length;
  const extremeShare = total > 0 ? (hist[1] + hist[5]) / total : 0;
  const midShare = total > 0 ? (hist[2] + hist[3] + hist[4]) / total : 0;
  const bimodalWarning = total >= 6 && extremeShare >= 0.8 && midShare <= 0.2;

  return { results: scored, bimodalWarning };
}

// ---------- Helper: AI visibility check (uses Claude via API) ----------

const VISIBILITY_PROMPTS = (category, city) => [
  `Nenne mir die 5 besten Anbieter für ${category} in ${city}. Nur eine kurze Liste mit Namen, keine Erklärung.`,
  `Ich suche jemanden für ${category} in ${city}. Wen empfiehlst du?`,
  `Welche Firma für ${category} in ${city} hat den besten Ruf?`,
  `Top-Empfehlung für ${category} in ${city}?`,
  `Vergleiche die bekanntesten Anbieter für ${category} in ${city}.`,
];

async function askClaude(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await response.json();
  const text = (data.content || [])
    .map((c) => (c.type === "text" ? c.text : ""))
    .join(" ");
  return text;
}

// ---------- UI ----------

const RISK_LABEL = (risk) => {
  if (risk >= 60) return { label: "Hohes Risiko", color: "#C2463D" };
  if (risk >= 30) return { label: "Auffällig", color: "#D9A441" };
  return { label: "Unauffällig", color: "#4FA69C" };
};

const FLAG_LABELS = {
  velocity: "Zeitliche Häufung",
  silence: "Ausbruch nach langer Stille",
  similarity: "Ähnlicher Text wie andere Bewertung",
  generic: "Generisch, kaum konkrete Details",
  deviation: "Weicht stark vom Gesamtschnitt ab",
  "single-account": "Konto mit nur dieser einen Bewertung",
  "sentiment-mismatch": "Text passt nicht zur Sternebewertung",
  caps: "Auffällige Schreibweise (Caps/Ausrufezeichen)",
  "duplicate-reviewer": "Name mehrfach in der Fallakte",
};

const CONFIDENCE_LABEL = {
  hoch: { label: "Hohe Konfidenz", color: "#C2463D" },
  "erste-hinweise": { label: "Erste Hinweise", color: "#D9A441" },
  keine: { label: "—", color: "#8B93A7" },
};

function parseCSV(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const rows = lines[0].toLowerCase().includes("bewerter") ||
    lines[0].toLowerCase().includes("reviewer")
    ? lines.slice(1)
    : lines;
  return rows
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const [reviewer, rating, date, text, reviewerReviewCount] = cols;
      if (!text) return null;
      return {
        id: crypto.randomUUID(),
        reviewer: reviewer || "",
        rating: Number(rating) || 1,
        date: date || "",
        text: text || "",
        reviewerReviewCount: reviewerReviewCount || "",
      };
    })
    .filter(Boolean);
}

const CSV_TEMPLATE = `Bewerter,Sterne,Datum,Text,AnzahlBewertungenKonto
M. K.,1,2026-08-10T09:00,"Absolute Katastrophe, nie wieder!",1
T. R.,1,2026-08-10T11:30,"Unterirdisch, absolute Katastrophe.",1
S. Berger,5,2026-07-02T14:00,"Herr Wagner hat unsere Heizung fair repariert.",14`;

function emptyReview() {
  return {
    id: crypto.randomUUID(),
    reviewer: "",
    rating: 1,
    date: "",
    text: "",
    reviewerReviewCount: "",
  };
}

export default function ReputationsWaechter() {
  const [tab, setTab] = useState("detektor");

  // Detektor state
  const [reviews, setReviews] = useState([
    {
      id: crypto.randomUUID(),
      reviewer: "M. K.",
      rating: 1,
      date: "2026-08-10T09:00",
      text: "Absolute Katastrophe, nie wieder!",
    },
    {
      id: crypto.randomUUID(),
      reviewer: "T. R.",
      rating: 1,
      date: "2026-08-10T11:30",
      text: "Unterirdisch, absolute Katastrophe.",
    },
    {
      id: crypto.randomUUID(),
      reviewer: "S. Berger",
      rating: 5,
      date: "2026-07-02T14:00",
      text: "Herr Wagner hat unsere Heizung am 2. Juli innerhalb von 3 Stunden repariert, sehr fair im Preis.",
    },
  ]);
  const [draft, setDraft] = useState(emptyReview());
  const [analyzed, setAnalyzed] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [showCsv, setShowCsv] = useState(false);

  // Sichtbarkeits state
  const [biz, setBiz] = useState({
    name: "",
    category: "",
    city: "",
  });
  const [visResults, setVisResults] = useState(null);
  const [visLoading, setVisLoading] = useState(false);
  const [visError, setVisError] = useState(null);

  const flaggedCount = useMemo(
    () => (analyzed ? analyzed.results.filter((r) => r.risk >= 30).length : 0),
    [analyzed]
  );

  function importCsv() {
    const parsed = parseCSV(csvText);
    if (parsed.length === 0) return;
    setReviews((prev) => [...prev, ...parsed]);
    setCsvText("");
    setShowCsv(false);
    setAnalyzed(null);
  }

  function downloadCsvTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "klarblick-vorlage.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function addReview() {
    if (!draft.text.trim()) return;
    setReviews((prev) => [...prev, { ...draft, id: crypto.randomUUID() }]);
    setDraft(emptyReview());
  }

  function removeReview(id) {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    setAnalyzed(null);
  }

  function runScan() {
    setScanning(true);
    setTimeout(() => {
      setAnalyzed(analyzeReviews(reviews));
      setScanning(false);
    }, 900);
  }

  function exportEvidence() {
    if (!analyzed) return;
    const flagged = analyzed.results.filter((r) => r.risk >= 30);
    const lines = [
      `BEWEISPAKET — Verdächtige Bewertungsmuster`,
      `Erstellt: ${new Date().toLocaleString("de-DE")}`,
      `Anzahl auffälliger Bewertungen: ${flagged.length}`,
      "",
      ...flagged.map((r, i) => {
        const rl = RISK_LABEL(r.risk);
        return [
          `${i + 1}. Bewertung von "${r.reviewer || "unbekannt"}" — ${r.rating}★ — ${
            r.date || "kein Datum"
          }`,
          `   Risikoscore: ${r.risk}/100 (${rl.label})`,
          `   Gründe: ${r.flags.map((f) => FLAG_LABELS[f]).join("; ")}`,
          `   Text: "${r.text}"`,
          "",
        ].join("\n");
      }),
      "Hinweis: Dies ist eine heuristische Ersteinschätzung auf Basis von Zeitmuster,",
      "Textähnlichkeit, Bewertungsabweichung, Kontosignalen und weiteren Mustern aus",
      "veröffentlichter Forschung zu Fake-Review-Erkennung. Für eine Google-Meldung als",
      "unterstützendes Dokument verwenden, nicht als alleinigen Beweis.",
    ].join("\n");

    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "beweispaket-verdaechtige-bewertungen.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runVisibilityCheck() {
    if (!biz.name.trim() || !biz.category.trim() || !biz.city.trim()) return;
    setVisLoading(true);
    setVisError(null);
    setVisResults(null);
    try {
      const prompts = VISIBILITY_PROMPTS(biz.category, biz.city);
      const outcomes = [];
      for (const p of prompts) {
        const text = await askClaude(p);
        const mentioned = text
          .toLowerCase()
          .includes(biz.name.trim().toLowerCase());
        outcomes.push({ prompt: p, response: text, mentioned });
      }
      setVisResults(outcomes);
    } catch (e) {
      setVisError("Anfrage fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setVisLoading(false);
    }
  }

  const visScore = visResults
    ? visResults.filter((r) => r.mentioned).length
    : null;

  return (
    <div className="min-h-screen w-full bg-[#12161F] text-[#E9E7E0] font-['IBM_Plex_Sans',sans-serif]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
        @keyframes sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .scan-sweep::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(217,164,65,0.25), transparent);
          animation: sweep 1.1s ease-in-out infinite;
        }
      `}</style>

      {/* Header */}
      <header className="border-b border-[#2A3345] px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[#D9A441] flex items-center justify-center">
            <Radar size={20} className="text-[#12161F]" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold leading-tight">
              Klarblick
            </h1>
            <p className="text-xs text-[#8B93A7] font-mono">
              Fallakte · lokale Unternehmen
            </p>
          </div>
        </div>
        <nav className="flex gap-1 bg-[#1A2130] border border-[#2A3345] rounded-lg p-1">
          <button
            onClick={() => setTab("detektor")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "detektor"
                ? "bg-[#D9A441] text-[#12161F]"
                : "text-[#8B93A7] hover:text-[#E9E7E0]"
            }`}
          >
            Sabotage-Detektor
          </button>
          <button
            onClick={() => setTab("sichtbarkeit")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "sichtbarkeit"
                ? "bg-[#D9A441] text-[#12161F]"
                : "text-[#8B93A7] hover:text-[#E9E7E0]"
            }`}
          >
            AI-Sichtbarkeit
          </button>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === "detektor" && (
          <div className="grid md:grid-cols-5 gap-6">
            {/* Left: input */}
            <div className="md:col-span-2 space-y-4">
              <div className="bg-[#1A2130] border border-[#2A3345] rounded-lg p-4">
                <h2 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                  <Plus size={15} className="text-[#D9A441]" />
                  Bewertung hinzufügen
                </h2>
                <div className="space-y-2">
                  <input
                    placeholder="Name des Bewerters (optional)"
                    value={draft.reviewer}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, reviewer: e.target.value }))
                    }
                    className="w-full bg-[#12161F] border border-[#2A3345] rounded-md px-3 py-2 text-sm outline-none focus:border-[#D9A441]"
                  />
                  <div className="flex gap-2">
                    <select
                      value={draft.rating}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, rating: e.target.value }))
                      }
                      className="bg-[#12161F] border border-[#2A3345] rounded-md px-3 py-2 text-sm outline-none focus:border-[#D9A441]"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n} ★
                        </option>
                      ))}
                    </select>
                    <input
                      type="datetime-local"
                      value={draft.date}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, date: e.target.value }))
                      }
                      className="flex-1 bg-[#12161F] border border-[#2A3345] rounded-md px-3 py-2 text-sm outline-none focus:border-[#D9A441] font-mono text-xs"
                    />
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="Anzahl bisheriger Bewertungen dieses Kontos (falls auf Google sichtbar)"
                    value={draft.reviewerReviewCount}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        reviewerReviewCount: e.target.value,
                      }))
                    }
                    className="w-full bg-[#12161F] border border-[#2A3345] rounded-md px-3 py-2 text-xs outline-none focus:border-[#D9A441]"
                  />
                  <textarea
                    placeholder="Bewertungstext"
                    value={draft.text}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, text: e.target.value }))
                    }
                    rows={3}
                    className="w-full bg-[#12161F] border border-[#2A3345] rounded-md px-3 py-2 text-sm outline-none focus:border-[#D9A441] resize-none"
                  />
                  <button
                    onClick={addReview}
                    className="w-full bg-[#2A3345] hover:bg-[#333d52] transition-colors rounded-md py-2 text-sm font-medium"
                  >
                    Zur Fallakte hinzufügen
                  </button>
                </div>
              </div>

              <div className="bg-[#1A2130] border border-[#2A3345] rounded-lg p-4">
                <h2 className="font-display text-sm font-semibold mb-3">
                  Fallakte ({reviews.length})
                </h2>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {reviews.map((r) => (
                    <div
                      key={r.id}
                      className="bg-[#12161F] border border-[#2A3345] rounded-md p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[#D9A441]">
                          {r.rating}★
                        </span>
                        <button
                          onClick={() => removeReview(r.id)}
                          className="text-[#8B93A7] hover:text-[#C2463D]"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <p className="text-[#8B93A7] font-mono text-[10px] mb-1">
                        {r.reviewer || "unbekannt"} ·{" "}
                        {r.date
                          ? new Date(r.date).toLocaleString("de-DE")
                          : "kein Datum"}
                      </p>
                      <p className="text-[#E9E7E0] leading-snug">{r.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#1A2130] border border-[#2A3345] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display text-sm font-semibold">
                    CSV-Import
                  </h2>
                  <button
                    onClick={() => setShowCsv((s) => !s)}
                    className="text-xs text-[#D9A441] hover:underline"
                  >
                    {showCsv ? "Schließen" : "Öffnen"}
                  </button>
                </div>
                {showCsv && (
                  <div className="space-y-2">
                    <p className="text-xs text-[#8B93A7]">
                      Spalten: Bewerter, Sterne, Datum, Text,
                      AnzahlBewertungenKonto
                    </p>
                    <textarea
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      placeholder="CSV-Inhalt hier einfügen…"
                      rows={4}
                      className="w-full bg-[#12161F] border border-[#2A3345] rounded-md px-3 py-2 text-xs font-mono outline-none focus:border-[#D9A441] resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={importCsv}
                        className="flex-1 bg-[#2A3345] hover:bg-[#333d52] transition-colors rounded-md py-2 text-xs font-medium"
                      >
                        Importieren
                      </button>
                      <button
                        onClick={downloadCsvTemplate}
                        className="flex-1 border border-[#2A3345] hover:border-[#D9A441] transition-colors rounded-md py-2 text-xs font-medium"
                      >
                        Vorlage laden
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={runScan}
                disabled={reviews.length < 2 || scanning}
                className="w-full bg-[#D9A441] hover:bg-[#c99537] disabled:opacity-40 disabled:cursor-not-allowed text-[#12161F] font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors"
              >
                {scanning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Analysiere
                    Muster…
                  </>
                ) : (
                  <>
                    <FileSearch size={16} /> Muster analysieren
                  </>
                )}
              </button>
            </div>

            {/* Right: results */}
            <div className="md:col-span-3">
              {!analyzed && !scanning && (
                <div className="h-full flex flex-col items-center justify-center text-center py-24 border border-dashed border-[#2A3345] rounded-lg">
                  <ShieldAlert size={28} className="text-[#8B93A7] mb-3" />
                  <p className="text-[#8B93A7] text-sm max-w-xs">
                    Füge mindestens zwei Bewertungen hinzu und starte die
                    Analyse, um verdächtige Muster zu erkennen.
                  </p>
                </div>
              )}

              {scanning && (
                <div className="relative overflow-hidden h-64 border border-[#2A3345] rounded-lg flex items-center justify-center scan-sweep">
                  <div className="text-center">
                    <Radar
                      size={32}
                      className="text-[#D9A441] mx-auto mb-3 animate-pulse"
                    />
                    <p className="font-mono text-xs text-[#8B93A7]">
                      Zeitmuster · Textähnlichkeit · Generizität
                    </p>
                  </div>
                </div>
              )}

              {analyzed && !scanning && (
                <div className="space-y-4">
                  {analyzed.bimodalWarning && (
                    <div
                      className="flex items-start gap-2.5 rounded-lg p-3.5 text-sm"
                      style={{
                        background: "#C2463D1A",
                        border: "1px solid #C2463D",
                      }}
                    >
                      <AlertTriangle
                        size={16}
                        className="mt-0.5 flex-shrink-0"
                        style={{ color: "#C2463D" }}
                      />
                      <p>
                        <span className="font-semibold">
                          Verdacht auf koordinierte Kampagne:
                        </span>{" "}
                        Die Bewertungen häufen sich fast nur bei 1★ und 5★,
                        kaum in der Mitte. Dieses Muster tritt bei
                        organischem Feedback selten auf.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-[#1A2130] border border-[#2A3345] rounded-lg p-4">
                    <div>
                      <p className="font-display text-2xl font-semibold">
                        {flaggedCount}{" "}
                        <span className="text-sm font-normal text-[#8B93A7]">
                          von {analyzed.results.length} auffällig
                        </span>
                      </p>
                      <p className="text-xs text-[#8B93A7]">
                        Heuristische Ersteinschätzung, kein Rechtsgutachten
                      </p>
                    </div>
                    <button
                      onClick={exportEvidence}
                      disabled={flaggedCount === 0}
                      className="flex items-center gap-2 bg-[#2A3345] hover:bg-[#333d52] disabled:opacity-30 disabled:cursor-not-allowed rounded-md px-3 py-2 text-sm"
                    >
                      <Download size={14} /> Beweispaket
                    </button>
                  </div>

                  <div className="space-y-2">
                    {analyzed.results
                      .slice()
                      .sort((a, b) => b.risk - a.risk)
                      .map((r) => {
                        const rl = RISK_LABEL(r.risk);
                        const cl = CONFIDENCE_LABEL[r.confidence];
                        return (
                          <div
                            key={r.id}
                            className="bg-[#1A2130] border border-[#2A3345] rounded-lg p-3.5"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 text-xs font-mono text-[#8B93A7]">
                                <span>{r.reviewer || "unbekannt"}</span>
                                <span>·</span>
                                <span>{r.rating}★</span>
                                {r.confidence !== "keine" && (
                                  <span
                                    className="font-semibold"
                                    style={{ color: cl.color }}
                                  >
                                    · {cl.label}
                                  </span>
                                )}
                              </div>
                              <div
                                className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{
                                  color: rl.color,
                                  backgroundColor: `${rl.color}1A`,
                                }}
                              >
                                {r.risk >= 60 ? (
                                  <AlertTriangle size={12} />
                                ) : (
                                  <CheckCircle2 size={12} />
                                )}
                                {rl.label} · {r.risk}/100
                              </div>
                            </div>
                            <p className="text-sm mb-2">{r.text}</p>
                            {r.flags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {r.flags.map((f) => (
                                  <span
                                    key={f}
                                    className="text-[10px] font-mono text-[#8B93A7] border border-[#2A3345] rounded px-1.5 py-0.5"
                                  >
                                    {FLAG_LABELS[f]}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "sichtbarkeit" && (
          <div className="grid md:grid-cols-5 gap-6">
            <div className="md:col-span-2 space-y-3">
              <div className="bg-[#1A2130] border border-[#2A3345] rounded-lg p-4">
                <h2 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                  <Eye size={15} className="text-[#D9A441]" />
                  Unternehmen prüfen
                </h2>
                <div className="space-y-2">
                  <input
                    placeholder="Firmenname"
                    value={biz.name}
                    onChange={(e) =>
                      setBiz((b) => ({ ...b, name: e.target.value }))
                    }
                    className="w-full bg-[#12161F] border border-[#2A3345] rounded-md px-3 py-2 text-sm outline-none focus:border-[#D9A441]"
                  />
                  <input
                    placeholder="Branche / Kategorie (z. B. Zahnarzt)"
                    value={biz.category}
                    onChange={(e) =>
                      setBiz((b) => ({ ...b, category: e.target.value }))
                    }
                    className="w-full bg-[#12161F] border border-[#2A3345] rounded-md px-3 py-2 text-sm outline-none focus:border-[#D9A441]"
                  />
                  <input
                    placeholder="Stadt"
                    value={biz.city}
                    onChange={(e) =>
                      setBiz((b) => ({ ...b, city: e.target.value }))
                    }
                    className="w-full bg-[#12161F] border border-[#2A3345] rounded-md px-3 py-2 text-sm outline-none focus:border-[#D9A441]"
                  />
                  <button
                    onClick={runVisibilityCheck}
                    disabled={visLoading}
                    className="w-full bg-[#D9A441] hover:bg-[#c99537] disabled:opacity-40 text-[#12161F] font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors"
                  >
                    {visLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Prüfe
                        5 Anfragen…
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> Sichtbarkeit testen
                      </>
                    )}
                  </button>
                  {visError && (
                    <p className="text-xs text-[#C2463D]">{visError}</p>
                  )}
                </div>
              </div>

              <div className="bg-[#1A2130]/60 border border-[#2A3345] rounded-lg p-3.5 text-xs text-[#8B93A7] leading-relaxed">
                Dieser Prototyp testet die Sichtbarkeit ausschließlich bei
                Claude, als Stellvertreter für KI-Suchsysteme. Eine
                Produktivversion würde zusätzlich ChatGPT-, Perplexity- und
                Gemini-APIs abfragen, um ein vollständiges Bild zu erhalten.
              </div>
            </div>

            <div className="md:col-span-3">
              {!visResults && !visLoading && (
                <div className="h-full flex flex-col items-center justify-center text-center py-24 border border-dashed border-[#2A3345] rounded-lg">
                  <Radar size={28} className="text-[#8B93A7] mb-3" />
                  <p className="text-[#8B93A7] text-sm max-w-xs">
                    Trage Firmenname, Branche und Stadt ein, um zu prüfen, ob
                    das Unternehmen bei KI-Empfehlungen auftaucht.
                  </p>
                </div>
              )}

              {visLoading && (
                <div className="relative overflow-hidden h-64 border border-[#2A3345] rounded-lg flex items-center justify-center scan-sweep">
                  <div className="text-center">
                    <Sparkles
                      size={32}
                      className="text-[#D9A441] mx-auto mb-3 animate-pulse"
                    />
                    <p className="font-mono text-xs text-[#8B93A7]">
                      5 Empfehlungsanfragen laufen…
                    </p>
                  </div>
                </div>
              )}

              {visResults && !visLoading && (
                <div className="space-y-4">
                  <div className="bg-[#1A2130] border border-[#2A3345] rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="font-display text-2xl font-semibold">
                        {visScore}
                        <span className="text-base text-[#8B93A7]">
                          /{visResults.length}
                        </span>
                      </p>
                      <p className="text-xs text-[#8B93A7]">
                        Anfragen, in denen das Unternehmen genannt wurde
                      </p>
                    </div>
                    <div
                      className="text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{
                        color:
                          visScore === 0
                            ? "#C2463D"
                            : visScore < visResults.length
                            ? "#D9A441"
                            : "#4FA69C",
                        backgroundColor:
                          visScore === 0
                            ? "#C2463D1A"
                            : visScore < visResults.length
                            ? "#D9A4411A"
                            : "#4FA69C1A",
                      }}
                    >
                      {visScore === 0
                        ? "Nicht sichtbar"
                        : visScore < visResults.length
                        ? "Teilweise sichtbar"
                        : "Gut sichtbar"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {visResults.map((r, i) => (
                      <div
                        key={i}
                        className="bg-[#1A2130] border border-[#2A3345] rounded-lg p-3.5"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-mono text-[#8B93A7]">
                            Anfrage {i + 1}
                          </p>
                          <span
                            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              color: r.mentioned ? "#4FA69C" : "#C2463D",
                              backgroundColor: r.mentioned
                                ? "#4FA69C1A"
                                : "#C2463D1A",
                            }}
                          >
                            {r.mentioned ? (
                              <CheckCircle2 size={11} />
                            ) : (
                              <AlertTriangle size={11} />
                            )}
                            {r.mentioned ? "Genannt" : "Nicht genannt"}
                          </span>
                        </div>
                        <p className="text-xs text-[#8B93A7] italic mb-2">
                          „{r.prompt}"
                        </p>
                        <p className="text-sm leading-snug">{r.response}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
