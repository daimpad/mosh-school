// Abstrakte Geräte-Grafiken für die Gear-Werkzeuge: monochrome Inline-SVGs
// (currentColor, wie die Baustein-Grafiken) für Pedale, Amps und Boxen. Rein
// deterministisch aus den Geräte-Attributen erzeugt — kein Asset, kein Zufall.
// Themenneutral hier zu halten wäre Overkill (es ist Gear); die Werkzeuge rufen
// die Generatoren beim Rendern auf. Wirken nur inline (Maskerade via currentColor).

// Ein Regler: Kreis mit Zeiger (Winkel variiert je Index → lebendiger).
function knopf(cx, cy, i = 0, r = 5) {
  const a = -2.5 + (i % 5) * 0.5;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="1.6"/><line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * r).toFixed(1)}" y2="${(cy + Math.sin(a) * r).toFixed(1)}" stroke-width="1.4"/>`;
}
function svg(viewBox, klasse, inner) {
  return `<svg class="${klasse}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// --- Pedal -----------------------------------------------------------------
// Typ-Profil je Pedal-ID: Anzahl Regler bzw. Sonderform (Wah-Wippe, Tuner-
// Display, EQ-Schieber). Unbekannte IDs bekommen 3 Regler (generischer Tret-Effekt).
const PEDAL_TYP = {
  tuner: { display: true },
  kompressor: { knoepfe: 3 },
  wah: { wippe: true },
  boost: { knoepfe: 1 },
  overdrive: { knoepfe: 3 },
  bass_overdrive: { knoepfe: 4 },
  distortion: { knoepfe: 3 },
  fuzz: { knoepfe: 2 },
  noise_gate: { knoepfe: 2 },
  eq: { schieber: 5 },
  bass_preamp_di: { knoepfe: 4 },
  chorus: { knoepfe: 3 },
  delay: { knoepfe: 3 },
  reverb: { knoepfe: 3 },
};

export function pedalGrafik(pedal, klasse = 'geraet-grafik pedal-grafik') {
  const typ = PEDAL_TYP[pedal?.id] || { knoepfe: 3 };
  const gehaeuse = `<rect x="6" y="5" width="52" height="78" rx="5" stroke-width="2"/>`;
  const jacks = `<rect x="1" y="26" width="6" height="9" rx="1.5" stroke-width="1.4"/><rect x="57" y="26" width="6" height="9" rx="1.5" stroke-width="1.4"/>`;
  const led = `<circle cx="32" cy="13" r="2.3" fill="currentColor" stroke="none"/>`;
  const fussschalter = `<circle cx="32" cy="66" r="7" stroke-width="2"/><circle cx="32" cy="66" r="2" fill="currentColor" stroke="none"/>`;
  let oben = '';
  if (typ.wippe) {
    // Wah: schräge Trittwippe statt Regler.
    oben = `<polygon points="12,40 52,20 52,40 12,52" stroke-width="2"/><line x1="16" y1="43" x2="48" y2="27" stroke-width="1.2"/>`;
    return svg('0 0 64 88', klasse, `${gehaeuse}${jacks}${led}${oben}${fussschalter}`);
  }
  if (typ.display) {
    // Tuner: Anzeige mit Nadel.
    oben = `<rect x="15" y="22" width="34" height="16" rx="2" stroke-width="1.6"/><line x1="32" y1="37" x2="36" y2="24" stroke-width="1.6"/><circle cx="21" cy="34" r="1.2" fill="currentColor" stroke="none"/><circle cx="43" cy="34" r="1.2" fill="currentColor" stroke="none"/>`;
    return svg('0 0 64 88', klasse, `${gehaeuse}${jacks}${led}${oben}${fussschalter}`);
  }
  if (typ.schieber) {
    // EQ: senkrechte Schieberegler.
    const n = typ.schieber;
    const von = 16;
    const bis = 48;
    const schritt = (bis - von) / (n - 1);
    oben = Array.from({ length: n }, (_, i) => {
      const x = von + i * schritt;
      const ny = 22 + ((i * 37) % 20);
      return `<line x1="${x}" y1="20" x2="${x}" y2="44" stroke-width="1.3"/><rect x="${x - 3}" y="${ny}" width="6" height="5" rx="1" fill="currentColor" stroke="none"/>`;
    }).join('');
    return svg('0 0 64 88', klasse, `${gehaeuse}${jacks}${led}${oben}${fussschalter}`);
  }
  // Regler-Effekte: n Regler quer oben.
  const n = typ.knoepfe || 3;
  const von = n === 1 ? 32 : 17;
  const bis = 47;
  const schritt = n === 1 ? 0 : (bis - von) / (n - 1);
  oben = Array.from({ length: n }, (_, i) => knopf(von + i * schritt, 30, i)).join('');
  return svg('0 0 64 88', klasse, `${gehaeuse}${jacks}${led}${oben}${fussschalter}`);
}

// --- Amp -------------------------------------------------------------------
// Topteil = nur der Kopf (Box separat); Combo = Kopf + eingebaute Box mit
// Lautsprecher. Röhre bekommt glühende Röhren als Andeutung.
export function ampGrafik(bauartId, formatId, klasse = 'geraet-grafik amp-grafik') {
  const kopf = `<rect x="6" y="8" width="116" height="30" rx="3" stroke-width="2"/><rect x="12" y="12" width="104" height="11" rx="1.5" stroke-width="1.2"/>`;
  const regler = Array.from({ length: 6 }, (_, i) => knopf(24 + i * 16, 17.5, i, 3.4)).join('');
  const roehren = bauartId === 'roehre'
    ? Array.from({ length: 4 }, (_, i) => `<circle cx="${40 + i * 16}" cy="32" r="2.4" fill="currentColor" stroke="none" opacity="0.85"/>`).join('')
    : '';
  const marke = `<line x1="12" y1="30" x2="30" y2="30" stroke-width="1.2" opacity="0.6"/>`;
  if (formatId === 'combo') {
    // Combo: Kopf oben, Grille + Lautsprecher darunter.
    const grille = `<rect x="6" y="40" width="116" height="30" rx="3" stroke-width="2"/>`;
    const gitter = Array.from({ length: 9 }, (_, i) => `<line x1="${14 + i * 12}" y1="44" x2="${14 + i * 12}" y2="66" stroke-width="0.8" opacity="0.5"/>`).join('');
    const lsp = `<circle cx="64" cy="55" r="12" stroke-width="1.8"/><circle cx="64" cy="55" r="4" stroke-width="1.4"/>`;
    return svg('0 0 128 76', klasse, `${kopf}${regler}${marke}${roehren}${grille}${gitter}${lsp}`);
  }
  // Topteil: nur Kopf, mit Füßchen.
  const fuesse = `<line x1="16" y1="38" x2="16" y2="42" stroke-width="1.4"/><line x1="112" y1="38" x2="112" y2="42" stroke-width="1.4"/>`;
  return svg('0 0 128 52', klasse, `${kopf}${regler}${marke}${roehren}${fuesse}`);
}

// --- Box (Lautsprecher-Cabinet) --------------------------------------------
// Lautsprecher-Anzahl aus der Bestückungs-ID (z. B. „4x12" → 4, „8x10" → 8),
// in ein sinnvolles Raster gelegt; jeder Lautsprecher als konzentrische Kreise.
export function boxGrafik(bestueckungId, klasse = 'geraet-grafik box-grafik') {
  const anzahl = Math.max(1, parseInt(bestueckungId, 10) || 1);
  let spalten;
  if (anzahl === 1) spalten = 1;
  else if (anzahl === 2) spalten = 2;
  else if (anzahl <= 4) spalten = 2;
  else spalten = Math.ceil(Math.sqrt(anzahl));
  const reihen = Math.ceil(anzahl / spalten);
  const rand = 12;
  const W = 96;
  const H = 96;
  const feldB = (W - 2 * rand) / spalten;
  const feldH = (H - 2 * rand) / reihen;
  const r = Math.min(feldB, feldH) * 0.42;
  let lsp = '';
  for (let i = 0; i < anzahl; i++) {
    const c = i % spalten;
    const rr = Math.floor(i / spalten);
    const cx = rand + feldB * (c + 0.5);
    const cy = rand + feldH * (rr + 0.5);
    lsp += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" stroke-width="1.8"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * 0.34).toFixed(1)}" stroke-width="1.3"/>`;
  }
  const gehaeuse = `<rect x="4" y="4" width="88" height="88" rx="3" stroke-width="2"/><rect x="8" y="8" width="80" height="80" rx="2" stroke-width="0.8" opacity="0.5"/>`;
  return svg('0 0 96 96', klasse, `${gehaeuse}${lsp}`);
}
