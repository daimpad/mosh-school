// Feedback-Modus: bindet den Kommentator (daimpad/kommentator, lokal in
// vendor/kommentator/) ein, damit Rezensent:innen die aktuelle Ansicht
// markieren, kommentieren und als JSON oder E-Mail zurückschicken können.
//
// Zwei Wege ihn zu starten, beide über dieselbe Aktivierung:
//   • ?feedback in der URL  → automatisch beim Booten (teilbarer Link)
//   • Knopf unter „Mitmachen" → aktiviereFeedback() auf Klick (ohne Reload)
// Normale Besucher ohne beides laden nichts davon (keine Extra-Bytes/-UI).
//
// Der Kommentator ist ein klassisches Skript (window.Kommentare), kein ES-Modul;
// CSS + JS werden dynamisch nachgeladen. Sein Thema scoped er über eigene
// Klassen (kommentare-dark/-light), nie über <html data-theme> — kein Konflikt
// mit dem App-Thema; wir reichen den passenden Wert hinein und führen ihn nach.
// Sein CI wird über css/feedback.css an das App-CI angeglichen.

import { einstellungen } from './zustand.js';

const KONTAKT_EMAIL = 'contact@nozilla.de';
let aktiv = false;

// App-Thema (auto/hell/dunkel) → Kommentator-Thema (auto/light/dark).
function kommentatorThema() {
  const abbildung = { hell: 'light', dunkel: 'dark', auto: 'auto' };
  return abbildung[einstellungen().thema] || 'auto';
}

function feedbackGewuenscht() {
  try {
    return new URLSearchParams(window.location.search).has('feedback');
  } catch {
    return false;
  }
}

function ladeStil(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function ladeSkript(src) {
  return new Promise((aufloesen, ablehnen) => {
    const skript = document.createElement('script');
    skript.src = src;
    skript.onload = aufloesen;
    skript.onerror = () => ablehnen(new Error(`Skript nicht ladbar: ${src}`));
    document.body.appendChild(skript);
  });
}

export function feedbackAktiv() {
  return aktiv;
}

// Startet den Kommentator (idempotent). Fehler bleiben lokal — schlägt das Laden
// fehl, läuft die App unverändert weiter.
export async function aktiviereFeedback() {
  if (aktiv) return;
  aktiv = true;
  try {
    await ladeSkript('vendor/kommentator/kommentare.js');
  } catch {
    aktiv = false;
    return;
  }
  ladeStil('vendor/kommentator/kommentare.css');
  ladeStil('css/feedback.css'); // CI-Angleichung, NACH der Vendor-CSS
  if (!window.Kommentare) {
    aktiv = false;
    return;
  }
  const instanz = window.Kommentare.init({
    container: '#ansicht', // die Lern-Inhalte; Kopf/Navigation bleiben außen vor
    autor: 'Gast',
    toolbarMode: 'floating', // Knopf unten rechts öffnet das Menü
    notes: 'floating', // schwebende Notizspalte — baut das Seitenlayout nicht um
    resizable: true,
    help: true,
    themeToggle: false, // das Thema steuert die App, nicht der Kommentator
    theme: kommentatorThema(),
    email: KONTAKT_EMAIL,
    emailSubject: 'Feedback mosh school',
  });
  // Thema mitführen, wenn es im Menü/Profil umgeschaltet wird (wendeThemaAn
  // sendet 'app:thema'). Fehler ignorieren — der Kommentator ist optional.
  window.addEventListener('app:thema', () => {
    try {
      instanz.setTheme(kommentatorThema());
    } catch {
      /* egal */
    }
  });
}

// Beiläufig beim Booten: nur der teilbare ?feedback-Link aktiviert automatisch.
export function initFeedbackWennGewuenscht() {
  if (feedbackGewuenscht()) aktiviereFeedback();
}
