// Trainingsplan: ein regelbasiert erzeugter Wochenplan aus den (stufen-gefilterten)
// Trainingseinheiten, den man danach anpassen (Einheit tauschen / Session entfernen /
// neu erzeugen) und herunterladen kann — als Druckansicht (PDF) und als Kalender (.ics).
// Der Plan lebt im Zustand (persistent); Fortschritt bleibt baustein-gebunden.

import { label, sprache, t, text } from '../i18n.js';
import { bausteinIcon, esc, heroKlein, neuRendern } from '../oberflaeche.js';
import { erzeugePlan, tauscheEinheit, entferneSession, planNachWochen, planbareEinheiten, planAlsIcal } from '../plan.js';
import { plan as gespeicherterPlan, setzePlan, loeschePlan } from '../zustand.js';

function naechsterMontagISO() {
  const d = new Date();
  d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  return d.toISOString().slice(0, 10);
}

// Wochentag + Datum in der aktiven Sprache (Intl); UTC, damit das ISO-Datum nicht kippt.
function formatDatum(iso) {
  const [j, m, t2] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(j, m - 1, t2));
  return new Intl.DateTimeFormat(sprache(), {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(d);
}

function ladeHerunter(name, inhalt, mime) {
  const blob = new Blob([inhalt], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function konfigHtml(vorgabe) {
  return `
    <form class="karte plan-konfig" id="plan-form">
      <h2>${esc(t('plan_erstellen'))}</h2>
      <p class="leise">${esc(t('plan_intro'))}</p>
      <div class="plan-felder">
        <label class="plan-feld"><span>${esc(t('plan_wochen'))}</span>
          <input type="number" id="plan-wochen" min="1" max="12" value="${vorgabe.wochen}"></label>
        <label class="plan-feld"><span>${esc(t('plan_pro_woche'))}</span>
          <input type="number" id="plan-pro-woche" min="1" max="4" value="${vorgabe.einheitenProWoche}"></label>
        <label class="plan-feld"><span>${esc(t('plan_start'))}</span>
          <input type="date" id="plan-start" value="${vorgabe.startISO}"></label>
      </div>
      <div class="knopf-zeile" style="justify-content:flex-start">
        <button type="submit" class="knopf knopf-primaer"><i class="fa-solid fa-list-check" aria-hidden="true"></i> ${esc(t('plan_generieren'))}</button>
      </div>
    </form>`;
}

function sessionHtml(daten, session, index) {
  const e = daten.einheitVonId.get(session.einheit);
  const titel = label('einheit', session.einheit);
  const schwerpunkt = e ? (text(e.schwerpunkt) ?? '') : '';
  return `
    <div class="plan-session">
      <div class="plan-session-datum">${esc(formatDatum(session.datum))}</div>
      <div class="plan-session-inhalt">
        <h4>${bausteinIcon(e ? e.phasen?.hauptteil?.[0]?.baustein : '', 'plan-icon')} ${esc(titel)}</h4>
        ${schwerpunkt ? `<p class="leise">${esc(schwerpunkt)}</p>` : ''}
        <a class="leise plan-session-link" href="#/training/${esc(session.einheit)}">${esc(t('einheit_starten'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
      </div>
      <div class="plan-session-knoepfe">
        <button class="knopf knopf-leise plan-tausch" data-index="${index}" aria-label="${esc(t('plan_tauschen'))}" title="${esc(t('plan_tauschen'))}"><i class="fa-solid fa-rotate" aria-hidden="true"></i></button>
        <button class="knopf knopf-leise plan-entfernen" data-index="${index}" aria-label="${esc(t('plan_entfernen'))}" title="${esc(t('plan_entfernen'))}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
    </div>`;
}

function planHtml(daten, p) {
  const wochen = planNachWochen(p)
    .map(
      (g) => `
      <section class="plan-woche">
        <h3>${esc(t('plan_woche', { n: g.woche }))}</h3>
        ${g.sessions.map((s) => sessionHtml(daten, s, p.sessions.indexOf(s))).join('')}
      </section>`,
    )
    .join('');
  return `
    <div class="karte plan-uebersicht">
      <div class="plan-kopf">
        <p class="leise">${esc(t('plan_umfang', { wochen: p.wochen, n: p.sessions.length }))}</p>
        <div class="plan-aktionen knopf-zeile">
          <button class="knopf knopf-sekundaer" id="plan-pdf"><i class="fa-solid fa-print" aria-hidden="true"></i> ${esc(t('plan_pdf'))}</button>
          <button class="knopf knopf-sekundaer" id="plan-ics"><i class="fa-solid fa-calendar-plus" aria-hidden="true"></i> ${esc(t('plan_ical'))}</button>
          <button class="knopf knopf-leise" id="plan-neu">${esc(t('plan_neu'))}</button>
        </div>
      </div>
      ${p.sessions.length ? wochen : `<p class="leise">${esc(t('plan_leer'))}</p>`}
    </div>`;
}

export function renderPlan(el, daten) {
  const p = gespeicherterPlan();
  const vorgabe = p
    ? { wochen: p.wochen, einheitenProWoche: p.einheitenProWoche, startISO: p.startISO }
    : { wochen: 4, einheitenProWoche: 2, startISO: naechsterMontagISO() };
  const wenige = planbareEinheiten(daten).length === 0;

  el.innerHTML = `
    ${heroKlein('fa-calendar-days', t('plan_titel'), t('plan_kachel_text'), 'pf-indigo')}
    ${wenige ? `<div class="karte"><p class="leise">${esc(t('plan_keine_einheiten'))}</p></div>` : ''}
    ${konfigHtml(vorgabe)}
    ${p ? planHtml(daten, p) : ''}`;

  const form = el.querySelector('#plan-form');
  form?.addEventListener('submit', (ereignis) => {
    ereignis.preventDefault();
    const konfig = {
      wochen: Number(el.querySelector('#plan-wochen').value),
      einheitenProWoche: Number(el.querySelector('#plan-pro-woche').value),
      startISO: el.querySelector('#plan-start').value || naechsterMontagISO(),
    };
    setzePlan(erzeugePlan(daten, konfig));
    neuRendern();
  });

  el.querySelector('#plan-neu')?.addEventListener('click', () => {
    loeschePlan();
    neuRendern();
  });
  for (const knopf of el.querySelectorAll('.plan-tausch')) {
    knopf.addEventListener('click', () => {
      setzePlan(tauscheEinheit(daten, gespeicherterPlan(), Number(knopf.dataset.index)));
      neuRendern();
    });
  }
  for (const knopf of el.querySelectorAll('.plan-entfernen')) {
    knopf.addEventListener('click', () => {
      setzePlan(entferneSession(gespeicherterPlan(), Number(knopf.dataset.index)));
      neuRendern();
    });
  }
  el.querySelector('#plan-pdf')?.addEventListener('click', () => window.print());
  el.querySelector('#plan-ics')?.addEventListener('click', () => {
    const beschriftung = (id) => {
      const e = daten.einheitVonId.get(id);
      return { titel: label('einheit', id), schwerpunkt: e ? (text(e.schwerpunkt) ?? '') : '' };
    };
    const stempel = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const ics = planAlsIcal(gespeicherterPlan(), beschriftung, stempel);
    ladeHerunter('moshschool-trainingsplan.ics', ics, 'text/calendar;charset=utf-8');
  });
}
