// Hintergrundbilder für Heros und Kacheln — die Bildebene hinter Motiv und Scrim.
//
// Themenneutral und DOM-frei: Das Modul kennt nur eine Liste von Dateinamen und
// liefert zu einem Schlüssel (Genre-Slug, Bereichs-ID, …) deterministisch ein
// Bild plus das fertige HTML-Fragment der Bildebene.
//
// Deterministisch heißt: derselbe Schlüssel bekommt über Reloads hinweg dasselbe
// Bild — sonst flackerte die Startseite bei jedem Anstrich durch. Dieselbe
// Technik wie bei den Genre-Motiven (FNV-1a-Hash über den Schlüssel), nur dass
// hier in eine Bilderliste statt in Formparameter abgebildet wird. Welches Foto
// wo landet, ist bewusst keine inhaltliche Aussage: Bei 18 px Weichzeichnung und
// 35 % Deckkraft bleibt von einem Motiv nur noch Farbe und Textur übrig.
//
// Die Liste kommt aus images/bg/bilder.json (erzeugt von
// scripts/build_bg_index.py, gepflegt vom Workflow bg-index.yml). Fehlt sie oder
// ist sie leer, liefert bildEbene() einen leeren String — Heros und Kacheln
// sehen dann aus wie vorher. Die Bildebene ist reine Zutat, nie Voraussetzung.

// Modulweite Registry, gesetzt beim Boot (js/app.js) — analog zu setzeGrafiken().
let BILDER = [];

// Basispfad der Bilder. Relativ, damit es unter „/" wie unter „/mosh-school/"
// funktioniert (dieselbe Regel wie im Service Worker).
const ORDNER = 'images/bg/';

// Obergrenze je Bild. Die Startseite lädt rund zehn Hintergründe — ein einzelnes
// Bild von mehreren hundert Kilobyte schlägt dort voll durch, obwohl von ihm nach
// 18 px Weichzeichnung nichts als Farbe übrig bleibt. Die Vorgabe für den Ordner
// sind 150–250 KB (siehe images/bg/README.md); diese Grenze liegt bewusst
// deutlich darüber und greift damit nur bei echten Ausreißern.
//
// Ein übergangenes Bild ist NICHT verloren: Es bleibt im Ordner, bleibt in der
// Vergleichsseite sichtbar und kommt von selbst zurück, sobald es verkleinert
// ist — die Größe steht in bilder.json und wird bei jedem Push neu erzeugt.
const MAX_BYTES = 400 * 1024;

export function setzeHintergrundbilder(liste) {
  BILDER = Array.isArray(liste)
    ? liste.filter((b) => b && b.datei && !(b.bytes > MAX_BYTES))
    : [];
}

// FNV-1a über den Schlüssel — derselbe Hash wie in genre-inszenierung.js, hier
// aber lokal gehalten: Die beiden Module sollen sich nicht gegenseitig brauchen.
function hashSlug(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Der Dateiname darf Leerzeichen und Klammern enthalten (die Bilder kommen aus
// einem Foto-Ordner) — deshalb kodieren, sonst bricht die url() im style-Attribut.
export function hintergrundBild(schluessel) {
  if (!BILDER.length) return '';
  const eintrag = BILDER[hashSlug('mosh-bg:' + String(schluessel)) % BILDER.length];
  return ORDNER + encodeURIComponent(eintrag.datei);
}

// Die Bildebene als HTML. Gehört im Hero/in der Kachel VOR das Motiv-SVG —
// die Reihenfolge im DOM ist die Schichtung: Bild ganz hinten, dann Motiv,
// dann Scrim, dann Text.
//
// WICHTIG — warum hier `background-image` steht und keine Custom Property:
// Ein relatives url() in einer Custom Property wird NICHT gegen das Dokument
// aufgelöst, sondern gegen das Stylesheet, in dem die var() steht. Über
// `--hero-bild` landete der Pfad deshalb bei „css/images/bg/…" statt bei
// „images/bg/…" — 404 für jedes einzelne Bild. Inline auf background-image
// gesetzt, gilt die Dokument-Basis, und derselbe relative Pfad funktioniert
// unter „/" wie unter „/mosh-school/". Alles Übrige (Position, Zuschnitt,
// Weichzeichnung, Deckkraft) bleibt in .genre-landing-bg in css/app.css.
//
// Einfache Anführungszeichen im url(): Die Dateinamen kommen aus einem
// Foto-Ordner und enthalten Klammern — unquotiert bräche die url() daran.
export function bildEbene(schluessel) {
  const url = hintergrundBild(schluessel);
  if (!url) return '';
  return `<div class="genre-landing-bg" aria-hidden="true" style="background-image:url('${url}')"></div>`;
}
