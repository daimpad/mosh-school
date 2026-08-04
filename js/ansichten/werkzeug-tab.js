// Werkzeug: Tabulatur eingeben, sehen und hören.
//
// Du fügst einen ASCII-Tab ein (das Format, in dem Tabs seit jeher durchs Netz
// gehen), wählst eine Stimmung aus dem gemeinsamen Pool (data/tunings.json) und
// spielst ihn ab. Gespielt wird über den GEMEINSAMEN Audio-Kern: derselbe
// Scheduler und dieselbe Saiten-Stimme wie die Demonstrationen — kein zweites
// Timing, keine Samples.
//
// Der Parser liegt DOM-frei in js/tabulatur.js, damit er prüfbar bleibt; hier
// steht nur Darstellung und Bedienung.
//
// Eigene Tabs liegen im Werkzeug-Speicher (moshschool.werkzeuge.v1), nicht im
// Fortschritts-Schema — wie Pedalketten und eigene Stimmungen.

import { label, t } from '../i18n.js';
import { esc, registriereAufraeumen } from '../oberflaeche.js';
import { aktiviere, holeAusgang, holeKontext, istBereit } from '../audio/kontext.js';
import { erzeugeScheduler } from '../audio/scheduler.js';
import { saite as saitenStimme } from '../audio/stimmen.js';
import { holeWerkzeugDaten, setzeWerkzeugDaten } from '../werkzeug-speicher.js';
import { parseTabulatur, saitenNoten } from '../tabulatur.js';
import { frequenzVon } from './stimmungen.js';
import { landingHeroHtml } from '../genre-inszenierung.js';

// Beispiel beim ersten Öffnen: bewusst ein eigenes, generisches Übungsmuster
// (Powerchord-Wechsel), kein fremder Song. Das Werkzeug liefert kein
// Notenmaterial aus — was du einfügst, ist deine Sache.
const BEISPIEL = [
  'e|----------------|',
  'B|----------------|',
  'G|----------------|',
  'D|----------------|',
  'A|-2-2-2-2--5-5---|',
  'E|-0-0-0-0--3-3-0-|',
].join('\n');

const zustand = {
  text: null,        // null = noch nicht geladen (dann Beispiel)
  stimmung: 'e_standard',
  bpm: 100,
  proSchlag: 4,      // Spalten je Schlag: 4 = Sechzehntel
  loop: true,
  laeuft: false,
};

let sched = null;
let laufElement = null;

function tabs() {
  const d = holeWerkzeugDaten('tabulatur', { eigene: [] });
  return Array.isArray(d?.eigene) ? d.eigene : [];
}
function speichereTabs(liste) {
  setzeWerkzeugDaten('tabulatur', { eigene: liste });
}

function stimmungen(daten) {
  return daten.tunings?.stimmungen || [];
}
function gewaehlteStimmung(daten) {
  return stimmungen(daten).find((s) => s.id === zustand.stimmung) || null;
}

function aktuellerText() {
  return zustand.text == null ? BEISPIEL : zustand.text;
}

// --- Raster ---------------------------------------------------------------
function rasterHtml(tab, noten) {
  if (tab.leer) return `<p class="leise">${esc(t('wz_tab_leer'))}</p>`;
  const proSchlag = Math.max(1, zustand.proSchlag);
  const evMap = new Map();
  for (const ev of tab.events) evMap.set(`${ev.saite}:${ev.schritt}`, ev);
  const zeilen = [];
  for (let s = 1; s <= tab.saiten; s++) {
    const zellen = [];
    for (let i = 0; i < tab.spalten; i++) {
      const ev = evMap.get(`${s}:${i}`);
      const takt = i % proSchlag === 0 ? ' takt' : '';
      const inhalt = ev ? (ev.technik === 'dead_note' ? 'x' : String(ev.bund)) : '';
      zellen.push(`<span class="tab-zelle${ev ? ' an' : ''}${takt}" data-col="${i}" aria-hidden="true">${esc(inhalt)}</span>`);
    }
    const name = noten[s - 1] ? String(noten[s - 1]).replace(/-?\d+$/, '') : '';
    zeilen.push(`<div class="tab-zeile"><span class="tab-saite">${esc(name)}</span>
      <div class="tab-zellen" style="grid-template-columns:repeat(${tab.spalten},minmax(1.4rem,1fr))">${zellen.join('')}</div></div>`);
  }
  return `<div class="tab-raster" role="img" aria-label="${esc(t('wz_tab_raster_aria', { saiten: tab.saiten, spalten: tab.spalten }))}">${zeilen.join('')}</div>`;
}

// --- Wiedergabe -----------------------------------------------------------
function stoppe(el) {
  sched?.stoppe();
  sched = null;
  zustand.laeuft = false;
  if (laufElement) laufElement.classList.remove('jetzt');
  laufElement = null;
  const knopf = el?.querySelector('[data-tab-play]');
  if (knopf) {
    knopf.setAttribute('aria-pressed', 'false');
    knopf.querySelector('.tab-play-text').textContent = t('wz_tab_play');
  }
}

function spiele(el, daten) {
  const tab = parseTabulatur(aktuellerText());
  if (tab.leer || !tab.events.length) return;
  const noten = saitenNoten(tab, gewaehlteStimmung(daten)?.saiten);
  const ctx = holeKontext();
  const ziel = holeAusgang();
  const proSpalte = 60 / zustand.bpm / Math.max(1, zustand.proSchlag);

  // Ereignisse je Spalte bündeln — ein Akkord ist EIN Schritt mit mehreren Tönen.
  const spalten = new Map();
  for (const ev of tab.events) {
    if (!spalten.has(ev.schritt)) spalten.set(ev.schritt, []);
    spalten.get(ev.schritt).push(ev);
  }

  sched = erzeugeScheduler(ctx);
  sched.starte({
    schrittDauer: (i) => {
      if (i < tab.spalten) return proSpalte;
      return zustand.loop ? null : null; // Schleife wird unten neu gestartet
    },
    beiSchritt: (zeit, i) => {
      for (const ev of spalten.get(i) || []) {
        const basis = frequenzVon(noten[ev.saite - 1] || '');
        if (!basis) continue;
        saitenStimme(ctx, ziel, zeit, {
          frequenz: basis * 2 ** (ev.bund / 12),
          gedaempft: ev.technik === 'dead_note',
        });
      }
      // Laufmarke: nicht-auditives Signal, welche Spalte gerade klingt.
      const verzug = Math.max(0, (zeit - ctx.currentTime) * 1000);
      window.setTimeout(() => {
        if (!zustand.laeuft) return;
        laufElement?.classList.remove('jetzt');
        laufElement = el.querySelector(`.tab-zellen .tab-zelle[data-col="${i}"]`);
        laufElement?.classList.add('jetzt');
      }, verzug);
    },
    beiEnde: () => {
      if (zustand.loop && zustand.laeuft) spiele(el, daten);
      else stoppe(el);
    },
  });
  zustand.laeuft = true;
  const knopf = el.querySelector('[data-tab-play]');
  if (knopf) {
    knopf.setAttribute('aria-pressed', 'true');
    knopf.querySelector('.tab-play-text').textContent = t('wz_tab_stop');
  }
}

// --- Ansicht --------------------------------------------------------------
export function renderWerkzeugTab(el, daten) {
  stoppe(null);
  const tab = parseTabulatur(aktuellerText());
  const stimmung = gewaehlteStimmung(daten);
  const noten = saitenNoten(tab, stimmung?.saiten);
  const bereit = istBereit();

  const stimmungsChips = stimmungen(daten)
    .filter((s) => s.saiten.length === tab.saiten || tab.leer)
    .map((s) => `<button type="button" class="chip${s.id === zustand.stimmung ? ' chip-akzent' : ''}" data-tab-stimmung="${esc(s.id)}">${esc(label('stimmung', s.id))}</button>`)
    .join(' ');

  const gespeicherte = tabs();
  const listeHtml = gespeicherte.length
    ? gespeicherte
        .map((e) => `<span class="wz-eigen-eintrag">
          <button type="button" class="chip chip-waehlbar" data-tab-laden="${esc(e.id)}"><i class="fa-solid fa-book-open" aria-hidden="true"></i> ${esc(e.name)}</button>
          <button type="button" class="chip" data-tab-loeschen="${esc(e.id)}" aria-label="${esc(t('wz_tab_loeschen', { name: e.name }))}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </span>`)
        .join(' ')
    : `<span class="leise">${esc(t('wz_tab_keine'))}</span>`;

  el.innerHTML = `
    <article class="wz-werkzeug">
      ${landingHeroHtml('fa-list-check', t('wz_tab_titel'), t('wz_tab_untertitel'), 'pf-teal', 'werkzeug:tab', t('kicker_werkzeug'))}
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>

      <div class="wz-audio-tor" ${bereit ? 'hidden' : ''}>
        <p class="leise">${esc(t('wz_audio_hinweis'))}</p>
        <button type="button" class="knopf knopf-primaer wz-audio-aktivieren">
          <i class="fa-solid fa-volume-high" aria-hidden="true"></i> ${esc(t('wz_audio_aktivieren'))}
        </button>
      </div>

      <section class="abschnitt">
        <h2 class="abschnitt-titel">${esc(t('wz_tab_eingabe'))}</h2>
        <p class="leise">${esc(t('wz_tab_hinweis'))}</p>
        <label class="nur-sr" for="tab-text">${esc(t('wz_tab_eingabe'))}</label>
        <textarea id="tab-text" class="tab-eingabe" rows="8" spellcheck="false">${esc(aktuellerText())}</textarea>
        <p class="leise tab-befund" role="status">${esc(
          tab.leer
            ? t('wz_tab_leer')
            : t('wz_tab_befund', { saiten: tab.saiten, spalten: tab.spalten, toene: tab.events.length })
        )}</p>
        ${tab.hinweise.length ? `<p class="leise">${esc(t('wz_tab_ungespielt', { was: tab.hinweise.map((h) => t('wz_tab_technik_' + h)).join(', ') }))}</p>` : ''}
      </section>

      <section class="abschnitt">
        <h2 class="abschnitt-titel">${esc(t('wz_tab_raster'))}</h2>
        ${rasterHtml(tab, noten)}
      </section>

      <section class="abschnitt">
        <h2 class="abschnitt-titel">${esc(t('wz_tab_stimmung'))}</h2>
        <p class="chip-zeile">${stimmungsChips || `<span class="leise">${esc(t('wz_tab_keine_stimmung'))}</span>`}</p>
        <p class="leise">${esc(t('wz_tab_stimmung_hinweis'))}</p>
      </section>

      <section class="abschnitt">
        <h2 class="abschnitt-titel">${esc(t('wz_tab_wiedergabe'))}</h2>
        <p class="wz-feld">
          <label for="tab-bpm">${esc(t('wz_tab_tempo'))}: <output id="tab-bpm-wert">${zustand.bpm}</output> BPM</label>
          <input id="tab-bpm" type="range" min="40" max="240" step="1" value="${zustand.bpm}">
        </p>
        <p class="wz-feld">
          <label for="tab-raster">${esc(t('wz_tab_proschlag'))}: <output id="tab-raster-wert">${zustand.proSchlag}</output></label>
          <input id="tab-raster" type="range" min="1" max="8" step="1" value="${zustand.proSchlag}">
        </p>
        <p class="chip-zeile">
          <button type="button" class="knopf knopf-primaer" data-tab-play aria-pressed="false" ${bereit ? '' : 'disabled'}>
            <i class="fa-solid fa-play" aria-hidden="true"></i> <span class="tab-play-text">${esc(t('wz_tab_play'))}</span>
          </button>
          <label class="chip"><input type="checkbox" data-tab-loop ${zustand.loop ? 'checked' : ''}> ${esc(t('wz_tab_loop'))}</label>
        </p>
      </section>

      <section class="abschnitt">
        <h2 class="abschnitt-titel">${esc(t('wz_tab_gespeichert'))}</h2>
        <p class="wz-eigen-speicherzeile">
          <label class="wz-eigen-name-feld">${esc(t('wz_tab_name'))}
            <input type="text" class="tab-name" maxlength="40" placeholder="${esc(t('wz_tab_name_platzhalter'))}">
          </label>
          <button type="button" class="knopf knopf-sekundaer" data-tab-speichern>
            <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> ${esc(t('wz_tab_speichern'))}
          </button>
        </p>
        <p class="tab-status leise" role="status"></p>
        <p class="chip-zeile tab-liste">${listeHtml}</p>
      </section>
    </article>`;

  verdrahte(el, daten);
  registriereAufraeumen(() => stoppe(null));
}

function verdrahte(el, daten) {
  const neu = () => renderWerkzeugTab(el, daten);

  el.querySelector('.wz-audio-aktivieren')?.addEventListener('click', async () => {
    await aktiviere();
    if (istBereit()) neu();
  });

  // Eingabe: nur das Raster und den Befund neu zeichnen, NICHT die ganze
  // Ansicht — ein Neu-Rendern bei jedem Tastendruck nähme dem Textfeld den
  // Fokus und die Einfügemarke.
  const feld = el.querySelector('#tab-text');
  feld?.addEventListener('input', () => {
    zustand.text = feld.value;
    const tab = parseTabulatur(zustand.text);
    const noten = saitenNoten(tab, gewaehlteStimmung(daten)?.saiten);
    const raster = el.querySelector('.tab-raster')?.parentElement || el.querySelector('.abschnitt:nth-of-type(2)');
    const ziel = el.querySelectorAll('.abschnitt')[1];
    if (ziel) {
      const alt = ziel.querySelector('.tab-raster') || ziel.querySelector('.leise');
      alt?.insertAdjacentHTML('afterend', rasterHtml(tab, noten));
      alt?.remove();
    }
    const befund = el.querySelector('.tab-befund');
    if (befund) {
      befund.textContent = tab.leer
        ? t('wz_tab_leer')
        : t('wz_tab_befund', { saiten: tab.saiten, spalten: tab.spalten, toene: tab.events.length });
    }
  });

  for (const knopf of el.querySelectorAll('[data-tab-stimmung]')) {
    knopf.addEventListener('click', () => {
      zustand.stimmung = knopf.dataset.tabStimmung;
      neu();
    });
  }

  const bpm = el.querySelector('#tab-bpm');
  bpm?.addEventListener('input', () => {
    zustand.bpm = Number(bpm.value);
    el.querySelector('#tab-bpm-wert').textContent = zustand.bpm;
  });
  const raster = el.querySelector('#tab-raster');
  raster?.addEventListener('change', () => {
    zustand.proSchlag = Number(raster.value);
    neu();
  });
  raster?.addEventListener('input', () => {
    el.querySelector('#tab-raster-wert').textContent = raster.value;
  });
  el.querySelector('[data-tab-loop]')?.addEventListener('change', (e) => {
    zustand.loop = e.target.checked;
  });

  el.querySelector('[data-tab-play]')?.addEventListener('click', () => {
    if (zustand.laeuft) stoppe(el);
    else spiele(el, daten);
  });

  el.querySelector('[data-tab-speichern]')?.addEventListener('click', () => {
    const nameFeld = el.querySelector('.tab-name');
    const status = el.querySelector('.tab-status');
    const name = (nameFeld?.value || '').trim();
    if (!name) {
      if (status) status.textContent = t('wz_tab_name_fehlt');
      nameFeld?.focus();
      return;
    }
    speichereTabs([...tabs(), { id: 'tab_' + Date.now(), name, text: aktuellerText(), stimmung: zustand.stimmung }]);
    neu();
    const s = el.querySelector('.tab-status');
    if (s) s.textContent = t('wz_tab_gespeichert_ok', { name });
  });

  for (const knopf of el.querySelectorAll('[data-tab-laden]')) {
    knopf.addEventListener('click', () => {
      const eintrag = tabs().find((e) => e.id === knopf.dataset.tabLaden);
      if (!eintrag) return;
      zustand.text = eintrag.text;
      if (eintrag.stimmung) zustand.stimmung = eintrag.stimmung;
      neu();
    });
  }
  for (const knopf of el.querySelectorAll('[data-tab-loeschen]')) {
    knopf.addEventListener('click', () => {
      speichereTabs(tabs().filter((e) => e.id !== knopf.dataset.tabLoeschen));
      neu();
    });
  }
}
