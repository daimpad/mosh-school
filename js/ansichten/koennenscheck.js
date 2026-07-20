// Könnens-Check: eine Selbsteinschätzung je Könnensstufe. Referenzbereich wie das
// Stimmungs-Werkzeug — NICHT im Baustein-Pool, kein gespeicherter Fortschritt.
// Die Daten (instrumentneutrale Leitplanken über Domänen hinweg) liegen in
// data/turnierregeln.json: Kategorien bündeln Anforderungen; jede Anforderung
// trägt je Stufe entweder Pflicht („solltest du können") oder Empfehlung
// („übe darauf hin") plus einen stufengerechten Beschreibungstext.
//
// Zustand ist flüchtig und gerätelokal (Modul-State wie in Suche/Stimmungen):
// gewählte Stufe und die abgehakten Punkte überleben ein Neu-Rendern, aber
// keinen Reload — es ist bewusst kein Fortschritt, nur eine Standort-Bestimmung.

import { label, t, text } from '../i18n.js';
import { esc } from '../oberflaeche.js';

const STUFEN_REIHENFOLGE = ['einsteiger', 'fortgeschritten', 'experte'];
let aktiveStufe = 'einsteiger';
// Abgehakte Anforderungen je Stufe (flüchtig): { <stufe>: Set<anforderungId> }.
const abgehakt = {};

function stufenListe(werkzeug) {
  const vorhandene = new Set((werkzeug.stufen || []).map((s) => s.id));
  return STUFEN_REIHENFOLGE.filter((id) => vorhandene.has(id));
}

// Anforderungen der gewählten Stufe, gruppiert nach Kategorie (in Kategorie-
// Reihenfolge). Nur Anforderungen mit einem Wert für diese Stufe erscheinen.
function proKategorie(werkzeug, stufe) {
  return (werkzeug.kategorien || [])
    .map((kat) => ({
      kat,
      posten: (werkzeug.anforderungen || []).filter((a) => a.kategorie === kat.id && a.werte?.[stufe]),
    }))
    .filter((gruppe) => gruppe.posten.length > 0);
}

function zaehleGesamt(werkzeug, stufe) {
  return (werkzeug.anforderungen || []).filter((a) => a.werte?.[stufe]).length;
}

export function renderKoennenscheck(el, daten) {
  const werkzeug = daten.turnierregeln || { stufen: [], kategorien: [], anforderungen: [] };
  const stufen = stufenListe(werkzeug);
  if (!stufen.includes(aktiveStufe)) aktiveStufe = stufen[0] || 'einsteiger';
  if (!abgehakt[aktiveStufe]) abgehakt[aktiveStufe] = new Set();
  const gehakt = abgehakt[aktiveStufe];

  const stufenKnoepfe = stufen
    .map(
      (s) => `
      <button type="button" class="chip chip-waehlbar ${s === aktiveStufe ? 'chip-akzent' : ''}" data-stufe="${esc(s)}" aria-pressed="${s === aktiveStufe}">
        ${esc(label('kompetenzstufe', s))}
      </button>`
    )
    .join(' ');

  const gruppen = proKategorie(werkzeug, aktiveStufe);
  const gesamt = zaehleGesamt(werkzeug, aktiveStufe);

  // Eine Kategorie als <fieldset>: Legende + abhakbare Posten. Jeder Posten ist
  // eine echte Checkbox mit Label — Screenreader liest Beschreibung + Pflicht/Empfehlung.
  const kategorieHtml = ({ kat, posten }) => `
    <fieldset class="kc-gruppe">
      <legend>${esc(text(kat.titel) || kat.id)}</legend>
      <ul class="kc-liste">
        ${posten
          .map((a) => {
            const wert = a.werte[aktiveStufe];
            const artKlasse = wert.stufe === 'pflicht' ? 'kc-pflicht' : 'kc-empfehlung';
            const artText = wert.stufe === 'pflicht' ? t('koennenscheck_pflicht') : t('koennenscheck_empfehlung');
            const feldId = `kc-${esc(a.id)}`;
            const istGehakt = gehakt.has(a.id);
            return `
            <li class="kc-posten ${istGehakt ? 'erledigt' : ''}">
              <input type="checkbox" id="${feldId}" data-posten="${esc(a.id)}" ${istGehakt ? 'checked' : ''}>
              <label for="${feldId}">
                <span class="kc-posten-kopf">
                  <span class="kc-posten-titel">${esc(text(a.titel) || a.id)}</span>
                  <span class="kc-marke ${artKlasse}">${esc(artText)}</span>
                </span>
                <span class="kc-posten-text leise">${esc(text(wert.text) || '')}</span>
              </label>
            </li>`;
          })
          .join('')}
      </ul>
    </fieldset>`;

  el.innerHTML = `
    <article>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-flag-checkered" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('nav_koennenscheck'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('koennenscheck_untertitel'))}</p>
        </div>
      </section>
      <p class="leise">${esc(t('koennenscheck_intro'))}</p>
      <p class="chip-zeile" role="group" aria-label="${esc(t('koennenscheck_stufenwahl'))}">${stufenKnoepfe}</p>
      <p class="kc-zaehler leise" aria-live="polite">${esc(t('koennenscheck_erfuellt', { n: gehakt.size, gesamt }))}</p>
      <div class="kc-gruppen">
        ${gruppen.map(kategorieHtml).join('')}
      </div>
      <p class="leise kc-fuss">${esc(t('koennenscheck_hinweis'))}</p>
    </article>`;

  for (const knopf of el.querySelectorAll('[data-stufe]')) {
    knopf.addEventListener('click', () => {
      aktiveStufe = knopf.dataset.stufe;
      renderKoennenscheck(el, daten);
      el.querySelector(`[data-stufe="${CSS.escape(aktiveStufe)}"]`)?.focus();
    });
  }

  const zaehler = el.querySelector('.kc-zaehler');
  for (const box of el.querySelectorAll('[data-posten]')) {
    box.addEventListener('change', () => {
      const id = box.dataset.posten;
      if (box.checked) gehakt.add(id);
      else gehakt.delete(id);
      // Nur Zähler + Zeilen-Optik aktualisieren, nicht neu rendern (Fokus bleibt).
      box.closest('.kc-posten')?.classList.toggle('erledigt', box.checked);
      if (zaehler) zaehler.textContent = t('koennenscheck_erfuellt', { n: gehakt.size, gesamt });
    });
  }
}
