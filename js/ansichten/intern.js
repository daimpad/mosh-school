// Interner Bereich (#/intern): bettet ein Pad (CryptPad/Etherpad) in die App
// ein, hinter einer einfachen Passwortabfrage.
//
// WAS DAS IST UND WAS NICHT: Die App ist rein clientseitig; ein Passwort in
// JavaScript liegt im ausgelieferten Quelltext und ist damit für jeden lesbar.
// Diese Seite ist ein SICHTSCHUTZ, kein Zugangsschutz — sie hält Zufallsbesucher
// ab, nicht jemanden, der nachsieht. Genau so ist sie auch beschriftet
// (`intern_hinweis`), denn eine Seite, die „geschützt" verspricht und es nicht
// ist, ist schlimmer als eine, die offen sagt, was sie kann. Echter Schutz
// gehört auf den Server (Basic Auth bei netcup, vor das eingebettete Ziel).
//
// DIE PAD-ADRESSE WIRD BEWUSST NICHT EINGECHECKT. Bei CryptPad steckt der
// Entschlüsselungs-Schlüssel IM URL-Fragment — die Adresse IST der Schlüssel.
// Eine in ein öffentliches Repository committete Pad-URL veröffentlicht damit
// das Pad, unwiderruflich: Die Git-Historie ist öffentlich und geklont, und der
// Service Worker verteilte die Adresse zusätzlich in den Offline-Cache jedes
// Nutzers. Deshalb wird sie einmal im Browser hinterlegt und liegt nur dort —
// im Werkzeug-Speicher (localStorage, eigener Namespace), nie im Repo, nie im
// Fortschritts-Schema und nie in der URL.
//
// AUCH NICHT IN DIE URL: js/app.js zählt bei jedem Routenwechsel die volle
// Hash-Route samt Query an GoatCounter. Ein `#/intern?pad=…` oder `?pw=…`
// schriebe Adresse bzw. Passwort dauerhaft in ein fremdes Analytics-Log. Aus
// demselben Grund zählt der Router die Route #/intern gar nicht mit.
//
// KLICK ZUM LADEN: Das iframe entsteht erst nach einem ausdrücklichen Klick,
// nicht beim Betreten der Seite. Ohne Klick gibt es keinen Kontakt zum fremden
// Dienst — kein Verbindungsaufbau, keine IP, keine Cookies auf dessen Origin.
// Das vereinfacht die Datenschutz-Lage erheblich und kostet einen Klick.

import { t } from '../i18n.js';
import { esc, registriereAufraeumen } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';
import { holeWerkzeugDaten, setzeWerkzeugDaten } from '../werkzeug-speicher.js';

const SPEICHER = 'intern';

// Das Passwort steht im Klartext, weil es im ausgelieferten Bundle ohnehin
// stünde — ein Hash brächte nichts, der Vergleichswert wäre genauso lesbar.
// Folge daraus: Es darf nie ein Passwort sein, das anderswo benutzt wird.
const PASSWORT = 'verzerrer';

// Nur für diese Sitzung im Speicher, bewusst NIRGENDWO persistiert: nicht in
// zustand.js (dessen Export landet in der herunterladbaren Backup-JSON, die
// Nutzer weitergeben), nicht im localStorage (überdauert Neustarts auf einem
// womöglich geteilten Gerät) und nicht in der URL. Ein Reload fragt erneut —
// auf einer selten besuchten Seite ist das praktisch kostenlos.
let freigeschaltet = false;

function padUrl() {
  const gespeichert = holeWerkzeugDaten(SPEICHER, null);
  return typeof gespeichert?.pad === 'string' ? gespeichert.pad : '';
}

// Nur https und nur eine echte Adresse. Ohne diese Prüfung nähme das Feld auch
// `javascript:`/`data:` entgegen — aus einem Eingabefeld für die eigene
// Pad-Adresse würde sonst eine Einladung, sich selbst etwas unterzuschieben.
function istBrauchbar(roh) {
  try {
    return new URL(roh).protocol === 'https:';
  } catch {
    return false;
  }
}

function formHtml(url) {
  return `
    <form class="intern-pad-form" novalidate>
      <div class="intern-feld">
        <label for="intern-pad">${esc(t('intern_pad_label'))}</label>
        <input id="intern-pad" class="intern-eingabe" type="url" inputmode="url"
               spellcheck="false" autocomplete="off" placeholder="https://…"
               value="${esc(url)}" aria-describedby="intern-pad-hinweis">
      </div>
      <button type="submit" class="knopf knopf-sekundaer">${esc(t('intern_pad_sichern'))}</button>
    </form>
    <p id="intern-pad-hinweis" class="leise">${esc(t('intern_pad_hinweis'))}</p>`;
}

// Die Ansicht hinter dem Vorhang. Das iframe steht hier NICHT im Markup — es
// entsteht erst im Klick-Handler (s. Kopf).
function bereichHtml() {
  const url = padUrl();
  return `
    <section class="abschnitt">
      <h2 class="abschnitt-titel">${esc(t('intern_pad_titel'))}</h2>
      ${formHtml(url)}
      ${
        url
          ? `<div class="knopf-zeile intern-aktionen">
               <button type="button" class="knopf knopf-primaer" data-pad-laden>
                 <i class="fa-solid fa-eye" aria-hidden="true"></i> ${esc(t('intern_pad_laden'))}
               </button>
               <a class="knopf knopf-leise" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
                 <i class="fa-solid fa-link" aria-hidden="true"></i> ${esc(t('intern_pad_extern'))}
               </a>
             </div>
             <div class="intern-buehne" aria-live="polite"></div>`
          : ''
      }
    </section>`;
}

function schlossHtml() {
  return `
    <section class="abschnitt intern-schloss">
      <h2 class="abschnitt-titel">${esc(t('intern_schloss_titel'))}</h2>
      <form class="intern-form" novalidate>
        <div class="intern-feld">
          <label for="intern-pw">${esc(t('intern_pw_label'))}</label>
          <input id="intern-pw" class="intern-eingabe" type="password"
                 autocomplete="current-password" aria-describedby="intern-pw-fehler">
        </div>
        <button type="submit" class="knopf knopf-primaer">${esc(t('intern_oeffnen'))}</button>
      </form>
      <p id="intern-pw-fehler" class="intern-fehler" role="alert" aria-live="polite"></p>
    </section>`;
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
  rahmen.loading = 'lazy';
  // Ehrlich bleiben: CryptPad braucht Skripte UND seine eigene Origin (Krypto,
  // Speicher) — zusammen hebt das den Schutzwert der Sandbox für diese Origin
  // weitgehend auf. Was sie hier wirklich leistet, ist das FEHLENDE
  // allow-top-navigation: Ohne das kann die eingebettete Seite ZERRER nicht
  // wegnavigieren. Enger gesetzt bricht das Pad, statt sicherer zu werden.
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
  bereich.innerHTML = freigeschaltet ? bereichHtml() : schlossHtml();

  if (!freigeschaltet) {
    const form = bereich.querySelector('.intern-form');
    const feld = bereich.querySelector('#intern-pw');
    const fehler = bereich.querySelector('#intern-pw-fehler');
    feld?.focus();
    form?.addEventListener('submit', (ereignis) => {
      ereignis.preventDefault();
      // Trimmen und Groß-/Kleinschreibung ignorieren: Der Vorhang soll den
      // Berechtigten nicht an einer Feststelltaste scheitern lassen, und
      // sicherer wird er durch Strenge ohnehin nicht.
      if ((feld?.value || '').trim().toLowerCase() !== PASSWORT) {
        if (fehler) fehler.textContent = t('intern_pw_falsch');
        feld?.select();
        return;
      }
      freigeschaltet = true;
      zeichneInhalt(el);
    });
    return;
  }

  const form = bereich.querySelector('.intern-pad-form');
  const feld = bereich.querySelector('#intern-pad');
  form?.addEventListener('submit', (ereignis) => {
    ereignis.preventDefault();
    const roh = (feld?.value || '').trim();
    // Leeres Feld heißt „Adresse vergessen" — ein ausdrücklicher, nützlicher
    // Weg, keine Fehleingabe.
    if (!roh) {
      setzeWerkzeugDaten(SPEICHER, { pad: '' });
      zeichneInhalt(el);
      return;
    }
    if (!istBrauchbar(roh)) {
      feld?.setAttribute('aria-invalid', 'true');
      const hinweis = bereich.querySelector('#intern-pad-hinweis');
      if (hinweis) hinweis.textContent = t('intern_pad_ungueltig');
      return;
    }
    setzeWerkzeugDaten(SPEICHER, { pad: roh });
    zeichneInhalt(el);
  });

  bereich.querySelector('[data-pad-laden]')?.addEventListener('click', () => {
    const buehne = bereich.querySelector('.intern-buehne');
    if (buehne) haengeRahmenEin(buehne, padUrl());
  });
}

export function renderIntern(el) {
  el.innerHTML = `
    <article class="intern-seite">
      ${landingHeroHtml('fa-lock', t('intern_titel'), t('intern_untertitel'), 'pf-schiefer', 'intern')}
      <p class="intern-warnung leise">${esc(t('intern_hinweis'))}</p>
      <div class="intern-inhalt"></div>
    </article>`;
  zeichneInhalt(el);
}
