# CLAUDE.md

Leitfaden für Beitragende und KI-Assistenten an dieser Codebasis. Kurz halten,
was der Code schon sagt; hier steht nur, was man **wissen muss, bevor** man etwas ändert.

## Was das ist

**mosh school** — eine clientseitige Lernapp fürs Spielen von Extreme-Metal-Instrumenten
(Gitarre, Bass, Schlagzeug, Gesang) in den Genres Hardcore, Metalcore, Thrash, Death,
Black und Doom. Rein statisch: HTML/CSS/JS als ES-Module, **kein Build-Schritt, keine
Server-Komponente, keine npm-Laufzeitabhängigkeiten**. Inhalte kommen aus JSON in `data/`,
Fortschritt lebt in `localStorage`. Quellsprache Deutsch, du-Form. (Die App ist aus einer
Crossminton-Lern-Engine geforkt — die Engine ist themenneutral, der Inhalt ist Metal.)

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
praktisch stützen (Klick/Metronom, Play-along-Loops, Stimmgerät, Song-Struktur,
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
- **Persistenz:** Werkzeug-Einstellungen sind vorerst **flüchtiger Modul-State**
  (wie patterns.js) — das versionierte `zustand.js`-Schema bleibt unangetastet.
  Echte Persistenz (localStorage für Strukturen, **IndexedDB** für Audio-Blobs)
  kommt mit dem Song-Struktur-Baukasten und den Rekordern.
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
4. **Service Worker:** die neue Datei in `SHELL` (`sw.js`) aufnehmen **und** `CACHE` erhöhen
   (`mosh-vN` → `mosh-vN+1`). Sonst bekommen Offline-Nutzer die Datei nie.
5. **Validieren:** `python3 scripts/validate.py` (muss „OK — strukturell sauber" zeigen).
6. **Verifizieren:** `python3 -m http.server 8000` + Playwright durchklicken (s. u.).

**Neuer Vokabelwert** (neuer `stil`, neue `domaene`, neuer `spielziele`-Faktor) ist eine
*koordinierte* Erweiterung: Wert in `vokabulare` der **kanonischen Gitarren-Datei** ergänzen
**und** Label unter `vokabeln.*` bzw. `spielziele` in `labels/de.json`. Erst dann nutzbar.

## Verifikation (Pflicht vor jedem Commit)

```sh
python3 scripts/validate.py     # Cross-File-Konsistenz über den gemischten Pool
python3 scripts/lift.py         # idempotent — Titel geliftet, Skelette aktuell
python3 -m http.server 8000     # dann im Browser / per Playwright durchklicken
```

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
- **Blutrot ist Akzent** (Links, Aktion, Aktiv-Zustand, Icons), keine Flächenfarbe;
  Ampellogik für Status (offen/teilweise/erledigt). Hell & Dunkel über denselben Token-Satz.
- **Kondensierte Display-Schrift** (Anton, lokal als `assets/fonts/anton-regular.ttf`) für
  H1/H2/Marke; Fließtext Rubik. Hart-kantige Container, versetzte Schatten, Grain-Overlay.
- **Icons:** Font Awesome Solid ist ein **lokales Subset** — neue Codepoints rendern als Tofu
  und lassen sich hier nicht nachziehen. Instrument-Symbole liegen daher als **Inline-SVG**
  (`INSTRUMENT_SVG` + `domaeneIcon()` in `js/oberflaeche.js`); Baustein-Icons in `BAUSTEIN_ICONS`.
- **Baustein-Grafiken:** Jeder Baustein hat eine abstrakte, monochrome SVG-Grafik
  (`data/grafiken.json`, `{id: "<svg…>"}`). Quelle der Wahrheit sind die deterministischen
  Generatoren `scripts/build_svg.py`/`build_svg2.py`/`build_svg3.py`;
  `python3 scripts/build_grafiken.py` führt sie in dieser Reihenfolge aus und bündelt das
  JSON — **Motive dort korrigieren und neu generieren, nie SVGs/Bundle von Hand editieren**.
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
- **SW-Wartung:** wird eine Kern-Datei neu hinzugefügt/umbenannt (neues `js/`-Modul, neue
  `data/…json` in `INHALTSDATEIEN`, CSS, Schrift), muss sie in `SHELL` **und** der `CACHE`-Name
  erhöht werden. Baustein-Grafiken (`images/*.png`, falls später ergänzt) werden bewusst NICHT
  vorgeladen. Kein Test deckt die SHELL-Liste ab — von Hand mitziehen.
- **Genau eines von `uebungsteil`/`reflexionsaufgabe`** je Baustein. Bewegungs-Bausteine tragen
  den Übungsteil; Wissens-/Reflexions-Bausteine (Mentales, Gesundheit, Ausrüstung) die
  Reflexionsaufgabe. `validate.py` prüft das.
- **Skelette nach Datenänderung neu erzeugen** (`scripts/lift.py`): `labels/{en,fr,pl}.json`
  sind strukturgleiche, leere Gerüste von `de.json` (leere Werte fallen zur Laufzeit auf de zurück).
