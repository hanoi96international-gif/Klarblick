# Klarblick

Reputations-Monitoring für lokale Unternehmen: erkennt verdächtige Muster in
Google-Bewertungen und prüft die Sichtbarkeit in KI-Suchsystemen.

> **Status:** Beta. Lauffähig und deploybar, noch kein Produktivbetrieb.

## Was das Projekt macht

**Sabotage-Detektor** — analysiert Bewertungen auf neun Signale aus drei
unabhängigen Kategorien (statistisch, textuell, verhaltensbasiert) und vergibt
einen Risikoscore je Bewertung. Die Konfidenz steigt erst, wenn mehrere
Kategorien gleichzeitig anschlagen — ein Signal allein beweist nichts.
Exportiert ein Beweispaket zur Untermauerung eigener Google-Meldungen.

**AI-Sichtbarkeits-Check** — testet mit mehreren Anfrageformulierungen, ob ein
Unternehmen bei KI-Empfehlungen für seine Branche und Stadt genannt wird.

Klarblick erzeugt keine Bewertungen und verspricht keine Löschung. Es deckt
Manipulationsmuster auf und liefert Belege — die Meldung bleibt beim Kunden.

## Struktur

Ein npm-Workspace mit drei Paketen. Die Erkennungslogik liegt bewusst in einem
eigenen Paket: sie ist der Kern des Produkts, muss unabhängig von der Oberfläche
testbar bleiben und wird sowohl im Browser als auch später serverseitig gebraucht.

```
.
├── shared/          @klarblick/detector — Erkennungslogik, ohne UI-Abhängigkeiten
│   ├── src/         Signale, Schwellwerte, CSV-Import, Beweispaket
│   └── test/        Unit-Tests für jedes Signal
├── frontend/        Vite + React — Dashboard (Detektor + Sichtbarkeits-Check)
├── backend/         Express — Google-OAuth, Sichtbarkeits-Proxy, Warteliste
├── landing/         Marketing-Seite plus Impressum, Datenschutz und AGB
│   ├── src/         Quelle des Stylesheets (Tailwind)
│   └── fonts/       Selbst gehostete Schriften — kein CDN, keine Google Fonts
└── docs/            Projektkontext, rechtliche Entwürfe, Marketingmaterial
```

## Schnellstart

```bash
npm install

# Backend (Port 3000)
cp backend/.env.example backend/.env    # Werte eintragen, siehe backend/README.md
npm run dev:backend

# Dashboard (Port 5173) — in einem zweiten Terminal
npm run dev:frontend
```

**Landingpage ansehen:** `landing/index.html` im Browser öffnen —
keine Abhängigkeiten nötig.

Ohne `.env` startet das Backend trotzdem: Google-Anmeldung und Sichtbarkeits-Check
melden sich dann als nicht konfiguriert, alles andere funktioniert.

## Tests, Linter und Build

```bash
npm run lint        # ESLint über alle Pakete
npm test            # 109 Tests: Detektor 64, Backend 29, Frontend 16
npm run build       # Landingpage-Stylesheet und Dashboard nach frontend/dist
```

Nach Änderungen an den Tailwind-Klassen im HTML der Landingpage muss
`npm run build:landing` laufen — die CI prüft, ob das eingecheckte Stylesheet
zum Markup passt, und schlägt sonst fehl.

## Erkennungslogik (9 Signale, 3 Kategorien)

Basiert auf veröffentlichter Forschung zu Fake-Review-Erkennung (u. a. Lim et al.,
Fei et al., Savage et al., Li et al. zur bimodalen Verteilung). Schwellwerte und
Gewichte stehen gebündelt in `shared/src/constants.js`.

| Kategorie | Signale |
|---|---|
| Statistisch | zeitliche Häufung (≤48 h), Ausbruch nach ≥14 Tagen Stille, Abweichung vom Gesamtschnitt |
| Textuell | Textähnlichkeit (Jaccard ≥0,35), Generizität, Sentiment-Rating-Mismatch, auffällige Schreibweise |
| Verhaltensbasiert | Konto mit nur einer Bewertung, doppelter Bewertername |

Das Konfidenz-Abzeichen meldet „hoch" erst bei **mindestens zwei verschiedenen
Kategorien** — das senkt Fehlalarme spürbar gegenüber reinem Aufsummieren, weil
zwei textuelle Auffälligkeiten oft nur am Schreibstil liegen. Zusätzlich warnt der
Detektor bei bimodaler Verteilung (fast nur 1★ und 5★) vor einer koordinierten
Kampagne.

## Wichtige Hinweise

- `.env` niemals committen — enthält Google-OAuth-Secrets und den API-Schlüssel
- Der Anthropic-Schlüssel liegt ausschließlich im Backend; der Browser sieht ihn nie
- Google-Refresh-Tokens werden vor dem Speichern verschlüsselt (AES-256-GCM)
- Die rechtlichen Dokumente in `docs/` sind Entwürfe und ersetzen keine Rechtsberatung
- Google-Business-Profile-API-Zugriff muss separat beantragt werden; bis dahin
  läuft die Datenzufuhr über CSV-Import
- SQLite ist für die Beta gedacht; ab mehreren Instanzen auf Postgres wechseln

## Weiterführend

- `DEPLOYMENT.md` — Live-Schaltung von Landingpage, Backend und Dashboard
- `backend/README.md` — Google-OAuth einrichten, API-Zugriff beantragen
- `docs/KLARBLICK-PROJEKTKONTEXT.md` — Gesamtüberblick, Stand, nächste Schritte

## Lizenz

Privates Projekt, noch keine Lizenz vergeben.
