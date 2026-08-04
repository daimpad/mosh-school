// Werkzeug: Zerr-Labor. Schickt ein Signal durch die Kennlinien aus
// data/zerrlabor-kennlinien.json (Hochpass → Kennlinie → Tiefpass) und macht die
// Unterschiede hörbar UND sichtbar — die Übertragungskurve wird als SVG gezeichnet,
// damit man den Zusammenhang zwischen Kurvenform und Klang sieht.
//
// Quelle wahlweise eine echte Gitarre (Standard), ein synthetisiertes Riff oder das
// Mikrofon/Instrument. Vergleichstaste gegen `kl_clean`.
//
// WARUM EINE ECHTE GITARRE: Ein Sägezahn hat keine Saitenresonanz, kein
// Plektrum-Geräusch und keinen Anschlag, der über die Zeit dunkler wird — auf so
// einem Signal klingt jede Kennlinie plausibel, und der Vergleich sagt nichts.
// Die Klangproben (assets/sounds/gitarre-*.wav, erzeugt von
// scripts/build_gitarrenprobe.mjs aus einem CC0-Bestand — siehe
// assets/sounds/HERKUNFT.txt) sind bewusst DIREKTSIGNAL ohne Verstärker: Das
// Werkzeug hängt seine eigene Zerre und Box dahinter — ein bereits verzerrtes
// Sample würde doppelt verzerrt und die Kennlinien wären nicht mehr
// auseinanderzuhalten.
//
// Aus fünf Einzeltönen baut die Ansicht mehrere CLIPS (s. u.). Ein einzelnes
// Signal reicht nicht: Intermodulation zeigt sich erst am Powerchord,
// Kompression erst am stehenden Ton, Anschlagsdynamik erst im Wechsel von
// weichem und hartem Schlag.
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
import { baueBox } from '../audio/box.js';
import { ladeKlangprobe } from '../audio/klangprobe.js';
import { landingHeroHtml } from '../genre-inszenierung.js';

const zustand = {
  kennlinie: null,      // id; null = erste aus den Daten
  gain: 1,              // Faktor auf den Kennlinien-Gain
  filter: 1,            // Faktor auf Hoch-/Tiefpass
  quelle: 'gitarre',    // 'gitarre' | 'riff' | 'mikro'
  clip: 'chugs',        // id aus CLIPS; nur bei quelle === 'gitarre'
  laeuft: false,
  vergleich: false,     // true = kl_clean statt der gewählten Kennlinie
  box: null,            // id aus data/boxen.json; null = ohne Boxensimulation
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
let boxKette = null;
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

function boxen(daten) {
  return daten.boxen?.boxen || [];
}

function gewaehlteBox(daten) {
  return boxen(daten).find((b) => b.id === zustand.box) || null;
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

// Ein Riff, zwei Quellen: dieselben acht Achtel, dieselben Halbtonschritte.
// Nur so vergleicht der Wechsel zwischen synthetischer und echter Gitarre
// wirklich das Signal und nicht zwei verschiedene Riffs.
const RIFF_SCHRITT = 0.16;                          // s je Achtel
const RIFF_STUFEN = [0, 0, 0, 3, 0, 0, 1, 0];       // Halbtöne über dem Grundton
// Harter Anschlag auf der Eins und auf den beiden Wechseltönen — dazwischen
// weich. Das ist die Anschlagsfolge, die ein Mensch spielt, und sie macht den
// Unterschied zwischen den Kennlinien überhaupt erst hörbar: Ein Zerrer klippt
// den harten Schlag und lässt den weichen fast durch.
const RIFF_HART = [true, false, false, true, false, false, true, false];

// Plant einen Takt und weckt sich per Timer zum nächsten. Die Zeiten hängen an
// ctx.currentTime, der Timer plant nur nach — naives setTimeout-Timing für
// einzelne Töne wäre hörbar ungenau.
function taktSchleife(ctx, planeTakt, laenge) {
  const spiele = () => {
    planeTakt(ctx.currentTime + 0.02);
    riffTimer = setTimeout(spiele, laenge * 1000 - 40);
  };
  spiele();
  return { stop: () => { clearTimeout(riffTimer); riffTimer = null; } };
}

// Synthetisiertes Riff als Quelle: gedämpfte Achtel auf einem tiefen Grundton,
// wie die Pattern-Demos. Fällt ein, wenn die Klangproben nicht geladen werden
// können (offline) — deshalb bleibt es erhalten.
function starteRiff(ctx, ziel) {
  const grund = 82.41 / 2; // E1, tief genug, damit die Klippung deutlich wird
  return taktSchleife(ctx, (t0) => {
    for (let i = 0; i < 8; i++) {
      const zeit = t0 + i * RIFF_SCHRITT;
      const osc = ctx.createOscillator();
      const h = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(grund * 2 ** (RIFF_STUFEN[i] / 12), zeit);
      h.gain.setValueAtTime(0.0001, zeit);
      h.gain.exponentialRampToValueAtTime(0.5, zeit + 0.006);
      h.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.14);
      osc.connect(h);
      h.connect(ziel);
      osc.start(zeit);
      osc.stop(zeit + RIFF_SCHRITT);
    }
  }, 8 * RIFF_SCHRITT);
}

// --- Klangproben und Clips ------------------------------------------------
// Fünf Töne, aus denen alle Clips gebaut werden. Volle Pfad-Literale, damit
// scripts/validate.py sie findet und prüfen kann, ob die Dateien da und im
// erwarteten Format sind (ein zusammengesetzter Pfad wäre dort unsichtbar).
const PROBEN = {
  e2_hart: 'assets/sounds/gitarre-e2-hart.wav',
  e2_weich: 'assets/sounds/gitarre-e2-weich.wav',
  a2_hart: 'assets/sounds/gitarre-a2-hart.wav',
  e3_hart: 'assets/sounds/gitarre-e3-hart.wav',
  g3_hart: 'assets/sounds/gitarre-g3-hart.wav',
};

// Ein Clip ist eine Folge von Anschlägen auf dem Achtel-Raster:
//   schritt  Position in Achteln (RIFF_SCHRITT)
//   probe    Schlüssel aus PROBEN
//   halbton  Transposition über playbackRate (0 = Originalton)
//   dauer    Klingdauer in Sekunden (kurz = abgedämpft, lang = stehen lassen)
//   pegel    Eingangspegel in die Kennlinie
//   versatz  optionale Verzögerung in Sekunden (Anschlag über die Saiten)
//
// WARUM MEHRERE CLIPS: Eine Zerrkennlinie verhält sich nicht überall gleich.
// Ein Powerchord zeigt Intermodulation, die ein Einzelton gar nicht erzeugen
// kann; ein stehender Ton zeigt, wie stark die Kennlinie komprimiert; die hohe
// Lage zeigt, was der Nach-Tiefpass mit den Obertönen macht. Mit nur einem
// Signal bliebe jeder dieser Effekte unhörbar.
//
// PEGEL: Alle Clips sind gegen das synthetische Riff eingemessen (Ausgangs-RMS
// ~0,065). Bei ungleichem Pegel klippt die Kennlinie beim Clipwechsel
// unterschiedlich stark — dann verglichen die Clips Lautstärke statt Signal.
const CLIPS = [
  {
    // Das Riff des synthetischen Gegenstücks, Note für Note: gedämpfte Achtel,
    // harter Anschlag auf der Eins und den beiden Wechseltönen. Nur wenn beide
    // Quellen dasselbe spielen, vergleicht der Quellenwechsel das Signal.
    id: 'chugs',
    schritte: 8,
    noten: RIFF_STUFEN.map((halbton, i) => ({
      schritt: i,
      probe: RIFF_HART[i] ? 'e2_hart' : 'e2_weich',
      halbton,
      dauer: i === 7 ? 0.5 : 0.14,
      pegel: RIFF_HART[i] ? 0.27 : 0.17,
    })),
  },
  {
    // Vier weiche, dann vier harte Anschläge auf demselben Ton. Der Pegelsprung
    // ist Absicht und echt: Weicher Anschlag ist leiser UND dunkler, und genau
    // daran hängt, ob eine Kennlinie überhaupt anspricht.
    id: 'dynamik',
    schritte: 8,
    noten: [0, 2, 4, 6].map((schritt) => ({
      schritt,
      probe: schritt < 4 ? 'e2_weich' : 'e2_hart',
      dauer: 0.3,
      pegel: schritt < 4 ? 0.11 : 0.33,
    })),
  },
  {
    // E5 auf den Saiten 1–3 (E2 + H2 + E3), zweimal angeschlagen und klingen
    // gelassen. Die Quinte entsteht aus A2 zwei Halbtöne höher — auf der
    // A-Saite wird sie auch gegriffen. Der Versatz ist der Schlag über die
    // Saiten: gleichzeitig angerissen klänge es nach Tastendruck.
    id: 'powerchord',
    schritte: 12,
    noten: [0, 6].flatMap((schritt) => [
      { schritt, probe: 'e2_hart', dauer: 1.1, pegel: 0.2 },
      { schritt, probe: 'a2_hart', halbton: 2, dauer: 1.1, pegel: 0.17, versatz: 0.012 },
      { schritt, probe: 'e3_hart', dauer: 1.1, pegel: 0.16, versatz: 0.024 },
    ]),
  },
  {
    // Ein Ton, voll ausklingend. Zeigt die Kompression: Je härter die Kennlinie
    // klippt, desto länger bleibt der Ton auf gleicher Lautstärke stehen.
    id: 'stehend',
    schritte: 12,
    noten: [{ schritt: 0, probe: 'e2_hart', dauer: 1.75, pegel: 0.34 }],
  },
  {
    // Höhere Lage (G3, 196 Hz): Dieselbe Kennlinie klingt hier deutlich anders,
    // weil die Obertöne weiter oben liegen und der Nach-Tiefpass sie greift.
    id: 'lead',
    schritte: 8,
    noten: [
      { schritt: 0, probe: 'g3_hart', dauer: 0.45, pegel: 0.3 },
      { schritt: 3, probe: 'g3_hart', halbton: 3, dauer: 0.45, pegel: 0.3 },
      { schritt: 6, probe: 'g3_hart', halbton: 5, dauer: 0.7, pegel: 0.3 },
    ],
  },
];

function gewaehlterClip() {
  return CLIPS.find((c) => c.id === zustand.clip) || CLIPS[0];
}

// Spielt einen Clip in Schleife. Gleiche Bauart wie das synthetische Riff:
// ein Takt wird im Voraus gegen die Audio-Uhr geplant, der Timer weckt nur.
function starteClip(ctx, ziel, clip, puffer) {
  return taktSchleife(ctx, (t0) => {
    for (const note of clip.noten) {
      const zeit = t0 + note.schritt * RIFF_SCHRITT + (note.versatz || 0);
      const quelle = ctx.createBufferSource();
      quelle.buffer = puffer[note.probe];
      quelle.playbackRate.value = 2 ** ((note.halbton || 0) / 12);
      const h = ctx.createGain();
      h.gain.setValueAtTime(note.pegel, zeit);
      h.gain.setValueAtTime(note.pegel, zeit + note.dauer * 0.7);
      h.gain.exponentialRampToValueAtTime(0.0001, zeit + note.dauer);
      quelle.connect(h);
      h.connect(ziel);
      quelle.start(zeit);
      quelle.stop(zeit + note.dauer + 0.02);
    }
  }, clip.schritte * RIFF_SCHRITT);
}

// Lädt nur die Töne, die dieser Clip wirklich braucht. Der Standard-Clip kostet
// damit zwei Dateien statt fünf — die übrigen kommen erst, wenn jemand sie
// tatsächlich anwählt.
async function ladeProben(ctx, clip) {
  const gebraucht = [...new Set(clip.noten.map((n) => n.probe))];
  const puffer = {};
  await Promise.all(gebraucht.map(async (schluessel) => {
    puffer[schluessel] = await ladeKlangprobe(ctx, PROBEN[schluessel]);
  }));
  return puffer;
}

const MELDUNG = {
  mikro_fehlt: 'zerrlabor_mikro_fehlt',
  probe_fehlt: 'zerrlabor_probe_fehlt',
};

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
  boxKette?.trenne();
  boxKette = null;
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
  // Box zwischen Kennlinie und Begrenzer — genau dort sitzt sie auch in echt:
  // Der Lautsprecher hört das verzerrte Signal, nicht umgekehrt. Ohne Box geht
  // es direkt weiter, damit der Vergleich „mit/ohne" nur EINE Sache ändert.
  const box = gewaehlteBox(daten);
  if (box) {
    boxKette = baueBox(ctx, box);
    kette.ausgang.connect(boxKette.eingang);
    boxKette.ausgang.connect(begrenzer.eingang);
  } else {
    kette.ausgang.connect(begrenzer.eingang);
  }

  if (zustand.quelle === 'mikro') {
    const mikro = await mikroQuelle(ctx).catch(() => null);
    if (!mikro) {
      stoppe();
      return 'mikro_fehlt';
    }
    mikroStrom = mikro.strom;
    quelleNode = mikro.knoten;
    quelleNode.connect(kette.eingang);
  } else if (zustand.quelle === 'gitarre') {
    // Ohne Netz (die Klangproben stehen bewusst nicht in der SW-Hülle) fällt das
    // Werkzeug auf das synthetische Riff zurück, statt stumm zu bleiben.
    const clip = gewaehlterClip();
    const proben = await ladeProben(ctx, clip).catch(() => null);
    if (!proben) {
      zustand.quelle = 'riff';
      quelleNode = starteRiff(ctx, kette.eingang);
      zustand.laeuft = true;
      return 'probe_fehlt';
    }
    quelleNode = starteClip(ctx, kette.eingang, clip, proben);
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
        <h2 class="abschnitt-titel">${esc(t('zerrlabor_box'))}</h2>
        <p class="chip-zeile">
          <button type="button" class="chip${zustand.box ? '' : ' chip-akzent'}" data-box="">${esc(t('zerrlabor_box_ohne'))}</button>
          ${boxen(daten)
            .map((b) => `<button type="button" class="chip${zustand.box === b.id ? ' chip-akzent' : ''}" data-box="${esc(b.id)}">${esc(t('box_' + b.id))}</button>`)
            .join(' ')}
        </p>
        <p class="leise">${esc(gewaehlteBox(daten)?.hinweis?.de || t('zerrlabor_box_hinweis'))}</p>
        <p class="leise">${esc(t('zerrlabor_box_synthese'))}</p>
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
          <button type="button" class="chip${zustand.quelle === 'gitarre' ? ' chip-akzent' : ''}" data-quelle="gitarre">${esc(t('zerrlabor_quelle_gitarre'))}</button>
          <button type="button" class="chip${zustand.quelle === 'riff' ? ' chip-akzent' : ''}" data-quelle="riff">${esc(t('zerrlabor_quelle_riff'))}</button>
          <button type="button" class="chip${zustand.quelle === 'mikro' ? ' chip-akzent' : ''}" data-quelle="mikro">${esc(t('zerrlabor_quelle_mikro'))}</button>
        </p>
        ${zustand.quelle === 'gitarre' ? `
        <p class="chip-zeile">
          ${CLIPS.map((c) => `<button type="button" class="chip${c.id === zustand.clip ? ' chip-akzent' : ''}"
            data-clip="${esc(c.id)}"${c.id === zustand.clip ? ' aria-current="true"' : ''}>${esc(t(`zerrlabor_clip_${c.id}`))}</button>`).join(' ')}
        </p>
        <p class="leise">${esc(t(`zerrlabor_clip_${gewaehlterClip().id}_text`))}</p>
        <p class="leise">${esc(t('zerrlabor_quelle_hinweis'))}</p>` : ''}
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
  for (const knopf of el.querySelectorAll('[data-box]')) {
    knopf.addEventListener('click', async () => {
      zustand.box = knopf.dataset.box || null;
      // Läuft gerade Ton, wird die Kette neu gebaut — der ConvolverNode lässt
      // sich nicht im laufenden Betrieb umhängen, ohne zu knacken.
      if (zustand.laeuft) await starte(daten);
      renderWerkzeugZerrlabor(el, daten);
      el.querySelector(`[data-box="${CSS.escape(zustand.box || '')}"]`)?.focus();
    });
  }

  for (const knopf of el.querySelectorAll('[data-clip]')) {
    knopf.addEventListener('click', async () => {
      zustand.clip = knopf.dataset.clip;
      let fehler = null;
      // Der neue Clip braucht womöglich Töne, die noch nicht geladen sind —
      // starte() holt sie nach und fällt bei Misserfolg auf das Riff zurück.
      if (zustand.laeuft) fehler = await starte(daten);
      renderWerkzeugZerrlabor(el, daten);
      const m = el.querySelector('[data-meldung]');
      if (m && fehler) m.textContent = t(MELDUNG[fehler]);
      el.querySelector(`[data-clip="${CSS.escape(zustand.clip)}"]`)?.focus();
    });
  }

  for (const knopf of el.querySelectorAll('[data-quelle]')) {
    knopf.addEventListener('click', async () => {
      zustand.quelle = knopf.dataset.quelle;
      let fehler = null;
      if (zustand.laeuft) {
        fehler = await starte(daten);
        // Mikrofon abgelehnt: starte() hat abgebaut, also zurück auf die Quelle,
        // die immer geht. Bei der Klangprobe hat starte() schon selbst
        // umgeschaltet und spielt weiter.
        if (fehler === 'mikro_fehlt') zustand.quelle = 'riff';
      }
      renderWerkzeugZerrlabor(el, daten);
      const m = el.querySelector('[data-meldung]');
      if (m && fehler) m.textContent = t(MELDUNG[fehler]);
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
    let fehler = null;
    if (zustand.laeuft) stoppe();
    else fehler = await starte(daten);
    renderWerkzeugZerrlabor(el, daten);
    // NACH dem Neuzeichnen setzen und frisch abfragen: Die vorher gemerkte
    // Referenz zeigt auf ein Element, das innerHTML gerade ersetzt hat — die
    // Meldung stand dort und war im selben Atemzug wieder weg.
    if (fehler) {
      const m = el.querySelector('[data-meldung]');
      if (m) m.textContent = t(MELDUNG[fehler]);
    }
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
