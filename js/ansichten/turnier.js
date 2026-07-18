// Turnier-Regularium (Referenz, unter „Regeln"): ein Filter über die offiziellen
// Turnier-Standards. Wähle die Kategorie (Fun · 100er … 1000er) — die Liste zeigt,
// woran ein offizielles Turnier gebunden ist, gruppiert nach Bereich, mit Pflicht/
// Empfehlung und einer Markierung, was gegenüber der nächstniedrigeren Kategorie NEU
// oder verschärft ist (die Frage „woran bin ich ZUSÄTZLICH gebunden?"). Doppel-/
// Junior-Varianten blenden ihre Abweichungen als Hinweis ein.
//
// Eigener statischer Bereich — KEIN Lerninhalt: kein Fortschritt, keine Voraussetzungen,
// keine Deltas, keine Gamification. Die Auswahl lebt nur in der Ansicht (kein Zustand,
// keine URL) — ein reines Nachschlage-Werkzeug.

import { t, text } from '../i18n.js';
import { esc, externesZiel } from '../oberflaeche.js';

// Auswahl über Neu-Zeichnungen hinweg gehalten (Modul-Ebene) — bleibt beim
// Zurückkehren erhalten, ohne den Zustand zu belasten. Default: 250er (mittlere
// Stufe mit Variante — zeigt alle Funktionen auf einen Blick).
let aktiveStufe = 't250';
let aktiveVariante = 'einzel';

// Kleine Bereichs-Icons (nur Zierde, aria-hidden) — bestehende FA-Codepoints.
const KAT_ICON = {
  org: 'fa-list-check',
  teilnehmer: 'fa-users',
  anlage: 'fa-ruler-horizontal',
  ablauf: 'fa-flag-checkered',
  nach: 'fa-medal',
};

function stufeVonId(tr, id) {
  return tr.stufen.find((s) => s.id === id) || null;
}

// Die nächstniedrigere Stufe (per Rang) — Bezug für „neu/verschärft".
function vorigeStufe(tr, stufe) {
  if (!stufe) return null;
  return tr.stufen.find((s) => s.rang === stufe.rang - 1) || null;
}

// Turnier-Kategorie-Auswahl (Kacheln): Name groß, Serie klein.
function stufenHtml(tr) {
  return tr.stufen
    .map((s) => {
      const aktiv = s.id === aktiveStufe;
      return `
        <button type="button" class="turnier-stufe" data-stufe="${esc(s.id)}" aria-pressed="${aktiv}">
          <span class="turnier-stufe-name">${esc(text(s.name) ?? s.id)}</span>
          <span class="turnier-stufe-serie">${esc(text(s.serie) ?? '')}</span>
        </button>`;
    })
    .join('');
}

// Varianten-Umschalter (Einzel / Doppel / Junior) — nur für Stufen, die Varianten
// tragen. „Einzel" ist immer die neutrale Grundwahl.
function variantenHtml(tr, stufe) {
  const varianten = (stufe?.varianten || []).map((id) => tr.varianten.find((v) => v.id === id)).filter(Boolean);
  if (varianten.length === 0) return '';
  const knopf = (id, beschriftung, aktiv) =>
    `<button type="button" class="turnier-variante-knopf" data-variante="${esc(id)}" aria-pressed="${aktiv}">${esc(beschriftung)}</button>`;
  const knoepfe = [knopf('einzel', t('turnier_einzel'), aktiveVariante === 'einzel')]
    .concat(varianten.map((v) => knopf(v.id, text(v.label) ?? v.id, aktiveVariante === v.id)))
    .join('');
  return `
    <div class="turnier-varianten">
      <span class="turnier-feld-titel">${esc(t('turnier_konkurrenz'))}</span>
      <div class="turnier-segment" role="group" aria-label="${esc(t('turnier_konkurrenz'))}">${knoepfe}</div>
    </div>`;
}

// Fortschrittsleiter der Kategorien — bis zur gewählten Stufe hervorgehoben (Zierde).
function leiterHtml(tr, stufe) {
  const schritte = tr.stufen
    .map((s, i) => {
      const an = stufe && s.rang <= stufe.rang ? ' an' : '';
      const pfeil = i < tr.stufen.length - 1 ? '<span class="turnier-leiter-pfeil" aria-hidden="true">→</span>' : '';
      return `<span class="turnier-leiter-schritt${an}">${esc(text(s.name) ?? s.id)}</span>${pfeil}`;
    })
    .join('');
  return `<div class="turnier-leiter" aria-hidden="true">${schritte}</div>`;
}

// Kopf-Zusammenfassung: Anzahl der Auflagen + Delta-Satz gegenüber der Vorstufe.
function summeHtml(stufe, vorige, anzahl, neu, verschaerft) {
  const vorher = vorige ? (text(vorige.name) ?? vorige.id) : '';
  let delta;
  if (!vorige) {
    delta = t('turnier_basis');
  } else if (neu + verschaerft === 0) {
    delta = t('turnier_wie_zuvor', { vorher });
  } else {
    const teile = [];
    if (neu) teile.push(`${neu} ${t('turnier_neu')}`);
    if (verschaerft) teile.push(`${verschaerft} ${t('turnier_verschaerft')}`);
    delta = `${t('turnier_davon')} ${teile.join(', ')} ${t('turnier_ggue', { vorher })}`;
  }
  return `
    <div class="turnier-summe-kopf">
      <span class="turnier-summe-zahl">${anzahl}</span>
      <div class="turnier-summe-text">
        <strong>${esc(t('turnier_auflagen_fuer', { name: text(stufe?.name) ?? '' }))}</strong>
        <span class="leise">${esc(delta)}</span>
      </div>
    </div>`;
}

// Abweichungs-Hinweis der aktiven Variante (Doppel/Junior) für die gewählte Stufe.
function variantenInfoHtml(tr, stufe) {
  if (aktiveVariante === 'einzel') return '';
  const v = tr.varianten.find((x) => x.id === aktiveVariante);
  const abw = v?.abweichungen?.[stufe?.id] || [];
  if (abw.length === 0) return '';
  const punkte = abw.map((a) => `<li>${esc(text(a) ?? '')}</li>`).join('');
  return `
    <section class="karte turnier-variante-info">
      <h2><i class="fa-solid fa-people-arrows" aria-hidden="true"></i> ${esc(t('turnier_variante_titel', { variante: text(v.label) ?? v.id }))}</h2>
      <ul class="turnier-abweichungen">${punkte}</ul>
    </section>`;
}

// Eine Anforderungs-Zeile mit Pflicht/Empfehlung-Marke und (falls zutreffend)
// neu/verschärft-Marke gegenüber der Vorstufe.
function anforderungHtml(anf, wert, marke) {
  const pflicht = wert.stufe === 'pflicht';
  const marken = [];
  if (marke === 'neu') marken.push(`<span class="turnier-marke marke-neu">${esc(t('turnier_neu'))}</span>`);
  else if (marke === 'verschaerft') marken.push(`<span class="turnier-marke marke-verschaerft">${esc(t('turnier_verschaerft'))}</span>`);
  marken.push(
    pflicht
      ? `<span class="turnier-marke marke-pflicht">${esc(t('turnier_pflicht'))}</span>`
      : `<span class="turnier-marke marke-empfehlung">${esc(t('turnier_empfehlung'))}</span>`,
  );
  const hervor = marke === 'neu' || marke === 'verschaerft' ? ' hervor' : '';
  return `
    <div class="turnier-anf${hervor}">
      <span class="turnier-anf-punkt" aria-hidden="true"></span>
      <div class="turnier-anf-koerper">
        <div class="turnier-anf-kopf">
          <span class="turnier-anf-titel">${esc(text(anf.titel) ?? anf.id)}</span>
          <span class="turnier-marken">${marken.join('')}</span>
        </div>
        <p class="turnier-anf-text">${esc(text(wert.text) ?? '')}</p>
      </div>
    </div>`;
}

// Nach Bereich gruppierte Anforderungsliste für die gewählte Stufe.
function ergebnisHtml(tr, stufe, vorige) {
  const abschnitte = tr.kategorien
    .map((kat) => {
      const zeilen = tr.anforderungen
        .filter((a) => a.werte[stufe.id] && a.kategorie === kat.id)
        .map((a) => {
          const wert = a.werte[stufe.id];
          const wertVor = vorige ? a.werte[vorige.id] : null;
          let marke = null;
          if (vorige) {
            if (!wertVor) marke = 'neu';
            else if ((text(wertVor.text) ?? '') !== (text(wert.text) ?? '')) marke = 'verschaerft';
          }
          return anforderungHtml(a, wert, marke);
        });
      if (zeilen.length === 0) return '';
      const icon = KAT_ICON[kat.id] || 'fa-list-check';
      return `
        <section class="karte turnier-kat">
          <h2><i class="fa-solid ${icon}" aria-hidden="true"></i> ${esc(text(kat.titel) ?? kat.id)} <span class="turnier-kat-zahl">${zeilen.length}</span></h2>
          ${zeilen.join('')}
        </section>`;
    })
    .join('');
  return abschnitte || `<div class="karte"><p class="leise">${esc(t('turnier_leer'))}</p></div>`;
}

// Offizielle Dokumente (Absprünge zu den lokal abgelegten PDFs) + Quelle/Stand/Hinweis.
function dokumenteHtml(meta) {
  const dok = (meta.dokumente || [])
    .map((d) => {
      const titel = esc(text(d.titel) ?? d.pfad ?? '');
      const hinweis = text(d.hinweis) ? ` <span class="leise">— ${esc(text(d.hinweis))}</span>` : '';
      // Same-origin-Pfade (rules/…) sind kein externesZiel; als normaler Absprung verlinken.
      return d.pfad
        ? `<li><a class="turnier-dok-link" href="${esc(d.pfad)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-book-open" aria-hidden="true"></i> ${titel}</a>${hinweis}</li>`
        : `<li>${titel}${hinweis}</li>`;
    })
    .join('');
  const quelle = text(meta.quelle);
  const stand = text(meta.stand);
  const quelleZeile = quelle
    ? `<p class="leise turnier-quelle"><i class="fa-solid fa-scale-balanced" aria-hidden="true"></i> ${esc(t('turnier_quelle'))}: ${esc(quelle)}${stand ? ` · ${esc(t('turnier_stand'))}: ${esc(stand)}` : ''}</p>`
    : '';
  const hinweis = text(meta.hinweis)
    ? `<p class="leise turnier-hinweis"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${esc(text(meta.hinweis))}</p>`
    : '';
  return `
    <section class="karte turnier-dokumente">
      <h2><i class="fa-solid fa-book-open" aria-hidden="true"></i> ${esc(t('turnier_dokumente'))}</h2>
      ${dok ? `<ul class="turnier-dok-liste">${dok}</ul>` : ''}
      ${quelleZeile}
      ${hinweis}
    </section>`;
}

function ansichtHtml(tr) {
  const stufe = stufeVonId(tr, aktiveStufe);
  const vorige = vorigeStufe(tr, stufe);
  const anwendbar = stufe ? tr.anforderungen.filter((a) => a.werte[stufe.id]) : [];
  let neu = 0;
  let verschaerft = 0;
  if (stufe && vorige) {
    for (const a of anwendbar) {
      const wertVor = a.werte[vorige.id];
      if (!wertVor) neu += 1;
      else if ((text(wertVor.text) ?? '') !== (text(a.werte[stufe.id].text) ?? '')) verschaerft += 1;
    }
  }
  return `
    <h1><i class="fa-solid fa-scale-balanced turnier-titel-icon" aria-hidden="true"></i> ${esc(t('turnier_titel'))}</h1>
    <p class="leise">${esc(text(tr.meta.einleitung) ?? '')}</p>

    <section class="karte turnier-filter" aria-label="${esc(t('turnier_frage'))}">
      <p class="turnier-feld-titel">${esc(t('turnier_frage'))}</p>
      <div class="turnier-stufen" role="group" aria-label="${esc(t('turnier_frage'))}">${stufenHtml(tr)}</div>
      ${variantenHtml(tr, stufe)}
    </section>

    <section class="karte turnier-summe" aria-live="polite">
      ${summeHtml(stufe, vorige, anwendbar.length, neu, verschaerft)}
      ${stufe?.kurz ? `<p class="leise turnier-kurz">${esc(text(stufe.kurz) ?? '')}</p>` : ''}
      ${leiterHtml(tr, stufe)}
    </section>

    ${variantenInfoHtml(tr, stufe)}
    ${stufe ? ergebnisHtml(tr, stufe, vorige) : ''}
    ${dokumenteHtml(tr.meta)}`;
}

export function renderTurnier(el, daten) {
  const tr = daten.turnierregeln || { stufen: [], kategorien: [], anforderungen: [], varianten: [], meta: {} };
  if (!tr.stufen.some((s) => s.id === aktiveStufe)) aktiveStufe = tr.stufen[0]?.id || null;

  const zeichne = (fokus) => {
    el.innerHTML = ansichtHtml(tr);
    // Kategorie-Auswahl: setzt Stufe, prüft Varianten-Verfügbarkeit, zeichnet neu.
    for (const knopf of el.querySelectorAll('.turnier-stufe')) {
      knopf.addEventListener('click', () => {
        aktiveStufe = knopf.dataset.stufe;
        const stufe = stufeVonId(tr, aktiveStufe);
        if (aktiveVariante !== 'einzel' && !(stufe?.varianten || []).includes(aktiveVariante)) {
          aktiveVariante = 'einzel';
        }
        zeichne(`.turnier-stufe[data-stufe="${aktiveStufe}"]`);
      });
    }
    // Varianten-Umschalter.
    for (const knopf of el.querySelectorAll('.turnier-variante-knopf')) {
      knopf.addEventListener('click', () => {
        aktiveVariante = knopf.dataset.variante;
        zeichne(`.turnier-variante-knopf[data-variante="${aktiveVariante}"]`);
      });
    }
    // Fokus auf das eben gewählte Steuerelement zurücklenken (Tastatur-Orientierung).
    if (fokus) el.querySelector(fokus)?.focus();
  };
  zeichne();
}
