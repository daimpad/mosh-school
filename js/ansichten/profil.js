// Profil: revidierbarer diagnostischer Zustand (Spez. 7 — die Pfade lesen ihn
// bei jeder Traversierung neu), Fortschritts-Projektionen, Kontinuität und
// Einstellungen (Sprache, Transfer-Schalter, Zurücksetzen).

import { markiereAbsolviert } from '../aktionen.js';
import { deltaFuer, domaenenVon, niedrigsteStufe } from '../daten.js';
import { bausteinAbsolviert, globaleProjektion, projektion } from '../fortschritt.js';
import { label, t, text } from '../i18n.js';
import { balkenHtml, bausteinIcon, esc, meilensteinLabel, neuRendern, ringHtml, wendeThemaAn, zeigeMeilenstein } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';
import { uebungsteilHtml } from './baustein.js';
import { instrumentRinge, wasAlsNaechstes } from '../mastery.js';
import { kompetenzpfad } from '../pfade.js';
import { diagnose, einstellungen, entferneGemerkt, exportiereZustand, importiereZustand, kontinuitaet, meilensteine, merkliste, setzeDiagnose, setzeEinstellung, setzeZurueck } from '../zustand.js';
import { gewaehlteZiele, zielLabels, zielwahlHtml } from './zielwahl.js';


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

// Merkliste als PDF: buildfrei über die Druck-Ansicht des Browsers (keine
// PDF-Bibliothek). Ein neues Fenster mit sauberem, druckoptimiertem HTML wird
// geöffnet und der Druckdialog aufgerufen — dort wählt man „Als PDF speichern".
function absaetzePdf(rohtext) {
  return String(rohtext ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
}

function oeffneMerklistePdf(daten) {
  const ids = merkliste();
  const teile = ids
    .map((id) => {
      const b = daten.bausteinVonId.get(id);
      if (!b) return '';
      const kat = domaenenVon(b).map((d) => esc(label('domaene', d))).join(' · ');
      const stufen = (b.kompetenzstufe || []).map((s) => esc(label('kompetenzstufe', s))).join(' · ');
      const meta = [kat, stufen].filter(Boolean).join(' — ');
      const erklaer = absaetzePdf(text(b.erklaerteil));
      let aufgabe = '';
      if (b.uebungsteil) aufgabe = uebungsteilHtml(text(b.uebungsteil));
      else if (b.reflexionsaufgabe) aufgabe = `<h3>${esc(t('reflexionsaufgabe'))}</h3>${absaetzePdf(text(b.reflexionsaufgabe))}`;
      return `<article class="pdf-baustein">
        ${meta ? `<p class="pdf-kat">${meta}</p>` : ''}
        <h2>${esc(label('baustein', id))}</h2>
        ${erklaer}
        ${aufgabe}
      </article>`;
    })
    .join('');
  const stil = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; background: #fff; max-width: 46rem; margin: 2rem auto; padding: 0 1.2rem; line-height: 1.5; }
    h1 { font-size: 1.7rem; margin: 0 0 0.2rem; }
    .pdf-intro { color: #555; margin: 0 0 1.6rem; }
    .pdf-baustein { padding: 1rem 0 0.4rem; border-top: 2px solid #111; page-break-inside: avoid; }
    .pdf-baustein h2 { font-size: 1.25rem; margin: 0.1rem 0 0.5rem; }
    .pdf-kat { text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.72rem; color: #666; margin: 0; }
    .pdf-baustein h3, .pdf-baustein h4 { font-size: 0.95rem; margin: 0.9rem 0 0.2rem; }
    .pdf-baustein p { margin: 0.35rem 0; }
    ol { margin: 0.3rem 0 0.3rem 1.2rem; padding: 0; }
    li { margin: 0.15rem 0; }
    @media print { body { margin: 0; max-width: none; } a { color: inherit; text-decoration: none; } }
  `;
  const dok = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(t('merkliste_pdf_titel'))}</title><style>${stil}</style></head><body>
    <h1>${esc(t('merkliste_pdf_titel'))}</h1>
    <p class="pdf-intro">mosh school — ${esc(t('merkliste_titel'))}</p>
    ${teile}
    <script>window.addEventListener('load',function(){window.focus();window.print();});<\/script>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(dok);
  w.document.close();
  return true;
}

// Merkliste (§ Lesezeichen): gemerkte Bausteine, als PDF (Druck-Ansicht) sicherbar.
// Als eigene Funktion, weil sie an ZWEI Orten steht: im Profil (wo sie inhaltlich
// hingehört) und unter #/merkliste (wo der Merken-Knopf der Baustein-Seite
// hinführt). Vorher zeigte dieser Knopf auf #/profil — dort steht die Merkliste
// aber gut 1500 px weit unten, man landete oben und musste die halbe Seite
// scrollen, um zu sehen, was man gerade gemerkt hatte.
function merklisteSektionHtml(daten) {
  const merkIds = merkliste();
  const merkEintraege = merkIds
    .map((id) => {
      const b = daten.bausteinVonId.get(id);
      const titel = b ? label('baustein', id) : id;
      return `<li class="merk-eintrag">
        <a class="merk-link" href="#/baustein/${esc(id)}?kontext=kompetenz">
          <span class="merk-icon">${bausteinIcon(id) || '<i class="fa-solid fa-bookmark" aria-hidden="true"></i>'}</span>
          <span>${esc(titel)}</span>
        </a>
        <button class="knopf knopf-leise merk-entfernen" data-merk-entfernen="${esc(id)}" aria-label="${esc(t('merkliste_entfernen'))}" title="${esc(t('merkliste_entfernen'))}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </li>`;
    })
    .join('');
  return `
    <section class="karte profil-merkliste">
      <h2><i class="fa-solid fa-bookmark" aria-hidden="true"></i> ${esc(t('merkliste_titel'))}</h2>
      ${merkIds.length === 0
        ? `<p class="leise">${esc(t('merkliste_leer'))}</p>`
        : `<p class="leise">${esc(t('merkliste_text'))}</p>
           <ul class="merk-liste">${merkEintraege}</ul>
           <div class="knopf-zeile" style="justify-content:flex-start">
             <button class="knopf knopf-sekundaer" id="pf-merk-pdf"><i class="fa-solid fa-print" aria-hidden="true"></i> ${esc(t('merkliste_pdf'))}</button>
           </div>`}
    </section>`;
}

// Entfernen + PDF — dieselben Handler für beide Orte. `neuZeichnen` hängt davon
// ab, in welcher Ansicht wir stehen; sonst würde ein Klick auf #/merkliste die
// Profil-Ansicht in den Container schreiben.
function bindeMerkliste(el, daten, neuZeichnen) {
  for (const knopf of el.querySelectorAll('[data-merk-entfernen]')) {
    knopf.addEventListener('click', () => {
      entferneGemerkt(knopf.dataset.merkEntfernen);
      neuZeichnen();
    });
  }
  el.querySelector('#pf-merk-pdf')?.addEventListener('click', () => oeffneMerklistePdf(daten));
}

// Eigene Seite für die Merkliste — Ziel des Merken-Knopfs auf der Baustein-Seite.
export function renderMerkliste(el, daten) {
  el.innerHTML = `
    ${landingHeroHtml('fa-bookmark', t('merkliste_titel'), t('merkliste_untertitel'), 'pf-blau', 'merkliste')}
    ${merklisteSektionHtml(daten)}
    <p class="knopf-zeile" style="justify-content:flex-start">
      <a class="knopf knopf-sekundaer" href="#/profil"><i class="fa-solid fa-user" aria-hidden="true"></i> ${esc(t('nav_profil'))}</a>
    </p>`;
  bindeMerkliste(el, daten, () => renderMerkliste(el, daten));
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

  // Meilensteine (§5): erreichte, feierlich; leer bleibt einladend, nicht mahnend.
  const erreicht = meilensteine();
  const meilensteinListe = erreicht.length
    ? erreicht.map((id) => `<li class="meilenstein-eintrag"><i class="fa-solid fa-medal" aria-hidden="true"></i> ${esc(meilensteinLabel(id))}</li>`).join('')
    : `<li class="leise">${esc(t('meilensteine_leer'))}</li>`;

  const loopSektion = `
    <section class="karte profil-loop">
      <h2>${esc(t('meilensteine_titel'))}</h2>
      <ul class="meilenstein-liste">${meilensteinListe}</ul>
    </section>`;

  const merklisteSektion = merklisteSektionHtml(daten);

  el.innerHTML = `
    ${landingHeroHtml('fa-user', t('nav_profil'), t('profil_intro'), 'pf-blau')}

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

    ${loopSektion}

    ${merklisteSektion}

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
        <label for="pf-thema">${esc(t('thema'))}</label>
        <select id="pf-thema">${themaOptionen}</select>
      </div>
      <div class="profil-zeile">
        <label for="pf-transfer">${esc(t('transfer_schalter'))}<span class="leise" style="display:block">${esc(t('transfer_schalter_text'))}</span></label>
        <input type="checkbox" id="pf-transfer" ${e.transferKuerzelSichtbar ? 'checked' : ''}>
      </div>
      <div class="profil-backup">
        <p>${esc(t('backup_titel'))}</p>
        <p class="leise">${esc(t('backup_text'))}</p>
        <div class="knopf-zeile" style="justify-content:flex-start">
          <button class="knopf knopf-sekundaer" id="pf-export"><i class="fa-solid fa-download" aria-hidden="true"></i> ${esc(t('backup_export'))}</button>
          <button class="knopf knopf-sekundaer" id="pf-import-knopf"><i class="fa-solid fa-upload" aria-hidden="true"></i> ${esc(t('backup_import'))}</button>
          <input type="file" id="pf-import" accept="application/json,.json" hidden>
        </div>
        <p class="leise pf-backup-status" role="status" aria-live="polite"></p>
      </div>
      <div class="knopf-zeile">
        <button class="knopf knopf-gefahr" id="pf-reset">${esc(t('daten_reset'))}</button>
      </div>
    </section>

    <section class="karte">
      <h2>${esc(t('nav_mitmachen'))}</h2>
      <p class="leise">${esc(t('profil_mitmachen_text'))}</p>
      <div class="knopf-zeile" style="justify-content:flex-start">
        <a class="knopf knopf-sekundaer" href="#/mitmachen">${esc(t('nav_mitmachen'))}</a>
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

  bindeMerkliste(el, daten, () => renderProfil(el, daten));

  el.querySelector('#pf-thema').addEventListener('change', (ereignis) => {
    const neu = ereignis.target.value;
    setzeEinstellung('thema', neu);
    wendeThemaAn(neu);
  });

  el.querySelector('#pf-transfer').addEventListener('change', (ereignis) => {
    setzeEinstellung('transferKuerzelSichtbar', ereignis.target.checked);
  });

  // Backup herunterladen: den kompletten Zustand als JSON-Datei (portables Konto-
  // los-Backup). Datei-URL wird nach dem Klick wieder freigegeben.
  el.querySelector('#pf-export')?.addEventListener('click', () => {
    const inhalt = JSON.stringify(exportiereZustand(), null, 2);
    const url = URL.createObjectURL(new Blob([inhalt], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `moshschool-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const status = el.querySelector('.pf-backup-status');
    if (status) status.textContent = t('backup_export_ok');
  });

  // Backup laden: Datei einlesen, importieren, dann die App neu laden — so greift
  // das ggf. mitgesicherte Thema und alle Sichten zeigen frisch den neuen Stand.
  el.querySelector('#pf-import-knopf')?.addEventListener('click', () => el.querySelector('#pf-import')?.click());
  el.querySelector('#pf-import')?.addEventListener('change', async (ereignis) => {
    const status = el.querySelector('.pf-backup-status');
    const datei = ereignis.target.files?.[0];
    if (!datei) return;
    try {
      const objekt = JSON.parse(await datei.text());
      if (!importiereZustand(objekt)) throw new Error('ungueltig');
      if (status) status.textContent = t('backup_import_ok');
      setTimeout(() => window.location.reload(), 700);
    } catch {
      if (status) status.textContent = t('backup_import_fehler');
    } finally {
      ereignis.target.value = '';
    }
  });

  el.querySelector('#pf-reset').addEventListener('click', async () => {
    if (!window.confirm(t('reset_bestaetigen'))) return;
    setzeZurueck();
    offen = null;
    location.hash = '#/onboarding';
    neuRendern();
  });
}
