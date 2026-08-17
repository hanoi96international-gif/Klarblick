# Klarblick Backend

Node/Express-Server mit vier Aufgaben: Google-Anmeldung, Bewertungsabruf,
serverseitiger Proxy für den AI-Sichtbarkeits-Check und die Beta-Warteliste.

## Lokal starten

```bash
npm install                 # im Repository-Wurzelverzeichnis
cp backend/.env.example backend/.env
npm run dev:backend
```

Läuft danach auf `http://localhost:3000`. Ohne ausgefüllte `.env` startet der
Server trotzdem und meldet im Log, welche Funktionen deshalb inaktiv sind.

## Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/healthz` | Zustand, für die Überwachung des Hosters |
| `GET` | `/auth/google` | Startet die Google-Anmeldung |
| `GET` | `/auth/google/callback` | Rückleitung von Google, legt die Sitzung an |
| `GET` | `/auth/me` | Ist jemand angemeldet? |
| `POST` | `/auth/logout` | Meldet ab |
| `GET` | `/api/reviews` | Bewertungen aus dem Google-Business-Profil (bis zur Freigabe 501) |
| `POST` | `/api/visibility` | AI-Sichtbarkeits-Check, fünf Anfrageformulierungen |
| `POST` | `/api/waitlist` | Beta-Anmeldung von der Landingpage |
| `GET` | `/api/waitlist/count` | Anzahl der Anmeldungen (keine Adressen) |
| `GET` | `/api/waitlist/export` | Alle Anmeldungen als CSV oder JSON, nur mit `ADMIN_TOKEN` |

## Aufbau

```
src/
├── server.js          Start, Sitzungsspeicher, geordnetes Herunterfahren
├── app.js             Express-App und Rate-Limits — ohne Port, dadurch testbar
├── config.js          Umgebungsvariablen, beim Start geprüft
├── crypto.js          AES-256-GCM für die Google-Tokens
├── db.js              SQLite-Schema und Abfragen
├── google.js          OAuth-Hilfsfunktionen
└── routes/            auth · reviews · visibility · waitlist
```

## Sicherheitsentscheidungen

**Ein OAuth-Client pro Request.** Ein gemeinsam genutzter Client wäre ein ernstes
Problem: `setCredentials()` verändert globalen Zustand, sodass die Tokens eines
Nutzers im gleichzeitig laufenden Request eines anderen landen können. `createOAuthClient()`
liefert deshalb immer eine frische Instanz.

**Tokens verschlüsselt.** Ein Refresh-Token erlaubt dauerhaften Zugriff auf das
Google-Business-Profil des Kunden. Im Klartext wäre jeder Datenbank-Leak sofort ein
Vollzugriff auf alle verbundenen Konten. Deshalb AES-256-GCM mit
`TOKEN_ENCRYPTION_KEY`, das auch nachträgliche Veränderung am Chiffrat erkennt.

**API-Schlüssel bleibt serverseitig.** Der Sichtbarkeits-Check lief früher direkt
aus dem Browser — ohne Schlüssel also immer erfolglos, mit Schlüssel für jeden
Besucher im Netzwerk-Tab sichtbar. Jetzt kennt nur der Server den Schlüssel.

**Rate-Limits** gebündelt als `DEFAULT_RATE_LIMITS` in `app.js`. Der Sichtbarkeits-Check
ist am strengsten begrenzt, weil jeder Aufruf fünf Modellanfragen auslöst.

## Schritt 1 — Google-Cloud-Projekt einrichten

1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt anlegen
2. "APIs & Services" → "OAuth consent screen" → Nutzertyp "Extern", App-Name
   ("Klarblick"), Support-E-Mail und Logo hinterlegen
3. "Credentials" → "Create Credentials" → "OAuth Client ID" → Typ "Web application"
4. Als "Authorized redirect URI" exakt eintragen:
   `http://localhost:3000/auth/google/callback` (später zusätzlich die Produktiv-URL,
   z. B. `https://api.klarblick.de/auth/google/callback`)
5. Client-ID und Client-Secret in die `.env` kopieren

Solange die App im Status "Testing" steht, können sich nur hinterlegte Testnutzer
anmelden — für die Beta reicht das, mit bis zu 100 Konten.

## Schritt 2 — Business-Profile-API-Zugriff beantragen

Der Schritt mit der längsten Wartezeit (3–10 Werktage), also früh anstoßen:

1. Voraussetzung: das eigene Google-Business-Profil muss seit mindestens 60 Tagen
   aktiv und verifiziert sein
2. Zugriff beantragen über
   [developers.google.com/my-business/content/prereqs](https://developers.google.com/my-business/content/prereqs)
3. Den Use-Case konkret beschreiben, z. B.: *"Wir synchronisieren Bewertungen
   verifizierter, von uns autorisierter Geschäftskunden in ein internes
   Reputations-Dashboard zur Erkennung verdächtiger Bewertungsmuster."*
4. Nur die wirklich benötigten Scopes anfragen (hier bereits minimal:
   `business.manage`) — Überbeantragung führt zu Nachprüfungen und Verzögerung

Bis zur Freigabe `GBP_ACCESS_APPROVED=false` lassen. `/api/reviews` antwortet dann
mit 501 statt mit erfundenen Daten; Kunden arbeiten über den CSV-Import, der
vollständig funktioniert.

## Schritt 3 — Nach Freigabe: echten Reviews-Call einbauen

In `src/routes/reviews.js` die föderierten GBP-APIs aufrufen (Stand 2026 in
mehrere Teil-APIs aufgesplittet):

- `mybusinessaccountmanagement.googleapis.com/v1` — Konto- und Standort-IDs
- `mybusinessbusinessinformation.googleapis.com/v1` — Standortdetails
- `mybusiness.googleapis.com/v4/accounts/*/locations/*/reviews` — die Bewertungen

Antwortfelder auf das Format des Detektors abbilden: `reviewer.displayName` →
`reviewer`, `starRating` → `rating`, `createTime` → `date`, `comment` → `text`.

## Schritt 4 — Von SQLite auf Postgres wechseln

SQLite liegt als Datei neben der Anwendung und verträgt keine parallel
schreibenden Prozesse. Sobald mehr als eine Instanz läuft, auf Postgres wechseln
(Supabase, Neon oder Railway Postgres, alle mit kostenlosem Einstieg). Die
Abfragen sind in `src/db.js` gebündelt, sodass nur diese Datei zu ersetzen ist.

## Tests

```bash
npm test --workspace backend
```

Deckt Verschlüsselung, Eingabeprüfung, Rate-Limits, Sicherheits-Header und die
Zugriffskontrolle ab. Die Tests legen eine eigene Datenbank im Temp-Verzeichnis an
und fassen die echte nicht an.
