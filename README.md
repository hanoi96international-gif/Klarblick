# Klarblick

Reputations-Monitoring für lokale Unternehmen: erkennt verdächtige Muster in
Google-Bewertungen und prüft die Sichtbarkeit in KI-Suchsystemen.

> **Status:** Prototyp / Validierungsphase. Noch kein Produktivbetrieb.

## Was das Projekt macht

**Sabotage-Detektor** — analysiert Bewertungen auf neun Signale aus drei
unabhängigen Kategorien (statistisch, textuell, verhaltensbasiert) und vergibt
einen Risikoscore je Bewertung. Bei Übereinstimmung über mehrere Kategorien
hinweg steigt die Konfidenz. Exportiert ein Beweispaket zur Untermauerung
eigener Google-Meldungen.

**AI-Sichtbarkeits-Check** — testet mit mehreren Anfrageformulierungen, ob ein
Unternehmen bei KI-Empfehlungen für seine Branche und Stadt genannt wird.

Klarblick erzeugt keine Bewertungen und verspricht keine Löschung. Es deckt
Manipulationsmuster auf und liefert Belege — die Meldung bleibt beim Kunden.

## Struktur

```
.
├── frontend/
│   └── reputations-waechter.jsx      React-Dashboard (Detektor + Sichtbarkeit)
├── landing/
│   └── klarblick-landingpage.html    Marketing-Seite, standalone
├── backend/
│   ├── server.js                     Express + Google OAuth
│   ├── package.json
│   ├── .env.example
│   └── README.md                     Setup + Google-API-Beantragung
└── docs/
    ├── KLARBLICK-PROJEKTKONTEXT.md   Gesamtüberblick, Stand, nächste Schritte
    ├── rechtliche-entwuerfe.md       Impressum, Datenschutz, AGB (ungeprüft)
    ├── social-media-plan.md
    ├── werbetexte-branchen.md
    └── validierungsgespraeche.md
```

## Schnellstart

**Landingpage ansehen:** `landing/klarblick-landingpage.html` im Browser öffnen —
keine Abhängigkeiten nötig.

**Backend lokal starten:**
```bash
cd backend
npm install
cp .env.example .env   # Werte eintragen, siehe backend/README.md
npm run dev
```

**Dashboard:** Das JSX ist für eine React-Umgebung gedacht (Vite, Next.js oder
Claude Artifacts). Nutzt Tailwind-Utility-Klassen und `lucide-react`.

## Wichtige Hinweise

- `.env` niemals committen — enthält Google-OAuth-Secrets
- Die rechtlichen Dokumente in `docs/` sind Entwürfe und ersetzen keine
  Rechtsberatung
- Google-Business-Profile-API-Zugriff muss separat beantragt werden; bis dahin
  läuft die Datenzufuhr über CSV-Import
- SQLite im Backend ist nur für die lokale Entwicklung gedacht

## Lizenz

Privates Projekt, noch keine Lizenz vergeben.
