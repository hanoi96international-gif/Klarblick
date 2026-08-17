import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

// Vor dem Laden der Module setzen: config.js und db.js lesen die Umgebung beim
// Import, und die Tests sollen nicht die echte Datenbank anfassen.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "klarblick-test-"));
process.env.DATABASE_FILE = path.join(tempDir, "test.db");
process.env.NODE_ENV = "test";
process.env.ALLOWED_ORIGINS = "http://localhost:5173";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;

const { createApp } = await import("../src/app.js");
const { config } = await import("../src/config.js");
const { closeDb } = await import("../src/db.js");
const { default: request } = await import("supertest");

// Für die Funktionstests großzügige Limits, damit sie sich nicht gegenseitig
// aussperren. Dass die echten Limits greifen, prüft der letzte Block gezielt.
const app = createApp({
  rateLimits: {
    api: { windowMs: 60_000, limit: 1000 },
    visibility: { windowMs: 60_000, limit: 1000 },
    waitlist: { windowMs: 60_000, limit: 1000 },
  },
});

after(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("GET /healthz", () => {
  it("meldet den Zustand ohne Anmeldung", async () => {
    const res = await request(app).get("/healthz");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
  });
});

describe("Unbekannte Route", () => {
  it("antwortet mit JSON statt einer HTML-Fehlerseite", async () => {
    const res = await request(app).get("/gibt-es-nicht");
    assert.equal(res.status, 404);
    assert.equal(res.body.error, "Nicht gefunden");
  });
});

describe("Sicherheits-Header", () => {
  it("setzt die Helmet-Header", async () => {
    const res = await request(app).get("/healthz");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.ok(res.headers["x-frame-options"]);
  });

  it("verrät die verwendete Server-Technik nicht", async () => {
    const res = await request(app).get("/healthz");
    assert.equal(res.headers["x-powered-by"], undefined);
  });
});

describe("POST /api/waitlist", () => {
  it("nimmt eine gültige Adresse an", async () => {
    const res = await request(app)
      .post("/api/waitlist")
      .send({ email: "inhaber@musterpraxis.de", business: "Musterpraxis" });
    assert.equal(res.status, 201);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.alreadyRegistered, false);
  });

  it("meldet eine doppelte Anmeldung als Erfolg, ohne sie zu bestätigen", async () => {
    await request(app).post("/api/waitlist").send({ email: "doppelt@example.de" });
    const res = await request(app).post("/api/waitlist").send({ email: "doppelt@example.de" });
    assert.equal(res.status, 201);
    assert.equal(res.body.ok, true);
  });

  it("normalisiert Groß- und Kleinschreibung", async () => {
    await request(app).post("/api/waitlist").send({ email: "Gross@Example.de" });
    const res = await request(app).post("/api/waitlist").send({ email: "gross@example.de" });
    assert.equal(res.body.alreadyRegistered, true);
  });

  it("weist ungültige Adressen ab", async () => {
    for (const email of ["", "keine-mail", "a@b", "@example.de", "a b@example.de"]) {
      const res = await request(app).post("/api/waitlist").send({ email });
      assert.equal(res.status, 400, `sollte abgelehnt werden: ${JSON.stringify(email)}`);
    }
  });

  it("weist eine fehlende Adresse ab", async () => {
    const res = await request(app).post("/api/waitlist").send({});
    assert.equal(res.status, 400);
  });
});

describe("GET /api/waitlist/count", () => {
  it("liefert nur die Anzahl, keine Adressen", async () => {
    const res = await request(app).get("/api/waitlist/count");
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.count, "number");
    assert.deepEqual(Object.keys(res.body), ["count"]);
  });
});

describe("POST /api/visibility", () => {
  it("meldet klar, wenn der Dienst nicht konfiguriert ist", async () => {
    const res = await request(app)
      .post("/api/visibility")
      .send({ name: "Heizung Wagner", category: "Heizungsbauer", city: "Köln" });
    assert.equal(res.status, 503);
    assert.match(res.body.error, /ANTHROPIC_API_KEY/);
  });
});

describe("GET /api/reviews", () => {
  it("verweigert den Zugriff ohne Anmeldung", async () => {
    const res = await request(app).get("/api/reviews");
    assert.equal(res.status, 401);
    assert.equal(res.body.error, "Nicht angemeldet");
  });
});

describe("GET /auth/google", () => {
  it("meldet klar, wenn Google nicht konfiguriert ist", async () => {
    const res = await request(app).get("/auth/google");
    assert.equal(res.status, 503);
  });
});

describe("GET /auth/me", () => {
  it("meldet ohne Sitzung, dass niemand angemeldet ist", async () => {
    const res = await request(app).get("/auth/me");
    assert.equal(res.status, 200);
    assert.equal(res.body.signedIn, false);
  });
});

describe("GET /api/waitlist/export", () => {
  const TOKEN = "geheim-fuer-den-test";

  it("ist abgeschaltet, solange kein ADMIN_TOKEN gesetzt ist", async () => {
    config.adminToken = "";
    const res = await request(app).get("/api/waitlist/export");
    assert.equal(res.status, 503);
  });

  it("verweigert fehlenden und falschen Token", async () => {
    config.adminToken = TOKEN;

    assert.equal((await request(app).get("/api/waitlist/export")).status, 401);
    assert.equal(
      (await request(app).get("/api/waitlist/export").set("Authorization", "Bearer falsch"))
        .status,
      401
    );
    // Gleiche Länge wie der echte Token — der Vergleich darf auch dann nicht durchlassen.
    assert.equal(
      (
        await request(app)
          .get("/api/waitlist/export")
          .set("Authorization", `Bearer ${"x".repeat(TOKEN.length)}`)
      ).status,
      401
    );

    config.adminToken = "";
  });

  it("liefert mit gültigem Token eine CSV mit den Anmeldungen", async () => {
    config.adminToken = TOKEN;
    await request(app).post("/api/waitlist").send({ email: "export@example.de" });

    const res = await request(app)
      .get("/api/waitlist/export")
      .set("Authorization", `Bearer ${TOKEN}`);

    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /text\/csv/);
    assert.match(res.headers["content-disposition"], /klarblick-warteliste\.csv/);
    assert.match(res.text, /email,unternehmen,angemeldet_am/);
    assert.match(res.text, /export@example\.de/);

    config.adminToken = "";
  });

  it("maskiert Kommas und Anführungszeichen, statt die Spalten aufzubrechen", async () => {
    config.adminToken = TOKEN;
    await request(app)
      .post("/api/waitlist")
      .send({ email: "komma@example.de", business: 'Meier, Sohn & "Co"' });

    const res = await request(app)
      .get("/api/waitlist/export")
      .set("Authorization", `Bearer ${TOKEN}`);

    assert.match(res.text, /"Meier, Sohn & ""Co"""/);

    config.adminToken = "";
  });

  it("liefert auf Wunsch JSON statt CSV", async () => {
    config.adminToken = TOKEN;
    const res = await request(app)
      .get("/api/waitlist/export?format=json")
      .set("Authorization", `Bearer ${TOKEN}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.entries));
    assert.equal(res.body.count, res.body.entries.length);

    config.adminToken = "";
  });
});

describe("Rate-Limiting", () => {
  const limitedApp = createApp({
    rateLimits: {
      api: { windowMs: 60_000, limit: 1000 },
      visibility: { windowMs: 60_000, limit: 1000 },
      waitlist: { windowMs: 60_000, limit: 2 },
    },
  });

  it("bremst wiederholte Wartelisten-Anmeldungen aus", async () => {
    const send = (n) =>
      request(limitedApp).post("/api/waitlist").send({ email: `limit${n}@example.de` });

    assert.equal((await send(1)).status, 201);
    assert.equal((await send(2)).status, 201);
    const blocked = await send(3);
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.error, /Zu viele Anmeldeversuche/);
  });

  it("lässt den Zähler weiterlaufen, obwohl das Eintragen gesperrt ist", async () => {
    // Das strenge Limit gilt nur dem Schreiben — eine gesperrte IP soll die
    // Landingpage trotzdem noch anzeigen können.
    const res = await request(limitedApp).get("/api/waitlist/count");
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.count, "number");
  });
});
