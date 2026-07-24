// App-Einstieg: Boot (Zustand → Sprache → Daten), Hash-Router und Navigation.
// Ansichten rendern in #ansicht; Zustandsänderungen stoßen über das Ereignis
// 'app:rendern' ein Neu-Rendern der aktuellen Route an.

import { renderBaustein } from './ansichten/baustein.js';
import { renderHeim } from './ansichten/heim.js';
import { renderMitmachen, renderRechtstext, renderUeber } from './ansichten/info.js';
import { renderOnboarding } from './ansichten/onboarding.js';
import { renderPlan } from './ansichten/plan.js';
import { renderBand, renderIndividual, renderInstrument, renderKompetenzpfad, renderStil, renderThemen, renderUmgebung } from './ansichten/pfad.js';
import { renderProfil } from './ansichten/profil.js';
import { renderStimmungen } from './ansichten/stimmungen.js';
import { renderPatterns } from './ansichten/patterns.js';
import { renderSongs } from './ansichten/songs.js';
import { renderWerkzeuge } from './ansichten/werkzeuge.js';
import { renderWerkzeugMetronom } from './ansichten/werkzeug-metronom.js';
import { renderWerkzeugLoops } from './ansichten/werkzeug-loops.js';
import { renderWerkzeugStimmgeraet } from './ansichten/werkzeug-stimmgeraet.js';
import { renderWerkzeugPedalboard } from './ansichten/werkzeug-pedalboard.js';
import { renderWerkzeugAmpbox } from './ansichten/werkzeug-ampbox.js';
import { renderWerkzeugStruktur } from './ansichten/werkzeug-struktur.js';
import { renderWerkzeugRecorder } from './ansichten/werkzeug-recorder.js';
import { renderWerkzeugMehrspur } from './ansichten/werkzeug-mehrspur.js';
import { renderWerkzeugExplorer } from './ansichten/werkzeug-explorer.js';
import { renderWerkzeugLandkarte } from './ansichten/werkzeug-landkarte.js';
import { renderWerkzeugGenremix } from './ansichten/werkzeug-genremix.js';
import { renderKoennenscheck } from './ansichten/koennenscheck.js';
import { renderExperimentieren } from './ansichten/experimentieren.js';
import { renderLernen, renderSongwriting, renderUeben } from './ansichten/hub.js';
import { renderGeraete } from './ansichten/geraete.js';
import { renderSuche } from './ansichten/suche.js';
import { renderTraining } from './ansichten/training.js';
import { renderWillkommen } from './ansichten/willkommen.js';
import { ladeDaten } from './daten.js';
import { initFeedbackWennGewuenscht } from './feedback.js';
import { initI18n, t } from './i18n.js';
import { esc, fuehreAufraeumenAus, setzeGrafiken, setzeLehrgrafiken } from './oberflaeche.js';
import { einstellungen, istOnboardingAbgeschlossen, ladeZustand, schliesseOnboardingAb } from './zustand.js';

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

function richteRevealEin(el) {
  if (revealBeobachter) {
    revealBeobachter.disconnect();
    revealBeobachter = null;
  }
  if (!bewegungErlaubt || typeof IntersectionObserver !== 'function') return;
  const ziele = el.querySelectorAll('.reveal');
  if (!ziele.length) return;
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
    : s0 === 'profil'
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
                      : s0 === 'ueber'
                        ? 'ueber'
                        : s0 === 'pfad' && segmente[1] === 'stil'
                          ? 'genres'
                          : s0 === 'pfad' && segmente[1] === 'umgebung'
                            ? 'kontext'
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
  const imMehrNav = ['lernen', 'ueben', 'songwriting', 'experimentieren', 'genres', 'kontext', 'geraete', 'stimmungen', 'patterns', 'ueber'];
  const imMehr = imMehrNav.includes(aktiv) || ['songs', 'suche', 'koennenscheck', 'mitmachen', 'impressum', 'datenschutz'].includes(s0);
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

function beschrifteRahmen() {
  document.title = t('app_titel');
  const zumInhalt = document.querySelector('.zum-inhalt');
  if (zumInhalt) zumInhalt.textContent = t('skip_link');
  document.querySelector('.marke-text').textContent = t('app_titel');
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
  const fokusVorher = letzteRoute !== null && roh === letzteRoute ? fokusSchluessel(document.activeElement) : null;

  // Erstlauf: Willkommensseite mit den zwei Einstiegen; der Wizard ist einer
  // davon. Nur die leere Route zeigt die Willkommensseite — aktive Navigation
  // tritt frei ein (s. u.).
  let erstlauf = !istOnboardingAbgeschlossen();
  // Zwei-Ebenen-Logik (4.4): Zugriff wird nie gesperrt. Navigiert die Person vor
  // Abschluss des Onboardings aktiv in einen echten Bereich (z. B. über die
  // Kopf-Navigation), gilt das als freier Einstieg — wie „Freies Handbuch" —
  // statt sie auf die Willkommensseite zurückzuwerfen. So funktioniert die
  // Navigation von Anfang an, und Kopf-Icons bleiben durchgehend sichtbar.
  if (erstlauf && segmente.length > 0 && segmente[0] !== 'onboarding') {
    schliesseOnboardingAb();
    erstlauf = false;
  }
  document.body.classList.toggle('im-onboarding', segmente[0] === 'onboarding' || erstlauf);
  beschrifteRahmen();

  if (erstlauf && segmente.length === 0) {
    renderWillkommen(el, daten);
    aktualisiereNavigation(segmente);
    return;
  }

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
  } else if (segmente[0] === 'impressum') {
    renderRechtstext(el, daten, 'impressum');
  } else if (segmente[0] === 'datenschutz') {
    renderRechtstext(el, daten, 'datenschutz');
  } else if (segmente[0] === 'baustein' && segmente[1]) {
    renderBaustein(el, daten, sicherDecode(segmente[1]), query.get('kontext') || 'kompetenz');
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
  richteRevealEin(el);
}

async function boot() {
  ladeZustand();
  // Bewegungseffekte (Reinboxen/Einblendungen) nur freischalten, wenn das System
  // keine reduzierte Bewegung verlangt — die CSS-Regeln hängen an .anim-reveal.
  if (bewegungErlaubt) document.documentElement.classList.add('anim-reveal');
  const el = document.getElementById('ansicht');
  // Baustein-Grafiken laufen beiläufig mit: Fehlt die Datei, bleibt die Registry
  // leer und bausteinIcon fällt auf die FA-/Domänen-Icons zurück (kein Bruch).
  const lehrgrafikenLaden = fetch('data/lehrgrafiken.json')
    .then((a) => (a.ok ? a.json() : {}))
    .catch(() => ({}));
  const grafikenLaden = fetch('data/grafiken.json')
    .then((antwort) => (antwort.ok ? antwort.json() : {}))
    .catch(() => ({}));
  try {
    await initI18n(einstellungen().sprache);
    daten = await ladeDaten();
    setzeGrafiken(await grafikenLaden);
    setzeLehrgrafiken(await lehrgrafikenLaden);
  } catch (fehler) {
    try {
      await initI18n('de');
    } catch {
      // Ohne Labels bleibt nur die nackte Fehlermeldung — t() fällt auf Schlüssel zurück.
    }
    renderFehler(el, fehler);
    return;
  }
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
  // Der Themen-Umschalter lebt nur noch im Profil (nicht mehr im Menü).
  window.addEventListener('keydown', (ereignis) => {
    if (ereignis.key === 'Escape') schliesseMenue();
  });

  window.addEventListener('hashchange', rendern);
  window.addEventListener('app:rendern', rendern);
  rendern();

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
