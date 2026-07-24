// Info-Reiter „Über" und „Mitmachen": statischer Referenzinhalt aus app-info.json
// (eigene Entität, NICHT im Baustein-Pool — kein Fortschritt, keine Gamification).
// Platzhalter in [eckigen Klammern] bleiben bewusst sichtbar, bis der Betreiber
// sie füllt (Name, Lizenz, GitHub-URL) — sie werden nie erfunden oder verlinkt.

import { aktiviereFeedback, feedbackAktiv } from '../feedback.js';
import { t, text } from '../i18n.js';
import { esc, externesZiel } from '../oberflaeche.js';
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

function abschnittHtml(block) {
  if (!block) return '';
  const eintraege = (block.eintraege || []).map((e) => `<p class="leise">${esc(text(e) ?? '')}</p>`).join('');
  const github =
    block.github && block.github.ziel && !istPlatzhalter(block.github.ziel)
      ? `<p class="info-cta"><a class="knopf knopf-sekundaer info-github" href="${esc(block.github.ziel)}" target="_blank" rel="noopener noreferrer">${GITHUB_SVG} ${esc(text(block.github.label) ?? 'GitHub')}</a></p>`
      : '';
  return `<section class="karte"><h2>${esc(text(block.titel) ?? '')}</h2>${eintraege}${github}</section>`;
}

export function renderUeber(el, daten) {
  const u = daten.appInfo?.ueber;
  if (!u) {
    el.innerHTML = `<div class="karte"><p>${esc(t('nicht_gefunden'))}</p></div>`;
    return;
  }
  const absaetze = (u.absaetze || []).map((a) => `<p>${esc(text(a) ?? '')}</p>`).join('');
  const links = (u.links || []).map((l) => `<p class="info-cta">${externerLink(l.ziel, text(l.label) ?? '', 'knopf knopf-sekundaer')}</p>`).join('');
  el.innerHTML = `
    ${landingHeroHtml('fa-compass', text(u.titel) ?? t('nav_ueber'), '', 'pf-blau')}
    ${absaetze ? `<section class="karte">${absaetze}</section>` : ''}
    ${abschnittHtml(u.danksagungen)}
    ${abschnittHtml(u.credits_lizenz)}
    ${links ? `<section class="karte">${links}</section>` : ''}
    <section class="karte">
      <h2>${esc(t('nav_mitmachen'))}</h2>
      <p class="leise">${esc(t('profil_mitmachen_text'))}</p>
      <p class="info-cta"><a class="knopf knopf-sekundaer" href="#/mitmachen"><i class="fa-solid fa-comments" aria-hidden="true"></i> ${esc(t('nav_mitmachen'))}</a></p>
    </section>`;
}

// Rechtstexte (Impressum / Datenschutz): schlichte Titel-+-Absätze-Ansicht aus
// app-info.json `rechtliches`. Platzhalter in [eckigen Klammern] bleiben sichtbar.
export function renderRechtstext(el, daten, schluessel) {
  const block = daten.appInfo?.rechtliches?.[schluessel];
  if (!block) {
    el.innerHTML = `<div class="karte"><p>${esc(t('nicht_gefunden'))}</p></div>`;
    return;
  }
  const absaetze = (block.absaetze || []).map((a) => `<p>${esc(text(a) ?? '')}</p>`).join('');
  el.innerHTML = `
    <h1>${esc(text(block.titel) ?? '')}</h1>
    <section class="karte">${absaetze}</section>`;
}

export function renderMitmachen(el, daten) {
  const m = daten.appInfo?.mitmachen;
  if (!m) {
    el.innerHTML = `<div class="karte"><p>${esc(t('nicht_gefunden'))}</p></div>`;
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
