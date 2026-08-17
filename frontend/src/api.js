// Zugriff auf das Backend. Im Entwicklungsbetrieb leitet der Vite-Proxy /api und
// /auth an den lokalen Server weiter, im Produktivbetrieb liegt beides hinter
// derselben Domain — deshalb genügen relative Pfade, sofern VITE_API_URL nicht
// ausdrücklich auf eine andere Herkunft zeigt.

const BASE = import.meta.env.VITE_API_URL ?? "";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new ApiError("Server nicht erreichbar. Läuft das Backend?", 0);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Antwort ohne JSON-Körper — für die Fehlermeldung unten nicht zwingend nötig.
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || `Anfrage fehlgeschlagen (${response.status})`, response.status);
  }
  return payload;
}

/**
 * Fragt den AI-Sichtbarkeits-Check an. Der API-Schlüssel liegt ausschließlich im
 * Backend — der Browser sieht ihn nie.
 */
export function checkVisibility({ name, category, city }) {
  return request("/api/visibility", {
    method: "POST",
    body: JSON.stringify({ name, category, city }),
  });
}

/** Trägt eine E-Mail-Adresse in die Beta-Warteliste ein. */
export function joinWaitlist({ email, business }) {
  return request("/api/waitlist", {
    method: "POST",
    body: JSON.stringify({ email, business }),
  });
}

/** Holt Bewertungen aus dem verbundenen Google-Business-Profil, sofern freigeschaltet. */
export function fetchGoogleReviews() {
  return request("/api/reviews");
}

export { ApiError };
