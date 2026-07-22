// Profil: revidierbarer diagnostischer Zustand (Spez. 7 — die Pfade lesen ihn
// bei jeder Traversierung neu), Fortschritts-Projektionen, Kontinuität und
// Einstellungen (Sprache, Transfer-Schalter, Zurücksetzen).

import { markiereAbsolviert } from '../aktionen.js';
import { deltaFuer, niedrigsteStufe } from '../daten.js';
import { bausteinAbsolviert, globaleProjektion, projektion } from '../fortschritt.js';
import { label, setzeSprache, sprache, t } from '../i18n.js';
import { balkenHtml, bausteinIcon, esc, heroKlein, neuRendern, ringHtml, wendeThemaAn, zeigeMeilenstein } from '../oberflaeche.js';
import { instrumentRinge, wasAlsNaechstes } from '../mastery.js';
import { kompetenzpfad } from '../pfade.js';
import { diagnose, einstellungen, kontinuitaet, setzeDiagnose, setzeEinstellung, setzeZurueck } from '../zustand.js';
import { gewaehlteZiele, zielLabels, zielwahlHtml } from './zielwahl.js';

const SPRACHNAMEN = { de: 'Deutsch', en: 'English', fr: 'Français', pl: 'Polski' };

let offen = null; // gerade geöffneter Inline-Editor: 'stufe' | 'trainer' | 'herkunft' | 'ziel'

function zielLabel(ziel) {
  const beschriftungen = zielLabels(ziel);
  return beschriftungen.length > 0 ? beschriftungen.join(' · ') : t('ziel_keins');
}

function zeile(schluessel, begriff, wert) {
  const aktiv = offen === schluessel;
  return `
    <div class="profil-zeile">
      <div><p class="leise">${esc(begriff)}</p><p>${esc(wert)}</p></div>
      <button class="knopf knopf-leise" data-bearbeite="${schluessel}">${esc(aktiv ? t('schliessen') : t('aendern'))}</button>
    </div>`;
}

function editorHtml(daten, d) {
  if (offen === 'stufe') {
    const optionen = ['einsteiger', 'fortgeschritten', 'experte']
      .map(
        (stufe) => `
        <label class="option-karte">
          <input type="radio" name="pf-stufe" value="${stufe}" ${d.stufe === stufe ? 'checked' : ''}>
          <span class="option-inhalt"><strong>${esc(label('kompetenzstufe', stufe))}</strong><span class="leise">${esc(t(`anker_${stufe}`))}</span></span>
        </label>`
      )
      .join('');
    return `<div class="profil-editor">${optionen}<div class="knopf-zeile"><button class="knopf knopf-primaer" data-uebernehmen="stufe">${esc(t('uebernehmen'))}</button></div></div>`;
  }
  if (offen === 'trainer') {
    return `
      <div class="profil-editor">
        <label class="option-karte">
          <input type="radio" name="pf-trainer" value="ja" ${d.trainer ? 'checked' : ''}>
          <span class="option-inhalt"><strong>${esc(t('trainer_ja'))}</strong><span class="leise">${esc(t('anker_trainer'))}</span></span>
        </label>
        <label class="option-karte">
          <input type="radio" name="pf-trainer" value="nein" ${d.trainer ? '' : 'checked'}>
          <span class="option-inhalt"><strong>${esc(t('trainer_nein'))}</strong></span>
        </label>
        <div class="knopf-zeile"><button class="knopf knopf-primaer" data-uebernehmen="trainer">${esc(t('uebernehmen'))}</button></div>
      </div>`;
  }
  if (offen === 'herkunft') {
    const optionen = daten.herkuenfte
      .map(
        (kuerzel) => `
        <label class="option-karte">
          <input type="radio" name="pf-herkunft" value="${esc(kuerzel)}" ${d.herkunft === kuerzel ? 'checked' : ''}>
          <span class="option-inhalt"><strong>${esc(label('transfer_herkunft', kuerzel))}</strong></span>
        </label>`
      )
      .join('');
    return `
      <div class="profil-editor">
        <p class="leise">${esc(t('herkunft_hinweis'))}</p>
        ${optionen}
        <label class="option-karte">
          <input type="radio" name="pf-herkunft" value="" ${d.herkunft === null ? 'checked' : ''}>
          <span class="option-inhalt"><strong>${esc(t('herkunft_keine'))}</strong></span>
        </label>
        <div class="knopf-zeile"><button class="knopf knopf-primaer" data-uebernehmen="herkunft">${esc(t('uebernehmen'))}</button></div>
      </div>`;
  }
  if (offen === 'ziel') {
    return `
      <div class="profil-editor">
        <form id="pf-zielform">${zielwahlHtml(daten, d.ziel, { mitVermittlungszielen: true })}</form>
        <div class="knopf-zeile">
          <button class="knopf knopf-leise" data-uebernehmen="ziel-entfernen">${esc(t('ziel_entfernen'))}</button>
          <button class="knopf knopf-primaer" data-uebernehmen="ziel">${esc(t('uebernehmen'))}</button>
        </div>
      </div>`;
  }
  return '';
}

// Vormarkieren jenseits des Onboardings (6.5): jederzeit im Profil möglich.
function vormarkierenHtml(daten, d) {
  if (!d.herkunft || !d.stufe) return '';
  const kandidaten = daten.bausteine.filter(
    (b) => niedrigsteStufe(daten, b) === d.stufe && !deltaFuer(daten, b.id, d.herkunft) && !bausteinAbsolviert(b)
  );
  const inhalt =
    kandidaten.length === 0
      ? `<p class="leise">${esc(t('vormarkieren_keine'))}</p>`
      : `<p class="leise">${esc(t('vormarkieren_text'))}</p>
         ${kandidaten
           .map(
             (b) => `
             <label class="option-karte">
               <input type="checkbox" name="pf-vormarkieren" value="${esc(b.id)}">
               <span class="option-inhalt"><strong>${esc(label('baustein', b.id))}</strong></span>
             </label>`
           )
           .join('')}
         <div class="knopf-zeile"><button class="knopf knopf-primaer" id="pf-vormarkieren-los">${esc(t('uebernehmen'))}</button></div>`;
  return `<details class="karte"><summary>${esc(t('vormarkieren_profil'))}</summary>${inhalt}</details>`;
}

export function renderProfil(el, daten) {
  const d = diagnose();
  const e = einstellungen();
  const global = globaleProjektion(daten);
  const pfad = kompetenzpfad(daten);
  const pfadProjektion = projektion(pfad.stationen.map((s) => s.baustein));
  const k = kontinuitaet();

  const jeEinheit = Object.entries(k.jeEinheit)
    .map(([id, anzahl]) => `<li>${esc(label('einheit', id))}: ${esc(t('mal_absolviert', { n: anzahl }))}</li>`)
    .join('');

  const sprachOptionen = Object.entries(SPRACHNAMEN)
    .map(([kuerzel, name]) => `<option value="${kuerzel}" ${sprache() === kuerzel ? 'selected' : ''}>${esc(name)}</option>`)
    .join('');

  const themaOptionen = ['auto', 'hell', 'dunkel']
    .map((w) => `<option value="${w}" ${(e.thema || 'auto') === w ? 'selected' : ''}>${esc(t(`thema_${w}`))}</option>`)
    .join('');

  // „Dein Können" (§5): fähigkeitsbasierte Ringe je Instrument (Anteil „sitzt")
  // plus „Was als Nächstes" — getrennt vom durchgearbeiteten „Fortschritt".
  const ringe = instrumentRinge(daten);
  const koennenRinge = ringe
    .map(
      (r) => `<div class="koennen-ring">
        ${ringHtml({ quote: r.quote, absolviert: r.sitzt, gesamt: r.gesamt }, { groesse: 72, staerke: 7, beschriftung: t('koennen_ring_aria', { instrument: label('domaene', r.domaene), a: r.sitzt, b: r.gesamt }) })}
        <span class="koennen-ring-label">${esc(label('domaene', r.domaene))}</span>
        <span class="leise koennen-ring-zahl">${r.sitzt}/${r.gesamt}</span>
      </div>`,
    )
    .join('');
  const naechste = wasAlsNaechstes(daten, 5);
  const naechsteListe = naechste
    .map(
      (b) => `<a class="karte karte-link koennen-naechst" href="#/baustein/${esc(b.id)}?kontext=kompetenz">
        <span class="koennen-naechst-icon">${bausteinIcon(b.id) || '<i class="fa-solid fa-feather" aria-hidden="true"></i>'}</span>
        <span>${esc(label('baustein', b.id))}</span>
        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
      </a>`,
    )
    .join('');
  const koennenSektion = `
    <section class="karte profil-koennen">
      <h2>${esc(t('koennen_titel'))}</h2>
      <p class="leise">${esc(t('koennen_intro'))}</p>
      ${koennenRinge ? `<div class="koennen-ringe">${koennenRinge}</div>` : ''}
      ${naechste.length ? `<h3>${esc(t('was_als_naechstes'))}</h3><div class="koennen-naechste">${naechsteListe}</div>` : ''}
    </section>`;

  el.innerHTML = `
    ${heroKlein('fa-user', t('nav_profil'), t('profil_intro'), 'pf-blau')}

    <section class="karte">
      <h2>${esc(t('profil_diagnose'))}</h2>
      <p class="leise">${esc(t('profil_diagnose_text'))}</p>
      ${zeile('stufe', t('profil_stufe'), d.stufe ? label('kompetenzstufe', d.stufe) : t('keine_angabe'))}
      ${offen === 'stufe' ? editorHtml(daten, d) : ''}
      ${zeile('trainer', t('profil_trainer'), d.trainer ? t('profil_trainer_an') : t('profil_trainer_aus'))}
      ${offen === 'trainer' ? editorHtml(daten, d) : ''}
      ${zeile('herkunft', t('profil_herkunft'), d.herkunft ? label('transfer_herkunft', d.herkunft) : t('herkunft_keine'))}
      ${offen === 'herkunft' ? editorHtml(daten, d) : ''}
      ${zeile('ziel', t('profil_ziel'), zielLabel(d.ziel))}
      ${offen === 'ziel' ? editorHtml(daten, d) : ''}
    </section>

    ${vormarkierenHtml(daten, d)}

    ${koennenSektion}

    <section class="karte">
      <h2>${esc(t('fortschritt'))}</h2>
      <h3>${esc(t('fortschritt_global'))}</h3>
      <div class="ring-zeile">
        ${ringHtml(global)}
        <div>
          <p>${esc(t('bausteine_erledigt', { a: global.absolviert, b: global.gesamt }))}</p>
          <p class="leise">${esc(t('teile_stand', { a: global.erklaertErledigt, b: global.gesamt, c: global.aufgabeErledigt, d: global.aufgabeGesamt }))}</p>
        </div>
      </div>
      ${d.stufe ? `
        <a class="karte-link profil-kompetenz-link" href="#/pfad/kompetenz">
          <h3>${esc(t('pfad_kompetenz'))} <span class="chip chip-stufe chip-stufe-${esc(d.stufe)}">${esc(label('kompetenzstufe', d.stufe))}</span> <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></h3>
          ${balkenHtml(pfadProjektion)}
        </a>` : ''}
      <h3>${esc(t('kontinuitaet'))}</h3>
      <p>${esc(t('kontinuitaet_stand', { n: k.gesamt }))}</p>
      ${jeEinheit ? `<ul class="leise einheiten-zaehler">${jeEinheit}</ul>` : ''}
      <p class="leise">${esc(t('kontinuitaet_text'))}</p>
    </section>

    <section class="karte">
      <h2>${esc(t('einstellungen'))}</h2>
      <div class="profil-zeile">
        <label for="pf-sprache">${esc(t('sprache'))}</label>
        <select id="pf-sprache">${sprachOptionen}</select>
      </div>
      ${sprache() !== 'de' ? `<p class="leise">${esc(t('uebersetzung_fehlt'))}</p>` : ''}
      <div class="profil-zeile">
        <label for="pf-thema">${esc(t('thema'))}</label>
        <select id="pf-thema">${themaOptionen}</select>
      </div>
      <div class="profil-zeile">
        <label for="pf-transfer">${esc(t('transfer_schalter'))}<span class="leise" style="display:block">${esc(t('transfer_schalter_text'))}</span></label>
        <input type="checkbox" id="pf-transfer" ${e.transferKuerzelSichtbar ? 'checked' : ''}>
      </div>
      <div class="knopf-zeile">
        <button class="knopf knopf-gefahr" id="pf-reset">${esc(t('daten_reset'))}</button>
      </div>
    </section>

    <section class="karte">
      <h2>${esc(t('ueber'))}</h2>
      <p class="leise">${esc(t('ueber_text'))}</p>
      <div class="knopf-zeile" style="justify-content:flex-start">
        <a class="knopf knopf-sekundaer" href="#/ueber">${esc(t('nav_ueber'))}</a>
        <a class="knopf knopf-leise" href="#/mitmachen">${esc(t('nav_mitmachen'))}</a>
      </div>
    </section>`;

  for (const knopf of el.querySelectorAll('[data-bearbeite]')) {
    knopf.addEventListener('click', () => {
      offen = offen === knopf.dataset.bearbeite ? null : knopf.dataset.bearbeite;
      renderProfil(el, daten);
    });
  }

  for (const knopf of el.querySelectorAll('[data-uebernehmen]')) {
    knopf.addEventListener('click', () => {
      const art = knopf.dataset.uebernehmen;
      if (art === 'stufe') {
        const wert = el.querySelector('input[name="pf-stufe"]:checked')?.value;
        if (wert) setzeDiagnose({ stufe: wert });
      } else if (art === 'trainer') {
        setzeDiagnose({ trainer: el.querySelector('input[name="pf-trainer"]:checked')?.value === 'ja' });
      } else if (art === 'herkunft') {
        const wert = el.querySelector('input[name="pf-herkunft"]:checked')?.value;
        setzeDiagnose({ herkunft: wert ? wert : null });
      } else if (art === 'ziel') {
        setzeDiagnose({ ziel: gewaehlteZiele(el) });
      } else if (art === 'ziel-entfernen') {
        setzeDiagnose({ ziel: null });
      }
      offen = null;
      renderProfil(el, daten);
    });
  }

  el.querySelector('#pf-vormarkieren-los')?.addEventListener('click', () => {
    let meilenstein = null;
    for (const eingabe of el.querySelectorAll('input[name="pf-vormarkieren"]:checked')) {
      const baustein = daten.bausteinVonId.get(eingabe.value);
      if (!baustein) continue;
      const ergebnis = markiereAbsolviert(daten, 'kompetenz', baustein);
      meilenstein = ergebnis.meilenstein ?? meilenstein;
    }
    if (meilenstein) zeigeMeilenstein(meilenstein);
    else renderProfil(el, daten);
  });

  el.querySelector('#pf-sprache').addEventListener('change', async (ereignis) => {
    const neu = ereignis.target.value;
    try {
      await setzeSprache(neu);
      setzeEinstellung('sprache', neu);
    } catch {
      ereignis.target.value = sprache();
    }
    // Sprachwechsel muss auch Navigation/Menü/Kopf neu beschriften → globales Re-Render.
    neuRendern();
  });

  el.querySelector('#pf-thema').addEventListener('change', (ereignis) => {
    const neu = ereignis.target.value;
    setzeEinstellung('thema', neu);
    wendeThemaAn(neu);
  });

  el.querySelector('#pf-transfer').addEventListener('change', (ereignis) => {
    setzeEinstellung('transferKuerzelSichtbar', ereignis.target.checked);
  });

  el.querySelector('#pf-reset').addEventListener('click', async () => {
    if (!window.confirm(t('reset_bestaetigen'))) return;
    setzeZurueck();
    await setzeSprache('de');
    offen = null;
    location.hash = '#/onboarding';
    neuRendern();
  });
}
