# Klarblick Backend — Grundgerüst

Minimaler Node/Express-Server mit Google-OAuth-Login. Deckt genau zwei Dinge ab:
Anmeldung über Google und einen vorbereiteten (noch nicht scharfgeschalteten)
Endpunkt für Bewertungsdaten.

## Lokal starten

```bash
npm install
cp .env.example .env
# .env mit deinen echten Werten füllen (siehe Schritte unten)
npm run dev
```

Server läuft danach auf `http://localhost:3000`.

## Schritt 1 — Google-Cloud-Projekt einrichten

1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt anlegen
2. "APIs & Services" → "OAuth consent screen" → Nutzertyp "Extern" wählen, App-Namen
   ("Klarblick"), Support-E-Mail und Logo hinterlegen
3. "Credentials" → "Create Credentials" → "OAuth Client ID" → Typ "Web application"
4. Als "Authorized redirect URI" exakt eintragen:
   `http://localhost:3000/auth/google/callback` (später zusätzlich die
   Produktiv-URL, z. B. `https://app.klarblick.de/auth/google/callback`)
5. Client-ID und Client-Secret in die `.env` kopieren

Solange die App im Status "Testing" ist, können nur explizit als Testnutzer
hinterlegte Google-Konten sich anmelden — für die Beta-Phase reicht das, mit bis zu
100 Testnutzern.

## Schritt 2 — Business-Profile-API-Zugriff beantragen

Das ist der Schritt, der Zeit braucht (laut aktuellen Berichten 3–10 Werktage), also
früh anstoßen:

1. Voraussetzung: euer eigenes Google-Business-Profil muss seit mindestens
   60 Tagen aktiv und verifiziert sein
2. Zugriff beantragen über:
   [developers.google.com/my-business/content/prereqs](https://developers.google.com/my-business/content/prereqs)
3. Im Antragsformular den Use-Case möglichst konkret beschreiben, z. B.:
   *"Wir synchronisieren Bewertungen verifizierter, von uns autorisierter
   Geschäftskunden in ein internes Reputations-Dashboard zur Erkennung
   verdächtiger Bewertungsmuster."*
4. Nur die Scopes anfragen, die ihr wirklich braucht (hier bereits minimal gehalten:
   `business.manage`) — Überbeantragung führt laut mehreren Entwickler-Guides zu
   Re-Reviews und Verzögerungen

Bis zur Freigabe: `GBP_ACCESS_APPROVED=false` in der `.env` lassen. Das Frontend
nutzt in dieser Zeit den CSV-Import statt der Live-Anbindung — Kunden können also
schon vor Freigabe produktiv arbeiten.

## Schritt 3 — Nach Freigabe: echten Reviews-Call einbauen

Sobald der Zugriff steht, in `server.js` im `/api/reviews`-Handler die echten Calls
gegen die föderierten GBP-APIs einbauen (Stand 2026 in mehrere Teil-APIs
aufgesplittet):

- `mybusinessaccountmanagement.googleapis.com/v1` — Account-/Location-IDs holen
- `mybusinessbusinessinformation.googleapis.com/v1` — Standortdetails
- `mybusiness.googleapis.com/v4/accounts/*/locations/*/reviews` — die eigentlichen
  Bewertungen (List-Reviews-Endpunkt)

Die Antwortfelder (`reviewer.displayName`, `starRating`, `createTime`, `comment`) auf
das Frontend-Format mappen (`reviewer`, `rating`, `date`, `text`).

## Schritt 4 — Von SQLite auf Produktiv-DB wechseln

SQLite ist hier nur zum lokalen Entwickeln. Für den echten Betrieb empfiehlt sich
Postgres (z. B. gehostet über Supabase, Railway oder Neon — alle mit kostenlosem
Einstiegsplan), inklusive verschlüsselter Ablage der Refresh-Tokens.

## Sicherheits-Checkliste vor dem Live-Gang

- [ ] `SESSION_SECRET` durch echten Zufallswert ersetzen
- [ ] HTTPS erzwingen (die meisten Hoster wie Railway/Render machen das automatisch)
- [ ] Refresh-Tokens verschlüsselt speichern, nicht im Klartext wie in diesem
      Grundgerüst
- [ ] Rate-Limiting auf `/api/*`-Routen (z. B. `express-rate-limit`)
- [ ] AVV mit Hosting-Anbieter abschließen (siehe Datenschutz-Entwurf)
