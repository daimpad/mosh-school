// Zerr-Kennlinien für das Zerr-Labor — themenneutral und DOM-frei wie der übrige
// Audio-Kern. Erzeugt aus einer Kennlinien-Beschreibung (data/zerrlabor-kennlinien.json)
// die Float32Array-Kurve für einen WaveShaperNode und baut daraus die Kette
// Hochpass → Shaper → Tiefpass.
//
// Warum eine Tabelle statt einer Rechnung pro Sample: Der WaveShaperNode nimmt
// ohnehin nur eine Kurve entgegen und interpoliert linear zwischen den Stützstellen.
//
// FALLSTRICK bei den harten Diodenkurven: Es wird bewusst NICHT auf die Schwelle
// normiert (kein `/s`). Genau daran hängt die Lehre des Kapitels — gleicher Gain,
// nur die Schwellspannung unterscheidet sich, also verzerrt Germanium (0,3 V) am
// stärksten und kommt am leisesten heraus, LED (1,7 V) umgekehrt. Mit Normierung
// kehrte sich die Pegelreihenfolge um. Die Sollwerte in der Datenquelle sind ohne
// Normierung gerechnet; scripts/pruefe_zerrlabor.py hält das fest.

const STUETZSTELLEN = 8192;

function clip(wert, unten, oben) {
  return Math.max(unten, Math.min(oben, wert));
}

// Liefert die reine Übertragungsfunktion y = f(x) für x in [-1, 1].
// `gainFaktor` skaliert den in der Kennlinie hinterlegten Gain (Regler im Werkzeug).
export function uebertragung(kennlinie, gainFaktor = 1) {
  const p = kennlinie.parameter || {};
  const g = (p.gain ?? 1) * gainFaktor;
  switch (kennlinie.funktion) {
    case 'linear':
      return (x) => clip(g * x, -1, 1);
    case 'tanh':
      return (x) => Math.tanh(g * x);
    case 'hard': {
      const s = p.schwelle ?? 1;
      return (x) => clip(g * x, -s, s);
    }
    case 'diode': {
      // Unterhalb der Schwelle linear, darüber mit flachem Knick weiter — das
      // Verhalten einer Diode in der Gegenkopplung: sie begrenzt weich statt abzuschneiden.
      const s = p.schwelle ?? 0.6;
      const knick = p.knick ?? 0.25;
      return (x) => {
        const v = g * x;
        const betrag = Math.abs(v);
        return betrag > s ? Math.sign(v) * (s + (betrag - s) * knick) : v;
      };
    }
    case 'asym_soft': {
      // Unterschiedlicher Gain je Halbwelle — erzeugt geradzahlige Obertöne
      // (die „röhrige" Wärme), im Gegensatz zu allen symmetrischen Kurven.
      const a = (p.gain_positiv ?? 1) * gainFaktor;
      const b = (p.gain_negativ ?? 1) * gainFaktor;
      return (x) => (x >= 0 ? Math.tanh(a * x) : Math.tanh(b * x));
    }
    case 'fuzz': {
      const haerte = p.haerte ?? 1;
      return (x) => clip(Math.tanh(4 * g * x) * haerte, -1, 1);
    }
    case 'tanh_kaskade': {
      // Mehrstufig, wie eine kaskadierte Vorstufe. Der Zwischen-Hochpass der
      // Beschreibung lässt sich in einer gedächtnislosen Kurve nicht abbilden —
      // er sitzt deshalb als echter Filter in der Kette (siehe baueKette).
      const stufen = Math.max(1, p.stufen ?? 3);
      return (x) => {
        let v = x;
        for (let i = 0; i < stufen; i++) v = Math.tanh(g * v);
        return v;
      };
    }
    case 'multiband':
      // Zwei getrennt geklippte Bänder lassen sich nicht in EINE Kurve gießen;
      // baueKette() setzt dafür zwei parallele Zweige auf. Hier nur der Notnagel,
      // damit ein versehentlicher Direktaufruf nicht still Unsinn liefert.
      return (x) => Math.tanh((p.gain_hoch ?? 1) * gainFaktor * x);
    default:
      return (x) => x;
  }
}

// Kurventabelle für den WaveShaperNode.
//
// Die Werte werden bewusst NICHT auf ±1 begrenzt: Beim WaveShaper spannt nur die
// Eingangsachse [-1, 1] auf, die Tabellenwerte sind die Ausgangswerte und dürfen
// darüber hinausgehen. Ein Deckel bei 1 hätte ausgerechnet die LED-Kennlinie
// (Schwelle 1,7) gekappt — also die, die laut Kapitel am wenigsten verzerrt und am
// lautesten herauskommt. Gemessen kam sie mit Deckel auf RMS 0,90 statt 0,135·10;
// die Pegelaussage des Kapitels wäre still falsch geworden. Den Pegel fängt der
// Begrenzer in der Ansicht ab, nicht diese Tabelle.
export function kurveFuer(kennlinie, gainFaktor = 1, stuetzstellen = STUETZSTELLEN) {
  const f = uebertragung(kennlinie, gainFaktor);
  const kurve = new Float32Array(stuetzstellen);
  for (let i = 0; i < stuetzstellen; i++) {
    const x = (i * 2) / (stuetzstellen - 1) - 1;
    const y = f(x);
    kurve[i] = Number.isFinite(y) ? y : 0;
  }
  return kurve;
}

function shaper(ctx, kennlinie, gainFaktor) {
  const node = ctx.createWaveShaper();
  node.curve = kurveFuer(kennlinie, gainFaktor);
  node.oversample = '4x'; // gegen Aliasing der harten Kurven
  return node;
}

function filter(ctx, typ, frequenz) {
  const node = ctx.createBiquadFilter();
  node.type = typ;
  node.frequency.value = frequenz;
  return node;
}

// Baut Hochpass → Kennlinie → Tiefpass und gibt Ein- und Ausgang zurück.
// `filterFaktor` verschiebt beide Eckfrequenzen (Regler im Werkzeug).
// Der Aufrufer verbindet eingang/ausgang selbst und ruft trenne() beim Abbau.
export function baueKette(ctx, kennlinie, { gainFaktor = 1, filterFaktor = 1 } = {}) {
  const p = kennlinie.parameter || {};
  const eingang = ctx.createGain();
  const ausgang = ctx.createGain();
  const knoten = [eingang, ausgang];

  let ende = eingang;
  const hp = (kennlinie.pre_hochpass_hz || 0) * filterFaktor;
  if (hp > 0) {
    const n = filter(ctx, 'highpass', hp);
    ende.connect(n);
    ende = n;
    knoten.push(n);
  }

  if (kennlinie.funktion === 'multiband') {
    // Zwei Zweige mit eigener Klippung, danach summiert: tiefe Frequenzen bleiben
    // straff, die Mitten/Höhen zerren stark. Genau das trennt Multiband-Zerre von
    // einer einzelnen Kurve, die den Bass mitmatschen lässt.
    const trenn = (p.trennfrequenz_hz ?? 250) * filterFaktor;
    const tief = filter(ctx, 'lowpass', trenn);
    const hoch = filter(ctx, 'highpass', trenn);
    const sTief = shaper(ctx, { funktion: 'tanh', parameter: { gain: p.gain_tief ?? 1 } }, gainFaktor);
    const sHoch = shaper(ctx, { funktion: 'tanh', parameter: { gain: p.gain_hoch ?? 1 } }, gainFaktor);
    const summe = ctx.createGain();
    summe.gain.value = 0.5; // zwei parallele Zweige, sonst doppelter Pegel
    ende.connect(tief); tief.connect(sTief); sTief.connect(summe);
    ende.connect(hoch); hoch.connect(sHoch); sHoch.connect(summe);
    ende = summe;
    knoten.push(tief, hoch, sTief, sHoch, summe);
  } else if (kennlinie.funktion === 'tanh_kaskade') {
    // Stufen einzeln, mit echtem Hochpass dazwischen — er strafft den Bass VOR
    // der nächsten Klippung, was eine gedächtnislose Kurve nicht leisten kann.
    const stufen = Math.max(1, p.stufen ?? 3);
    const zwischenHp = (p.zwischen_hochpass_hz || 0) * filterFaktor;
    const eine = { funktion: 'tanh', parameter: { gain: p.gain ?? 1 } };
    for (let i = 0; i < stufen; i++) {
      if (i > 0 && zwischenHp > 0) {
        const n = filter(ctx, 'highpass', zwischenHp);
        ende.connect(n);
        ende = n;
        knoten.push(n);
      }
      const s = shaper(ctx, eine, gainFaktor);
      ende.connect(s);
      ende = s;
      knoten.push(s);
    }
  } else {
    const s = shaper(ctx, kennlinie, gainFaktor);
    ende.connect(s);
    ende = s;
    knoten.push(s);
  }

  const tp = (kennlinie.post_tiefpass_hz || 0) * filterFaktor;
  if (tp > 0) {
    const n = filter(ctx, 'lowpass', Math.min(tp, ctx.sampleRate / 2 - 100));
    ende.connect(n);
    ende = n;
    knoten.push(n);
  }
  ende.connect(ausgang);

  return {
    eingang,
    ausgang,
    trenne() {
      for (const n of knoten) n.disconnect();
    },
  };
}
