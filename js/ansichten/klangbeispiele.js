// Klangbeispiele an einem Baustein: eine Reihe Knöpfe, je einer spielt eine
// kurze Aufnahme (Gesangstechnik, Gitarrentechnik, Bühne/Proberaum). Daten und
// Abspielen liegen DOM-frei in js/audio/klangbeispiele.js; hier nur Markup und
// Bedienung. Es spielt höchstens ein Beispiel zugleich, ein Seitenwechsel stoppt es.
//
// Gesundheitsrahmen: Bei Gesangs-Bausteinen steht über den Knöpfen ein eigener
// Hinweis — ein Beispiel zeigt, wie das Ziel klingen KANN, es ist keine
// Vorgabe, die man mit Druck nachbaut.

import { label, t } from '../i18n.js';
import { esc, registriereAufraeumen } from '../oberflaeche.js';
import { aktiviere, holeAusgang } from '../audio/kontext.js';
import { BEISPIELE, spieleBeispiel } from '../audio/klangbeispiele.js';

let laufend = null; // { knopf, handle }

function stoppe() {
  if (!laufend) return;
  laufend.handle?.stop();
  setzeZustand(laufend.knopf, false);
  laufend = null;
}

function setzeZustand(knopf, laeuft) {
  knopf.setAttribute('aria-pressed', String(laeuft));
  knopf.classList.toggle('chip-akzent', laeuft);
  const icon = knopf.querySelector('i');
  if (icon) icon.className = laeuft ? 'fa-solid fa-stop' : 'fa-solid fa-play';
}

export function klangbeispieleHtml(baustein) {
  const ids = (baustein.klangbeispiele || []).filter((id) => BEISPIELE[id]);
  if (!ids.length) return '';
  const gesang = (baustein.domaene || []).includes('gesang');
  return `
    <section class="demo klangbeispiele" aria-labelledby="klangbeispiele-titel">
      <h2 id="klangbeispiele-titel"><i class="fa-solid fa-volume-high" aria-hidden="true"></i> ${esc(t('klangbeispiele_titel'))}</h2>
      ${gesang ? `<p class="leise">${esc(t('klangbeispiele_hinweis_gesang'))}</p>` : ''}
      <div class="chip-zeile">
        ${ids.map((id) => `<button type="button" class="chip chip-waehlbar" data-klangbeispiel="${esc(id)}" aria-pressed="false"><i class="fa-solid fa-play" aria-hidden="true"></i> ${esc(label('klangbeispiel', id))}</button>`).join('')}
      </div>
      <p class="leise klangbeispiele-status" role="status" aria-live="polite"></p>
      <p class="leise klangbeispiele-herkunft">${esc(t('klangbeispiele_herkunft'))}</p>
    </section>`;
}

export function bindeKlangbeispiele(el) {
  const knoepfe = el.querySelectorAll('[data-klangbeispiel]');
  if (!knoepfe.length) return;
  const status = el.querySelector('.klangbeispiele-status');
  registriereAufraeumen(stoppe);
  for (const knopf of knoepfe) {
    knopf.addEventListener('click', async () => {
      const war = laufend?.knopf === knopf;
      stoppe();
      if (war) return;
      if (status) status.textContent = '';
      const eintrag = { knopf, handle: null };
      laufend = eintrag;
      setzeZustand(knopf, true);
      try {
        const ctx = await aktiviere();
        const handle = await spieleBeispiel(ctx, holeAusgang(), knopf.dataset.klangbeispiel);
        // Während des Ladens auf etwas anderes geklickt: dieses nicht mehr spielen.
        if (laufend !== eintrag) {
          handle.stop();
          return;
        }
        eintrag.handle = handle;
        handle.ende.then(() => {
          if (laufend === eintrag) {
            setzeZustand(knopf, false);
            laufend = null;
          }
        });
      } catch {
        if (laufend === eintrag) {
          setzeZustand(knopf, false);
          laufend = null;
        }
        if (status) status.textContent = t('klangbeispiele_fehler');
      }
    });
  }
}
