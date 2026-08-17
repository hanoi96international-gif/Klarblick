# Klarblick — Projektkontext

*Dieses Dokument zu Beginn einer neuen Unterhaltung hochladen, damit sofort der
volle Kontext da ist. Stand: 17. August 2026.*

---

## Die Idee in einem Satz

Ein Tool für lokale Unternehmen, das erkennt, wenn gefälschte negative Bewertungen
das Google-Profil angreifen, und zusätzlich prüft, ob das Unternehmen bei
KI-Suchsystemen (ChatGPT, Perplexity, Gemini) überhaupt empfohlen wird.

## Wie wir dorthin kamen

Ausgangspunkt war das Interesse an Diensten, die Google-Bewertungen erstellen oder
löschen. Das ist als Geschäftsmodell nicht gangbar — § 5b UWG stellt Kauf, Verkauf
und Vermittlung gefälschter Bewertungen ausdrücklich als unlauteren Wettbewerb dar,
und es verstößt gegen Googles Richtlinien. Aus der Recherche kam die Umkehrung:
statt Manipulation zu betreiben, Manipulation *aufdecken* — legal, unbesetzter
Markt, echtes Problem.

Marktrecherche bestätigte: KI-generierte Fake-Bewertungen sind 2026 kaum noch von
echten zu unterscheiden, koordinierte Angriffe auf Wettbewerber nehmen zu, und
Google reagiert oft erst nach Wochen. Dedizierte, bezahlbare Erkennungstools für
einzelne lokale Betriebe gibt es praktisch nicht (bestehende AI-Visibility-Anbieter
zielen auf Multi-Location-Marken).

## Zielgruppe

Lokale Einzelbetriebe mit hohem Bewertungsdruck: Zahnärzte/Arztpraxen, Handwerker
(besonders Notdienst), Restaurants, Frisör-/Beauty-Salons.

## Preismodell (Entwurf)

- Starter 39 €/Monat — 1 Standort, Sabotage-Detektor, Wochenbericht
- Wachstum 89 €/Monat — bis 3 Standorte, Beweispaket-Export, tägl.
  AI-Sichtbarkeits-Check, Echtzeit-Alarme
- Agentur 199 €/Monat — unbegrenzte Standorte, White-Label-Berichte

## Was bereits gebaut ist

| Bereich | Inhalt |
|---|---|
| `shared/` | Erkennungslogik als eigenes Paket `@klarblick/detector`, ohne UI-Abhängigkeiten, mit Tests für jedes Signal |
| `frontend/` | Vite-React-Dashboard: Sabotage-Detektor + AI-Sichtbarkeits-Check, CSV-Import per Datei oder Einfügen |
| `landing/` | Marketing-Landingpage inkl. Preise, FAQ und funktionsfähigem Beta-Formular |
| `backend/` | Express: Google-OAuth, Sichtbarkeits-Proxy, Warteliste, verschlüsselte Token-Ablage, Rate-Limits |
| `.github/workflows/` | CI: Tests, Frontend-Build und Abhängigkeitsprüfung bei jedem Push |
| `DEPLOYMENT.md` | Schritt-für-Schritt-Anleitung für Landingpage, Backend und Dashboard |
| `docs/rechtliche-entwuerfe.md` | Impressum, Datenschutzerklärung, AGB — **ungeprüfte Entwürfe** |
| `docs/social-media-plan.md` | 4 Wochen, 12 fertige Posts für LinkedIn/Instagram |
| `docs/werbetexte-branchen.md` | Google Ads, Meta, Outreach für 4 Branchen |
| `docs/validierungsgespraeche.md` | Gesprächsleitfaden + Entscheidungsregel für Marktvalidierung |

### Erkennungslogik (9 Signale, 3 Kategorien)

Basiert auf veröffentlichter Forschung zu Fake-Review-Erkennung (u. a. Lim et al.,
Fei et al., Savage et al., Li et al. zu bimodaler Verteilung).

- **Statistisch:** zeitliche Häufung (≤48h), Ausbruch nach ≥14 Tagen Stille,
  Bewertungsabweichung vom Gesamtschnitt
- **Textuell:** Textähnlichkeit (Jaccard ≥0,35), Generizität, Sentiment-Rating-
  Mismatch, auffälliger Schreibstil (Caps/Ausrufezeichen)
- **Verhaltensbasiert:** Konto mit nur einer Bewertung, doppelter Bewertername

Konfidenz-Badge zeigt "hoch" nur, wenn **mindestens zwei verschiedene Kategorien**
zuschlagen — reduziert Fehlalarme gegenüber reinem Aufsummieren. Zusätzlich
Kampagnen-Warnung bei bimodaler Verteilung (fast nur 1★ und 5★).

## Design-System

- Farben: Ink `#12161F`, Panel `#1A2130`, Border `#2A3345`, Text `#E9E7E0`,
  Muted `#8B93A7`, Amber `#D9A441`, Teal `#4FA69C`, Rot `#C2463D`
- Schriften: Space Grotesk (Display), IBM Plex Sans (Body), IBM Plex Mono (Daten)

## Aktueller Stand & nächster Schritt

**Bewusste Entscheidung: erst validieren, dann investieren.** Gewerbeanmeldung,
Backend-Deployment, Werbekonten und Stripe sind absichtlich zurückgestellt, bis
echtes Marktsignal vorliegt.

Der Code steht seit dem Beta-Ausbau auf eigenen Füßen: Erkennungslogik als
getestetes Paket, lauffähiges Dashboard, gehärtetes Backend, funktionsfähige
Beta-Anmeldung, CI. Die technische Voraussetzung für die Validierung ist damit
erfüllt — was fehlt, ist Marktsignal, nicht Software.

**Als Nächstes dran:**
1. Landingpage kostenlos live schalten (Vercel/Netlify, keine Firma nötig) —
   Anleitung in `DEPLOYMENT.md`. Impressum und Datenschutzerklärung vorher
   einsetzen; das Beta-Formular sammelt bereits E-Mail-Adressen
2. 10–15 Validierungsgespräche nach Leitfaden führen
3. Entscheidungsregel: 5+ von 15 mit echtem Problem *und* Warteliste-Zusage
   → weitermachen. 2–4 → andere Branche testen. 0–1 → Idee ehrlich hinterfragen

## Offene Punkte / Abhängigkeiten

- Google-Business-Profile-API-Zugriff muss beantragt werden (3–10 Werktage
  Bearbeitung, Profil muss ≥60 Tage verifiziert sein) — bis dahin läuft alles
  über CSV-Import
- Rechtliche Entwürfe brauchen Anwalt- oder eRecht24-Prüfung vor Live-Gang
- AI-Sichtbarkeits-Check läuft im Prototyp nur gegen Claude; produktiv müssten
  ChatGPT-, Perplexity- und Gemini-APIs dazu
- Domain klarblick.de auf Verfügbarkeit prüfen

## Wichtige Leitplanken für dieses Projekt

Klarblick deckt Manipulation **auf** und erzeugt sie nicht. Keine Erstellung von
Bewertungen, kein Massen-Melden, kein Versprechen, Bewertungen löschen zu lassen —
das Produkt liefert Beweispakete, die Meldungen des Kunden stärken. Diese Grenze
ist zugleich Verkaufsargument und rechtliche Voraussetzung.
