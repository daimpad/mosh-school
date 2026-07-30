// Glitch-Animation des Marken-Schriftzugs im Startseiten-Hero — "kaputter
// Film", kein CSS-@keyframes: Eine Schleife mit fester Länge verrät sich nach
// zwei Durchläufen als Muster, ein kaputter Film ist nicht periodisch. Ein
// Ausbruch-Scheduler würfelt Sorte/Länge/Stärke jedes Ausbruchs aus,
// dazwischen ist bewusst Ruhe. Pro Frame werden ausschließlich CSS-Variablen
// gesetzt (kein Layout-Thrash) — das Zeichnen bleibt beim Compositor.
//
// Werte + Aufbau stammen 1:1 aus dem abgestimmten Mockup
// (mockups/hero-glitch.html); hier fest verdrahtet, keine Regler in der App.
//
// Markup-Erwartung (siehe js/genre-inszenierung.js `markeHeroInszeniert`):
//   <span class="zerr-wort" aria-label="ZERRER">
//     <span class="zerr-basis" aria-hidden="true">ZERRER</span>
//   </span>
// `.zerr-basis` bleibt ohne JS/bei reduzierter Bewegung sichtbar (normales,
// unbewegtes Wort) — die Animation ist eine reine Erweiterung obendrauf, kein
// Ersatz für die statische Darstellung.

import { registriereAufraeumen } from './oberflaeche.js';

const INTENSITAET = 0.32;
const TEMPO = 0.63;
const VERZERRUNG = 1;
const BEWEGUNG = 0.02;
const UNSCHAERFE = 0;
const BAENDER = 2;
const FARBVERSATZ = 0.99;
const FARBSTAERKE = 1;
// Palette "marke" aus dem Mockup: Stahlblau + Blutrot statt des klassischen
// Cyan/Rot-Kamera-Splits — bleibt im Marken-Farbraum.
const FARBE_A = '#7ea8c4';
const FARBE_B = '#cc2418';

const SORTEN = ['riss', 'versatz', 'aussetzer', 'zittern'];
const zufall = (a, b) => a + Math.random() * (b - a);
const wuerfel = (n) => Math.floor(Math.random() * n);

// Baut Chroma-Geister + Bänder in `wort` und startet den Ausbruch-Scheduler.
// Bricht früh ab (Basis bleibt sichtbar) ohne `.zerr-basis`, ohne
// requestAnimationFrame oder bei `prefers-reduced-motion: reduce`.
export function initHeroGlitch(wort) {
  if (!wort) return;
  const basis = wort.querySelector('.zerr-basis');
  if (!basis) return;
  if (typeof requestAnimationFrame !== 'function') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  wort.classList.add('zerr-aktiv');
  const text = basis.textContent;

  const mach = (klasse) => {
    const el = document.createElement('span');
    el.className = 'zerr-lage ' + klasse;
    el.setAttribute('aria-hidden', 'true');
    el.textContent = text;
    wort.appendChild(el);
    return el;
  };

  const chromaA = mach('zerr-chroma zerr-chroma-a');
  const chromaB = mach('zerr-chroma zerr-chroma-b');
  chromaA.style.setProperty('--zerr-farbe-a', FARBE_A);
  chromaB.style.setProperty('--zerr-farbe-b', FARBE_B);
  wort.style.setProperty('--zerr-farbstaerke', String(FARBSTAERKE));

  const scheiben = [];
  for (let i = 0; i < BAENDER; i++) {
    const el = mach('zerr-scheibe');
    el.style.setProperty('--o', (i / BAENDER * 100).toFixed(3) + '%');
    el.style.setProperty('--u', ((BAENDER - i - 1) / BAENDER * 100).toFixed(3) + '%');
    scheiben.push(el);
  }

  let ausbruch = null;
  let naechsterAb = 0;
  let laeuft = true;
  let sichtbar = true;
  let frameHandle = null;

  function planeNaechsten(jetzt) {
    // Tempo 0 -> ~8s Pause, Tempo 1 -> ~0.12s, exponentiell (siehe Mockup).
    const basisPause = 8000 * Math.pow(0.015, TEMPO);
    naechsterAb = jetzt + zufall(basisPause * 0.45, basisPause * 1.55);
  }

  function starteAusbruch(jetzt) {
    const sorte = SORTEN[wuerfel(SORTEN.length)];
    const dauer = sorte === 'zittern' ? zufall(260, 620)
      : sorte === 'aussetzer' ? zufall(45, 130)
        : zufall(70, 240);
    ausbruch = { sorte, start: jetzt, dauer, staerke: zufall(0.55, 1) };
  }

  function frame(jetzt) {
    if (!laeuft || !sichtbar) {
      frameHandle = null;
      return;
    }
    const I = INTENSITAET;
    if (!ausbruch && jetzt >= naechsterAb) {
      starteAusbruch(jetzt);
      planeNaechsten(jetzt);
    }

    // Ruhe: die Farbauszüge atmen minimal, damit das Wort nicht wie ein
    // Standbild wirkt.
    const atem = Math.sin(jetzt / 1400) * 0.5 + 0.5;
    let split = (1 + atem * 1.6) * FARBVERSATZ * I * 3;
    let wortX = 0;
    let wortY = 0;
    let neigung = 0;
    let stauchung = 1;
    let blur = 0;
    let deckkraft = 1;
    let bandVersatz = 0;
    let bandAnteil = 0;
    let bandY = 0;

    if (ausbruch) {
      const t = (jetzt - ausbruch.start) / ausbruch.dauer;
      if (t >= 1) {
        ausbruch = null;
      } else {
        // Harter Einsatz, schnelles Abklingen — wie ein Bandsprung.
        const h = Math.pow(1 - t, 1.6) * ausbruch.staerke * I;
        const sorte = ausbruch.sorte;
        if (sorte === 'riss') {
          bandVersatz = VERZERRUNG * h * 14;
          bandAnteil = 0.35 + h * 0.4;
          bandY = BEWEGUNG * h * 6;
          split += FARBVERSATZ * h * 26;
          blur = UNSCHAERFE * h * 2.2;
        } else if (sorte === 'versatz') {
          wortX = (Math.random() < 0.5 ? -1 : 1) * BEWEGUNG * h * 26;
          split += FARBVERSATZ * h * 40;
          neigung = (Math.random() < 0.5 ? -1 : 1) * BEWEGUNG * h * 5;
          blur = UNSCHAERFE * h * 3;
          bandVersatz = VERZERRUNG * h * 5;
          bandAnteil = 0.2;
        } else if (sorte === 'aussetzer') {
          deckkraft = 1 - h * 0.92;
          wortY = BEWEGUNG * h * 10;
          stauchung = 1 - h * 0.12;
          split += FARBVERSATZ * h * 18;
          blur = UNSCHAERFE * h * 4;
        } else {
          // zittern
          const f = Math.sin(jetzt / 18) * Math.sin(jetzt / 7.3);
          wortX = f * BEWEGUNG * h * 7;
          wortY = Math.sin(jetzt / 11) * BEWEGUNG * h * 4;
          split += FARBVERSATZ * h * 12;
          bandVersatz = VERZERRUNG * h * 4;
          bandAnteil = 0.5;
          blur = UNSCHAERFE * h * 1.2;
        }
      }
    }

    wort.style.setProperty('--zerr-x', wortX.toFixed(2) + 'px');
    wort.style.setProperty('--zerr-y', wortY.toFixed(2) + 'px');
    wort.style.setProperty('--zerr-neigung', neigung.toFixed(2) + 'deg');
    wort.style.setProperty('--zerr-stauchung', stauchung.toFixed(3));
    wort.style.setProperty('--zerr-blur', blur.toFixed(2) + 'px');
    wort.style.setProperty('--zerr-deckkraft', deckkraft.toFixed(3));
    wort.style.setProperty('--zerr-split', split.toFixed(2) + 'px');

    for (const el of scheiben) {
      let dx = 0;
      let dy = 0;
      let sop = 1;
      if (bandVersatz > 0 && Math.random() < bandAnteil) {
        dx = zufall(-bandVersatz, bandVersatz);
        dy = zufall(-bandY, bandY);
        if (Math.random() < 0.12) sop = zufall(0.2, 0.8);
      }
      el.style.setProperty('--dx', dx.toFixed(2) + '%');
      el.style.setProperty('--dy', dy.toFixed(2) + 'px');
      el.style.setProperty('--sop', sop.toFixed(2));
    }

    frameHandle = requestAnimationFrame(frame);
  }

  planeNaechsten(performance.now());
  frameHandle = requestAnimationFrame(frame);

  // Pausiert, sobald der Hero aus dem Sichtfeld scrollt — sonst läuft die
  // Schleife sinnlos im Hintergrund weiter und kostet Akku.
  let beobachter = null;
  if ('IntersectionObserver' in window) {
    beobachter = new IntersectionObserver(
      (eintraege) => {
        sichtbar = eintraege[0].isIntersecting;
        if (sichtbar && laeuft && frameHandle === null) frameHandle = requestAnimationFrame(frame);
      },
      { threshold: 0 },
    );
    beobachter.observe(wort);
  }

  registriereAufraeumen(() => {
    laeuft = false;
    if (frameHandle !== null) cancelAnimationFrame(frameHandle);
    beobachter?.disconnect();
  });
}
