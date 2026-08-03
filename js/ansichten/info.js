// Info-Reiter „Über" und „Mitmachen": statischer Referenzinhalt aus app-info.json
// (eigene Entität, NICHT im Baustein-Pool — kein Fortschritt, keine Gamification).
// Platzhalter in [eckigen Klammern] bleiben bewusst sichtbar, bis der Betreiber
// sie füllt (Name, Lizenz, GitHub-URL) — sie werden nie erfunden oder verlinkt.

import { aktiviereFeedback, feedbackAktiv } from '../feedback.js';
import { t, text } from '../i18n.js';
import { esc, externesZiel, nichtGefundenHtml } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';

function istPlatzhalter(wert) {
  return typeof wert === 'string' && wert.trim().startsWith('[');
}

// Externer Absprung. Ein noch nicht gefüllter Platzhalter wird sichtbar gelassen
// (der Betreiber ersetzt ihn), aber nie als Link ausgegeben.
function externerLink(ziel, beschriftung, klasse) {
  if (istPlatzhalter(ziel) || !externesZiel(ziel)) {
    return `<span class="${klasse} knopf-inaktiv" role="link" aria-disabled="true">${esc(beschriftung)}</span>
      <span class="info-platzhalter leise">${esc(ziel || '')}</span>`;
  }
  return `<a class="${klasse}" href="${esc(ziel)}" target="_blank" rel="noopener noreferrer">${esc(beschriftung)} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>`;
}

// Kein Brands-Font eingebunden (nur fa-solid) — das GitHub-Logo daher als Inline-SVG.
const GITHUB_SVG =
  '<svg class="github-logo" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" focusable="false"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

// Abstraktes Ziegenkopf-Icon (Inline-SVG, eigene Zeichnung — keine Reproduktion
// des GoatCounter-Markenlogos) fuer den Reichweitenmessungs-Hinweis unten in
// diesem Abschnitt; dieselbe Zeichnung traegt index.html und build_seiten.py.
const GOAT_SVG =
  '<svg class="goat-logo" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 21c-2.8 0-5-2.1-5-4.8v-2.8c0-2.9 2.2-5.2 5-5.2s5 2.3 5 5.2v2.8c0 2.7-2.2 4.8-5 4.8Z"/><path d="M7.8 8.6C6 6.7 5 4.6 5 2.4c2 .1 3.8 1.1 4.8 3"/><path d="M16.2 8.6C18 6.7 19 4.6 19 2.4c-2 .1-3.8 1.1-4.8 3"/><path d="M12 21v1.4"/><circle cx="10.1" cy="11.4" r=".9" fill="currentColor" stroke="none"/><circle cx="13.9" cy="11.4" r=".9" fill="currentColor" stroke="none"/></svg>';

// Lizenz-/Credits-Absatz: dieselben echten Links wie im Footer (index.html),
// hier zentral im „Über"-Reiter statt im Footer selbst (der traegt seit der
// Fussnav-Ueberarbeitung nur noch Impressum/Datenschutz + die Logos). Bewusst
// hartes HTML statt JSON-`eintraege` (die werden escaped) — echte Links
// gehoeren nicht in escapten Fliesstext. `titel` bleibt aus app-info.json,
// damit die Ueberschrift editierbar bleibt.
function creditsLizenzHtml(titel) {
  return `<section class="karte">
    <h2>${esc(titel ?? 'Open Source & Lizenz')}</h2>
    <p class="leise">Der Code steht unter der <a href="https://github.com/daimpad/mosh-school/blob/main/LICENSE" rel="license noopener" target="_blank">MIT-Lizenz</a> — nutze, verändere und teile ihn frei. Die Inhalte stehen unter <a href="https://creativecommons.org/licenses/by-nc/4.0/deed.de" rel="license noopener" target="_blank">Creative Commons BY-NC 4.0</a>: Namensnennung, nicht kommerziell.</p>
    <p class="leise">Gebaut von <a href="https://paderta.com" rel="noopener" target="_blank">Damian Paderta</a> (<a href="https://nozilla.de" rel="noopener" target="_blank">Nozilla — bits and bytes with heart</a>) · <a href="#/kollektiv">ZERRER-Kollektiv</a>.</p>
    <p class="leise">${GOAT_SVG} Anonyme Reichweitenmessung mit <a href="https://www.goatcounter.com/" rel="noopener" target="_blank">GoatCounter</a> — Details in der <a href="#/datenschutz">Datenschutzerklärung</a>.</p>
  </section>`;
}

function abschnittHtml(block) {
  if (!block) return '';
  const eintraege = (block.eintraege || []).map((e) => `<p class="leise">${esc(text(e) ?? '')}</p>`).join('');
  const github =
    block.github && block.github.ziel && !istPlatzhalter(block.github.ziel)
      ? `<p class="info-cta"><a class="knopf knopf-sekundaer info-github" href="${esc(block.github.ziel)}" target="_blank" rel="noopener noreferrer">${GITHUB_SVG} ${esc(text(block.github.label) ?? 'GitHub')}</a></p>`
      : '';
  return `<section class="karte"><h2>${esc(text(block.titel) ?? '')}</h2>${eintraege}${github}</section>`;
}

// Regenbogenflagge (Pride) als Inline-SVG — bewusst FARBIG (Ausnahme vom
// currentColor-Prinzip; eine Flagge ist ohne ihre Farben keine Flagge).
const PRIDE_SVG =
  '<svg class="pride-svg" viewBox="0 0 18 12" width="26" height="17" aria-hidden="true" focusable="false">' +
  '<rect width="18" height="2" y="0" fill="#e40303"/><rect width="18" height="2" y="2" fill="#ff8c00"/>' +
  '<rect width="18" height="2" y="4" fill="#ffed00"/><rect width="18" height="2" y="6" fill="#008026"/>' +
  '<rect width="18" height="2" y="8" fill="#004dff"/><rect width="18" height="2" y="10" fill="#750787"/></svg>';

// Haltungs-Statements mit Icon (monochrom, currentColor) — die Flagge kommt extra.
const HALTUNG = [
  { icon: 'fa-ban', key: 'haltung_no_ads' },
  { icon: 'fa-eye-slash', key: 'haltung_no_tracking' },
  { icon: 'fa-thumbs-down', key: 'haltung_no_influencer' },
  { icon: 'fa-shield', key: 'haltung_no_nsbm' },
];

function haltungHtml() {
  const zeilen = HALTUNG.map(
    (s) => `<li><i class="fa-solid ${s.icon}" aria-hidden="true"></i> <span>${esc(t(s.key))}</span></li>`,
  ).join('');
  return `
    <section class="karte ueber-haltung">
      <h2>${esc(t('haltung_titel'))}</h2>
      <ul class="haltung-liste">
        ${zeilen}
        <li class="haltung-pride"><span class="pride-flag" role="img" aria-label="${esc(t('haltung_lgbtq_aria'))}">${PRIDE_SVG}</span> <span>${esc(t('haltung_lgbtq'))}</span></li>
      </ul>
    </section>`;
}

// Steckbrief: die ausführliche Selbstbeschreibung (Was ist es / was kann es /
// wozu / für wen / was nicht), aufklappbar statt als Textwand — die Absätze
// füllen sonst den halben Reiter, bevor Haltung und Credits überhaupt kommen.
//
// Die Zahlen darin stehen NICHT im Text, sondern als Platzhalter `{bausteine}`
// & Co. Ein Bestand, der wöchentlich wächst, wäre als ausgeschriebene Zahl in
// der JSON binnen eines Monats falsch — und zwar lautlos, weil kein Test einen
// Fließtext gegen den Pool prüft. Unbekannte Platzhalter bleiben unersetzt
// stehen, damit ein Tippfehler auffällt statt eine leere Lücke zu hinterlassen.
function steckbriefZahlen(daten) {
  return {
    bausteine: daten.bausteine?.length ?? 0,
    fehlerbilder: daten.fehlerbilder?.length ?? 0,
    einheiten: daten.einheiten?.length ?? 0,
    genres: Object.keys(daten.genres || {}).length,
    stimmungen: daten.tunings?.stimmungen?.length ?? 0,
    patterns: daten.patterns?.patterns?.length ?? 0,
    glossar: daten.glossar?.begriffe?.length ?? 0,
    experimente: daten.experimente?.experimente?.length ?? 0,
    songs: (daten.songs || []).reduce((summe, pool) => summe + (pool.songs?.length ?? 0), 0),
  };
}

function setzeZahlen(roh, zahlen) {
  return String(roh).replace(/\{(\w+)\}/g, (treffer, name) =>
    zahlen[name] == null ? treffer : String(zahlen[name]),
  );
}

function steckbriefHtml(abschnitte, zahlen) {
  if (!Array.isArray(abschnitte) || abschnitte.length === 0) return '';
  return abschnitte
    .map((a) => {
      const absaetze = (a.absaetze || [])
        .map((p) => `<p>${esc(setzeZahlen(text(p) ?? '', zahlen))}</p>`)
        .join('');
      const punkte = (a.punkte || [])
        .map((p) => `<li>${esc(setzeZahlen(text(p) ?? '', zahlen))}</li>`)
        .join('');
      return `
      <details class="karte klapp-abschnitt">
        <summary><h2>${esc(text(a.titel) ?? '')}</h2></summary>
        ${absaetze}
        ${punkte ? `<ul class="steckbrief-liste">${punkte}</ul>` : ''}
      </details>`;
    })
    .join('');
}

export function renderUeber(el, daten) {
  const u = daten.appInfo?.ueber;
  if (!u) {
    el.innerHTML = nichtGefundenHtml();
    return;
  }
  const absaetze = (u.absaetze || []).map((a) => `<p>${esc(text(a) ?? '')}</p>`).join('');
  const links = (u.links || []).map((l) => `<p class="info-cta">${externerLink(l.ziel, text(l.label) ?? '', 'knopf knopf-sekundaer')}</p>`).join('');
  el.innerHTML = `
    ${landingHeroHtml('fa-compass', text(u.titel) ?? t('nav_ueber'), '', 'pf-blau')}
    ${absaetze ? `<section class="karte">${absaetze}</section>` : ''}
    ${steckbriefHtml(u.steckbrief, steckbriefZahlen(daten))}
    ${haltungHtml()}
    ${abschnittHtml(u.danksagungen)}
    ${creditsLizenzHtml(text(u.credits_lizenz?.titel))}
    ${links ? `<section class="karte">${links}</section>` : ''}
    <section class="karte">
      <h2>${esc(t('nav_mitmachen'))}</h2>
      <p class="leise">${esc(t('profil_mitmachen_text'))}</p>
      <p class="info-cta"><a class="knopf knopf-sekundaer" href="#/mitmachen"><i class="fa-solid fa-comments" aria-hidden="true"></i> ${esc(t('nav_mitmachen'))}</a></p>
    </section>`;
}

// Schlichte Info-Seite: Titel + optionale Einleitungs-Absätze, dazu optionale
// betitelte `abschnitte` (h2 + Absätze). Trägt die Rechtstexte (Impressum/
// Datenschutz) UND die Kollektiv-Seite — gleiche Bauform, eine Stelle.
// Platzhalter in [eckigen Klammern] bleiben sichtbar, bis der Betreiber sie füllt.
function infoSeiteHtml(block) {
  const absaetzeHtml = (liste) => (liste || []).map((a) => `<p>${esc(text(a) ?? '')}</p>`).join('');
  const einleitung = absaetzeHtml(block.absaetze);
  const abschnitte = (block.abschnitte || [])
    .map((a) => `<h2>${esc(text(a.titel) ?? '')}</h2>${absaetzeHtml(a.absaetze)}`)
    .join('');
  return `
    <h1>${esc(text(block.titel) ?? '')}</h1>
    <section class="karte">${einleitung}${abschnitte}</section>`;
}

export function renderRechtstext(el, daten, schluessel) {
  const block = daten.appInfo?.rechtliches?.[schluessel];
  el.innerHTML = block ? infoSeiteHtml(block) : nichtGefundenHtml();
}

// ZERRA-Kollektiv: Konzerte im Raum Köln/Bonn und Kontakt. Referenzbereich —
// NICHT im Baustein-Pool, kein Fortschritt.
export function renderKollektiv(el, daten) {
  const block = daten.appInfo?.kollektiv;
  el.innerHTML = block ? infoSeiteHtml(block) : nichtGefundenHtml();
}

export function renderMitmachen(el, daten) {
  const m = daten.appInfo?.mitmachen;
  if (!m) {
    el.innerHTML = nichtGefundenHtml();
    return;
  }
  const einleitung = (m.einleitung || []).map((e) => `<p class="leise">${esc(text(e) ?? '')}</p>`).join('');
  const karten = (m.moeglichkeiten || [])
    .map(
      (moe) => `
      <section class="karte">
        <h3>${esc(text(moe.titel) ?? '')}</h3>
        <p>${esc(text(moe.text) ?? '')}</p>
        <p class="info-cta">${externerLink(moe.cta_ziel, text(moe.cta_label) ?? '', 'knopf knopf-primaer')}</p>
      </section>`,
    )
    .join('');
  // Feedback direkt auf der Seite (Kommentator, js/feedback.js). Der Knopf startet
  // den Modus ohne Reload; ist er schon aktiv (Knopf zuvor oder ?feedback-Link),
  // steht stattdessen der Hinweis.
  const fb = m.feedback;
  const feedbackKarte = fb
    ? `
      <section class="karte karte-akzent">
        <h3>${esc(text(fb.titel) ?? '')}</h3>
        <p>${esc(text(fb.text) ?? '')}</p>
        <div id="feedback-bereich" class="info-cta">
          ${
            feedbackAktiv()
              ? `<p class="bestaetigung">${esc(text(fb.aktiv) ?? '')}</p>`
              : `<button class="knopf knopf-primaer" id="feedback-start"><i class="fa-solid fa-comment-dots" aria-hidden="true"></i> ${esc(text(fb.knopf) ?? '')}</button>`
          }
        </div>
      </section>`
    : '';

  el.innerHTML = `
    ${landingHeroHtml('fa-comments', text(m.titel) ?? t('nav_mitmachen'), '', 'pf-blau')}
    ${einleitung}
    ${karten}
    ${feedbackKarte}`;

  el.querySelector('#feedback-start')?.addEventListener('click', async (ereignis) => {
    const knopf = ereignis.currentTarget;
    knopf.disabled = true;
    await aktiviereFeedback();
    if (!feedbackAktiv()) {
      knopf.disabled = false;
      return;
    }
    const bereich = el.querySelector('#feedback-bereich');
    if (bereich) bereich.innerHTML = `<p class="bestaetigung">${esc(text(fb.aktiv) ?? '')}</p>`;
  });
}
