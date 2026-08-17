import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, checkVisibility, joinWaitlist } from "../src/api.js";

function antwort(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

describe("API-Zugriff", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it("sendet die Anfrage als JSON mit Sitzungs-Cookie", async () => {
    fetch.mockResolvedValue(antwort({ results: [], score: 0, total: 5 }));

    await checkVisibility({ name: "Wagner", category: "Heizung", city: "Köln" });

    const [pfad, optionen] = fetch.mock.calls[0];
    expect(pfad).toBe("/api/visibility");
    expect(optionen.method).toBe("POST");
    // Ohne credentials würde die Sitzung bei jedem Aufruf verloren gehen.
    expect(optionen.credentials).toBe("include");
    expect(JSON.parse(optionen.body)).toEqual({
      name: "Wagner",
      category: "Heizung",
      city: "Köln",
    });
  });

  it("reicht die Fehlermeldung des Servers durch", async () => {
    fetch.mockResolvedValue(
      antwort({ error: "Stündliches Limit erreicht." }, { ok: false, status: 429 })
    );

    await expect(checkVisibility({ name: "a", category: "b", city: "c" })).rejects.toThrow(
      /Stündliches Limit erreicht/
    );
  });

  it("hängt den Statuscode an den Fehler, damit die Oberfläche unterscheiden kann", async () => {
    fetch.mockResolvedValue(antwort({ error: "Nicht berechtigt" }, { ok: false, status: 401 }));

    await expect(joinWaitlist({ email: "a@b.de" })).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
    });
  });

  it("erklärt einen Netzwerkausfall verständlich, statt den Rohfehler zu zeigen", async () => {
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(joinWaitlist({ email: "a@b.de" })).rejects.toThrow(/Server nicht erreichbar/);
  });

  it("kommt mit einer Fehlerantwort ohne JSON-Körper zurecht", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("kein JSON");
      },
    });

    const fehler = await joinWaitlist({ email: "a@b.de" }).catch((e) => e);
    expect(fehler).toBeInstanceOf(ApiError);
    expect(fehler.status).toBe(502);
  });
});
