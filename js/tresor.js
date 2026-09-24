// Tresor: verschlüsselt einen kleinen Inhalt mit einem Passwort (themenneutral,
// DOM-frei). Genutzt für die Pad-Adresse unter #/intern — und zwar IDENTISCH
// von der Seite (Entschlüsseln) und von scripts/verschluessele_pad.mjs
// (Verschlüsseln): Ein Parameter, der an zwei Stellen stünde, liefe
// auseinander, und dann passte kein Passwort mehr.
//
// WARUM ÜBERHAUPT: Bei CryptPad IST die Adresse der Schlüssel zum Pad. Im
// öffentlichen Repository darf sie deshalb nie im Klartext stehen. Verschlüsselt
// darf sie das — dann schützt das Passwort wirklich etwas, statt nur einen
// Vorhang zu ziehen. Die Stärke hängt damit allein am Passwort: Wer die
// verschlüsselte Datei hat (jeder, sie ist öffentlich), kann offline raten.
// Dagegen stehen die vielen PBKDF2-Runden; ein kurzes Wörterbuchwort hilft
// trotzdem nicht. Und nie ein Passwort, das schon einmal im Quelltext stand.
//
// Nur die WebCrypto-Bordmittel (Browser und Node ≥ 19 haben `crypto.subtle`):
// keine Bibliothek, kein Build-Schritt.

// OWASP-Empfehlung für PBKDF2-SHA256. Auf einem älteren Telefon dauert das
// Entschlüsseln damit rund eine Sekunde — einmal je Besuch, verkraftbar.
export const ITERATIONEN = 600000;

const TEXT = new TextEncoder();

function zuBase64(bytes) {
  let roh = '';
  for (const b of bytes) roh += String.fromCharCode(b);
  return btoa(roh);
}

function ausBase64(text) {
  return Uint8Array.from(atob(text), (z) => z.charCodeAt(0));
}

// Getrimmt und klein geschrieben: Telefon-Tastaturen setzen den ersten
// Buchstaben gern groß, und an einem Leerzeichen am Ende soll niemand
// scheitern. Kostet kaum Stärke, weil das Passwort ohnehin klein ist.
export function normalisiere(passwort) {
  return String(passwort ?? '').trim().toLowerCase();
}

async function schluessel(passwort, salz, iterationen, zweck) {
  const basis = await crypto.subtle.importKey(
    'raw', TEXT.encode(normalisiere(passwort)), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salz, iterations: iterationen },
    basis,
    { name: 'AES-GCM', length: 256 },
    false,
    [zweck],
  );
}

// Liefert ein reines JSON-Objekt, das so in eine Datei geschrieben werden kann.
export async function verschluessele(inhalt, passwort) {
  const salz = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await schluessel(passwort, salz, ITERATIONEN, 'encrypt');
  const daten = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, k, TEXT.encode(JSON.stringify(inhalt)),
  );
  return {
    version: 1,
    iterationen: ITERATIONEN,
    salz: zuBase64(salz),
    iv: zuBase64(iv),
    daten: zuBase64(new Uint8Array(daten)),
  };
}

// Falsches Passwort → null. AES-GCM prüft die Echtheit selbst (Auth-Tag): Mit
// dem falschen Schlüssel gibt es keinen Müll-Klartext, sondern einen Fehler.
// Deshalb braucht es auch keinen gespeicherten Passwort-Hash zum Vergleichen —
// der wäre nur ein zweites Angriffsziel.
export async function entschluessele(schloss, passwort) {
  try {
    const k = await schluessel(
      passwort, ausBase64(schloss.salz), schloss.iterationen, 'decrypt',
    );
    const klar = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ausBase64(schloss.iv) }, k, ausBase64(schloss.daten),
    );
    return JSON.parse(new TextDecoder().decode(klar));
  } catch {
    return null;
  }
}
