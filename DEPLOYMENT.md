# Deployment

Reihenfolge nach Aufwand und Nutzen: Landingpage zuerst (kostenlos, keine Firma
nötig, liefert sofort Marktsignal), Backend und Dashboard erst, wenn Anmeldungen
eingehen.

---

## 1. Landingpage live schalten

Die Landingpage ist eine einzelne HTML-Datei ohne Build-Schritt.

**Netlify Drop** — schnellster Weg, kein Konto nötig für den ersten Test:
1. https://app.netlify.com/drop öffnen
2. Den Ordner `landing/` hineinziehen
3. Fertig; die Adresse lässt sich später auf eine eigene Domain umstellen

**Vercel** (versionsgebunden, aktualisiert sich bei jedem Push):
```bash
npx vercel --cwd landing
```

**GitHub Pages**: `landing/klarblick-landingpage.html` nach `docs/index.html`
kopieren und in den Repository-Einstellungen unter *Pages* den Ordner `docs`
auswählen.

### Vor dem Live-Gang zwingend erledigen

- [ ] **Impressum** im Footer durch echte Firmendaten ersetzen — Pflicht nach § 5 TMG,
      und ein fehlendes Impressum ist ein häufiger Abmahngrund
- [ ] **Datenschutzerklärung** verlinken (Entwurf in `docs/rechtliche-entwuerfe.md`,
      vorher anwaltlich oder über eRecht24 prüfen lassen)
- [ ] `KLARBLICK_API` im `<script>`-Block am Seitenende auf die Backend-Adresse
      setzen, sonst geht die Beta-Anmeldung ins Leere
- [ ] Die Domain der Landingpage in `ALLOWED_ORIGINS` des Backends eintragen

### Die Seite ist eigenständig

Stylesheet (`landing/klarblick.css`, 18 KB) und Schriften (`landing/fonts/`, 156 KB)
werden mit ausgeliefert. Es gibt keine Anfrage an ein fremdes CDN — die Seite
funktioniert hinter Firmen-Firewalls, mit Adblocker und bei CDN-Ausfall unverändert,
und überträgt keine Besucher-IP an Google (was das direkte Einbinden von Google
Fonts täte; LG München I, 2022).

Nach Änderungen an den Tailwind-Klassen im HTML das Stylesheet neu bauen — sonst
fehlen die neu verwendeten Klassen:

```bash
npm run build:landing
```

Beim Hochladen muss der komplette Ordner `landing/` mit, nicht nur die HTML-Datei.

---

## 2. Backend deployen

Läuft auf jedem Node-Hoster. Empfehlung: **Railway** oder **Render**, beide mit
kostenlosem Einstieg und automatischem HTTPS.

### Railway

```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

Start-Kommando: `npm start --workspace backend`

### Erforderliche Umgebungsvariablen

Vorlage: `backend/.env.example`. Die beiden Schlüssel erzeugen mit:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| Variable | Pflicht | Zweck |
|---|---|---|
| `SESSION_SECRET` | ja | Signiert die Sitzungs-Cookies |
| `TOKEN_ENCRYPTION_KEY` | ja | Verschlüsselt die Google-Tokens in der Datenbank (32 Byte Hex) |
| `NODE_ENV` | ja | Auf `production` setzen — schaltet sichere Cookies und Proxy-Erkennung ein |
| `ALLOWED_ORIGINS` | ja | Domains von Landingpage und Dashboard, kommagetrennt |
| `FRONTEND_URL` | ja | Ziel nach erfolgreicher Google-Anmeldung |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | für Login | Aus der Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | für Login | Muss exakt mit dem Eintrag bei Google übereinstimmen |
| `ANTHROPIC_API_KEY` | für Sichtbarkeits-Check | Von console.anthropic.com |
| `DATABASE_FILE` | nein | Pfad zur SQLite-Datei, Vorgabe `./klarblick.db` |

Der Server startet mit fehlenden Pflichtwerten gar nicht erst, sondern nennt die
fehlende Variable im Klartext.

### Datenhaltung

SQLite liegt als Datei neben der Anwendung. Auf Hostern mit kurzlebigem Dateisystem
(Railway ohne Volume, Render Free) **geht sie bei jedem Deploy verloren** — inklusive
Warteliste. Deshalb:

- Railway: ein Volume anlegen und `DATABASE_FILE` dorthin zeigen lassen
- Render: einen Persistent Disk buchen
- Ab mehreren Instanzen ohnehin auf Postgres wechseln (Supabase, Neon, Railway
  Postgres); SQLite verträgt keine parallel schreibenden Prozesse

### Checkliste vor dem Live-Gang

- [ ] `NODE_ENV=production` gesetzt (sonst sind die Cookies nicht auf `secure`)
- [ ] `SESSION_SECRET` und `TOKEN_ENCRYPTION_KEY` sind echte Zufallswerte
- [ ] HTTPS erzwungen (bei Railway/Render automatisch)
- [ ] `ALLOWED_ORIGINS` enthält **nur** die eigenen Domains
- [ ] Datenbank liegt auf dauerhaftem Speicher
- [ ] `/healthz` liefert `{"status":"ok"}`
- [ ] Auftragsverarbeitungsvertrag mit dem Hoster geschlossen (siehe Datenschutz-Entwurf)

---

## 3. Dashboard deployen

```bash
npm run build          # erzeugt frontend/dist
npx vercel --cwd frontend
```

Vercel und Netlify erkennen Vite selbstständig. Manuell:
Build-Kommando `npm run build`, Ausgabeordner `frontend/dist`.

Läuft das Dashboard auf einer anderen Domain als das Backend, dort
`VITE_API_URL=https://api.deine-domain.de` setzen und dieselbe Domain in
`ALLOWED_ORIGINS` des Backends eintragen. Liegen beide hinter derselben Domain,
kann `VITE_API_URL` leer bleiben.

---

## 4. Google-Business-Profile-API beantragen

Der Schritt mit der längsten Wartezeit (3–10 Werktage) — deshalb früh anstoßen,
Details in `backend/README.md`. Bis zur Freigabe bleibt `GBP_ACCESS_APPROVED=false`;
Kunden arbeiten in der Zwischenzeit über den CSV-Import, der vollständig funktioniert.

---

## Betriebshinweise

**Health-Check:** `GET /healthz` — für die Überwachung des Hosters eintragen.

**Rate-Limits** (in `backend/src/app.js` als `DEFAULT_RATE_LIMITS` gebündelt):

| Route | Limit |
|---|---|
| `/api/*` | 60 Anfragen pro Minute und IP |
| `POST /api/visibility` | 10 pro Stunde und IP — jeder Aufruf kostet fünf Modellanfragen |
| `POST /api/waitlist` | 5 pro Stunde und IP |

**Logs:** Fehler gehen nach stderr. Weder Tokens noch API-Schlüssel werden geloggt.
