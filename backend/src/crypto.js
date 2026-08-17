// Verschlüsselung der Google-Tokens vor dem Ablegen in der Datenbank.
//
// Ein Refresh-Token erlaubt dauerhaften Zugriff auf das Google-Business-Profil
// des Kunden. Im Klartext in der Datenbank wäre jeder Datenbank-Leak sofort ein
// Vollzugriff auf alle verbundenen Kundenkonten. AES-256-GCM verschlüsselt und
// erkennt zusätzlich nachträgliche Veränderungen am Chiffrat.

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // für GCM empfohlen
const FORMAT_VERSION = "v1";

/**
 * Verschlüsselt einen String. Ergebnis: "v1:<iv>:<authTag>:<chiffrat>", alles hex.
 *
 * @param {string|null|undefined} plaintext
 * @param {Buffer} key 32 Byte
 * @returns {string|null}
 */
export function encrypt(plaintext, key) {
  if (plaintext === null || plaintext === undefined || plaintext === "") return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [FORMAT_VERSION, iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(
    ":"
  );
}

/**
 * Entschlüsselt einen mit encrypt() erzeugten String.
 * Wirft, wenn der Wert verändert wurde oder der Schlüssel nicht passt.
 *
 * @param {string|null|undefined} payload
 * @param {Buffer} key 32 Byte
 * @returns {string|null}
 */
export function decrypt(payload, key) {
  if (!payload) return null;

  const parts = String(payload).split(":");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error("Unbekanntes Format des verschlüsselten Werts");
  }

  const [, ivHex, authTagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
