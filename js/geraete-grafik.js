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

// L-förmige Eckenschützer an einem Rechteck (x0,y0)-(x1,y1) — typisches
// Gehäuse-Detail bei Amps/Boxen. Deterministisch, currentColor.
function eckSchutz(x0, y0, x1, y1, d = 8) {
  const l = (x, y, sx, sy) => `<path d="M${x + sx * d},${y} L${x},${y} L${x},${y + sy * d}" stroke-width="1.6"/>`;
  return l(x0, y0, 1, 1) + l(x1, y0, -1, 1) + l(x0, y1, 1, -1) + l(x1, y1, -1, -1);
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
  // Gehäuse mit innerer Kante (gefräste Fläche) und vier Eckschrauben.
  const gehaeuse = `<rect x="6" y="5" width="52" height="78" rx="5" stroke-width="2"/><rect x="9.5" y="8.5" width="45" height="71" rx="3.5" stroke-width="0.8" opacity="0.45"/>`;
  const schrauben = [[12, 11], [52, 11], [12, 77], [52, 77]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" stroke-width="1"/><line x1="${x - 1.1}" y1="${y}" x2="${x + 1.1}" y2="${y}" stroke-width="0.8"/>`)
    .join('');
  const jacks = `<rect x="1" y="26" width="6" height="9" rx="1.5" stroke-width="1.4"/><rect x="57" y="26" width="6" height="9" rx="1.5" stroke-width="1.4"/>`;
  // Status-LED mit Fassung.
  const led = `<circle cx="32" cy="13" r="3.3" stroke-width="1"/><circle cx="32" cy="13" r="2.1" fill="currentColor" stroke="none"/>`;
  // Fußschalter mit Überwurfmutter (Ring).
  const fussschalter = `<circle cx="32" cy="66" r="8.2" stroke-width="1" opacity="0.55"/><circle cx="32" cy="66" r="7" stroke-width="2"/><circle cx="32" cy="66" r="2" fill="currentColor" stroke="none"/>`;
  const rumpf = `${gehaeuse}${schrauben}${jacks}${led}`;
  let oben = '';
  if (typ.wippe) {
    // Wah: schräge Trittwippe statt Regler, mit Riffelung.
    oben = `<polygon points="12,40 52,20 52,40 12,52" stroke-width="2"/><line x1="16" y1="43" x2="48" y2="27" stroke-width="1.2"/><line x1="18" y1="46" x2="46" y2="30" stroke-width="0.8" opacity="0.6"/><line x1="20" y1="49" x2="44" y2="33" stroke-width="0.8" opacity="0.6"/>`;
    return svg('0 0 64 88', klasse, `${rumpf}${oben}${fussschalter}`);
  }
  if (typ.display) {
    // Tuner: Anzeige mit Nadel + Skala.
    oben = `<rect x="15" y="22" width="34" height="16" rx="2" stroke-width="1.6"/><line x1="20" y1="25" x2="20" y2="27" stroke-width="0.8" opacity="0.6"/><line x1="32" y1="24" x2="32" y2="27" stroke-width="0.8" opacity="0.7"/><line x1="44" y1="25" x2="44" y2="27" stroke-width="0.8" opacity="0.6"/><line x1="32" y1="37" x2="36" y2="26" stroke-width="1.6"/><circle cx="21" cy="34" r="1.2" fill="currentColor" stroke="none"/><circle cx="43" cy="34" r="1.2" fill="currentColor" stroke="none"/>`;
    return svg('0 0 64 88', klasse, `${rumpf}${oben}${fussschalter}`);
  }
  if (typ.schieber) {
    // EQ: senkrechte Schieberegler mit Rasterung.
    const n = typ.schieber;
    const von = 16;
    const bis = 48;
    const schritt = (bis - von) / (n - 1);
    oben = Array.from({ length: n }, (_, i) => {
      const x = von + i * schritt;
      const ny = 22 + ((i * 37) % 20);
      const raster = [24, 30, 36, 42].map((ry) => `<line x1="${x - 1.4}" y1="${ry}" x2="${x + 1.4}" y2="${ry}" stroke-width="0.6" opacity="0.4"/>`).join('');
      return `<line x1="${x}" y1="20" x2="${x}" y2="44" stroke-width="1.3"/>${raster}<rect x="${x - 3}" y="${ny}" width="6" height="5" rx="1" fill="currentColor" stroke="none"/>`;
    }).join('');
    return svg('0 0 64 88', klasse, `${rumpf}${oben}${fussschalter}`);
  }
  // Regler-Effekte: n Regler quer oben, jeder mit Skalen-Bogen; darunter ein
  // Typenschild als abstrakte Marke.
  const n = typ.knoepfe || 3;
  const von = n === 1 ? 32 : 17;
  const bis = 47;
  const schritt = n === 1 ? 0 : (bis - von) / (n - 1);
  oben = Array.from({ length: n }, (_, i) => {
    const cx = von + i * schritt;
    return `${knopf(cx, 29, i)}<path d="M${(cx - 7).toFixed(1)},33 A7,7 0 0 0 ${(cx + 7).toFixed(1)},33" stroke-width="0.7" opacity="0.5"/>`;
  }).join('');
  const schild = `<rect x="16" y="45" width="32" height="9" rx="1.5" stroke-width="1"/><line x1="20" y1="49" x2="44" y2="49" stroke-width="0.7" opacity="0.5"/><line x1="20" y1="51.5" x2="38" y2="51.5" stroke-width="0.7" opacity="0.4"/>`;
  return svg('0 0 64 88', klasse, `${rumpf}${oben}${schild}${fussschalter}`);
}

// --- Amp -------------------------------------------------------------------
// Topteil = nur der Kopf (Box separat); Combo = Kopf + eingebaute Box mit
// Lautsprecher. Röhre bekommt glühende Röhren als Andeutung.
export function ampGrafik(bauartId, formatId, klasse = 'geraet-grafik amp-grafik') {
  const kopf = `<rect x="6" y="8" width="116" height="30" rx="3" stroke-width="2"/><rect x="12" y="12" width="104" height="11" rx="1.5" stroke-width="1.2"/>`;
  // Tragegriff oben.
  const griff = `<rect x="50" y="2.5" width="28" height="4.5" rx="2.2" stroke-width="1.4"/><line x1="52" y1="7" x2="52" y2="8" stroke-width="1.2"/><line x1="76" y1="7" x2="76" y2="8" stroke-width="1.2"/>`;
  const regler = Array.from({ length: 6 }, (_, i) => knopf(22 + i * 15, 17.5, i, 3.4)).join('');
  // Eingangsbuchse links, Betriebs-Jewel rechts auf dem Bedienfeld.
  const eingang = `<circle cx="13" cy="17.5" r="2.2" stroke-width="1.3"/><circle cx="13" cy="17.5" r="0.9" fill="currentColor" stroke="none"/>`;
  const jewel = `<circle cx="112.5" cy="17.5" r="2.8" stroke-width="1"/><circle cx="112.5" cy="17.5" r="1.3" fill="currentColor" stroke="none"/>`;
  const roehren = bauartId === 'roehre'
    ? Array.from({ length: 4 }, (_, i) => `<circle cx="${40 + i * 16}" cy="32" r="2.4" fill="currentColor" stroke="none" opacity="0.85"/><circle cx="${40 + i * 16}" cy="32" r="3.4" stroke-width="0.7" opacity="0.5"/>`).join('')
    : '';
  const marke = `<line x1="12" y1="30" x2="30" y2="30" stroke-width="1.2" opacity="0.6"/><line x1="12" y1="32.5" x2="24" y2="32.5" stroke-width="0.9" opacity="0.4"/>`;
  if (formatId === 'combo') {
    // Combo: Kopf oben, bespannte Grille + Lautsprecher darunter, Eckenschützer
    // ums ganze Gehäuse.
    const grille = `<rect x="6" y="40" width="116" height="30" rx="3" stroke-width="2"/><rect x="10" y="43" width="108" height="24" rx="2" stroke-width="0.7" opacity="0.45"/>`;
    const gitter = Array.from({ length: 9 }, (_, i) => `<line x1="${14 + i * 12}" y1="44" x2="${14 + i * 12}" y2="66" stroke-width="0.8" opacity="0.5"/>`).join('');
    const lsp = `<circle cx="64" cy="55" r="12" stroke-width="1.8"/><circle cx="64" cy="55" r="8" stroke-width="0.8" opacity="0.5"/><circle cx="64" cy="55" r="4" stroke-width="1.4"/>`;
    const ecken = eckSchutz(6, 8, 122, 70, 7);
    return svg('0 0 128 76', klasse, `${griff}${kopf}${eingang}${regler}${jewel}${marke}${roehren}${grille}${gitter}${lsp}${ecken}`);
  }
  // Topteil: nur Kopf, mit Füßchen und Eckenschützern.
  const fuesse = `<line x1="16" y1="38" x2="16" y2="42" stroke-width="1.4"/><line x1="112" y1="38" x2="112" y2="42" stroke-width="1.4"/>`;
  const ecken = eckSchutz(6, 8, 122, 38, 6);
  return svg('0 0 128 52', klasse, `${griff}${kopf}${eingang}${regler}${jewel}${marke}${roehren}${ecken}${fuesse}`);
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
