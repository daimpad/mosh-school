// Willkommensseite (Erstlauf): Hero plus zwei gleichwertige Einstiege.
// Links das freie Handbuch (alle Kapitel, keine Angaben), rechts der geführte
// Weg über die Diagnostik — mit kurzer Begründung, warum Anpassen lohnt.

import { t } from '../i18n.js';
import { esc, markeHeroGross } from '../oberflaeche.js';
import { schliesseOnboardingAb, setzeDiagnose } from '../zustand.js';

export function renderWillkommen(el, daten) {
  const kapitelAnzahl = daten.bausteine.length;
  el.innerHTML = `
    ${markeHeroGross()}
    <p class="leise willkommen-lead">${esc(t('wk_untertitel'))}</p>

    <h2 class="abschnitt-titel">${esc(t('wk_einstieg'))}</h2>

    <a class="karte cta-karte" id="wk-handbuch" href="#/pfad/themen">
      <span class="cta-symbol"><i class="fa-solid fa-book-open" aria-hidden="true"></i></span>
      <span class="cta-text">
        <strong>${esc(t('wk_handbuch_titel'))}</strong>
        <span class="leise">${esc(t('wk_handbuch_text', { n: kapitelAnzahl }))}</span>
      </span>
      <i class="fa-solid fa-arrow-right cta-pfeil" aria-hidden="true"></i>
    </a>

    <a class="karte cta-karte" href="#/onboarding">
      <span class="cta-symbol"><i class="fa-solid fa-bullseye" aria-hidden="true"></i></span>
      <span class="cta-text">
        <strong>${esc(t('wk_gefuehrt_titel'))}</strong>
        <span class="leise">${esc(t('wk_gefuehrt_text'))}</span>
      </span>
      <i class="fa-solid fa-arrow-right cta-pfeil" aria-hidden="true"></i>
    </a>`;

  // Freier Einstieg: Diagnose bleibt leer (revidierbar), der Zugriff ist offen
  // (Zwei-Ebenen-Logik 4.4) — erst dann greift die Navigation zum Themenpfad.
  el.querySelector('#wk-handbuch').addEventListener('click', () => {
    setzeDiagnose({ stufe: null, trainer: false, herkunft: null, ziel: null });
    schliesseOnboardingAb();
  });
}
