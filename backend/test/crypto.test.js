import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";

import { decrypt, encrypt } from "../src/crypto.js";

const KEY = crypto.randomBytes(32);
const OTHER_KEY = crypto.randomBytes(32);

describe("Token-Verschlüsselung", () => {
  it("liefert den Ursprungswert zurück", () => {
    const token = "1//0eXaMpLe-refresh-token_abc123";
    assert.equal(decrypt(encrypt(token, KEY), KEY), token);
  });

  it("legt denselben Wert nie zweimal gleich ab", () => {
    // Gleiches Chiffrat für gleiches Token würde verraten, welche Nutzer
    // dasselbe Token teilen, und Angriffe auf wiederkehrende Werte erlauben.
    assert.notEqual(encrypt("gleicher-wert", KEY), encrypt("gleicher-wert", KEY));
  });

  it("enthält das Klartext-Token nicht im Chiffrat", () => {
    const token = "streng-geheim";
    assert.ok(!encrypt(token, KEY).includes(token));
  });

  it("verweigert die Entschlüsselung mit falschem Schlüssel", () => {
    const payload = encrypt("geheim", KEY);
    assert.throws(() => decrypt(payload, OTHER_KEY));
  });

  it("erkennt nachträgliche Veränderung am Chiffrat", () => {
    const payload = encrypt("geheim", KEY);
    const parts = payload.split(":");
    // Letztes Zeichen des Chiffrats kippen.
    const last = parts[3].at(-1) === "a" ? "b" : "a";
    parts[3] = parts[3].slice(0, -1) + last;
    assert.throws(() => decrypt(parts.join(":"), KEY));
  });

  it("behandelt leere Werte als null statt zu werfen", () => {
    assert.equal(encrypt(null, KEY), null);
    assert.equal(encrypt(undefined, KEY), null);
    assert.equal(encrypt("", KEY), null);
    assert.equal(decrypt(null, KEY), null);
  });

  it("weist ein unbekanntes Format zurück", () => {
    assert.throws(() => decrypt("nur-irgendein-string", KEY));
    assert.throws(() => decrypt("v9:aa:bb:cc", KEY));
  });

  it("verarbeitet Umlaute und lange Werte", () => {
    const value = "Grüße aus Köln — " + "x".repeat(5000);
    assert.equal(decrypt(encrypt(value, KEY), KEY), value);
  });
});
