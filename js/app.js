// App-Einstieg: Boot (Zustand → Sprache → Daten), Hash-Router und Navigation.
// Ansichten rendern in #ansicht; Zustandsänderungen stoßen über das Ereignis
// 'app:rendern' ein Neu-Rendern der aktuellen Route an.

import { renderBaustein } from './ansichten/baustein.js';
import { renderHeim } from './ansichten/heim.js';
import { renderKollektiv, renderMitmachen, renderRechtstext, renderUeber } from './ansichten/info.js';
import { renderOnboarding } from './ansichten/onboarding.js';
import { renderPlan } from './ansichten/plan.js';
import { renderBand, renderIndividual, renderInstrument, renderKompetenzpfad, renderStil, renderThemen, renderUmgebung } from './ansichten/pfad.js';
import { renderMerkliste, renderProfil } from './ansichten/profil.js';
import { renderStimmungen } from './ansichten/stimmungen.js';
import { renderPatterns } from './ansichten/patterns.js';
import { renderGriffe } from './ansichten/griffe.js';
import { renderZerrtypen } from './ansichten/zerrtypen.js';
import { renderSongs } from './ansichten/songs.js';
import { renderBrandAlert } from './ansichten/brand-alert.js';
import { renderGlossar } from './ansichten/glossar.js';
import { renderWerkzeuge } from './ansichten/werkzeuge.js';
import { renderWerkzeugMetronom } from './ansichten/werkzeug-metronom.js';
import { renderWerkzeugLoops } from './ansichten/werkzeug-loops.js';
import { renderWerkzeugStimmgeraet } from './ansichten/werkzeug-stimmgeraet.js';
import { renderWerkzeugPedalboard } from './ansichten/werkzeug-pedalboard.js';
import { renderWerkzeugAmpbox } from './ansichten/werkzeug-ampbox.js';
import { renderWerkzeugStruktur } from './ansichten/werkzeug-struktur.js';
import { renderWerkzeugRecorder } from './ansichten/werkzeug-recorder.js';
import { renderWerkzeugMehrspur } from './ansichten/werkzeug-mehrspur.js';
import { renderWerkzeugZerrlabor } from './ansichten/werkzeug-zerrlabor.js';
import { renderWerkzeugTab } from './ansichten/werkzeug-tab.js';
import { renderWerkzeugExplorer } from './ansichten/werkzeug-explorer.js';
import { renderWerkzeugLandkarte } from './ansichten/werkzeug-landkarte.js';
import { renderWerkzeugGenremix } from './ansichten/werkzeug-genremix.js';
import { renderKoennenscheck } from './ansichten/koennenscheck.js';
import { renderExperimentieren } from './ansichten/experimentieren.js';
import { renderLernen, renderSongwriting, renderUeben } from './ansichten/hub.js';
import { renderGeraete } from './ansichten/geraete.js';
import { renderSuche } from './ansichten/suche.js';
import { renderTraining } from './ansichten/training.js';
import { ladeDaten, ladeSuchindex } from './daten.js';
import { setzeHintergrundbilder } from './hintergrundbilder.js';
import { initFeedbackWennGewuenscht } from './feedback.js';
import { initI18n, t } from './i18n.js';
import { esc, fuehreAufraeumenAus, setzeGrafiken, setzeLehrgrafiken, wendeThemaAn } from './oberflaeche.js';
import { einstellungen, istOnboardingAbgeschlossen, ladeZustand, schliesseOnboardingAb, setzeEinstellung, uebernehmeFremdenStand } from './zustand.js';

let daten = null;
let letzteRoute = null;

// Scroll-Einblendungen (.reveal): ein einzelner IntersectionObserver, der nach
// jedem Rendern die aktuellen .reveal-Blöcke beobachtet und beim Hereinscrollen
// .sichtbar setzt, beim Verlassen (nach erstem Sichtbarwerden) .raus. Nur aktiv,
// wenn Bewegung erlaubt ist — die html-Klasse .anim-reveal schaltet den Effekt
// CSS-seitig frei; ohne sie bleibt aller Inhalt sofort sichtbar (auch ohne JS).
const bewegungErlaubt =
  typeof window.matchMedia !== 'function' ||
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let revealBeobachter = null;

// `ohneEinblenden`: bei einer In-Place-Neuzeichnung derselben Route (Nachladen
// von Grafiken/Suchindex, Zustandsaenderung) sind die .reveal-Bloecke frisch und
// damit wieder im Ausgangszustand — sie blendeten Sekunden nach dem ersten
// Anstrich ein zweites Mal ein. Was schon im Bild steht, wird deshalb sofort und
// uebergangslos als sichtbar markiert; nur echte Routenwechsel animieren.
function richteRevealEin(el, ohneEinblenden = false) {
  if (revealBeobachter) {
    revealBeobachter.disconnect();
    revealBeobachter = null;
  }
  if (!bewegungErlaubt || typeof IntersectionObserver !== 'function') return;
  const ziele = el.querySelectorAll('.reveal');
  if (!ziele.length) return;
  if (ohneEinblenden) {
    const hoehe = window.innerHeight || 0;
    const vorab = [...ziele].filter((z) => {
      const r = z.getBoundingClientRect();
      return r.top < hoehe && r.bottom > 0;
    });
    for (const z of vorab) z.classList.add('ohne-uebergang', 'sichtbar');
    // Reflow erzwingen, damit der uebergangslose Zustand wirklich uebernommen
    // ist, bevor der Uebergang wieder erlaubt wird.
    void el.offsetWidth;
    for (const z of vorab) z.classList.remove('ohne-uebergang');
  }
  revealBeobachter = new IntersectionObserver(
    (eintraege) => {
      for (const e of eintraege) {
        if (e.isIntersecting) {
          e.target.classList.add('sichtbar');
          e.target.classList.remove('raus');
        } else if (e.target.classList.contains('sichtbar')) {
          // Erst nach dem ersten Sichtbarwerden abblenden (nicht im Ausgangs-
          // zustand) — so „boxt" der Block einmal sauber herein, bevor er
          // beim Weiterscrollen wieder abdunkelt.
          e.target.classList.add('raus');
          e.target.classList.remove('sichtbar');
        }
      }
    },
    // threshold 0 (nicht > 0): ein hoher Block (lange Baustein-Liste) erreicht in
    // einem kleinen Viewport nie einen Sichtbarkeits-Anteil > 0 und würde sonst nie
    // ausgelöst. rootMargin zieht den Auslösepunkt etwas ins Bild hinein.
    { threshold: 0, rootMargin: '0px 0px -12% 0px' },
  );
  ziele.forEach((z) => revealBeobachter.observe(z));
}

function parseHash() {
  const roh = window.location.hash.replace(/^#\/?/, '');
  const [pfadTeil, queryTeil] = roh.split('?');
  return {
    segmente: pfadTeil.split('/').filter(Boolean),
    query: new URLSearchParams(queryTeil || ''),
    roh,
  };
}

function aktualisiereNavigation(segmente) {
  const s0 = segmente[0];
  // Geräte-Explorer (#/werkzeug/explorer) und die Instrument-Geräte-Landings
  // (#/geraete/*) gehören zum Menü-Punkt „Geräte", nicht zur Tools-Leiste.
  const geraeteRoute = s0 === 'geraete' || (s0 === 'werkzeug' && segmente[1] === 'explorer');
  const aktiv = !s0
    ? 'home'
    : s0 === 'profil' || s0 === 'merkliste'
      ? 'profil'
      : geraeteRoute
        ? 'geraete'
        : s0 === 'werkzeuge' || s0 === 'werkzeug'
          ? 'werkzeuge'
          : s0 === 'lernen'
            ? 'lernen'
            : s0 === 'ueben'
              ? 'ueben'
              : s0 === 'songwriting'
                ? 'songwriting'
                : s0 === 'experimentieren'
                  ? 'experimentieren'
                  : s0 === 'stimmungen'
                    ? 'stimmungen'
                    : s0 === 'patterns'
                      ? 'patterns'
                      : s0 === 'griffe'
                        ? 'griffe'
                      : s0 === 'zerrtypen'
                        ? 'zerrtypen'
                      : s0 === 'brand-alert'
                        ? 'brandalert'
                        : s0 === 'glossar'
                          ? 'glossar'
                          : s0 === 'ueber'
                            ? 'ueber'
                            : s0 === 'pfad' && segmente[1] === 'stil'
                              ? 'genres'
                              : s0 === 'pfad' && segmente[1] === 'umgebung'
                                ? 'kontext'
                                : s0 === 'pfad' && segmente[1] === 'themen' && segmente[2] === 'kontext'
                                  ? 'community'
                                  : null;
  for (const verweis of document.querySelectorAll('[data-nav]')) {
    const istAktiv = verweis.dataset.nav === aktiv;
    verweis.classList.toggle('aktiv', istAktiv);
    if (istAktiv) verweis.setAttribute('aria-current', 'page');
    else verweis.removeAttribute('aria-current');
  }
  for (const verweis of document.querySelectorAll('[data-footer]')) {
    const istAktiv = verweis.dataset.footer === s0;
    verweis.classList.toggle('aktiv', istAktiv);
    if (istAktiv) verweis.setAttribute('aria-current', 'page');
    else verweis.removeAttribute('aria-current');
  }
  // Der Bar-Knopf „Mehr" spiegelt die im Menü liegenden Ziele (inkl. Rechtstexte
  // und der aus den Hubs erreichbaren Referenzbereiche wie Songs/Suche/Prüfung).
  // 'profil' steht bewusst NICHT hier: Es hat einen eigenen Knopf in der unteren
  // Leiste. Stand es mit drin, trugen auf #/profil sowohl „Profil" als auch
  // „Mehr" aria-current="page" — die Leiste meldete zwei aktuelle Orte zugleich.
  const imMehrNav = ['lernen', 'ueben', 'songwriting', 'experimentieren', 'genres', 'kontext', 'geraete', 'stimmungen', 'patterns', 'ueber'];
  const imMehr = imMehrNav.includes(aktiv) || ['songs', 'suche', 'koennenscheck', 'mitmachen', 'kollektiv', 'impressum', 'datenschutz'].includes(s0);
  const mehr = document.querySelector('.fussnav-mehr');
  if (mehr) {
    mehr.classList.toggle('aktiv', imMehr);
    if (imMehr) mehr.setAttribute('aria-current', 'page');
    else mehr.removeAttribute('aria-current');
  }
}

function sicherDecode(wert) {
  try {
    return decodeURIComponent(wert);
  } catch {
    return wert;
  }
}

// Fokus-Signatur eines Bedienelements aus seinen data-*-Attributen (oder id) —
// stabil über eine In-Place-Neuzeichnung derselben Route hinweg. So landet der
// Tastatur-/Screenreader-Fokus nach einer Aktion (Quittieren, Mastery, „weiter")
// wieder auf demselben Steuerelement statt auf <body>. Gibt null, wenn sich das
// Element nicht wiederfinden lässt.
function fokusSchluessel(elem) {
  if (!elem || elem === document.body || !elem.attributes) return null;
  const daten = [...elem.attributes]
    .filter((a) => a.name.startsWith('data-'))
    .map((a) => `[${a.name}="${CSS.escape(a.value)}"]`)
    .join('');
  if (daten) return elem.tagName.toLowerCase() + daten;
  if (elem.id) return '#' + CSS.escape(elem.id);
  return null;
}

// Schnellumschalter hell/dunkel in der Kopfzeile. Er zeigt das Thema, in das er
// wechselt, nicht das gerade geltende — ein Knopf, der den Ist-Zustand zeigt,
// wird regelmäßig andersherum gelesen, und ohne Beschriftung lässt sich das
// nicht auflösen. Das aria-label sagt es deshalb ausdrücklich.
//
// Bei der Einstellung „auto" gibt es keinen gespeicherten Wert, an dem sich das
// ablesen ließe — dann entscheidet das WIRKSAME Thema (data-theme bzw. die
// OS-Vorgabe), was als Nächstes kommt. Die dritte Stellung bleibt dem Profil
// vorbehalten; ein Kopfzeilen-Icon kann drei Zustände nicht unterscheidbar
// anzeigen, und der schnelle Wechsel ist der eigentliche Bedarf.
function wirksamesThema() {
  const gesetzt = document.documentElement.dataset.theme;
  if (gesetzt === 'hell' || gesetzt === 'dunkel') return gesetzt;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dunkel' : 'hell';
}

function aktualisiereThemaKnopf() {
  const knopf = document.getElementById('kopf-thema');
  if (!knopf) return;
  const ziel = wirksamesThema() === 'dunkel' ? 'hell' : 'dunkel';
  knopf.dataset.ziel = ziel;
  knopf.setAttribute('aria-label', t(`thema_wechsel_${ziel}`));
  knopf.title = t(`thema_wechsel_${ziel}`);
  const icon = knopf.querySelector('i');
  if (icon) icon.className = `fa-solid ${ziel === 'hell' ? 'fa-sun' : 'fa-moon'}`;
}

function beschrifteRahmen() {
  // Marke plus Subline — dasselbe wie im statischen <title>. Ohne das wechselte
  // der Tab-Titel beim Laden von „ZERRER — Mosh School" auf nur „ZERRER", und
  // Lesezeichen hingen davon ab, wann man sie gesetzt hat.
  document.title = `${t('app_titel')} — ${t('hero_untertitel')}`;
  const zumInhalt = document.querySelector('.zum-inhalt');
  if (zumInhalt) zumInhalt.textContent = t('skip_link');
  document.querySelector('.marke-text').textContent = t('app_titel');
  // Fußzeilen-Claim: eine kurze Zeile statt der beiden ausgeschriebenen Zweige —
  // die stehen im Startseiten-Hero, und ihre Bereiche sind aus den Spalten
  // daneben verlinkt. Steht leer im HTML, damit der Text nur an EINER Stelle
  // gepflegt wird.
  // Die Fuss-Wortmarke ist eine Grafik; ihren zugaenglichen Namen traegt das
  // aria-label, damit Vorlesesoftware weiter „ZERRER" hoert.
  const fussWort = document.querySelector('.footer-marke-wort');
  if (fussWort) fussWort.setAttribute('aria-label', t('app_titel'));
  const fussClaim = document.querySelector('.footer-marke-claim');
  if (fussClaim) fussClaim.textContent = t('marke_footer_claim');
  const beschriftungen = {
    // Untere Leiste
    home: t('nav_home'),
    werkzeuge: t('nav_werkzeuge'),
    profil: t('nav_profil'),
    mehr: t('nav_mehr'),
    // Menü: Aktivitäts-Hauptpunkte
    lernen: t('nav_lernen'),
    ueben: t('nav_ueben'),
    experimentieren: t('nav_experimentieren'),
    songwriting: t('nav_songwriting'),
    // Menü: Referenzbereiche
    genres: t('pfad_stil'),
    kontext: t('pfad_umgebung'),
    geraete: t('wz_explorer_titel'),
    stimmungen: t('nav_stimmungen'),
    zerrtypen: t('nav_zerrtypen'),
    patterns: t('nav_patterns'),
    ueber: t('nav_ueber'),
  };
  for (const verweis of document.querySelectorAll('[data-nav]')) {
    const ziel = verweis.querySelector('.nav-text');
    if (ziel && beschriftungen[verweis.dataset.nav]) ziel.textContent = beschriftungen[verweis.dataset.nav];
  }
  document.querySelector('.menue-titel').textContent = t('menue');
  document.getElementById('hamburger').setAttribute('aria-label', t('menue'));
  document.getElementById('kopf-suche')?.setAttribute('aria-label', t('nav_suche'));
  aktualisiereThemaKnopf();
  document.querySelector('.menue-schliessen').setAttribute('aria-label', t('menue_schliessen'));
  // Impressum/Datenschutz stehen mit Icon im „Mehr"-Menü — nur den .nav-text-Träger
  // ersetzen, wenn vorhanden (Icon nicht zerstören).
  for (const verweis of document.querySelectorAll('[data-footer]')) {
    const beschriftung = { impressum: t('footer_impressum'), datenschutz: t('footer_datenschutz') }[verweis.dataset.footer];
    if (!beschriftung) continue;
    const ziel = verweis.querySelector('.nav-text');
    if (ziel) ziel.textContent = beschriftung;
    else verweis.textContent = beschriftung;
  }
  // Haltungs-Zeile im Footer: dieselben Labels wie die Über-Seite, damit die
  // Aussage nur an einer Stelle gepflegt wird (Icons stehen im Markup).
  for (const eintrag of document.querySelectorAll('[data-haltung]')) {
    eintrag.textContent = t('haltung_' + eintrag.dataset.haltung);
  }
}

// Menü öffnen zwei Auslöser: der Hamburger (Kopf, ab Tablet) und „Mehr"
// (Bottom-Bar, mobil). Beide teilen dieselbe Lade und denselben aria-Zustand.
function setzeMenueTrigger(offen) {
  for (const id of ['hamburger', 'mehr-knopf']) {
    const el = document.getElementById(id);
    if (el) el.setAttribute('aria-expanded', String(offen));
  }
}

// Fokus-Falle für den Menü-Drawer (Tastatur/Screenreader): Tab zirkuliert
// innerhalb der Lade, statt hinter den überdeckenden Schleier zu wandern.
let menueFokusVorher = null;
function menueFokussierbare() {
  const lade = document.querySelector('#hauptmenue .menue-lade');
  if (!lade) return [];
  return [...lade.querySelectorAll('a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])')].filter(
    (e) => e.offsetParent !== null || e === document.activeElement,
  );
}
function menueTasten(ereignis) {
  if (ereignis.key !== 'Tab') return;
  const ziele = menueFokussierbare();
  if (ziele.length === 0) return;
  const erst = ziele[0];
  const letzt = ziele[ziele.length - 1];
  if (ereignis.shiftKey && document.activeElement === erst) {
    letzt.focus();
    ereignis.preventDefault();
  } else if (!ereignis.shiftKey && document.activeElement === letzt) {
    erst.focus();
    ereignis.preventDefault();
  }
}

function oeffneMenue() {
  const menue = document.getElementById('hauptmenue');
  menueFokusVorher = document.activeElement;
  menue.hidden = false;
  // Die Lade ist ein modaler Dialog: Fokus hinein, außen ignorieren (aria-modal).
  const lade = menue.querySelector('.menue-lade');
  if (lade) {
    lade.setAttribute('role', 'dialog');
    lade.setAttribute('aria-modal', 'true');
  }
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      menue.classList.add('offen');
      menue.querySelector('.menue-schliessen')?.focus();
    }),
  );
  document.addEventListener('keydown', menueTasten, true);
  setzeMenueTrigger(true);
}

function schliesseMenue() {
  const menue = document.getElementById('hauptmenue');
  if (menue.hidden) return;
  menue.classList.remove('offen');
  setzeMenueTrigger(false);
  document.removeEventListener('keydown', menueTasten, true);
  // Fokus zurück auf den auslösenden Knopf (Hamburger/„Mehr"), sofern noch da.
  if (menueFokusVorher && typeof menueFokusVorher.focus === 'function') menueFokusVorher.focus();
  menueFokusVorher = null;
  window.setTimeout(() => {
    menue.hidden = true;
  }, 400);
}

function renderFehler(el, fehler) {
  el.innerHTML = `
    <div class="karte">
      <h1>${esc(t('fehler_laden_titel'))}</h1>
      <p class="leise">${esc(t('fehler_laden_text'))}</p>
      <p class="leise"><code>${esc(fehler?.message ?? fehler)}</code></p>
      <button class="knopf knopf-primaer" id="neu-laden">${esc(t('erneut_versuchen'))}</button>
    </div>`;
  el.querySelector('#neu-laden').addEventListener('click', () => window.location.reload());
}

function rendern() {
  const { segmente, query, roh } = parseHash();
  const el = document.getElementById('ansicht');

  // Ressourcen der verlassenen Ansicht stoppen (Audio, Mikrofon, Timer, URLs) —
  // nur bei echtem Routenwechsel, nicht bei einer In-Place-Neuzeichnung derselben
  // Route (app:rendern), damit z. B. ein laufender Demo-Loop beim Quittieren nicht
  // abbricht. letzteRoute trägt hier noch die vorige Route.
  if (roh !== letzteRoute) fuehreAufraeumenAus();

  // Bei einer In-Place-Neuzeichnung (gleiche Route) den Fokus des gerade bedienten
  // Steuerelements merken, um ihn nach dem Neu-Rendern zurückzusetzen.
  // Muss VOR dem Setzen von letzteRoute weiter unten festgehalten werden.
  const gleicheRoute = letzteRoute !== null && roh === letzteRoute;
  const fokusVorher = gleicheRoute ? fokusSchluessel(document.activeElement) : null;

  // Beim ersten Besuch stand hier eine eigene Willkommensseite mit nur zwei
  // Auswahlkacheln („Freies Handbuch" / „Geführter Einstieg"). Sie ist entfernt:
  // Wer die App zum ersten Mal öffnet, soll sehen, WAS es gibt — die Startseite
  // zeigt Instrumente, Genres, Lernwege und Werkzeuge auf einen Blick und trägt
  // den geführten Einstieg als CTA im Hero. Eine Auswahlseite davor verzögert
  // den Überblick, statt ihn zu geben.
  //
  // Zwei-Ebenen-Logik (4.4) bleibt: Zugriff wird nie gesperrt. Wer vor dem
  // Onboarding irgendwohin navigiert, gilt als freier Einstieg.
  if (!istOnboardingAbgeschlossen() && segmente.length > 0 && segmente[0] !== 'onboarding') {
    schliesseOnboardingAb();
  }
  document.body.classList.toggle('im-onboarding', segmente[0] === 'onboarding');
  beschrifteRahmen();

  if (segmente[0] === 'onboarding') {
    renderOnboarding(el, daten);
  } else if (segmente[0] === 'pfad' && segmente[1] === 'kompetenz') {
    renderKompetenzpfad(el, daten, segmente[2] || null);
  } else if (segmente[0] === 'pfad' && segmente[1] === 'themen') {
    renderThemen(el, daten, segmente[2] ? sicherDecode(segmente[2]) : null);
  } else if (segmente[0] === 'pfad' && segmente[1] === 'stil') {
    renderStil(el, daten, segmente[2] ? sicherDecode(segmente[2]) : null);
  } else if (segmente[0] === 'pfad' && segmente[1] === 'umgebung') {
    renderUmgebung(el, daten, null, null);
  } else if (segmente[0] === 'pfad' && segmente[1] === 'witterung') {
    renderUmgebung(el, daten, segmente[1], segmente[2] ? sicherDecode(segmente[2]) : null);
  } else if (segmente[0] === 'pfad' && segmente[1] === 'individual') {
    renderIndividual(el, daten);
  } else if (segmente[0] === 'instrument') {
    renderInstrument(el, daten, segmente[1] ? sicherDecode(segmente[1]) : null);
  } else if (segmente[0] === 'band') {
    renderBand(el, daten);
  } else if (segmente[0] === 'plan') {
    renderPlan(el, daten);
  } else if (segmente[0] === 'training') {
    renderTraining(el, daten, segmente[1] ? sicherDecode(segmente[1]) : null);
  } else if (segmente[0] === 'suche') {
    renderSuche(el, daten);
  } else if (segmente[0] === 'stimmungen') {
    renderStimmungen(el, daten);
  } else if (segmente[0] === 'patterns') {
    renderPatterns(el, daten, segmente[1] ? sicherDecode(segmente[1]) : null);
  } else if (segmente[0] === 'griffe') {
    renderGriffe(el, daten);
  } else if (segmente[0] === 'zerrtypen') {
    renderZerrtypen(el, daten);
  } else if (segmente[0] === 'brand-alert') {
    renderBrandAlert(el, daten);
  } else if (segmente[0] === 'glossar') {
    renderGlossar(el, daten, query);
  } else if (segmente[0] === 'songs') {
    renderSongs(el, daten, segmente[1] ? sicherDecode(segmente[1]) : null);
  } else if (segmente[0] === 'werkzeuge') {
    renderWerkzeuge(el, daten);
  } else if (segmente[0] === 'werkzeug' && segmente[1] === 'metronom') {
    renderWerkzeugMetronom(el, daten, query);
  } else if (segmente[0] === 'werkzeug' && segmente[1] === 'loops') {
    renderWerkzeugLoops(el, daten, query);
  } else if (segmente[0] === 'werkzeug' && segmente[1] === 'stimmgeraet') {
    renderWerkzeugStimmgeraet(el, daten, query);
  } else if (segmente[0] === 'werkzeug' && segmente[1] === 'pedalboard') {
    renderWerkzeugPedalboard(el, daten, query);
  } else if (segmente[0] === 'werkzeug' && segmente[1] === 'ampbox') {
    renderWerkzeugAmpbox(el, daten, query);
  } else if (segmente[0] === 'werkzeug' && segmente[1] === 'struktur') {
    renderWerkzeugStruktur(el, daten, query);
  } else if (segmente[0] === 'werkzeug' && segmente[1] === 'recorder') {
    renderWerkzeugRecorder(el, daten, query);
  } else if (segmente[0] === 'werkzeug' && segmente[1] === 'mehrspur') {
    renderWerkzeugMehrspur(el, daten, query);
  } else if (segmente[0] === 'werkzeug' && segmente[1] === 'tab') {
    renderWerkzeugTab(el, daten);
  } else if (segmente[0] === 'werkzeug' && segmente[1] === 'zerrlabor') {
    renderWerkzeugZerrlabor(el, daten, query);
  } else if (segmente[0] === 'werkzeug' && segmente[1] === 'explorer') {
    renderWerkzeugExplorer(el, daten, query);
  } else if (segmente[0] === 'werkzeug' && segmente[1] === 'landkarte') {
    renderWerkzeugLandkarte(el, daten, query);
  } else if (segmente[0] === 'werkzeug' && segmente[1] === 'genremix') {
    renderWerkzeugGenremix(el, daten, query);
  } else if (segmente[0] === 'werkzeug') {
    // Noch nicht gebautes Werkzeug → zurück zum Hub (kein Bruch bei Deep-Links).
    renderWerkzeuge(el, daten);
  } else if (segmente[0] === 'koennenscheck') {
    renderKoennenscheck(el, daten);
  } else if (segmente[0] === 'lernen') {
    renderLernen(el, daten);
  } else if (segmente[0] === 'ueben') {
    renderUeben(el, daten);
  } else if (segmente[0] === 'songwriting') {
    renderSongwriting(el, daten);
  } else if (segmente[0] === 'geraete') {
    renderGeraete(el, daten, segmente[1] ? sicherDecode(segmente[1]) : null);
  } else if (segmente[0] === 'experimentieren') {
    renderExperimentieren(el, daten);
  } else if (segmente[0] === 'ueber') {
    renderUeber(el, daten);
  } else if (segmente[0] === 'mitmachen') {
    renderMitmachen(el, daten);
  } else if (segmente[0] === 'kollektiv') {
    renderKollektiv(el, daten);
  } else if (segmente[0] === 'impressum') {
    renderRechtstext(el, daten, 'impressum');
  } else if (segmente[0] === 'datenschutz') {
    renderRechtstext(el, daten, 'datenschutz');
  } else if (segmente[0] === 'baustein' && segmente[1]) {
    renderBaustein(el, daten, sicherDecode(segmente[1]), query.get('kontext') || 'kompetenz');
  } else if (segmente[0] === 'merkliste') {
    renderMerkliste(el, daten);
  } else if (segmente[0] === 'profil') {
    renderProfil(el, daten);
  } else {
    renderHeim(el, daten);
  }

  aktualisiereNavigation(segmente);
  if (roh !== letzteRoute) {
    const ersterLauf = letzteRoute === null;
    window.scrollTo(0, 0);
    letzteRoute = roh;
    // Reichweitenmessung (GoatCounter, index.html laedt mit no_onload): bei
    // jedem ECHTEN Routenwechsel zaehlen, nicht bei einer In-Place-Neuzeichnung
    // derselben Route (sonst zaehlte jedes Quittieren als neuer Seitenaufruf).
    // window.goatcounter fehlt lautlos, wenn das Skript blockiert/offline ist.
    window.goatcounter?.count?.({ path: location.pathname + location.hash });
    // Einstiegs-Übergang nur bei Routenwechsel, nicht bei Zustands-Neuzeichnung.
    el.classList.remove('einstieg');
    void el.offsetWidth;
    el.classList.add('einstieg');
    // Tastatur-/Screenreader-Fokus auf den neuen Inhalt lenken (nicht beim Erstaufbau).
    if (!ersterLauf) el.focus({ preventScroll: true });
  } else if (fokusVorher) {
    // Gleiche Route neu gezeichnet: Fokus auf dasselbe Steuerelement zurücksetzen.
    const ziel = el.querySelector(fokusVorher);
    if (ziel) ziel.focus({ preventScroll: true });
  }

  // Scroll-Einblendungen der aktuellen Ansicht neu verdrahten (Beobachter wird
  // intern zuerst getrennt — auch bei In-Place-Neuzeichnung kein Leck).
  richteRevealEin(el, gleicheRoute);
}

async function boot() {
  ladeZustand();
  // Bewegungseffekte (Reinboxen/Einblendungen) nur freischalten, wenn das System
  // keine reduzierte Bewegung verlangt — die CSS-Regeln hängen an .anim-reveal.
  if (bewegungErlaubt) document.documentElement.classList.add('anim-reveal');
  const el = document.getElementById('ansicht');
  // Baustein-Grafiken laufen beiläufig mit: Fehlt die Datei, bleibt die Registry
  // leer und bausteinIcon fällt auf die FA-/Domänen-Icons zurück (kein Bruch).
  try {
    await initI18n(einstellungen().sprache);
    daten = await ladeDaten();
  } catch (fehler) {
    try {
      await initI18n('de');
    } catch {
      // Ohne Labels bleibt nur die nackte Fehlermeldung — t() fällt auf Schlüssel zurück.
    }
    renderFehler(el, fehler);
    return;
  }
  // Bildebene der Heros/Kacheln scharf schalten. Muss VOR dem ersten Anstrich
  // stehen — sonst zeichnet die Startseite einmal ohne Bilder und flackert nach.
  setzeHintergrundbilder(daten.hintergrundbilder);
  for (const warnung of daten.warnungen) console.warn('[daten]', warnung);

  document.getElementById('hamburger').addEventListener('click', oeffneMenue);
  document.getElementById('mehr-knopf')?.addEventListener('click', oeffneMenue);
  // Skip-Link: Fokus auf den Inhalt lenken, OHNE den Hash zu ändern — der Router
  // würde "#ansicht" sonst als (unbekannte) Route deuten und die Startseite zeigen.
  // #ansicht trägt tabindex="-1", ist also programmatisch fokussierbar.
  document.querySelector('.zum-inhalt')?.addEventListener('click', (ereignis) => {
    ereignis.preventDefault();
    el.focus();
    el.scrollIntoView();
  });
  for (const element of document.querySelectorAll('[data-menue-zu], .menue-punkt, .menue-mini')) {
    element.addEventListener('click', schliesseMenue);
  }
  // Schnellumschalter in der Kopfzeile. Er schreibt dieselbe Einstellung wie das
  // Profil-Auswahlfeld; neuRendern() über 'app:rendern' zieht ein offenes Profil
  // nach, damit dort nicht die alte Auswahl stehen bleibt.
  document.getElementById('kopf-thema')?.addEventListener('click', () => {
    const neu = document.getElementById('kopf-thema').dataset.ziel === 'hell' ? 'hell' : 'dunkel';
    setzeEinstellung('thema', neu);
    wendeThemaAn(neu);
    window.dispatchEvent(new CustomEvent('app:rendern'));
  });
  // Der Knopf hängt am Ereignis, nicht am eigenen Klick: Das Profil-Auswahlfeld
  // ruft wendeThemaAn() ebenfalls, rendert dabei aber bewusst nicht neu (sonst
  // verlöre das Feld den Fokus). Ohne diesen Mithörer blieb der Kopfzeilen-Knopf
  // nach einer Umstellung im Profil auf dem alten Symbol stehen und bot den
  // Wechsel in das Thema an, das bereits galt.
  window.addEventListener('app:thema', aktualisiereThemaKnopf);
  // Folgt das Thema dem Betriebssystem („auto"), kippt es ohne unser Zutun —
  // der Knopf muss dann sein Ziel umdrehen, sonst zeigt er ins Leere.
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', aktualisiereThemaKnopf);
  window.addEventListener('keydown', (ereignis) => {
    if (ereignis.key === 'Escape') schliesseMenue();
  });

  window.addEventListener('hashchange', rendern);
  window.addEventListener('app:rendern', rendern);
  // Fortschritt aus einem zweiten Tab übernehmen (s. uebernehmeFremdenStand).
  // `ereignis.key === null` heisst „Speicher komplett geleert" — auch dann neu
  // einlesen. Fremde Schlüssel (Werkzeug-Speicher) ignorieren wir.
  window.addEventListener('storage', (ereignis) => {
    if (ereignis.key !== null && ereignis.key !== 'moshschool.zustand.v1') return;
    if (uebernehmeFremdenStand()) rendern();
  });
  rendern();

  // Nicht-kritische Daten ERST NACH dem ersten Anstrich holen (die Startseite
  // braucht keins davon) — so konkurrieren die großen Dateien nicht mit den
  // Kern-Daten um Bandbreite und der Erst-Render kommt früher. bausteinIcon/
  // lehrgrafik fallen bis dahin leer bzw. auf FA-/Domänen-Icons zurück (kein
  // Bruch); der Such-Index (index.json, ~200 KB gzip) ist nur für die Suche.
  // Jeder Nachlade-Schritt löst einen idempotenten Neu-Render aus.
  Promise.all([
    fetch('data/grafiken.json').then((a) => (a.ok ? a.json() : {})).catch(() => ({})),
    fetch('data/lehrgrafiken.json').then((a) => (a.ok ? a.json() : {})).catch(() => ({})),
  ]).then(([g, lg]) => {
    setzeGrafiken(g);
    setzeLehrgrafiken(lg);
    rendern();
  });
  ladeSuchindex(daten).then(() => rendern());

  // Feedback-Modus (nur bei ?feedback in der URL): Kommentator nachladen. Läuft
  // beiläufig — schlägt es fehl, bleibt die App davon unberührt. Der Knopf unter
  // „Mitmachen" startet ihn alternativ ohne Reload (aktiviereFeedback).
  initFeedbackWennGewuenscht();

  registriereServiceWorker();
}

// Offline-Fähigkeit: den Service Worker beiläufig registrieren. Jeder Fehler
// (kein SW-Support, file://) wird verschluckt — die App bleibt unberührt.
// Relativer Pfad, damit die Registrierung unter „/" wie unter Unterpfad greift.
// boot() ist async und wartet auf i18n+Daten; das 'load'-Ereignis kann dabei
// schon gefeuert haben. Darum: ist die Seite fertig, sofort registrieren, sonst
// auf 'load' warten — sonst verpasste ein zu spät gesetzter Listener das Ereignis.
function registriereServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const registriere = () => navigator.serviceWorker.register('sw.js').catch(() => {});
  if (document.readyState === 'complete') registriere();
  else window.addEventListener('load', registriere, { once: true });
}

boot();
