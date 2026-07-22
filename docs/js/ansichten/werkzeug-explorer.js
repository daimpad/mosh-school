// Werkzeug: Gear-Explorer. Die KARTE über die Gear-Inhalte — man tippt die
// Bauteile eines Instruments an und bekommt eine Kurzfassung, die zum vollen
// Baustein (und, wo vorhanden, zum Baukasten) führt. Kein neuer Erklärtext: der
// Kurztext (Gist) wird aus dem Baustein-Erklärteil abgeleitet — EIN Quelltext,
// keine Dublette. Self-contained, kein Audio.
//
// Die vier Schemata sind monochrome Linien-SVGs (currentColor) mit unsichtbaren
// Trefferregionen (<g class="hotspot" data-region data-baustein role="button"
// tabindex="0">); die View verdrahtet Fokus, Klick und Enter/Space auf ein Panel.

import { label, t, text } from '../i18n.js';
import { bausteinIcon, esc } from '../oberflaeche.js';

// Vier Ansichten mit ihren Schema-SVGs (eingebettet, monochrom, Hotspots).
const SCHEMATA = {
  gitarre_bass: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polygon points="10.0,38.0 42.0,32.0 44.0,58.0 12.0,62.0" fill="none" stroke-width="3"/><circle cx="18.0" cy="41.0" r="2.0" fill="currentColor" stroke="none"/><circle cx="26.0" cy="39.0" r="2.0" fill="currentColor" stroke="none"/><circle cx="34.0" cy="37.0" r="2.0" fill="currentColor" stroke="none"/><circle cx="18.0" cy="59.0" r="2.0" fill="currentColor" stroke="none"/><circle cx="26.0" cy="57.0" r="2.0" fill="currentColor" stroke="none"/><circle cx="34.0" cy="55.0" r="2.0" fill="currentColor" stroke="none"/><line x1="48.0" y1="34.0" x2="48.0" y2="74.0" stroke-width="4"/><rect x="48.0" y="40.0" width="102.0" height="34.0" rx="2" fill="none" stroke-width="2.5"/><line x1="70.0" y1="40.0" x2="70.0" y2="74.0" stroke-width="1.5"/><line x1="90.0" y1="40.0" x2="90.0" y2="74.0" stroke-width="1.5"/><line x1="110.0" y1="40.0" x2="110.0" y2="74.0" stroke-width="1.5"/><line x1="130.0" y1="40.0" x2="130.0" y2="74.0" stroke-width="1.5"/><path d="M155,57 C155,27 188,20 212,22 C252,25 306,30 306,57 C306,84 252,92 212,92 C188,94 155,87 155,57 Z" stroke-width="3"/><line x1="48.0" y1="44.0" x2="290.0" y2="44.0" stroke-width="1"/><line x1="48.0" y1="48.0" x2="290.0" y2="48.0" stroke-width="1"/><line x1="48.0" y1="52.0" x2="290.0" y2="52.0" stroke-width="1"/><line x1="48.0" y1="56.0" x2="290.0" y2="56.0" stroke-width="1"/><line x1="48.0" y1="60.0" x2="290.0" y2="60.0" stroke-width="1"/><line x1="48.0" y1="64.0" x2="290.0" y2="64.0" stroke-width="1"/><rect x="212.0" y="42.0" width="12.0" height="30.0" rx="2" fill="none" stroke-width="2.5"/><rect x="242.0" y="42.0" width="12.0" height="30.0" rx="2" fill="none" stroke-width="2.5"/><rect x="284.0" y="44.0" width="10.0" height="26.0" rx="2" fill="currentColor" stroke="none"/><polygon points="226.0,80.0 240.0,80.0 233.0,92.0" fill="currentColor" stroke="none"/><g class="hotspot" data-region="sattel" data-baustein="sattel_typen" role="button" tabindex="0"><title>Kopfplatte &amp; Sattel</title><rect x="4" y="26" width="54" height="66" rx="3" fill="transparent"/></g><g class="hotspot" data-region="hals" data-baustein="saitenlage_setup" role="button" tabindex="0"><title>Hals, Bünde &amp; Saitenlage</title><rect x="56" y="38" width="92" height="40" rx="3" fill="transparent"/></g><g class="hotspot" data-region="saiten" data-baustein="saiten_mensur" role="button" tabindex="0"><title>Saiten &amp; Mensur</title><rect x="152" y="40" width="58" height="30" rx="3" fill="transparent"/></g><g class="hotspot" data-region="tonabnehmer" data-baustein="tonabnehmer_typen" role="button" tabindex="0"><title>Tonabnehmer</title><rect x="206" y="40" width="54" height="36" rx="3" fill="transparent"/></g><g class="hotspot" data-region="steg" data-baustein="steg_typen" role="button" tabindex="0"><title>Steg / Brücke</title><rect x="276" y="40" width="38" height="36" rx="3" fill="transparent"/></g><g class="hotspot" data-region="plektrum" data-baustein="plektren_saitenpflege" role="button" tabindex="0"><title>Anschlag &amp; Plektrum</title><rect x="208" y="80" width="70" height="34" rx="3" fill="transparent"/></g></svg>`,
  signalweg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="24.0" cy="54.0" r="11.0" stroke-width="2.5"/><line x1="31.0" y1="47.0" x2="52.0" y2="33.0" stroke-width="2.5"/><circle cx="52.0" cy="33.0" r="2.0" fill="currentColor" stroke="none"/><line x1="35.0" y1="54.0" x2="60.0" y2="54.0" stroke-width="2"/><rect x="62.0" y="36.0" width="66.0" height="40.0" rx="2" fill="none" stroke-width="2.5"/><rect x="70.0" y="44.0" width="14.0" height="20.0" rx="2" fill="currentColor" stroke="none"/><rect x="88.0" y="44.0" width="14.0" height="20.0" rx="2" fill="currentColor" stroke="none"/><rect x="106.0" y="44.0" width="14.0" height="20.0" rx="2" fill="currentColor" stroke="none"/><circle cx="77.0" cy="42.0" r="1.5" fill="currentColor" stroke="none"/><circle cx="95.0" cy="42.0" r="1.5" fill="currentColor" stroke="none"/><circle cx="113.0" cy="42.0" r="1.5" fill="currentColor" stroke="none"/><line x1="128.0" y1="54.0" x2="154.0" y2="54.0" stroke-width="2"/><rect x="156.0" y="26.0" width="58.0" height="52.0" rx="2" fill="none" stroke-width="2.5"/><circle cx="166.0" cy="36.0" r="2.0" stroke-width="2"/><circle cx="176.0" cy="36.0" r="2.0" stroke-width="2"/><circle cx="186.0" cy="36.0" r="2.0" stroke-width="2"/><circle cx="196.0" cy="36.0" r="2.0" stroke-width="2"/><circle cx="206.0" cy="36.0" r="2.0" stroke-width="2"/><line x1="164.0" y1="50.0" x2="206.0" y2="50.0" stroke-width="1.2"/><line x1="164.0" y1="56.0" x2="206.0" y2="56.0" stroke-width="1.2"/><line x1="164.0" y1="62.0" x2="206.0" y2="62.0" stroke-width="1.2"/><line x1="164.0" y1="68.0" x2="206.0" y2="68.0" stroke-width="1.2"/><line x1="214.0" y1="54.0" x2="240.0" y2="54.0" stroke-width="2"/><rect x="242.0" y="20.0" width="64.0" height="64.0" rx="2" fill="none" stroke-width="2.5"/><circle cx="258.0" cy="40.0" r="9.0" stroke-width="2.5"/><circle cx="290.0" cy="40.0" r="9.0" stroke-width="2.5"/><circle cx="258.0" cy="66.0" r="9.0" stroke-width="2.5"/><circle cx="290.0" cy="66.0" r="9.0" stroke-width="2.5"/><g class="hotspot" data-region="pedalboard" data-baustein="pedalboard_grundlagen" role="button" tabindex="0"><title>Pedalboard</title><rect x="60" y="32" width="70" height="48" rx="3" fill="transparent"/></g><g class="hotspot" data-region="amp" data-baustein="amp_grundlagen" role="button" tabindex="0"><title>Verstärker</title><rect x="152" y="22" width="66" height="60" rx="3" fill="transparent"/></g><g class="hotspot" data-region="box" data-baustein="box_grundlagen" role="button" tabindex="0"><title>Box</title><rect x="238" y="16" width="72" height="72" rx="3" fill="transparent"/></g></svg>`,
  schlagzeug: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 180" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="130.0" cy="118.0" r="44.0" stroke-width="3"/><circle cx="130.0" cy="118.0" r="11.0" stroke-width="2"/><circle cx="104.0" cy="72.0" r="22.0" stroke-width="2.5"/><circle cx="156.0" cy="72.0" r="22.0" stroke-width="2.5"/><circle cx="78.0" cy="120.0" r="19.0" stroke-width="2.5"/><line x1="78.0" y1="139.0" x2="70.0" y2="168.0" stroke-width="2"/><line x1="78.0" y1="139.0" x2="86.0" y2="168.0" stroke-width="2"/><line x1="28.0" y1="92.0" x2="54.0" y2="92.0" stroke-width="3"/><line x1="30.0" y1="99.0" x2="52.0" y2="99.0" stroke-width="2"/><line x1="41.0" y1="99.0" x2="41.0" y2="168.0" stroke-width="2"/><line x1="44.0" y1="46.0" x2="82.0" y2="34.0" stroke-width="3"/><line x1="63.0" y1="40.0" x2="63.0" y2="168.0" stroke-width="1.8"/><line x1="196.0" y1="40.0" x2="230.0" y2="52.0" stroke-width="3"/><line x1="230.0" y1="52.0" x2="236.0" y2="58.0" stroke-width="2"/><line x1="213.0" y1="46.0" x2="213.0" y2="168.0" stroke-width="1.8"/><rect x="120.0" y="160.0" width="20.0" height="9.0" rx="2" fill="currentColor" stroke="none"/><line x1="130.0" y1="160.0" x2="130.0" y2="150.0" stroke-width="2.5"/><rect x="160.0" y="104.0" width="14.0" height="10.0" rx="2" fill="none" stroke-width="2.5"/><line x1="167.0" y1="104.0" x2="167.0" y2="98.0" stroke-width="1.5"/><g class="hotspot" data-region="kit" data-baustein="schlagzeug_komponenten" role="button" tabindex="0"><title>Kit &amp; Komponenten</title><rect x="92" y="96" width="68" height="54" rx="3" fill="transparent"/></g><g class="hotspot" data-region="felle" data-baustein="felle_stimmung" role="button" tabindex="0"><title>Felle &amp; Stimmung</title><rect x="84" y="52" width="40" height="40" rx="3" fill="transparent"/></g><g class="hotspot" data-region="becken" data-baustein="becken_typen" role="button" tabindex="0"><title>Becken</title><rect x="40" y="24" width="48" height="28" rx="3" fill="transparent"/></g><g class="hotspot" data-region="fussmaschine" data-baustein="fussmaschine_double" role="button" tabindex="0"><title>Fußmaschine</title><rect x="112" y="150" width="40" height="22" rx="3" fill="transparent"/></g><g class="hotspot" data-region="trigger" data-baustein="trigger_edrums" role="button" tabindex="0"><title>Trigger &amp; E-Drums</title><rect x="162" y="98" width="26" height="20" rx="3" fill="transparent"/></g></svg>`,
  gesang: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="60.0" cy="42.0" r="13.0" stroke-width="3"/><line x1="50.0" y1="38.0" x2="70.0" y2="38.0" stroke-width="1.2"/><line x1="50.0" y1="42.0" x2="70.0" y2="42.0" stroke-width="1.2"/><line x1="50.0" y1="46.0" x2="70.0" y2="46.0" stroke-width="1.2"/><polygon points="50.0,54.0 70.0,54.0 67.0,100.0 53.0,100.0" fill="none" stroke-width="2.5"/><path d="M52.5,21.3 A22.0,22.0 0 0 0 52.5,62.7" stroke-width="2"/><path d="M46.5,13.0 A32.0,32.0 0 0 0 46.5,71.0" stroke-width="1.8"/><path d="M60.0,104.0 L63.0,101.6 L66.0,100.2 L69.0,100.2 L72.0,101.6 L75.0,104.0 L78.0,106.4 L81.0,107.8 L84.0,107.8 L87.0,106.4 L90.0,104.0 L93.0,101.6 L96.0,100.2 L99.0,100.2 L102.0,101.6 L105.0,104.0 L108.0,106.4 L111.0,107.8 L114.0,107.8 L117.0,106.4 L120.0,104.0 L123.0,101.6 L126.0,100.2 L129.0,100.2 L132.0,101.6 L135.0,104.0 L138.0,106.4 L141.0,107.8 L144.0,107.8 L147.0,106.4 L150.0,104.0" stroke-width="1.8"/><polygon points="150.0,106.0 214.0,106.0 204.0,80.0 162.0,88.0" fill="none" stroke-width="2.5"/><circle cx="184.0" cy="94.0" r="9.0" stroke-width="2.5"/><g class="hotspot" data-region="mikrofon" data-baustein="mikrofon_typen" role="button" tabindex="0"><title>Mikrofon</title><rect x="40" y="22" width="44" height="84" rx="3" fill="transparent"/></g><g class="hotspot" data-region="monitor" data-baustein="proberaum_ausruestung" role="button" tabindex="0"><title>Monitor / PA</title><rect x="150" y="74" width="68" height="38" rx="3" fill="transparent"/></g></svg>`,
};
const ANSICHTEN = ['gitarre_bass', 'signalweg', 'schlagzeug', 'gesang'];

// Region-Baustein -> Baukasten (Button „Baukasten öffnen").
const BAUKASTEN = { pedalboard_grundlagen: 'pedalboard', amp_grundlagen: 'ampbox', box_grundlagen: 'ampbox' };
// Optionale Querlinks je Region (weitere Bausteine aus dem Bestand).
const QUERLINKS = { mikrofon_typen: ['mikrofontechnik', 'mikrofon_harsh'], proberaum_ausruestung: ['show_lautstaerke_gehoer'] };

let aktiveAnsicht = 'gitarre_bass';
let aktiveRegion = null;

// Gist: erster Absatz des Baustein-Erklärteils (ein Quelltext, keine Dublette).
function gist(daten, id) {
  const b = daten.bausteinVonId.get(id);
  if (!b) return '';
  const voll = text(b.erklaerteil) || '';
  return voll.split('\n\n')[0];
}

function panelHtml(daten, id) {
  if (!id || !daten.bausteinVonId.has(id)) {
    return `<p class="leise wz-exp-panel-leer">${esc(t('wz_exp_waehle'))}</p>`;
  }
  const baukasten = BAUKASTEN[id];
  const ql = (QUERLINKS[id] || []).filter((q) => daten.bausteinVonId.has(q));
  return `<div class="wz-exp-panel karte" role="region" aria-live="polite">
    <h3>${bausteinIcon(id) || ''} ${esc(label('baustein', id))}</h3>
    <p>${esc(gist(daten, id))}</p>
    <p class="chip-zeile">
      <a class="chip chip-waehlbar" href="#/baustein/${esc(id)}"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i> ${esc(t('wz_exp_mehr'))}</a>
      ${baukasten ? `<a class="chip chip-waehlbar" href="#/werkzeug/${esc(baukasten)}"><i class="fa-solid fa-layer-group" aria-hidden="true"></i> ${esc(t('wz_exp_baukasten'))}</a>` : ''}
    </p>
    ${ql.length ? `<p class="leise">${esc(t('wz_exp_querlinks'))}: ${ql.map((q) => `<a href="#/baustein/${esc(q)}">${esc(label('baustein', q))}</a>`).join(', ')}</p>` : ''}
  </div>`;
}

function wendePresetAn(query) {
  if (!query) return;
  const a = query.get('ansicht');
  if (a && ANSICHTEN.includes(a)) aktiveAnsicht = a;
  const r = query.get('region');
  if (r) aktiveRegion = r;
}

export function renderWerkzeugExplorer(el, daten, query) {
  wendePresetAn(query);

  const ansichtKnoepfe = ANSICHTEN.map(
    (a) => `<button type="button" class="chip chip-waehlbar wz-exp-ansicht ${a === aktiveAnsicht ? 'chip-akzent' : ''}" data-ansicht="${a}" aria-pressed="${a === aktiveAnsicht}">${esc(t('wz_exp_ansicht_' + a))}</button>`
  ).join(' ');

  el.innerHTML = `
    <article class="wz-werkzeug">
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('wz_explorer_titel'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('wz_explorer_untertitel'))}</p>
        </div>
      </section>

      <p class="chip-zeile">${ansichtKnoepfe}</p>
      <p class="leise">${esc(t('wz_exp_hint'))}</p>
      <div class="wz-exp-buehne">${SCHEMATA[aktiveAnsicht]}</div>
      <div class="wz-exp-panel-halter">${panelHtml(daten, aktiveRegion)}</div>

      <p class="leise wz-metro-fuss">${esc(t('wz_exp_fuss'))}</p>
    </article>`;

  verdrahte(el, daten);
}

function verdrahte(el, daten) {
  for (const knopf of el.querySelectorAll('.wz-exp-ansicht')) {
    knopf.addEventListener('click', () => {
      aktiveAnsicht = knopf.dataset.ansicht;
      aktiveRegion = null;
      renderWerkzeugExplorer(el, daten, null);
      el.querySelector(`[data-ansicht="${CSS.escape(aktiveAnsicht)}"]`)?.focus();
    });
  }
  const halter = el.querySelector('.wz-exp-panel-halter');
  const waehle = (id, g) => {
    aktiveRegion = id;
    if (halter) halter.innerHTML = panelHtml(daten, id);
    for (const h of el.querySelectorAll('.hotspot')) {
      const an = h === g;
      h.classList.toggle('aktiv', an);
      if (an) h.setAttribute('aria-current', 'true');
      else h.removeAttribute('aria-current');
    }
  };
  for (const g of el.querySelectorAll('.wz-exp-buehne .hotspot')) {
    const id = g.dataset.baustein;
    g.addEventListener('click', () => waehle(id, g));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        waehle(id, g);
      }
    });
    if (id === aktiveRegion) {
      g.classList.add('aktiv');
      g.setAttribute('aria-current', 'true');
    }
  }
}
