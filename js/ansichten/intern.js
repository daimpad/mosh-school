// Interner Bereich (#/intern): bettet das Pad des Kollektivs (CryptPad) in die
// App ein, hinter einem Passwort.
//
// DAS PASSWORT IST DER SCHLÜSSEL, NICHT EIN VERGLEICHSWERT. Die Pad-Adresse
// steht verschlüsselt in js/intern-schluessel.js; das eingegebene Passwort
// entschlüsselt sie (js/tresor.js). Stimmt es nicht, schlägt die
// Entschlüsselung fehl — einen Vergleichswert gibt es nirgends. Anders als bis
// v211 schützt das Passwort damit wirklich etwas: Früher stand es im Klartext im
// Quelltext und zog nur einen Vorhang.
//
// DIE ADRESSE NIE IM KLARTEXT INS REPO. Bei CryptPad steckt der Schlüssel zum
// Pad im URL-Fragment — die Adresse IST der Schlüssel. Im Klartext committet,
// wäre das Pad unwiderruflich öffentlich (Historie, Klone, Pages-Spiegel).
// validate.py schlägt deshalb an, sobald irgendwo eine CryptPad-Adresse steht.
// Neue Adresse oder neues Passwort: scripts/verschluessele_pad.mjs.
//
// AUCH NICHT IN DIE URL: js/app.js zählt bei jedem Routenwechsel die volle
// Hash-Route samt Query an GoatCounter. Ein `#/intern?pw=…` schriebe das
// Passwort dauerhaft in ein fremdes Analytics-Log. Aus demselben Grund zählt
// der Router die Route #/intern gar nicht mit.
//
// ERST NACH DEM KLICK: Das iframe entsteht erst, wenn das Passwort gestimmt hat,
// also nach einem ausdrücklichen Klick auf „Öffnen". Vorher gibt es keinen
// Kontakt zum Pad-Dienst — kein Verbindungsaufbau, keine IP, keine Cookies auf
// dessen Origin. Darauf stützt sich der Datenschutzabschnitt.

import { t } from '../i18n.js';
import { esc, registriereAufraeumen } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';
import { entschluessele } from '../tresor.js';
import { PAD_SCHLOSS } from '../intern-schluessel.js';

// Die entschlüsselten Adressen, nur für diese Sitzung und bewusst NIRGENDWO
// persistiert: nicht in zustand.js (dessen Export landet in der
// herunterladbaren Backup-JSON), nicht im localStorage (überdauert Neustarts
// auf einem womöglich geteilten Gerät), nicht in der URL. Ein Reload fragt
// erneut nach dem Passwort.
let pad = null;

// Nur https. Die Adressen kommen zwar aus der eigenen verschlüsselten Datei,
// aber ein iframe mit `javascript:` wäre ein Fehler, den man nicht erst
// bemerken will, wenn er passiert ist.
function istBrauchbar(roh) {
  try {
    return new URL(roh).protocol === 'https:';
  } catch {
    return false;
  }
}

function schlossHtml() {
  return `
    <section class="abschnitt intern-schloss">
      <h2 class="abschnitt-titel">${esc(t('intern_schloss_titel'))}</h2>
      <form class="intern-form" novalidate>
        <div class="intern-feld">
          <label for="intern-pw">${esc(t('intern_pw_label'))}</label>
          <input id="intern-pw" class="intern-eingabe" type="password"
                 autocomplete="current-password" autocapitalize="none" spellcheck="false"
                 aria-describedby="intern-pw-fehler">
        </div>
        <button type="submit" class="knopf knopf-primaer">${esc(t('intern_oeffnen'))}</button>
      </form>
      <p id="intern-pw-fehler" class="intern-fehler" role="alert" aria-live="polite"></p>
    </section>`;
}

// Nach dem Entsperren: der Ausweich-Link und die Bühne fürs iframe. Der Link
// steht IMMER da, nicht erst bei einem Fehler: Eine blockierte Einbettung ist
// aus dieser Seite nicht zuverlässig zu erkennen (s. u.), und Browser, die
// Drittanbieter-Speicher sperren, zeigen im Rahmen nur CryptPads Fehlermeldung.
function bereichHtml() {
  return `
    <div class="knopf-zeile intern-aktionen">
      <a class="knopf knopf-leise" href="${esc(pad.oeffnen)}" target="_blank" rel="noopener noreferrer">
        <i class="fa-solid fa-link" aria-hidden="true"></i> ${esc(t('intern_pad_extern'))}
      </a>
    </div>
    <div class="intern-buehne" aria-live="polite"></div>`;
}

// Das iframe wird per DOM erzeugt statt als HTML-String eingesetzt: So steht
// die Adresse an keiner Stelle in einer Zeichenkette, die irgendwo als Markup
// landen könnte, und die Attribute stehen beieinander lesbar.
function haengeRahmenEin(buehne, url) {
  buehne.textContent = '';
  const rahmen = document.createElement('iframe');
  rahmen.className = 'intern-rahmen';
  rahmen.src = url;
  // Ohne title ist ein iframe für Screenreader ein namenloser Block (WCAG).
  rahmen.title = t('intern_rahmen_titel');
  // Die eigene Adresse geht den fremden Dienst nichts an.
  rahmen.referrerPolicy = 'no-referrer';
  // Leere Permissions-Policy: Kamera, Mikrofon, Standort ausdrücklich nein.
  rahmen.allow = '';
  // Ehrlich bleiben: CryptPad braucht Skripte UND seine eigene Origin (Krypto,
  // Speicher) — zusammen hebt das den Schutzwert der Sandbox für diese Origin
  // weitgehend auf. Was sie hier wirklich leistet, ist das FEHLENDE
  // allow-top-navigation: Ohne das kann die eingebettete Seite ZERRER nicht
  // wegnavigieren. Enger gesetzt bricht das Pad, statt sicherer zu werden.
  // (Die Meldung „CryptPad needs localStorage" kommt NICHT von hier — sie
  // entsteht, wenn der Browser Drittanbieter-Speicher sperrt, mit und ohne
  // sandbox; nachgestellt, s. CLAUDE.md.)
  rahmen.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads allow-modals',
  );
  buehne.appendChild(rahmen);
  // Beim Verlassen der Route abräumen, damit die Verbindung zum fremden Dienst
  // nicht weiterläuft. Das Ansichts-DOM wird zwar ohnehin ersetzt; das src zu
  // leeren macht das Ende explizit und unabhängig vom Zeitpunkt.
  registriereAufraeumen(() => {
    rahmen.src = 'about:blank';
    rahmen.remove();
  });
}

function zeichneInhalt(el) {
  const bereich = el.querySelector('.intern-inhalt');
  if (!bereich) return;

  if (pad) {
    bereich.innerHTML = bereichHtml();
    const buehne = bereich.querySelector('.intern-buehne');
    if (buehne) haengeRahmenEin(buehne, pad.einbetten);
    return;
  }

  bereich.innerHTML = schlossHtml();
  const form = bereich.querySelector('.intern-form');
  const feld = bereich.querySelector('#intern-pw');
  const knopf = form?.querySelector('button[type=submit]');
  const fehler = bereich.querySelector('#intern-pw-fehler');
  feld?.focus();
  form?.addEventListener('submit', async (ereignis) => {
    ereignis.preventDefault();
    // Die Schlüsselableitung dauert auf einem älteren Telefon rund eine
    // Sekunde (absichtlich — genau das bremst das Raten). Solange: Knopf
    // gesperrt und beschriftet, sonst tippt man ein zweites Mal.
    if (knopf) {
      knopf.disabled = true;
      knopf.textContent = t('intern_pruefe');
    }
    if (fehler) fehler.textContent = '';
    const inhalt = await entschluessele(PAD_SCHLOSS, feld?.value || '');
    if (!inhalt || !istBrauchbar(inhalt.einbetten) || !istBrauchbar(inhalt.oeffnen)) {
      if (knopf) {
        knopf.disabled = false;
        knopf.textContent = t('intern_oeffnen');
      }
      if (fehler) fehler.textContent = t('intern_pw_falsch');
      feld?.select();
      return;
    }
    pad = inhalt;
    zeichneInhalt(el);
  });
}

export function renderIntern(el) {
  el.innerHTML = `
    <article class="intern-seite">
      ${landingHeroHtml('fa-lock', t('intern_titel'), t('intern_untertitel'), 'pf-schiefer', 'intern')}
      <div class="intern-inhalt"></div>
    </article>`;
  zeichneInhalt(el);
}
