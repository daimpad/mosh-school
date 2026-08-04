// Werkzeug: Zerr-Labor. Schickt ein Signal durch die Kennlinien aus
// data/zerrlabor-kennlinien.json (Hochpass → Kennlinie → Tiefpass) und macht die
// Unterschiede hörbar UND sichtbar — die Übertragungskurve wird als SVG gezeichnet,
// damit man den Zusammenhang zwischen Kurvenform und Klang sieht.
//
// Quelle wahlweise ein synthetisiertes Riff (Standard, funktioniert immer) oder das
// Mikrofon/Instrument. Vergleichstaste gegen `kl_clean`.
//
// Einstellungen sind flüchtiger, gerätelokaler Modul-State (wie patterns.js).
//
// PEGEL: Klippung hebt den Pegel drastisch (LED-Kennlinie kommt auf RMS 1.35 heraus,
// fast das Dreifache von clean). Vor dem Ausgang sitzt deshalb ein fester
// DynamicsCompressor als Begrenzer plus ein Ausgangs-Gain — beides nicht abschaltbar.
// Die Übergabe nennt Pegelbegrenzung und Lautstärkehinweis ausdrücklich als Pflicht.

import { t } from '../i18n.js';
import { esc, registriereAufraeumen } from '../oberflaeche.js';
import { aktiviere, holeAusgang, holeKontext, istBereit } from '../audio/kontext.js';
import { baueKette, uebertragung } from '../audio/zerre.js';
import { landingHeroHtml } from '../genre-inszenierung.js';

const zustand = {
  kennlinie: null,      // id; null = erste aus den Daten
  gain: 1,              // Faktor auf den Kennlinien-Gain
  filter: 1,            // Faktor auf Hoch-/Tiefpass
  quelle: 'riff',       // 'riff' | 'mikro'
  laeuft: false,
  vergleich: false,     // true = kl_clean statt der gewählten Kennlinie
};

// Eigene Mikrofon-Quelle statt audio/mikro.js: Jenes Modul verbindet bewusst NUR
// mit einem Analyser und nie mit dem Ausgang („kein Monitoring, keine
// Rückkopplung"). Hier muss das Signal aber durch die Kette bis zum Ausgang —
// deshalb ein eigener Knoten, und deshalb der Kopfhörer-Hinweis in der Ansicht.
async function mikroQuelle(ctx) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('kein-mikro');
  const strom = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  return { strom, knoten: ctx.createMediaStreamSource(strom) };
}

let kette = null;
let quelleNode = null;
let begrenzer = null;
let mikroStrom = null;
let riffTimer = null;

function kennlinien(daten) {
  return daten.zerrlabor?.kennlinien || [];
}

function gewaehlte(daten) {
  const liste = kennlinien(daten);
  if (!liste.length) return null;
  if (zustand.vergleich) return liste.find((k) => k.id === 'kl_clean') || liste[0];
  return liste.find((k) => k.id === zustand.kennlinie) || liste[0];
}

// --- Kurvenbild -----------------------------------------------------------
// Zeichnet y = f(x) über x ∈ [-1, 1]. Die Diagonale zeigt den unverzerrten
// Verlauf als Bezug: Wo die Kurve von ihr abweicht, entsteht Verzerrung.
function kurvenBild(kennlinie, gainFaktor) {
  const B = 240;
  const H = 240;
  const f = uebertragung(kennlinie, gainFaktor);
  const punkte = [];
  for (let i = 0; i <= 160; i++) {
    const x = (i / 160) * 2 - 1;
    const y = Math.max(-1.6, Math.min(1.6, f(x)));
    punkte.push(`${(((x + 1) / 2) * B).toFixed(1)},${((1 - (y + 1.6) / 3.2) * H).toFixed(1)}`);
  }
  const mitteY = ((1 - (0 + 1.6) / 3.2) * H).toFixed(1);
  const einsOben = ((1 - (1 + 1.6) / 3.2) * H).toFixed(1);
  const einsUnten = ((1 - (-1 + 1.6) / 3.2) * H).toFixed(1);
  return `
    <svg class="zerr-kurve" viewBox="0 0 ${B} ${H}" role="img"
         aria-label="${esc(t('zerrlabor_kurve_aria'))}" fill="none"
         stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <line x1="0" y1="${mitteY}" x2="${B}" y2="${mitteY}" stroke-width="1" opacity=".35"/>
      <line x1="${B / 2}" y1="0" x2="${B / 2}" y2="${H}" stroke-width="1" opacity=".35"/>
      <line x1="0" y1="${einsOben}" x2="${B}" y2="${einsOben}" stroke-width="1" opacity=".18" stroke-dasharray="4 4"/>
      <line x1="0" y1="${einsUnten}" x2="${B}" y2="${einsUnten}" stroke-width="1" opacity=".18" stroke-dasharray="4 4"/>
      <line x1="0" y1="${einsUnten}" x2="${B}" y2="${einsOben}" stroke-width="1.2" opacity=".3" stroke-dasharray="3 5"/>
      <polyline points="${punkte.join(' ')}" stroke-width="2.6"/>
    </svg>`;
}

// --- Audio ----------------------------------------------------------------
function baueBegrenzer(ctx) {
  // Fester Begrenzer: die Kennlinien unterscheiden sich um bis zu 13 dB im
  // Ausgangspegel — ohne ihn wäre der Wechsel von Germanium auf LED ein Sprung,
  // der wehtut. Bewusst nicht abschaltbar.
  const komp = ctx.createDynamicsCompressor();
  komp.threshold.value = -10;
  komp.knee.value = 6;
  komp.ratio.value = 12;
  komp.attack.value = 0.003;
  komp.release.value = 0.15;
  const aus = ctx.createGain();
  aus.gain.value = 0.35;
  komp.connect(aus);
  aus.connect(holeAusgang());
  return { eingang: komp, trenne: () => { komp.disconnect(); aus.disconnect(); } };
}

// Synthetisiertes Riff als Quelle: gedämpfte Achtel auf einem tiefen Grundton,
// wie die Pattern-Demos. Kein Sample — der Audio-Kern ist Synthese-only.
function starteRiff(ctx, ziel) {
  const grund = 82.41 / 2; // E1, tief genug, damit die Klippung deutlich wird
  let takt = 0;
  const spiele = () => {
    const t0 = ctx.currentTime + 0.02;
    for (let i = 0; i < 8; i++) {
      const zeit = t0 + i * 0.16;
      const osc = ctx.createOscillator();
      const h = ctx.createGain();
      osc.type = 'sawtooth';
      const stufe = [0, 0, 0, 3, 0, 0, 1, 0][i];
      osc.frequency.setValueAtTime(grund * 2 ** (stufe / 12), zeit);
      h.gain.setValueAtTime(0.0001, zeit);
      h.gain.exponentialRampToValueAtTime(0.5, zeit + 0.006);
      h.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.14);
      osc.connect(h);
      h.connect(ziel);
      osc.start(zeit);
      osc.stop(zeit + 0.16);
    }
    takt += 1;
    riffTimer = setTimeout(spiele, 8 * 160 - 40);
  };
  spiele();
  return { stop: () => { clearTimeout(riffTimer); riffTimer = null; } };
}

function stoppe() {
  clearTimeout(riffTimer);
  riffTimer = null;
  if (quelleNode?.stop) quelleNode.stop();
  if (quelleNode?.disconnect) quelleNode.disconnect();
  quelleNode = null;
  if (mikroStrom) {
    for (const spur of mikroStrom.getTracks()) spur.stop();
    mikroStrom = null;
  }
  kette?.trenne();
  kette = null;
  begrenzer?.trenne();
  begrenzer = null;
  zustand.laeuft = false;
}

async function starte(daten) {
  stoppe();
  const kl = gewaehlte(daten);
  if (!kl) return;
  const ctx = holeKontext();
  begrenzer = baueBegrenzer(ctx);
  kette = baueKette(ctx, kl, { gainFaktor: zustand.gain, filterFaktor: zustand.filter });
  kette.ausgang.connect(begrenzer.eingang);

  if (zustand.quelle === 'mikro') {
    const mikro = await mikroQuelle(ctx).catch(() => null);
    if (!mikro) {
      stoppe();
      return 'mikro_fehlt';
    }
    mikroStrom = mikro.strom;
    quelleNode = mikro.knoten;
    quelleNode.connect(kette.eingang);
  } else {
    quelleNode = starteRiff(ctx, kette.eingang);
  }
  zustand.laeuft = true;
  return null;
}

// --- Rendern --------------------------------------------------------------
export function renderWerkzeugZerrlabor(el, daten) {
  const liste = kennlinien(daten);
  if (!liste.length) {
    el.innerHTML = `<article><p class="leise">${esc(t('zerrlabor_leer'))}</p></article>`;
    return;
  }
  if (!zustand.kennlinie) zustand.kennlinie = liste[0].id;
  const kl = gewaehlte(daten);
  const bereit = istBereit();

  const auswahl = liste
    .map((k) => {
      const aktiv = k.id === zustand.kennlinie && !zustand.vergleich;
      return `<button type="button" class="chip${aktiv ? ' chip-akzent' : ''}"
        data-kennlinie="${esc(k.id)}"${aktiv ? ' aria-current="true"' : ''}>${esc(k.name)}</button>`;
    })
    .join(' ');

  const kennwerte = kl.kennwerte || {};
  const werteZeile = [
    kennwerte.ausgangspegel_rms != null
      ? `<span class="chip">${esc(t('zerrlabor_pegel'))}: ${kennwerte.ausgangspegel_rms}</span>` : '',
    kennwerte.thd_1khz != null
      ? `<span class="chip">${esc(t('zerrlabor_thd'))}: ${Math.round(kennwerte.thd_1khz * 100)} %</span>` : '',
    kennwerte.anteil_geradzahlig
      ? `<span class="chip">${esc(t('zerrlabor_geradzahlig'))}: ${Math.round(kennwerte.anteil_geradzahlig * 100)} %</span>` : '',
  ].join(' ');

  el.innerHTML = `
    <article class="zerrlabor-seite">
      ${landingHeroHtml('fa-wave-square', t('zerrlabor_titel'), t('zerrlabor_untertitel'), 'pf-schiefer', 'zerrlabor')}

      <p class="zerr-warnung"><strong>${esc(t('zerrlabor_lautstaerke_titel'))}</strong>
        ${esc(t('zerrlabor_lautstaerke'))}</p>

      ${bereit ? '' : `<p><button type="button" class="knopf knopf-primaer" data-audio-an>${esc(t('wz_audio_aktivieren'))}</button></p>`}

      <section class="abschnitt">
        <h2 class="abschnitt-titel">${esc(t('zerrlabor_kennlinie'))}</h2>
        <p class="chip-zeile">${auswahl}</p>
        <div class="zerr-bild-zeile">
          ${kurvenBild(kl, zustand.gain)}
          <div class="zerr-beschreibung">
            <h3>${esc(kl.name)}</h3>
            <p>${esc(kl.beschreibung || '')}</p>
            <p class="leise"><code>${esc(kl.formel || '')}</code></p>
            ${werteZeile ? `<p class="chip-zeile">${werteZeile}</p>` : ''}
            <p class="leise">${esc(t('zerrlabor_signalweg'))}:
              ${kl.pre_hochpass_hz ? `${Math.round(kl.pre_hochpass_hz * zustand.filter)} Hz HP → ` : ''}
              ${esc(t('zerrlabor_kennlinie'))}
              ${kl.post_tiefpass_hz ? ` → ${Math.round(kl.post_tiefpass_hz * zustand.filter)} Hz TP` : ''}</p>
          </div>
        </div>
      </section>

      <section class="abschnitt">
        <h2 class="abschnitt-titel">${esc(t('zerrlabor_regler'))}</h2>
        <p class="wz-feld">
          <label for="zl-gain">${esc(t('zerrlabor_gain'))}: <output id="zl-gain-wert">${zustand.gain.toFixed(2)}×</output></label>
          <input id="zl-gain" type="range" min="0.2" max="3" step="0.05" value="${zustand.gain}">
        </p>
        <p class="wz-feld">
          <label for="zl-filter">${esc(t('zerrlabor_filter'))}: <output id="zl-filter-wert">${zustand.filter.toFixed(2)}×</output></label>
          <input id="zl-filter" type="range" min="0.4" max="2.5" step="0.05" value="${zustand.filter}">
        </p>
        <p class="chip-zeile">
          <button type="button" class="chip${zustand.quelle === 'riff' ? ' chip-akzent' : ''}" data-quelle="riff">${esc(t('zerrlabor_quelle_riff'))}</button>
          <button type="button" class="chip${zustand.quelle === 'mikro' ? ' chip-akzent' : ''}" data-quelle="mikro">${esc(t('zerrlabor_quelle_mikro'))}</button>
        </p>
        ${zustand.quelle === 'mikro' ? `<p class="zerr-warnung">${esc(t('zerrlabor_kopfhoerer'))}</p>` : ''}
        <p class="chip-zeile">
          <button type="button" class="knopf knopf-primaer" data-start ${bereit ? '' : 'disabled'}>
            ${esc(zustand.laeuft ? t('zerrlabor_stopp') : t('zerrlabor_start'))}</button>
          <button type="button" class="knopf${zustand.vergleich ? ' knopf-primaer' : ''}" data-vergleich ${bereit ? '' : 'disabled'}>
            ${esc(t('zerrlabor_vergleich'))}</button>
        </p>
        <p class="leise" data-meldung aria-live="polite"></p>
      </section>
    </article>`;

  const meldung = el.querySelector('[data-meldung]');

  el.querySelector('[data-audio-an]')?.addEventListener('click', async () => {
    await aktiviere();
    renderWerkzeugZerrlabor(el, daten);
    el.querySelector('[data-start]')?.focus();
  });

  for (const knopf of el.querySelectorAll('[data-kennlinie]')) {
    knopf.addEventListener('click', async () => {
      zustand.kennlinie = knopf.dataset.kennlinie;
      zustand.vergleich = false;
      const lief = zustand.laeuft;
      if (lief) await starte(daten);
      renderWerkzeugZerrlabor(el, daten);
      el.querySelector(`[data-kennlinie="${CSS.escape(zustand.kennlinie)}"]`)?.focus();
    });
  }

  for (const knopf of el.querySelectorAll('[data-quelle]')) {
    knopf.addEventListener('click', async () => {
      zustand.quelle = knopf.dataset.quelle;
      const lief = zustand.laeuft;
      if (lief) {
        const fehler = await starte(daten);
        if (fehler === 'mikro_fehlt') zustand.quelle = 'riff';
      }
      renderWerkzeugZerrlabor(el, daten);
      const m = el.querySelector('[data-meldung]');
      if (m && zustand.quelle === 'riff' && knopf.dataset.quelle === 'mikro') m.textContent = t('zerrlabor_mikro_fehlt');
      el.querySelector(`[data-quelle="${CSS.escape(zustand.quelle)}"]`)?.focus();
    });
  }

  const gainRegler = el.querySelector('#zl-gain');
  gainRegler?.addEventListener('input', () => {
    zustand.gain = Number(gainRegler.value);
    el.querySelector('#zl-gain-wert').textContent = `${zustand.gain.toFixed(2)}×`;
    // Kurvenbild sofort mitziehen, ohne die ganze Ansicht neu zu zeichnen
    // (sonst verlöre der Regler beim Ziehen den Fokus).
    const bild = el.querySelector('.zerr-kurve');
    if (bild) bild.outerHTML = kurvenBild(gewaehlte(daten), zustand.gain);
    if (zustand.laeuft) starte(daten);
  });

  const filterRegler = el.querySelector('#zl-filter');
  filterRegler?.addEventListener('input', () => {
    zustand.filter = Number(filterRegler.value);
    el.querySelector('#zl-filter-wert').textContent = `${zustand.filter.toFixed(2)}×`;
    if (zustand.laeuft) starte(daten);
  });

  el.querySelector('[data-start]')?.addEventListener('click', async () => {
    if (zustand.laeuft) stoppe();
    else {
      const fehler = await starte(daten);
      if (fehler === 'mikro_fehlt' && meldung) meldung.textContent = t('zerrlabor_mikro_fehlt');
    }
    renderWerkzeugZerrlabor(el, daten);
    el.querySelector('[data-start]')?.focus();
  });

  el.querySelector('[data-vergleich]')?.addEventListener('click', async () => {
    zustand.vergleich = !zustand.vergleich;
    if (zustand.laeuft) await starte(daten);
    renderWerkzeugZerrlabor(el, daten);
    el.querySelector('[data-vergleich]')?.focus();
  });

  // Beim Verlassen der Route alles abbauen — sonst liefe das Riff weiter und
  // ein offenes Mikrofon bliebe die ganze Sitzung offen.
  registriereAufraeumen(() => stoppe());
}
