# CLAUDE.md

Leitfaden für Beitragende und KI-Assistenten an dieser Codebasis. Kurz halten,
was der Code schon sagt; hier steht nur, was man **wissen muss, bevor** man etwas ändert.

## Was das ist

**ZERRER** — eine clientseitige Lernapp fürs Spielen von Extreme-Metal-Instrumenten
(Gitarre, Bass, Schlagzeug, Gesang) in den Genres Hardcore, Metalcore, Thrash, Death,
Black und Doom. Rein statisch: HTML/CSS/JS als ES-Module, **kein Build-Schritt, keine
Server-Komponente, keine npm-Laufzeitabhängigkeiten**. Inhalte kommen aus JSON in `data/`,
Fortschritt lebt in `localStorage`. Quellsprache Deutsch, du-Form. (Die App ist aus einer
Crossminton-Lern-Engine geforkt — die Engine ist themenneutral, der Inhalt ist Metal.)

## Name, Speicher, Pfade — drei Ebenen, die auseinanderfallen dürfen

Das Projekt heißt seit der Umbenennung **ZERRER**, Subline **„Mosh School"**. Drei
Dinge tragen den alten Namen weiter, und zwar mit Absicht:

- **Speicher-Schlüssel bleiben `moshschool.*`** (`zustand.v1`, `werkzeuge.v1`,
  `songs.v1`) und die IndexedDB-Datenbanken `moshschool-aufnahmen` /
  `moshschool-mehrspur`. Sie umzubenennen hieße: **jeder bestehende Nutzer
  verliert seinen Fortschritt und seine Aufnahmen.** Der Schlüssel ist eine
  technische Adresse, kein Anzeigename — er wird nicht mitgezogen. Das gilt auch
  für das Inline-Theme-Skript im `<head>` von `index.html`, das denselben
  Schlüssel liest.
- **Repository und Deployment heißen weiter `mosh-school`.** Die Seite liegt
  unter `daimpad.github.io/mosh-school/`; `canonical`, `og:url`, `sitemap.xml`,
  `robots.txt` und der Quelltext-Link zeigen dorthin. Die Domain `zerrer.org`
  ist beschlossen, aber noch nicht geschaltet — wer sie scharf stellt, legt eine
  `CNAME`-Datei an, setzt die Pages-Custom-Domain und zieht erst *dann* die
  Meta-Angaben nach.
- **Sichtbarer Name kommt aus `t('app_titel')`** (= „ZERRER"), die Subline aus
  `t('hero_untertitel')` (= „Mosh School"). Nie hart schreiben.

## Nicht verhandelbare Architektur

- **Rein clientseitig, buildfrei.** Keine Abhängigkeit, die einen Bundler oder eine Laufzeit
  voraussetzt. Bibliotheken/Schriften nur als lokal eingecheckte statische Datei.
- **Inhalt getrennt von der Engine.** `js/` ist themenneutral. Bausteine sind JSON in `data/`;
  sichtbare Texte kommen aus `data/labels/<sprache>.json`. Nie einen Anzeigetext hart in
  JS/HTML schreiben — immer `t()`, `label()` oder `text()` aus `js/i18n.js`.
- **Ein Baustein-Pool, mehrere Dateien.** `INHALTSDATEIEN` in `js/daten.js` listet die zu
  mischenden `data/bausteine.*.json`; `baueIndizes` konkateniert sie. **Nur die erste Datei
  trägt den `vokabulare`-Block** (kanonisch) — weitere Dateien tragen keins und dürfen nur
  bestehende Vokabelwerte nutzen.
- **Identität getrennt von Beschriftung.** Sprachneutrale IDs in der Inhalts-JSON, sichtbare
  Titel geliftet nach `labels/de.json` (`bausteine`-Abschnitt). Der Laufzeit-Titelpfad ist
  einheitlich das Label-File (`label('baustein', id)`).
- **Fortschritt ist baustein-gebunden** (nie pfad-gebunden), Zustand in `js/zustand.js`
  (ein `localStorage`-Schlüssel `moshschool.zustand.v1`, versioniertes Schema).
- **Zwei-Ebenen-Logik.** Der Voraussetzungsgraph (`voraussetzungen`) *sortiert* nur, *sperrt
  nie*. Fehlende Voraussetzungen erscheinen als Hinweis, nie als Zugangssperre. Kanten dürfen
  datei-, stufen- und domänenübergreifend zeigen.

## Domänen, Stufen, Achsen

- **Domänen** (`vokabulare.domaene`): die vier Instrumente `gitarre`/`bass`/`schlagzeug`/`gesang`
  plus die Querschnitts-Domänen `koerper` (Gesundheit/Aufwärmen), `mentales`, `theorie`,
  `ausruestung`. Die Domäne klassifiziert einen Baustein fachlich.
- **Könnensstufen** (`vokabulare.kompetenzstufe`): `einsteiger` → `fortgeschritten` → `experte`,
  dazu orthogonal `trainer`. Der Kompetenzpfad ist **stufen-kumulativ** (ein Fortgeschrittener
  sieht Einsteiger + Fortgeschritten).
- **Genre-Achse** (`vokabulare.stil`, Route `#/pfad/stil`): bündelt Bausteine mit `stil:[…]`
  domänen- und stufenübergreifend zu einem Thema pro Genre. `stil` ist optional und
  klassifiziert nichts um — ein Baustein bleibt an seiner Domäne/Stufe. (Verdrahtet in
  `js/pfade.js` `stile()`/`stilpfad()`, analog zur alten Spielform-Achse.)
- **Pfade:** Kompetenz (`#/pfad/kompetenz/<stufe>`), Themen (`#/pfad/themen`, Domänen-Facetten),
  Individual (`#/pfad/individual`, nach Spielziel), Training (`#/training`). Die aus dem Fork
  geerbten Achsen **Spielform/Umgebung** sind derzeit inhaltlich unbespielt (dormant) — die
  Home-Kacheln blenden sich bei 0 Treffern aus.

## Informationsarchitektur (Navigation)

Die App ist nach **Tätigkeit** geordnet, nicht nach Inhaltstyp. Vier Aktivitäts-Hubs
sind reine Sammelseiten (`js/ansichten/hub.js` + `experimentieren.js`), die auf bestehende
Routen zeigen — **keine eigenen Inhalte, kein eigener Fortschritt**; Werkzeuge dürfen bewusst
in mehreren Hubs auftauchen:

- **Lernen** (`#/lernen`) — Instrumente, Genres, Kontext, Kompetenz, Suche, Geräte, Prüfung.
- **Üben** (`#/ueben`) — Training, Profil, Metronom/Stimmgerät/Loops, Patterns.
- **Songwriting** (`#/songwriting`) — Song-Struktur/Riff-/Mehrspur-Recorder, Amp-Box, Songs.
- **Experimentieren** (`#/experimentieren`) — eigener View (Deck + Grenzgänger).

**Untere Leiste (mobil):** Home · Tools (`#/werkzeuge`) · Profil · Mehr (öffnet das Menü).
**Menü:** die vier Hubs als Hauptpunkte (`.menue-haupt`), abgesetzt die Referenzbereiche
(Genres, Kontext, Geräte, Stimmungen, Patterns), abgesetzt Über/Impressum/Datenschutz. Der
**Themen-Umschalter lebt nur im Profil** (nicht mehr im Menü). Aktiv-Zustand + Rahmen-Labels
in `js/app.js` (`aktualisiereNavigation`/`beschrifteRahmen`); `data-nav`-Schlüssel = Label-Key.
**Geräte** (`#/werkzeug/explorer`) trägt vier Instrument-Kacheln zu den Geräte-Landings
(`#/geraete/<instrument>`, `js/ansichten/geraete.js`) — daten-getrieben aus `domaene ⊇
{ausruestung, <instrument>}`.

## Wo was liegt

| Ebene | Dateien | Regel |
| --- | --- | --- |
| Daten | `js/daten.js`, `js/graph.js` | reine Funktionen, kein DOM; Indizes + `pruefeDaten` |
| Engine | `js/pfade.js`, `js/fortschritt.js`, `js/plan.js`, `js/suche.js`, `js/aktionen.js` | reine Funktionen über Daten+Zustand; **kein DOM** |
| Zustand | `js/zustand.js` | einziger `localStorage`-Zugriff, versioniertes Schema |
| i18n | `js/i18n.js` | alle sichtbaren Texte laufen hier durch |
| Ansichten | `js/ansichten/*.js` | rendern HTML-Strings + binden Events; lesen die Engine, mutieren nie direkt |
| Audio-Kern | `js/audio/*.js` | **themenneutral, DOM-frei**: ein `AudioContext`, ein Scheduler, Stimmen, WAV — trägt alle Werkzeuge |
| Shell | `js/app.js` | Boot, Hash-Router, Navigation |
| Oberfläche | `js/oberflaeche.js` | Icons (`BAUSTEIN_ICONS`, Instrument-SVGs, `domaeneIcon`), Theme, Hero |

**Faustregel:** Logik gehört in die Engine (testbar, DOM-frei), nicht in die Ansichten.

## Werkzeuge (Audio) — `#/werkzeuge`

Der Bereich **Werkzeuge** bündelt interaktive Audio-Werkzeuge, die die Lern-Bausteine
praktisch stützen (Gear-Explorer als Karte, Klick/Metronom, Play-along-Loops, Stimmgerät, Song-Struktur,
Riff-/Mehrspur-Rekorder). Referenzbereich wie Stimmungen/Patterns — **NICHT im
Baustein-Pool, kein Fortschritt**. Hub-View `js/ansichten/werkzeuge.js`, je Werkzeug
eine eigene View + Route `#/werkzeug/<name>`.

- **Ein gemeinsamer Audio-Kern** (`js/audio/`, themenneutral, DOM-frei) trägt ALLE
  Werkzeuge — nie sechs getrennte Audio-Implementierungen:
  - `kontext.js` — **ein** `AudioContext` (Singleton) + Master-Gain + geteilter
    Rausch-Puffer. `aktiviere()` startet/`resume()`t den Kontext **nur aus einer
    User-Geste** (Autoplay-Policy); jede Werkzeug-View zeigt bis dahin „Audio
    aktivieren". `istBereit()` steuert diesen Schritt.
  - `scheduler.js` — **ein** Lookahead-Scheduler (Muster „A Tale of Two Clocks":
    25 ms-Tick, 100 ms-Planung gegen `currentTime`). Schritt-basiert und
    tempo-agnostisch: `schrittDauer(i)→s|null` (konstant = Metronom, steigend =
    Ramp, aus Tabelle = Tempo-Map; `null` beendet). **Naives `setInterval`/
    `setTimeout`-Timing für Klang ist unzulässig** (hörbare Drift) — die Audio-Uhr
    trägt das Timing, der Timer weckt nur zum Nachplanen.
  - `stimmen.js` — **synthetisierte** Stimmen (`klick`, `kick`, `snare`, …); jede
    nimmt `ctx`+`ziel` entgegen, damit sie live **und** im `OfflineAudioContext`
    (WAV-Export) identisch klingt. **Synthese statt Samples** (offline, leicht) —
    Samples nur, wenn nötig, dann vendored + im SW gecacht.
  - `wav.js` — rendert eine geplante Klangfolge über `OfflineAudioContext` in einen
    WAV-Blob (DAW-tauglicher als `MediaRecorder`-WebM/Opus).
- **Verlinkungs-Konvention Baustein → Werkzeug** (`js/werkzeug-links.js`):
  Route-Form `#/werkzeug/<name>?<preset>`; Presets sind einfache Query-Parameter,
  die die View beim Laden liest (`bpm`, `rampe`, später `stil`/`note`). Unbekannte
  Parameter ignoriert die View — Vorbelegung ist immer optional. `werkzeugeFuer(b)`
  liefert die Links über zwei Ebenen (explizite ID-Regeln schlagen generische
  Regeln über `spielziele`/`stil`); die Baustein-Ansicht rendert daraus die
  „Passendes Werkzeug"-Chips. **Neue Anbindungen NUR hier** — die Werkzeuge kennen
  die Bausteine nicht.
- **Persistenz:** Audio-Werkzeug-Einstellungen sind **flüchtiger Modul-State**
  (wie patterns.js). Für gespeicherte Strukturen (Pedalketten, später Song-
  Strukturen) gibt es `js/werkzeug-speicher.js` — ein **eigener localStorage-
  Namespace** (`moshschool.werkzeuge.v1`), bewusst getrennt vom versionierten
  `zustand.js`-Fortschritts-Schema. Audio-Blobs liegen in **IndexedDB** —
  Riff-Recorder in `js/audio/riff-db.js` (DB `moshschool-aufnahmen`), Mehrspur-
  Skizzen in `js/audio/spuren-db.js` (DB `moshschool-mehrspur`) — nicht in
  localStorage (Größe) und nicht im Zustand-Schema.
- **SW-Pflege:** neue `js/audio/*`- und `js/ansichten/werkzeug*`-Module gehören in
  `SHELL` + `CACHE`-Bump (wie jedes Kern-Modul). Zugänglichkeit: tastaturbedienbar,
  ARIA; Tuner/Klick brauchen **nicht-farbliche** Signale (Zahl/Form, nicht nur Farbe).

## Neuen Inhalt einbinden (Content-Pipeline)

Für jede neue `data/bausteine.<stufe>-<instrument>.json`:

1. **Datei nach `data/` legen.** Schema-Vorlage: `data/bausteine.einsteiger-gitarre.json`.
   Top-Level `{ "_meta", "delta_bausteine": [], "bausteine": [] }`, **kein** `vokabulare`.
   Je Baustein: `id` (eindeutig im Gesamtpool), `anzeigetitel.de`, `domaene` (Liste),
   `kompetenzstufe` (Liste), `typ:"micro"`, optional `stil`/`voraussetzungen`/`spielziele`,
   und **genau eines** von `uebungsteil` (`{titel, ziel, schritte[], steigerung,
   selbstkontrolle}`) oder `reflexionsaufgabe` (Text).
2. **Pfad in `INHALTSDATEIEN`** (`js/daten.js`) ergänzen. Reihenfolge = Erzählreihenfolge.
3. **Titel liften + Skelette regenerieren:** `python3 scripts/lift.py`
   (hebt alle `anzeigetitel.de` nach `labels/de.json`, erzeugt `en/fr/pl` neu).
3b. **Such-Index neu bauen:** `python3 scripts/build_index.py` (regeneriert
   `data/index.json` aus dem Pool + gelifteten Titeln — generiertes Artefakt, eingecheckt).
4. **Service Worker:** die neue Datei in `SHELL` (`sw.js`) aufnehmen **und** `CACHE` erhöhen
   (`mosh-vN` → `mosh-vN+1`). Sonst bekommen Offline-Nutzer die Datei nie.
5. **Validieren:** `python3 scripts/validate.py` (muss „OK — strukturell sauber" zeigen).
6. **Verifizieren:** `python3 -m http.server 8000` + Playwright durchklicken (s. u.).

**Neuer Vokabelwert** (neuer `stil`, neue `domaene`, neuer `spielziele`-Faktor) ist eine
*koordinierte* Erweiterung: Wert in `vokabulare` der **kanonischen Gitarren-Datei** ergänzen
**und** Label unter `vokabeln.*` bzw. `spielziele` in `labels/de.json`. Erst dann nutzbar.

## Trainings-Loop (Unterbau)

Der Trainings-Loop (zeigen → üben → markieren → Fortschritt sehen) hebt vorhandene
Struktur, statt neue Inhalte zu verlangen. Der Unterbau (§0 der Übergabe):

- **Such-/Metadaten-Index** `data/index.json` (generiert via `scripts/build_index.py`,
  eingecheckt wie `grafiken.json`). Ein Eintrag je Baustein/Fehlerbild: Facetten
  (`domaene/kompetenzstufe/stil/spielziele/typ`), `voraussetzungen`, `hat_demo` und
  ein gedeckeltes, kleingeschriebenes `text`-Token-Feld für die reine In-Memory-Suche
  (kein externer Index, keine Lib). `typ` ist abgeleitet (`uebung`/`reflexion`/
  `fehlerbild`). Geladen in `js/daten.js` als `daten.suchindex`.
- **Fortschritts-Store = `js/zustand.js`** (kein zweiter Store — das versionierte
  Ein-Schlüssel-Schema bleibt kanonisch). **Schema 2** ergänzt additiv:
  `status` (baustein-gebundener Mastery-Zustand `neu`/`in_arbeit`/`sitzt`, getrennt
  vom teil-genauen `fortschritt`), `log` (Übe-Tagebuch), `ziele`, `bestwerte`,
  `meilensteine`, `onboarding`. Alt-Stände (Schema 1) heben sich per `tiefMerge`
  verlustfrei. Neu: `exportiereZustand()`/`importiereZustand()` (portables
  JSON-Backup, kein Konto). Jeder Mutator persistiert über `schreibe()`; Sichten
  rendern nach einer Änderung über das `app:rendern`-Ereignis (`neuRendern`) neu.
- **Optionales Baustein-Feld `demonstration`** (rückwärtskompatibel): `pattern`
  (Rhythmus-Raster, `spuren[].instrument/schritte`), `tab` (Saite × Zeit,
  `events[].saite/bund/technik`) oder `hoerbeispiel` (`verweis_genre`). Abgespielt
  über den **Audio-Kern der Werkzeuge** (Synthese, kein Asset). `validate.py`
  akzeptiert Abwesenheit und prüft bei Anwesenheit die Struktur (erlaubte
  Instrumente/Techniken, Rasterlänge = `aufloesung*takte`, `saite` 1..6).

## Verifikation (Pflicht vor jedem Commit)

```sh
python3 scripts/validate.py              # Cross-File-Konsistenz über den gemischten Pool
python3 scripts/lift.py                  # idempotent — Titel geliftet, Skelette aktuell
python3 scripts/build_grafiken.py --check # Grafik-Bundles aus den Quellen reproduzierbar
python3 -m http.server 8000              # dann im Browser / per Playwright durchklicken
```

Dieselben Prüfungen laufen bei jedem PR automatisch über
`.github/workflows/verify.yml` (plus JSON-Wohlgeformtheit und JS-Syntax) — lokal
vorab laufen lassen bleibt trotzdem schneller als auf die CI zu warten.

**Fallstrick JS-Syntaxprüfung:** `node --check <datei>` ist für die Module dieser
App **unbrauchbar** — enthält eine Datei ein `import`, erkennt Node sie als ESM
und liefert Exit 0 **auch bei kaputter Syntax**. Das betrifft praktisch jedes
Modul, die Prüfung wäre also durchgehend falsch-grün. Richtig ist
`node --check --input-type=module < datei.js`; nur `sw.js` (klassisches Skript,
kein Modul) wird mit dem einfachen `node --check sw.js` geprüft.

**Es gibt kein `tests/`-Verzeichnis** (der Fork-Testlauf war crossminton-spezifisch und wurde
entfernt). `scripts/validate.py` spiegelt die Engine-Prüfungen (`pruefeDaten` + Kahn-Topo aus
`js/graph.js`): eindeutige IDs, auflösbare `voraussetzungen`, keine Zyklen, genau ein
Aufgabenteil je Baustein, gültige Vokabelwerte, echte Umlaute, gelieftete Titel.

**Playwright** (Chromium unter `/opt/pw-browsers/chromium`, `localStorage` per
`addInitScript` *vor* `goto` seeden mit Schlüssel `moshschool.zustand.v1`): prüfe Dunkel-Default,
Themen-/Kompetenz-/Genre-Achse und Deep-Links der neuen Bausteine — **ohne Konsolen- oder
404-Fehler**. Beide Themes (dunkel/hell/auto) rendern.

## CI / Design (grungy, düster, hart — hardcorig)

Farben/Typografie sind CSS-Variablen in `css/app.css` (`:root`) — Ansichten lesen **nur
Tokens**, nie harte Farben.

- **Dunkel ist Default.** Der Umschalter (Menü + Profil) setzt `einstellungen.thema`
  (`auto`/`hell`/`dunkel`); das **Inline-Skript im `<head>`** von `index.html` setzt
  `data-theme` flackerfrei vor dem ersten Anstrich, `wendeThemaAn()` (`js/oberflaeche.js`)
  zur Laufzeit. **Wichtig:** Das Inline-Skript liest denselben `localStorage`-Schlüssel wie
  `js/zustand.js` (`moshschool.zustand.v1`) — bei einer Schlüssel-Änderung beide nachziehen.
- **Hell ist ein eigener Zustand, kein aufgehelltes Dunkel.** Weisses Blatt: `#ffffff`
  als einzige Fläche, **keine Schatten**, Hero-Fotos in **Graustufen**
  (`--bild-saettigung: 0`), neutrale statt warmer Tinte. Was im Dunkeln der
  Versatz-Schatten leistet — Container trennen —, leistet hier die Tintenkante
  (`--karten-kante`, 1px). **Die Kante ist eine Klick-Zusage**: Sie erscheint nur
  an `a.karte-link`, `button.karte` und `.station` — Heros, `.abschnitt` und reine
  Inhalts-Karten bleiben randlos und tragen ihre Struktur über Überschrift und
  Abstand. Dieselbe Regel gilt für Hover (Kante rot, Anheben): nur wo geklickt
  werden kann. Die Breite (`--karten-kante-breite`) liegt an **allen** Containern
  transparent an, damit das Setzen der Farbe keinen Layout-Sprung auslöst.
  Trennlinien *innerhalb* eines Containers sind keine Ränder und laufen über
  `--trennlinie` (hell deutlich leichter als `--linie`, dunkel identisch) — sonst
  zerschneidet jede Listenzeile die Karte. Alles davon steht **ausschliesslich als Token** im Block
  „HELLES THEMA — weisses Blatt" **am Ende von `css/app.css`** (er muss später
  stehen als die `--bild-*`-Tokens). Der Block enthält bewusst **keine
  Komponentenregel**: Lässt sich etwas nicht abschalten, wird der Wert oben zum
  Token gemacht (so entstanden `--schatten-leiste/-schublade/-dialog/-ring`,
  `--filter-marke/-medaille`, `--schatten-plastisch`, `--karten-kante`,
  `--karten-kante-breite`, `--trennlinie`, `--hue-kachel-bg`, `--trainer-bg`).
  **Fallstrick:** `box-shadow: none, inset …`
  ist ungültig — ein abzuschaltender Schatten in einer *Liste* wird zum
  Null-Schatten `0 0 0 0 transparent`, nicht zu `none`. Die Hell-Selektoren
  (`:root[data-theme='hell']` + `@media (prefers-color-scheme: light) :root:not([data-theme='dunkel'])`)
  schliessen Dunkel beide aus — deshalb braucht es keine Rücknahme, dafür die
  Doppelung des Token-Blocks.
- **Blutrot ist Akzent** (Links, Aktion, Aktiv-Zustand, Icons), keine Flächenfarbe;
  Ampellogik für Status (offen/teilweise/erledigt). Hell & Dunkel über denselben Token-Satz.
- **Kondensierte Display-Schrift** (Anton, lokal als `assets/fonts/anton-regular.ttf`) für
  H1/H2/Marke; Fließtext Rubik. Hart-kantige Container, versetzte Schatten, Grain-Overlay.
- **Icons:** **Tabler Icons** (MIT), lokal eingebettet als **Inline-SVG-Masken** in
  `css/schriften.css` — keine Icon-Schrift, kein CDN. Jede `.fa-*`-Klasse trägt ein Tabler-
  Outline-SVG als CSS-`mask` (`--ti`), die Fläche kommt aus `background-color: currentColor`
  (erbt also die Textfarbe). Die alte `<i class="fa-solid fa-xxx">`-Markup bleibt bewusst
  erhalten (Klassennamen = FA-Konvention), nur die Darstellung ist Tabler-Outline statt
  gefüllt. **Neues Icon einbinden:** in `css/schriften.css` eine `.fa-<name> { --ti: url("data:…") }`-
  Zeile mit dem Tabler-SVG als Data-URI ergänzen (Quelle: `@tabler/icons` via npm, `icons/outline/`).
  Instrument-Symbole bleiben eigenständige **Inline-SVG** (`INSTRUMENT_SVG` + `domaeneIcon()` in
  `js/oberflaeche.js`); Baustein-Icons in `BAUSTEIN_ICONS`.
- **Baustein-Grafiken:** Jeder Baustein hat eine abstrakte, monochrome SVG-Grafik
  (`data/grafiken.json`, `{id: "<svg…>"}`). Quelle der Wahrheit sind die deterministischen
  Generatoren `scripts/build_svg.py`/`build_svg2.py`/`build_svg3.py`/`build_svg4.py` sowie
  die eingecheckten Einzelmotive in `scripts/svg_static/`;
  `python3 scripts/build_grafiken.py` führt sie in dieser Reihenfolge aus und bündelt das
  JSON — **Motive dort korrigieren und neu generieren, nie SVGs/Bundle von Hand editieren**.
  **Jedes Motiv braucht eine Quelle**: entweder einen Generator ODER eine Datei in
  `svg_static/` — nie beides. `python3 scripts/build_grafiken.py --check` baut nur in den
  Speicher und bricht ab, wenn das eingecheckte Bundle davon abweicht; damit fällt ein
  quellenloser Bundle-Eintrag sofort auf (genau so entstand einmal eine Drift von 183
  Motiven ohne Quelle, die den Vollbau unbrauchbar machte).
  Auch **Fehlerbilder** tragen Grafiken (Trainer-Layer): Tranche 3 komponiert sie
  deterministisch aus dem abgeblendeten Basis-Motiv plus gezacktem Riss (Seed =
  `crc32(fehlerbild_id)`) — sie werden nie einzeln gezeichnet, sondern folgen dem
  Basisbaustein automatisch. Die Grafiken nutzen ausschließlich `currentColor` und
  wirken deshalb **nur inline** (Registry `setzeGrafiken()` → `bausteinIcon()` in
  `js/oberflaeche.js`) — nie als `<img src>` einbinden. Formvokabular: Punkte = Puls ·
  Striche = gedämpft · Wellen = klingend · Bögen = Resonanz/Atem/Rebound · Ticks = Zeit ·
  Strichstärke = Gewicht · Rauigkeit (seeded Jitter) = Verzerrung/Harsh · Hohlkreise =
  Ghost Notes · Grid-Dichtewechsel = Tempo-/Metrik-Wechsel. Neue Bausteine ohne Grafik
  meldet `scripts/validate.py` als Warnung; vorproduzierte IDs (künftige Sets) sind okay.
- **Hintergrundbilder + Kachel-Muster:** Heros und die Startseiten-Kacheln tragen
  hinter dem Motiv-SVG eine Foto-Ebene (`js/hintergrundbilder.js` → `bildEbene()`,
  CSS `.genre-landing-bg`). Stärke über **Tokens an einer Stelle** im
  `:root`-Block direkt über der Regel: `--bild-weich` (0px = scharf),
  `--bild-deckkraft` (.8), `--bild-saettigung` (1), `--bild-zoom` (1.02). Der
  Überzoom existiert nur wegen der Weichzeichnung — wer `--bild-weich` hochdreht,
  muss `--bild-zoom` auf ~1.18 mitziehen, sonst zieht der Blur helle Bildränder in
  die Kante. **Wo ein Foto liegt, tritt das Motiv-SVG zurück**
  (`.genre-landing-bg ~ .genre-landing-bild { opacity: .1 }`) — über einem scharfen
  Bild kreuzen sich sonst zwei Zeichnungen; ohne Foto bleibt das Motiv der Träger
  der Fläche. Live vergleichen lassen sich die Werte über die Regler in
  `mockups/startseite-muster.html` — dessen Vorgaben spiegeln die ausgelieferten
  Werte, beim Ändern also mitziehen.
  Reihenfolge im DOM = Schichtung: **Bild → Motiv → Scrim → Text**. Bildwahl ist
  deterministisch (FNV-1a über den Bereichs-Schlüssel) und bewusst ohne inhaltliche
  Zuordnung. Zwei Dinge gelten nur im Container-Maßstab: der Blur skaliert mit
  (`--blur-faktor`, `.bildkachel` = .68 — greift erst wieder ab `--bild-weich > 0`),
  und die Lesbarkeit hängt nicht am flächigen Scrim, sondern an einem **Rückhalt
  direkt hinter dem Text** (`.bildkachel-inhalt::before`) — er wächst mit der
  Textlänge mit und lässt das Bild darüber frei. Ein flächiger Scrim, der für die
  kleine Hue-Augenbraue stark genug wäre, deckt sonst das halbe Foto zu. Der
  Rückhalt reicht oben bewusst weit über den Inhalt hinaus (`inset: -1.5rem …`),
  weil die Augenbraue sonst im Ausblendbereich säße. **Fallstrick:** Das Bild wird
  inline als `background-image` gesetzt, **nicht** über eine Custom Property — ein
  relatives `url()` in einer Custom Property wird gegen das *Stylesheet* aufgelöst
  (also gegen `css/`) statt gegen das Dokument und läuft ins Leere.
  Die Startseite folgt dem Muster „Rhythmus C" (verglichen in
  `mockups/startseite-muster.html`): Marke/Instrumente/Lernwege mit Bild,
  Werkzeuge flach mit Icon, Entdecken als Zeilen. Bilder sind reine Zutat — ohne
  `images/bg/bilder.json` rendert alles wie zuvor. Sie sind **nicht** in der
  SW-`SHELL` (Gewicht), nur das Verzeichnis ist es.
- **Lehrgrafiken** (Tranche 4, `scripts/build_svg4.py` → `data/lehrgrafiken.json`):
  breite Erklär-Schemata (viewBox 240×120 — Beat-Raster, Griffbilder, Anschlagsmuster),
  die die Baustein-Ansicht als `<figure>` nach dem Erklärteil rendert (Registry
  `setzeLehrgrafiken()` → `lehrgrafik()`), optional je Baustein-ID. Textfrei/i18n-neutral —
  die Legende liefert `label('lehrgrafik', id)` aus `labels/de.json` (Abschnitt
  `lehrgrafiken`, von Hand gepflegt wie Einheiten-Titel). Beat-Raster-Konvention:
  oben Hi-Hat (x), Mitte Snare (Hohlkreis), unten Kick (Punkt); Viertel = hohe,
  Achtel = kurze Rasterstriche.
- **Werkzeuge:** Das Stimmungs-Werkzeug (`#/stimmungen`, `js/ansichten/stimmungen.js`)
  ist eine interaktive Referenz mit WebAudio-Tönen; seine Daten (kuratierte Tunings mit
  Genre-Zuordnung aus dem `stil`-Vokabular) liegen in `data/tunings.json`, die sichtbaren
  Namen unter `vokabeln.stimmung` in `labels/de.json`. Referenzbereich wie Regeln —
  NICHT im Baustein-Pool, kein Fortschritt.

## Sprache & Sicherheit

- **Deutsch, du-Form, sachlich-klar** (nicht werblich). **Echte Umlaute** ä/ö/ü/ß — nie
  ae/oe/ue/ss-Ersatzschreibung (`validate.py` warnt bei Verdacht).
- **Gesundheitsrahmen** bei allen körper-/stimmbezogenen Inhalten (Technik, Athletik/`koerper`,
  Gesang): Prinzip statt riskanter Dosierung, immer Aufwärmen, „bei Schmerz/Kratzen sofort
  stoppen", Hinweis auf Coach bzw. Arzt. Vorlage: `data/bausteine.einsteiger-gesang.json`
  (Extreme Vocals — Verzerrung aus Luft/Resonanz statt Pressen, HNO-Arzt bei Beschwerden).

## Fallstricke

- **`file://` funktioniert nicht** — `fetch()` der JSON braucht HTTP. Immer über einen
  lokalen Server testen.
- **UI-Texte gehören unter `ui`** in `labels/de.json`: `t('schluessel')` schlägt unter
  `['ui', schluessel]` nach (nicht am Root). Ein am Root eingefügter Schlüssel wird nie
  gefunden und rendert als roher Key. Beim Verifizieren auch auf **sichtbaren** Text prüfen
  (nicht nur „keine Konsolenfehler") — ein fehlgeleitetes Label wirft keinen Fehler.
- **SW-Wartung:** wird eine Kern-Datei neu hinzugefügt/umbenannt (neues `js/`-Modul, neue
  `data/…json` in `INHALTSDATEIEN`, CSS, Schrift), muss sie in `SHELL` **und** der `CACHE`-Name
  erhöht werden. Baustein-Grafiken (`images/*.png`, falls später ergänzt) werden bewusst NICHT
  vorgeladen. Kein Test deckt die SHELL-Liste ab — von Hand mitziehen.
- **Genau eines von `uebungsteil`/`reflexionsaufgabe`** je Baustein. Bewegungs-Bausteine tragen
  den Übungsteil; Wissens-/Reflexions-Bausteine (Mentales, Gesundheit, Ausrüstung) die
  Reflexionsaufgabe. `validate.py` prüft das.
- **Skelette nach Datenänderung neu erzeugen** (`scripts/lift.py`): `labels/{en,fr,pl}.json`
  sind strukturgleiche, leere Gerüste von `de.json` (leere Werte fallen zur Laufzeit auf de zurück).
