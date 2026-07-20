// Trainingsplan-Engine (Spez. 6.4, „regelbasierte Generierung"): baut aus den
// stufen-gefilterten Trainingseinheiten einen Wochenplan mit Terminen. Rein
// funktional (kein DOM); das Startdatum kommt als ISO herein und ein Zeitstempel
// wird für den iCal-Export durchgereicht — so bleibt die Erzeugung deterministisch
// und testbar (kein Date.now()).

import { trainingsuebersicht } from './pfade.js';

// n Einheiten gleichmäßig auf die Woche verteilen → n Wochentag-Offsets (0 = Mo … 6 = So).
function verteileTage(n) {
  const tage = [];
  for (let i = 0; i < n; i++) tage.push(Math.min(6, Math.floor((i * 7) / n)));
  return tage;
}

// ISO-Datum (YYYY-MM-DD) + Tage → ISO-Datum. Rechnet in UTC, um Zeitzonen-/DST-Sprünge zu meiden.
function plusTage(iso, tage) {
  const [j, m, t] = String(iso).split('-').map(Number);
  const d = new Date(Date.UTC(j, m - 1, t));
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

// Planbare Einheiten: stufen-kumulativ (aus trainingsuebersicht).
export function planbareEinheiten(daten) {
  return trainingsuebersicht(daten).map((u) => u.einheit);
}

const STANDARD = { wochen: 4, einheitenProWoche: 2 };

// Erzeugt einen Plan: rotiert die planbaren Einheiten für Abwechslung und verteilt
// sie auf Termine ab startISO. Ohne planbare Einheiten bleibt `sessions` leer.
export function erzeugePlan(daten, konfig = {}) {
  const k = { ...STANDARD, ...konfig };
  if (!k.startISO || Number.isNaN(Date.parse(k.startISO))) {
    throw new Error('erzeugePlan: gültiges startISO (YYYY-MM-DD) erforderlich');
  }
  const wochen = Math.max(1, Math.min(12, (k.wochen | 0) || STANDARD.wochen));
  const proWoche = Math.max(1, Math.min(4, (k.einheitenProWoche | 0) || STANDARD.einheitenProWoche));
  const pool = planbareEinheiten(daten).map((e) => e.id);
  const tage = verteileTage(proWoche);
  const sessions = [];
  let i = 0;
  for (let w = 0; w < wochen && pool.length > 0; w++) {
    for (let s = 0; s < proWoche; s++) {
      sessions.push({ datum: plusTage(k.startISO, w * 7 + tage[s]), einheit: pool[i % pool.length] });
      i += 1;
    }
  }
  return { startISO: k.startISO, wochen, einheitenProWoche: proWoche, sessions };
}

// Tauscht die Einheit einer Session gegen die nächste planbare (zyklisch) — macht „anpassbar".
export function tauscheEinheit(daten, plan, index) {
  const pool = planbareEinheiten(daten).map((e) => e.id);
  if (!plan.sessions[index] || pool.length <= 1) return plan;
  const aktuell = pool.indexOf(plan.sessions[index].einheit);
  const naechste = pool[(aktuell + 1 + pool.length) % pool.length];
  const sessions = plan.sessions.map((s, i) => (i === index ? { ...s, einheit: naechste } : s));
  return { ...plan, sessions };
}

// Entfernt eine Session (die Termine der übrigen bleiben, wie sie waren).
export function entferneSession(plan, index) {
  return { ...plan, sessions: plan.sessions.filter((_, i) => i !== index) };
}

// Sessions nach Wochen-Nummer gruppieren (für Anzeige/Druck), abgeleitet aus dem Datum.
export function planNachWochen(plan) {
  if (!plan || !plan.sessions.length) return [];
  const gruppen = new Map();
  for (const s of plan.sessions) {
    const woche = Math.floor(tageDifferenz(plan.startISO, s.datum) / 7) + 1;
    if (!gruppen.has(woche)) gruppen.set(woche, []);
    gruppen.get(woche).push(s);
  }
  return [...gruppen.entries()].sort((a, b) => a[0] - b[0]).map(([woche, sessions]) => ({ woche, sessions }));
}

function tageDifferenz(isoA, isoB) {
  const ms = (iso) => {
    const [j, m, t] = String(iso).split('-').map(Number);
    return Date.UTC(j, m - 1, t);
  };
  return Math.round((ms(isoB) - ms(isoA)) / 86400000);
}

function icalEscape(s) {
  return String(s == null ? '' : s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

// iCalendar-Export: eine ganztägige VEVENT je Session. `beschriftung(einheitId)` liefert
// { titel, schwerpunkt }; `jetztStempel` (YYYYMMDDTHHMMSSZ) kommt herein (kein Date.now()).
export function planAlsIcal(plan, beschriftung, jetztStempel) {
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//mosh school//Trainingsplan//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  plan.sessions.forEach((s, i) => {
    const b = beschriftung(s.einheit) || {};
    const tag = s.datum.replace(/-/g, '');
    const ende = plusTage(s.datum, 1).replace(/-/g, '');
    zeilen.push(
      'BEGIN:VEVENT',
      `UID:msh-${tag}-${i}@mosh-school`,
      `DTSTAMP:${jetztStempel}`,
      `DTSTART;VALUE=DATE:${tag}`,
      `DTEND;VALUE=DATE:${ende}`,
      `SUMMARY:${icalEscape('mosh school – ' + (b.titel || s.einheit))}`,
      `DESCRIPTION:${icalEscape(b.schwerpunkt || '')}`,
      'END:VEVENT',
    );
  });
  zeilen.push('END:VCALENDAR');
  return zeilen.join('\r\n');
}
