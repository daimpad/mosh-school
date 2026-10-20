// Audio-Kern (themenneutral, DOM-frei): Klangbeispiele — kurze Hörbeispiele
// neben Bausteinen (Gesangstechniken, Gitarrentechniken, Bühne und Proberaum).
//
// Anders als die Sample-Bank (samples.js) sind das keine Stimmen, die im Takt
// gespielt werden, sondern einzelne Aufnahmen zum Anhören. Daraus folgen drei
// Unterschiede:
// - AUSGELIEFERT WIRD DIE ROHDATEI (MP3, wie ElevenLabs sie liefert), nicht ein
//   aufbereitetes WAV. Der Encoder-Vorlauf des MP3, der im Groove ein Schleppfehler
//   wäre, ist hier egal; als WAV wäre der Bestand dreimal so schwer.
// - AUSSCHNITT UND PEGEL STEHEN HIER, nicht im Generator: `ab`/`dauer` schneiden
//   beim Abspielen, `pegel` gleicht die Lautheit an (gemessen mit
//   `node scripts/build_samples.mjs --beispiele`, lautestes 50-ms-Fenster).
// - GELADEN WIRD ERST BEIM KLICK, nicht beim Erzeugen des Kontexts — die meisten
//   Seiten brauchen kein einziges Beispiel.
// Herkunft und Prompts: scripts/samples_quelle/quellen.json (Schlüssel
// `beispiele/<datei>`), Labels unter vokabeln.klangbeispiel in de.json.

import { ladeKlangprobe } from './klangprobe.js';

const ORDNER = 'assets/sounds/beispiele/';

export const BEISPIELE = {
  growl_tief: { datei: 'growl-tief.mp3', ab: 0, dauer: 1.68, pegel: 0.5 },
  growl_rau: { datei: 'growl-rau.mp3', ab: 0, dauer: 1.45, pegel: 0.74 },
  guttural: { datei: 'guttural.mp3', ab: 0, dauer: 1.81, pegel: 0.95 },
  fry_scream: { datei: 'fry-scream.mp3', ab: 0.05, dauer: 1.6, pegel: 0.47 },
  false_cord: { datei: 'false-cord.mp3', ab: 0, dauer: 1.64, pegel: 0.67 },
  high_scream: { datei: 'high-scream.mp3', ab: 0.04, dauer: 1.8, pegel: 0.48 },
  hardcore_shout: { datei: 'hardcore-shout.mp3', ab: 0.87, dauer: 1.08, pegel: 0.65 },
  clean_ton_tief: { datei: 'clean-ton-m.mp3', ab: 0, dauer: 1.83, pegel: 1.73 },
  clean_ton_hoch: { datei: 'clean-ton-w.mp3', ab: 0, dauer: 1.81, pegel: 3.63 },
  vocal_fry: { datei: 'vocal-fry.mp3', ab: 0.13, dauer: 1.72, pegel: 10.71 },
  zischen: { datei: 'zischen.mp3', ab: 11.35, dauer: 4.2, pegel: 4.85 },
  lippenflattern: { datei: 'lippenflattern.mp3', ab: 0.23, dauer: 1.4, pegel: 0.5 },
  kopfstimme: { datei: 'kopfstimme.mp3', ab: 0.05, dauer: 0.85, pegel: 0.62 },
  belting: { datei: 'belting.mp3', ab: 0, dauer: 2.25, pegel: 0.69 },
  vibrato_ton: { datei: 'vibrato-ton.mp3', ab: 0, dauer: 2.6, pegel: 3.28 },
  doom_clean: { datei: 'doom-clean.mp3', ab: 0, dauer: 2.45, pegel: 0.51 },
  gang_shout: { datei: 'gang-shout.mp3', ab: 0, dauer: 0.4, pegel: 0.37 },
  publikum_club: { datei: 'publikum-club.mp3', ab: 0, dauer: 4, pegel: 0.47 },
  moshpit: { datei: 'moshpit.mp3', ab: 0, dauer: 4, pegel: 0.23 },
  raumton_club: { datei: 'raumton-club.mp3', ab: 0, dauer: 4, pegel: 22.79 },
  pa_feedback: { datei: 'pa-feedback.mp3', ab: 0, dauer: 1, pegel: 0.2 },
  kabel_knacken: { datei: 'kabel-knacken.mp3', ab: 0, dauer: 1.48, pegel: 1.2 },
  soundcheck: { datei: 'soundcheck.mp3', ab: 0, dauer: 2.37, pegel: 1.16 },
  pinch_harmonic: { datei: 'pinch-harmonic.mp3', ab: 0, dauer: 1.6, pegel: 0.57 },
  dive_bomb: { datei: 'dive-bomb.mp3', ab: 0, dauer: 2.48, pegel: 0.32 },
  gitarre_feedback: { datei: 'gitarre-feedback.mp3', ab: 0, dauer: 3, pegel: 0.72 },
  gitarre_vibrato: { datei: 'gitarre-vibrato.mp3', ab: 1.5, dauer: 1.0, pegel: 0.5 },
  bend_auf: { datei: 'bend-auf.mp3', ab: 0.97, dauer: 1.15, pegel: 0.52 },
  slide_auf: { datei: 'slide-auf.mp3', ab: 0, dauer: 1.38, pegel: 0.34 },
  flageolett: { datei: 'flageolett.mp3', ab: 0, dauer: 1.7, pegel: 2.76 },
  einatmen: { datei: 'einatmen.mp3', ab: 0, dauer: 2.7, pegel: 5.26 },
  amp_brummen: { datei: 'amp-brummen.mp3', ab: 0, dauer: 4.0, pegel: 0.7 },
  slide_ab: { datei: 'slide-ab.mp3', ab: 0, dauer: 2, pegel: 0.41 },
};

export const beispielUrl = (name) => ORDNER + BEISPIELE[name].datei;

// Spielt ein Beispiel einmal an `ziel`. Gibt ein Handle zurück: `ende` (Promise,
// erfüllt beim natürlichen Ende oder nach stop()) und `stop()`. Ladefehler
// (offline ohne Cache) werden NICHT geschluckt — die Ansicht sagt es dann.
export async function spieleBeispiel(ctx, ziel, name) {
  const b = BEISPIELE[name];
  if (!b) throw new Error(`Klangbeispiel ${name} unbekannt`);
  const puffer = await ladeKlangprobe(ctx, beispielUrl(name));
  const jetzt = ctx.currentTime + 0.02;
  const dauer = Math.min(b.dauer, puffer.duration - b.ab);
  const quelle = ctx.createBufferSource();
  quelle.buffer = puffer;
  // Unter allen Rohdateien liegt ein Rumpeln unter 30 Hz — nichts davon ist Inhalt.
  const hochpass = ctx.createBiquadFilter();
  hochpass.type = 'highpass';
  hochpass.frequency.value = 40;
  const huelle = ctx.createGain();
  huelle.gain.setValueAtTime(0.0001, jetzt);
  huelle.gain.exponentialRampToValueAtTime(b.pegel, jetzt + 0.01);
  huelle.gain.setValueAtTime(b.pegel, jetzt + dauer - 0.08);
  huelle.gain.exponentialRampToValueAtTime(0.0001, jetzt + dauer);
  quelle.connect(hochpass).connect(huelle).connect(ziel);
  quelle.start(jetzt, b.ab, dauer);
  const ende = new Promise((fertig) => quelle.addEventListener('ended', fertig, { once: true }));
  return {
    ende,
    stop() {
      try {
        quelle.stop();
      } catch {
        /* schon beendet */
      }
    },
  };
}
