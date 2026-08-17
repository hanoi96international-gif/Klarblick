# Arbeitshinweise für Klarblick

Vollständiger Projektkontext (Idee, Zielgruppe, Preismodell, Marktlage, Stand):
**`docs/KLARBLICK-PROJEKTKONTEXT.md`** — das ist die maßgebliche Quelle.
Diese Datei enthält nur, was beim Arbeiten am Code zu beachten ist.

## Leitplanke des Produkts

Klarblick deckt Manipulation **auf** und erzeugt sie nicht. Keine Erstellung von
Bewertungen, kein Massen-Melden, kein Versprechen, Bewertungen löschen zu lassen —
das Produkt liefert Beweispakete, die Meldungen des Kunden stärken. Diese Grenze
ist zugleich Verkaufsargument und rechtliche Voraussetzung (§ 5b UWG stellt Kauf,
Verkauf und Vermittlung gefälschter Bewertungen als unlauteren Wettbewerb dar).
Änderungen, die diese Grenze verschieben würden, gehören nicht ins Produkt.

## Aufbau

npm-Workspace mit `shared/` (Erkennungslogik), `frontend/` (Vite + React),
`backend/` (Express), `landing/` (eine HTML-Datei). Details in `README.md`.

Die Erkennungslogik gehört nach `shared/` — nicht in Komponenten. Sie ist der Kern
des Produkts und muss ohne Browser testbar bleiben.

## Beim Ändern der Erkennungslogik

- Schwellwerte und Gewichte stehen gebündelt in `shared/src/constants.js`, nicht
  verstreut im Code. Neue Signale dort eintragen und einer der drei Kategorien
  zuordnen — die Konfidenz-Berechnung zählt Kategorien, keine Einzeltreffer.
- Jedes Signal braucht einen Test für den Treffer **und** einen für den Nicht-Treffer.
  Ein Detektor, der zu oft anschlägt, ist für den Kunden schlimmer als einer, der
  etwas übersieht: ein Fehlalarm im Beweispaket beschädigt seine Google-Meldung.
- Formulierungen im Beweispaket bleiben zurückhaltend. Es geht an Google und darf
  nichts behaupten, was die Heuristik nicht hergibt.

## Sicherheit

- API-Schlüssel und Tokens gehören ausschließlich ins Backend. Nichts davon in
  Frontend-Code, auch nicht über `VITE_`-Variablen — die landen im Browser-Bundle.
- Google-Tokens werden vor dem Speichern verschlüsselt (`backend/src/crypto.js`).
- Pro Request einen eigenen OAuth-Client bauen, niemals einen globalen teilen.

## Vor dem Commit

```bash
npm test        # alle Pakete
npm run build   # Dashboard muss durchlaufen
```

## Sprache

Code-Kommentare, Oberfläche und Dokumentation auf Deutsch — das Produkt richtet
sich an deutsche Kleinbetriebe. Bezeichner im Code auf Englisch, wie in den
verwendeten Bibliotheken üblich.
