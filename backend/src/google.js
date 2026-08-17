// Google-OAuth-Hilfsfunktionen.
//
// WICHTIG: Für jeden Request wird ein eigener OAuth2-Client erzeugt. Ein einziger
// gemeinsam genutzter Client wäre ein ernstes Sicherheitsproblem — setCredentials()
// verändert dann globalen Zustand, und die Tokens des einen Nutzers können im
// gleichzeitig laufenden Request eines anderen landen.

import { google } from "googleapis";

import { config } from "./config.js";

// Bewusst minimal gehalten: Google prüft den Umfang der angefragten Scopes, und
// jeder zusätzliche Scope verlängert die Freigabe und schreckt Nutzer ab.
export const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/business.manage",
];

/** Erzeugt einen frischen OAuth2-Client — niemals einen globalen wiederverwenden. */
export function createOAuthClient() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

/** Baut die Anmelde-URL inklusive CSRF-State. */
export function buildAuthUrl(state) {
  return createOAuthClient().generateAuthUrl({
    access_type: "offline", // nötig, um überhaupt ein Refresh-Token zu erhalten
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

/** Tauscht den Callback-Code gegen Tokens und liest das Nutzerprofil. */
export async function exchangeCodeForProfile(code) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: profile } = await oauth2.userinfo.get();

  return { tokens, profile };
}

/** Baut einen Client für einen bereits verbundenen Nutzer. */
export function clientForUser(user) {
  const client = createOAuthClient();
  client.setCredentials({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
    expiry_date: user.tokenExpiry,
  });
  return client;
}
