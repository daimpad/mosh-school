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
- **Repository und GitHub-Pages-Deployment heißen weiter `mosh-school`.**
  Produktiv läuft die Seite unter der Domain **`zerrer.org`**, gehostet bei
  netcup: ein Webhook auf netcup zieht bei jedem Push nach `main` den
  aktuellen Stand direkt von GitHub — **kein** GitHub-Pages-Custom-Domain-
  Mechanismus, also auch keine `CNAME`-Datei. `.github/workflows/pages.yml`
  veröffentlicht denselben Stand parallel weiter unter
  `daimpad.github.io/mosh-school/` (Repo-Name/Pages-URL ziehen den
  Domain-Wechsel bewusst nicht nach). Weil beide Kopien exakt denselben
  statischen Stand ausliefern, verhindert allein ein korrektes `canonical`
  auf `https://zerrer.org/` Duplicate-Content — deshalb zeigen `canonical`,
  `og:url`, das `ld+json` in `index.html`, `sitemap.xml` und `robots.txt` auf
  `zerrer.org`. DNS und TLS-Zertifikat für `zerrer.org` liegen bei netcup,
  nicht in diesem Repo.
- **Sichtbarer Name kommt aus `t('app_titel')`** (= „ZERRER"), die Subline im
  Seitentitel aus `t('hero_untertitel')` (= „Mosh School"). Nie hart schreiben.
- **Die zwei Zweige unter der Marke** — „Zerrer Mosh Skool" (Lernangebot) und
  „Zerrer Kollektiv" (Shows Köln/Bonn) — stehen an drei Stellen: Startseiten-Hero,
  Fußzeile der App und Fußzeile der statischen Tier-2-Seiten. Gerendert werden
  sie aus **einer** Quelle: `markenZeilenHtml()` in `js/oberflaeche.js` (App) und
  `marken_zeilen()` in `scripts/build_seiten.py` (statisch), beide über dieselben
  vier Labels `marke_{schule,kollektiv}_{name,kurz}`. Die Fußzeile trug vorher
  einen eigenen, hart in `index.html` geschriebenen Claim — deshalb steht dort
  jetzt ein leeres `<span class="footer-marke-claim">`, das `beschrifteRahmen()`
  füllt. Im Hero tragen die Namen einen Chip und verlinken ihren Bereich
  (`#/lernen`, `#/kollektiv`), in den Fußzeilen bleiben es Textzeilen.

## Nicht verhandelbare Architektur

- **Rein clientseitig, buildfrei.** Keine Abhängigkeit, die einen Bundler oder eine Laufzeit
  voraussetzt. Bibliotheken/Schriften nur als lokal eingecheckte statische Datei. **Eine
  dokumentierte Ausnahme:** das Reichweitenmessungs-Skript von GoatCounter (`gc.zgo.at/count.js`,
  eingebunden am Ende von `index.html` und in jeder von `scripts/build_seiten.py` erzeugten
  Tier-2-Seite). GoatCounter rät selbst vom Vendoren/Self-Hosting des Skripts ab, weil es
  synchron mit der Server-Version bleiben muss — ein lokal eingecheckter Stand würde
  stillschweigend veralten. In der SPA läuft es mit `no_onload`: `js/app.js` (`rendern()`)
  zählt stattdessen selbst bei jedem echten Routenwechsel (`window.goatcounter?.count?.(…)`),
  sonst zählte eine Hash-Routing-App nur den ersten Aufruf. Details/Rechtsgrundlage:
  `data/app-info.json` → `rechtliches.datenschutz` (Abschnitt „Cookies und Tracking").
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
**Themen-Umschalter steht in der Kopfzeile und im Profil** (nicht im Menü): in der
Kopfzeile als Icon-Knopf neben der Lupe, der nur zwischen hell und dunkel wechselt —
die dritte Stellung `auto` bleibt dem Profil-Auswahlfeld vorbehalten, weil ein Knopf
ohne Beschriftung drei Zustände nicht unterscheidbar anzeigen kann. Aktiv-Zustand + Rahmen-Labels
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

Der Bereich **Werkzeuge** bündelt interaktive Werkzeuge, die die Lern-Bausteine
praktisch stützen — derzeit 13: Gear-Explorer, Klick/Metronom, Play-along-Loops,
Stimmgerät, Tabulatur, Song-Struktur, Riff- und Mehrspur-Rekorder, Pedalboard,
Amp/Box, Zerr-Labor, Gefühlslandkarte, Genre-Mix. Referenzbereich wie
Stimmungen/Patterns — **NICHT im Baustein-Pool, kein Fortschritt**. Hub-View
`js/ansichten/werkzeuge.js` (die Liste dort ist die Quelle der Wahrheit), je
Werkzeug eine eigene View + Route `#/werkzeug/<name>`.

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
  - `klangprobe.js` — die eine gezogene Ausnahme von „Synthese statt Samples":
    lädt und dekodiert eine Datei zu einem `AudioBuffer`, mit Cache je URL.
    Bewusst schmal — **kein Sampler**, keine Tonhöhen-Zuordnung, keine
    Velocity-Schichten; was mit dem Puffer passiert, entscheidet das Werkzeug.
    Genutzt bisher nur vom Zerr-Labor, wo die Aussage des Werkzeugs am echten
    Instrumentensignal hängt (s. u.). Fehler werden **nicht** geschluckt, damit
    der Aufrufer offline auf Synthese zurückfallen kann.
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
3. **Titel liften:** `python3 scripts/lift.py` (hebt alle `anzeigetitel.de` nach
   `labels/de.json`). **Nur `de.json`** — die leeren `en/fr/pl`-Skelette sind entfernt,
   `--skelette` erzeugt sie bei Bedarf wieder.
3b. **Such-Index neu bauen:** `python3 scripts/build_index.py` (regeneriert
   `data/index.json` aus dem Pool + gelifteten Titeln — generiertes Artefakt, eingecheckt).
3c. **Statische SEO-Seiten neu bauen:** `python3 scripts/build_seiten.py` (regeneriert
   `baustein/**`, `pfad/**` und `sitemap.xml` — s. „Tier-2-SEO" unten).
4. **Service Worker:** die neue Datei in `SHELL` (`sw.js`) aufnehmen **und** `CACHE` erhöhen
   (`mosh-vN` → `mosh-vN+1`). Sonst bekommen Offline-Nutzer die Datei nie.
5. **Validieren:** `python3 scripts/validate.py` (muss „OK — strukturell sauber" zeigen).
6. **Verifizieren:** `python3 -m http.server 8000` + Playwright durchklicken (s. u.).

**Neuer Vokabelwert** (neuer `stil`, neue `domaene`, neuer `spielziele`-Faktor) ist eine
*koordinierte* Erweiterung: Wert in `vokabulare` der **kanonischen Gitarren-Datei** ergänzen
**und** Label unter `vokabeln.*` bzw. `spielziele` in `labels/de.json`. Erst dann nutzbar.

## Tier-2-SEO (statische Seiten)

ZERRER ist eine Hash-Routing-SPA (`#/baustein/<id>`, `#/pfad/stil/<stil>`, …) — für
Suchmaschinen zählt alles hinter `#` als dieselbe URL wie `/`, bekommt also nie einen eigenen
Title/Snippet. `scripts/build_seiten.py` erzeugt deshalb einen **zusätzlichen, generierten
Seiten-Layer** unter echten Pfad-URLs, 1:1 auf die Hash-Routen gespiegelt (kein Build-Schritt
zur Laufzeit, wie `data/index.json`/`data/grafiken.json` ein eingechecktes Artefakt):

- `baustein/<id>/index.html` — je Pool-Baustein (derzeit 509), **nicht** für Fehlerbilder (keine
  eigene Route; sie erscheinen stattdessen als Trainer-Layer-Abschnitt auf der Seite ihres
  Basis-Bausteins).
- `pfad/stil/<stil>/`, `pfad/kompetenz/<stufe>/`, `pfad/themen/<domaene>/` — Landingpages,
  plus je eine Hub-Übersichtsseite (`pfad/stil/`, `pfad/kompetenz/`, `pfad/themen/`), auf die
  `index.html` im Footer mit echten (Nicht-Hash-)Links zeigt — Crawler-Einstiegspunkt
  unabhängig von der Sitemap-Einreichung in der Search Console.
- `instrument/<name>/` — die vier Instrument-Landingpages plus Hub (`instrument/`). Die App
  zeigt die Bereiche als **In-Page-Reiter** (Theorie/Praxis/Tools/Prüfung/Geräte/Stimmung/
  Patterns); statisch werden daraus **gestapelte Abschnitte** — Reiter sparen Platz auf dem
  Schirm, statisch gibt es diesen Zwang nicht und alles landet in EINEM crawlbaren Dokument
  statt hinter Klicks. Reihenfolge Praxis → Equipment → Tools → (Tuning/Patterns) → Theorie:
  Das Instrument-Eigene steht oben, die auf allen vier Seiten identische Theorie-Menge unten.
  Der Reiter **Prüfung** (Könnens-Check) entfällt — ein reines Frage-Antwort-Widget aus
  clientseitigem Zustand, das statisch nichts aussagt; er wird stattdessen verlinkt.
- Jede Seite: eigenes `<title>`/`canonical`/`og:*`/JSON-LD, lesbarer Inhalt aus denselben
  Quellen wie die SPA, **kein** clientseitiger Zustand (Mastery/Merken/Demo-Player entfallen),
  CTA „In ZERRER üben" → `#/baustein/<id>` in die echte App. **Kein** automatischer
  JS-Redirect: die statische Seite bleibt selbst die dauerhaft indexierte, kanonische URL.
  `sitemap.xml` wird von hier mitgeneriert (nicht mehr handgepflegt).
- Nach jeder Pool-Änderung neu bauen: `python3 scripts/build_seiten.py` (Normallauf,
  räumt `baustein/`+`pfad/` komplett auf und schreibt neu). `--check` (auch in
  `verify.yml`) baut nur im Speicher und meldet Drift/Waisen, schreibt nichts.
- `sw.js`: **keine** Änderung nötig — die Seiten liegen bewusst außerhalb von `SHELL` (kein
  `cache.addAll`-Bloat durch hunderte Einträge) und werden nie als Unterressource geladen.
- **Konstanten werden aus den JS-Quellen GELESEN, nicht kopiert.** `js_liste()`/`js_objekt()`
  ziehen `INSTRUMENTE`, `INSTR_STUFEN`, `INSTR_WERKZEUGE` (aus `js/mastery.js` bzw.
  `js/ansichten/pfad.js`) sowie `LOOP_STILE` und `GEAR_REGION` (aus `js/werkzeug-links.js`)
  direkt aus dem Quelltext — wie schon immer `INHALTSDATEIEN` aus `js/daten.js`. Wer dort
  einen Wert ergänzt, muss hier **nichts** nachziehen. Beide Leser **brechen hart ab**, wenn
  sie nicht parsen können (Umbenennung, geändertes Literal-Format): ein Leser, der im Zweifel
  leer liefert, wäre schlimmer als die Kopie — aus „läuft auseinander" würde „ist lautlos
  leer". Einzige verbleibende Ausnahme ist `INSTR_STIMMUNG`: das steckt in der App in einer
  Bedingung, nicht in einem Literal, es gibt dort nichts zu lesen.
- **Die Mengen-Logik lässt sich nicht lesen** (`instrument_mengen` ist ein Nachbau von
  `instrumentpfad` in `js/pfade.js` — Code, kein Literal). Dagegen wacht
  `pruefe_mengen_invarianten()` vor jedem Bau: Theorie/Praxis/Equipment müssen **paarweise
  disjunkt** sein und den Instrumentbestand vollständig abdecken. Genau diese Regel ist
  zweimal gebrochen worden (erst Praxis∩Theorie, dann Equipment∩Theorie — jeweils derselbe
  Baustein zweimal auf einer Seite); ein dritter Fall fällt jetzt beim Bauen auf.

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
  **Betonung** (optional, additiv): `-1` leise (Ghost Note) / `0` normal / `+1`
  betont — beim Pattern als Liste `betonung` je Spur (gleich lang wie
  `schritte`), beim Tab direkt am Ereignis. Ohne diese Ebene klingen Akzent-,
  Ghost-Note- und Rebound-Übungen wie eine Reihe gleich lauter Schläge, also
  genau NICHT wie das, was ihr Übungsteil beschreibt. Umgesetzt ist sie über
  **drei vorbereitete Gain-Knoten je Wiedergabe** (`js/ansichten/demonstration.js`),
  nicht über einen Pegel-Parameter an den Stimmen: Die Stimmen sollen live und
  im `OfflineAudioContext` identisch klingen, und ein Knoten je Schlag wären
  bei 16 Schlägen im Takt mit Schleife hunderte Knoten pro Minute.

## Verifikation (Pflicht vor jedem Commit)

```sh
python3 scripts/validate.py              # Cross-File-Konsistenz über den gemischten Pool
python3 scripts/lift.py                  # idempotent — Titel nach labels/de.json geliftet
python3 scripts/build_grafiken.py --check # Grafik-Bundles aus den Quellen reproduzierbar
python3 scripts/build_seiten.py --check   # Tier-2-SEO-Seiten + Sitemap aus den Quellen reproduzierbar
python3 scripts/pruefe_zerrlabor.py      # Zerr-Kennlinien treffen ihre Sollwerte
python3 scripts/pruefe_zerrlabor_mutation.py  # …und die Pruefung schlaegt bei Fehlern auch an
python3 scripts/pruefe_boxen.py          # Box-Impulsantworten treffen ihre Beschreibung
python3 scripts/pruefe_boxen_mutation.py # …und die Pruefung schlaegt bei Fehlern auch an
node scripts/pruefe_tonhoehe.mjs         # Stimmgeraet deckt den ganzen Stimmungs-Pool ab
node scripts/build_gitarrenprobe.mjs --check  # Klangproben aus dem Rohbestand reproduzierbar
                                         # (braucht Chromium + Server auf :8123, daher nicht in der CI)
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

- **Dunkel ist Default.** Beide Umschalter (Kopfzeile + Profil) setzen
  `einstellungen.thema` (`auto`/`hell`/`dunkel`); das **Inline-Skript im `<head>`** von
  `index.html` setzt `data-theme` flackerfrei vor dem ersten Anstrich, `wendeThemaAn()`
  (`js/oberflaeche.js`) zur Laufzeit. **Wichtig:** Das Inline-Skript liest denselben
  `localStorage`-Schlüssel wie `js/zustand.js` (`moshschool.zustand.v1`) — bei einer
  Schlüssel-Änderung beide nachziehen. Der Kopfzeilen-Knopf zeigt das Thema, in das er
  **wechselt**, nicht das geltende (ein Knopf, der den Ist-Zustand zeigt, wird
  regelmässig andersherum gelesen); das `aria-label` sagt es ausdrücklich. Er hängt am
  Ereignis `app:thema`, das `wendeThemaAn()` feuert — **nicht** am eigenen Klick: Das
  Profil-Auswahlfeld rendert bewusst nicht neu (sonst verlöre es den Fokus), und ohne
  den Mithörer blieb der Knopf nach einer Umstellung im Profil auf dem alten Symbol
  stehen und bot den Wechsel in das Thema an, das bereits galt.
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
  `--karten-kante-breite`, `--trennlinie`, `--widget-kante`, `--hero-rueckhalt`,
  `--balken-spur`, `--hue-kachel-bg`, `--trainer-bg`). **Hero-Text über Fotos:**
  Der flächige `.genre-landing-scrim` läuft erst ab 62 % Höhe an — Titel und
  Fließtext sitzen darin, die kleine Hue-Augenbraue steht darüber im Bild. In
  Graustufen trifft sie regelmäßig Mittelgrau, deshalb trägt
  `.genre-landing-inhalt::before` (über `--hero-rueckhalt`, nur hell) denselben
  textnahen Rückhalt wie `.bildkachel-inhalt::before`. Er reicht seitlich
  bewusst über den Hero hinaus (`inset: … -100% … -2.5rem`), sonst steht seine
  Kante als heller Kasten im Foto.
  **Fallstrick:** `box-shadow: none, inset …`
  ist ungültig — ein abzuschaltender Schatten in einer *Liste* wird zum
  Null-Schatten `0 0 0 0 transparent`, nicht zu `none`. Die Hell-Selektoren
  (`:root[data-theme='hell']` + `@media (prefers-color-scheme: light) :root:not([data-theme='dunkel'])`)
  schliessen Dunkel beide aus — deshalb braucht es keine Rücknahme, dafür die
  Doppelung des Token-Blocks.
- **Hero-Aufbau** (`landingHeroHtml`): Augenbraue → H1 → Unterzeile, alle drei in
  `var(--tinte)` und mit `--hero-textschatten` (dunkel schwarz, hell weiß) — die
  Buchstabenkante muss über jedem Bildausschnitt halten. Die Augenbraue trägt
  **kein Symbol und keine Fläche**: Das kleine rote Icon stand im Foto und war je
  nach Bildstelle nicht zu erkennen, ein weißer Chip war ein zweites Kästchen über
  dem Titel. Mit `augenbraueHref` wird sie zum Link auf ihren Bereich. Für HTML
  statt Text in der Unterzeile gibt es `untertitelHtml` (so sitzt der Stufen-Chip
  im Baustein-Hero).
- **Hero-Text steht in derselben Spalte wie der Fließtext.** Der Hintergrund läuft
  randlos (`width: 100vw` + negative Margins), das Innenmass spiegelt `main` GENAU:
  `max(1rem, calc(50vw - 21rem))` bzw. ab 768 px `max(1.5rem, calc(50vw - 20.5rem))`
  — 22rem für die halbe `max-width` **minus** dessen eigenes Innenmass. Heros tragen
  deshalb auch **keine** (auch keine transparente) Kante: ihre 2 px schöben den Text
  um genau diese 2 px aus der Spalte.
- **Blutrot ist Akzent** (Links, Aktion, Aktiv-Zustand, Icons), keine Flächenfarbe;
  Ampellogik für Status (offen/teilweise/erledigt). Hell & Dunkel über denselben Token-Satz.
  **Primär-CTA:** hell rot mit **weißer** Schrift (5,48:1 — Tinte auf Rot wären nur
  3,59:1), dunkel umgekehrt weiße Fläche mit Tinte und erst im Hover rot gefüllt.
  Quittier-CTAs (`[data-quittiere]`) sind davon ausgenommen und behalten ihren
  Ghost-Look, der Zustand zeigt statt Wichtigkeit — **mit eigener Schriftfarbe**
  (`var(--tinte)`), sonst erben sie das Weiß des gefüllten Knopfes und stehen
  hell auf hell. **Jeder** Knopf fällt im Hover rot (Sekundär wie Primär); der
  Hover ändert nur die Farbe, nie den Schatten — ein mitwachsender Schatten
  lässt den Knopf beim Überfahren zappeln.
- **Kopfzeilen-Knöpfe** (Hamburger, Lupe): weißes Zeichen auf schwarzem Grund, im
  Hover rot gefüllt. Sie sind Navigation, kein Inhalt — Schwarz setzt sie in beiden
  Themen gleich ab, ohne Rot zu verbrauchen (das gehört der Aktion).
- **Icons in aktiven Chips erben die Schriftfarbe** (`.chip-akzent .fa-solid`,
  `.chip.aktiv .fa-solid`). Ohne das behalten sie ihr globales Rot und stehen im
  gefüllten Zustand rot auf rot — unsichtbar genau dann, wenn der Filter greift.
  Im Ruhezustand bleibt das rote Icon der Akzent auf neutraler Fläche.
- **Eine Größe für alle Knopf-Varianten** (`min-height: 40px`, `0.82rem`) und
  **ein Radius für alles** (`--radius`, 2px). Beides ist schon zweimal
  auseinandergelaufen: einmal, als nur der Primärknopf verkleinert wurde, und
  einmal über die Pillen-Radien der Mastery-Knöpfe aus dem Fork.
- **Hover an Containern** ist **gestrichelte Tinte**, nicht Rot: Rot ist die
  Aktionsfarbe und nutzt sich als Rahmen um jede Kachel ab. Die Strichelung wirkt
  nicht-farblich und in beiden Themen; nur der Stil wechselt, die Breite bleibt.
- **Schreibmaschinen-Display-Schrift** (**Special Elite**, lokal als
  `assets/fonts/special-elite-latin-400-normal.woff2`) für H1/H2/H3 und
  `.abschnitt-titel` — gesetzt in `css/app.css` (`font-weight: 900`, Versalien).
  **Fließtext Roboto** (`assets/fonts/roboto-latin-*.woff2`, 400/500/700). Hart-kantige
  Container, versetzte Schatten, Grain-Overlay.
- **Marken-Schrift New Rocker** (lokal als `assets/fonts/new-rocker-latin-400-normal.woff2`,
  nur Gewicht 400 — SIL OFL, `assets/fonts/LICENSE-new-rocker.txt`): trägt
  **ausschließlich das Wort „ZERRER" als Logo**, an genau drei Stellen — Kopfzeile
  (`.marke-text`), Startseiten-Hero (`.startseite-hero-marke`, inkl. Glitch-Effekt) und
  Footer (`.footer-marke-name`). Jede der drei Stellen setzt `font-family`/`font-weight`
  explizit selbst (eigene Regeln in `css/app.css`, je mit `'New Rocker', 'Special Elite',
  cursive` und `font-weight: 400` — sonst würde der Browser aus einem geerbten
  900-Gewicht einen unsauberen synthetischen Fettdruck fälschen, da New Rocker nur 400
  vorliegt). **Fallstrick behoben:** Vorher lasen `.footer-marke-name`/`.genre-abschnitt-titel`
  u. a. das nirgends definierte Token `--schrift-display` und fielen still auf `inherit`
  zurück; `.footer-marke-name` hat jetzt eine explizite Regel, `.genre-abschnitt-titel` bleibt
  bewusst beim Fallback (kein Marken-Schriftzug).
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
  Werte, beim Ändern also mitziehen. **Schriften gegeneinander halten** lässt sich in
  `mockups/schriften-container.html`: dort ist je Container-Ebene (Hero-h1,
  Abschnitt-h2, Karten-h3, Wortmarke) zwischen Special Elite, New Rocker und Roboto
  umschaltbar, dazu Fotoebene an/aus, Thema hell/dunkel und ein Druck-Layout. Die Seite
  liest die echten Stylesheets und ändert nichts an der App — sie setzt nur
  `--probe-*`-Properties auf ihre eigene Bühne. Wer New Rocker dort für eine
  Überschrift wählt, bekommt automatisch Gewicht 400: Die Schrift liegt nur in 400 vor,
  aus einem geerbten 900 fälschte der Browser einen synthetischen Fettdruck.
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
  NICHT im Baustein-Pool, kein Fortschritt. **`data/tunings.json` ist die einzige
  Tuning-Quelle** — das Stimmgerät (`#/werkzeug/stimmgeraet`) liest denselben Pool
  und beschriftet über `label('stimmung', id)`. Es hielt bis v179 eine zweite,
  handgepflegte Preset-Liste mit eigenen IDs und eigenen `wz_tuning_*`-Labels; die
  blieb beim Ausbau der Referenz stehen und wich in der Schreibweise ab (`A#2`
  statt `Bb2`). Eine neue Stimmung gehört deshalb **nur** in die JSON plus ein
  Label — beide Ansichten ziehen automatisch nach. Jeder Eintrag trägt
  `art` (`standard`/`drop`/`offen`); danach gruppieren beide Ansichten ihre Chips
  (`nachArt()` in `stimmungen.js`). Alt-IDs der früheren Preset-Liste stehen als
  `ALT_IDS` im Stimmgerät, damit `?tuning=…`-Lesezeichen weiter treffen.
  **Die Erkennung muss den ganzen Pool abdecken — das tat sie nicht.** Die
  Untergrenze von `erkennePitch()` lag bei 40 Hz und damit **über neun Saiten, die
  `data/tunings.json` selbst anbietet**: das tiefe A eines Drop-A-Fünfsaiters
  (27,5 Hz), das tiefe H von Fünf-/Sechssaitern, das C eines C-Basses, das tiefe D
  eines Achtsaiters. Das Stimmgerät zeigte diese Stimmungen als Chips an und
  erkannte ihre tiefste Saite nicht — **ohne Fehlermeldung**, die Anzeige blieb auf
  „—". Untergrenze jetzt 25 Hz, `fftSize` 8192 statt 4096 (eine Periode bei 27,5 Hz
  sind gut 1700 Samples; mit 4096 lag A0 bis zu 17 Cent daneben, mit 8192 unter 3).
  Damit das bezahlbar bleibt, sucht `erkennePitch()` **zweistufig**: grob auf einem
  um Faktor 4 dezimierten Signal über den ganzen Bereich, dann fein bei voller
  Abtastrate nur im Fenster um den gefundenen Versatz. Das ist mit dem doppelt so
  langen Fenster **schneller als die alte Fassung** (1,6 ms statt 6,7 ms; die naive
  Vollsuche über 8192 hätte 22 ms gekostet, bei 33 ms Analysetakt untragbar).
  `node scripts/pruefe_tonhoehe.mjs` (auch in `verify.yml`) misst das über **vier
  Oberwellenprofile** — zwei davon mit schwächerem Grundton als erster Oberwelle,
  weil genau dort Autokorrelation eine Oktave danebengreift. Ein Test mit Sinus
  wäre ein Freibrief. Der geprüfte Bereich wird **aus `tunings.json` gelesen**: Eine
  neue, tiefere Stimmung lässt die Prüfung von selbst umfallen.
  Saitenstärken (`staerke`) sind **Praxis-Empfehlungen in handelsüblichen Sätzen**,
  keine gerechneten Werte: Sie müssen die Stimmungs-Leiter hinab monoton schwerer
  werden, aber Drop-Stimmungen stimmen nur die tiefste Saite um und der 6-Saiter-Bass
  ergänzt eine Saite nach **oben** — eine reine `d ∝ 2^(n/12)`-Formel geht dort fehl.
- **Zerrtypen** (`#/zerrtypen`, `js/ansichten/zerrtypen.js`, `data/zerrtypen.json`):
  Referenz der Verzerrer- und Verstärkerzerre-Bauarten, gruppiert von der geringsten
  zur stärksten Eingriffstiefe (Booster → … → Verstärker). Ebenfalls Referenzbereich,
  kein Fortschritt. **Alle Typen sind funktional benannt** (Mittenbuckel-Booster,
  Gegenkopplungs-Overdrive …) — konkrete Modelle gehören ausschließlich in die
  Ausnahmeliste `data/brand-alert.json` und sind von dort über die Typbezeichnung
  auffindbar. Neue Typen dieser Regel unterwerfen, sonst wird aus der Typologie ein
  Marken-Katalog.
- **Tabulatur-Werkzeug** (`#/werkzeug/tab`, `js/ansichten/werkzeug-tab.js`,
  Parser DOM-frei in `js/tabulatur.js`): ASCII-Tab einfügen, im Raster sehen, mit
  einer Stimmung aus **`data/tunings.json`** (derselbe Pool) über den gemeinsamen
  Audio-Kern hören. **Eine Spalte = ein Schritt** — die Leseweise, die ein
  ASCII-Tab selbst nahelegt; Notenwerte stehen dort nicht drin. Eigene Tabs
  liegen im Werkzeug-Speicher, nicht im Fortschritts-Schema. Das Werkzeug
  liefert **kein Notenmaterial aus** (nur ein generisches eigenes Beispiel) —
  was eingefügt wird, verantwortet die Person davor.
  **Drei Fallstricke im Parser, alle schon eingetreten:** (1) Leere Saitenzeilen
  (`e|-----|`) dürfen NICHT einzeln verworfen werden, sonst wird aus einem
  Sechssaiter ein Zweisaiter und jeder Ton landet eine Saite zu tief. Verworfen
  wird nur ein ganzer Block ohne jeden Ton. (2) Mehrstellige Bünde (`12`) sind
  EIN Ton und EINE Spalte — zeichenweise gelesen verschiebt sich alles dahinter,
  und zwar nur in den Zeilen mit hohen Bünden. (3) Zeilen mit abweichender Länge
  im selben Block sind keine Saiten (Trennlinie über dem Tab); die häufigste
  Zeilenlänge gewinnt.
- **Zerr-Labor** (`#/werkzeug/zerrlabor`, `js/ansichten/werkzeug-zerrlabor.js`):
  Werkzeug auf dem gemeinsamen Audio-Kern. Die Kennlinien liegen DOM-frei in
  `js/audio/zerre.js` (Kette Hochpass → WaveShaper → Tiefpass), die Daten in
  `data/zerrlabor-kennlinien.json`. **Zwei Fallstricke, beide schon eingetreten:**
  (1) Die harten Diodenkurven werden **nicht** auf die Schwelle normiert — sonst
  kehrt sich die Pegelreihenfolge um und Germanium wäre lauter als LED, also genau
  umgekehrt zur Kapitelaussage. (2) Die Kurventabelle wird **nicht** auf ±1
  begrenzt; beim WaveShaper spannt nur die Eingangsachse [-1, 1] auf, Ausgangswerte
  dürfen darüber. Ein Deckel kappte die LED-Kennlinie auf RMS 0,90 statt 1,35.
  `python3 scripts/pruefe_zerrlabor.py` (auch in `verify.yml`) rechnet beides gegen
  die Sollwerte nach und prüft die Schwellen-Reihenfolge eigens.
  **Zwei Kennlinien sind keine einzelne Kurve** — `kl_highgain_kaskade` (Hochpass
  zwischen den Stufen) und `kl_multiband` (zwei parallel geklippte Zweige). Sie
  fielen deshalb lange ganz aus der Prüfung heraus und trugen statt Kennwerten
  einen Platzhalter. Sie werden jetzt **end-zu-ende** gemessen (`messung:
  "ende_zu_ende"`, Kette samt Filtern, 48 kHz) — ihre Werte sind mit den acht
  Einzelkurven **nicht vergleichbar**, die stehen ohne Filter. Weil diese Werte aus
  der Umsetzung selbst stammen, **belegen sie nichts**, sie frieren nur den Ist-Zustand
  ein. Deshalb zwei Ergänzungen: (a) zwei Kapitelaussagen als eigene Tests — der
  Zwischen-Hochpass muss den Bass straffen, ohne 1 kHz anzufassen, und beim Multiband
  muss ein tiefer Ton sauberer bleiben als ein hoher; (b)
  `python3 scripts/pruefe_zerrlabor_mutation.py` (auch in `verify.yml`) setzt zehn
  Parameter absichtlich falsch und verlangt, dass die Prüfung anschlägt **und richtig
  begründet**. Genau das fand zwei Löcher: Bei Pegel 0,7 sättigen zwei und drei
  Kaskadenstufen zur selben Rechteckwelle (deshalb zusätzlich
  `ausgangspegel_rms_leise` bei Amplitude 0,02), und `gain_tief` verschob den
  1-kHz-Wert nur um 0,015 (deshalb `thd_80hz`). Der hohe Prüfton des Multibands liegt
  bei **800 Hz, nicht 2 kHz**: Dort verlöre er seine Oberwellen an den Nach-Tiefpass,
  und eine Tiefpass-Änderung hätte die Meldung „gain vertauscht?" ausgelöst — richtig
  angeschlagen, falsch begründet.
  **Pegelbegrenzung ist Pflicht** — ein fester, nicht abschaltbarer Begrenzer sitzt
  vor dem Ausgang, dazu Lautstärke- und (bei Mikrofoneingang) Kopfhörer-Hinweis.
  **Die Standard-Quelle ist eine echte Gitarre, nicht der Synthese-Kern.** Ein
  Sägezahn hat keine Saitenresonanz und kein Plektrum-Geräusch — darauf klingt
  jede Kennlinie gleich plausibel, und der Vergleich, für den es das Werkzeug
  gibt, sagt nichts. Ausgeliefert werden **fünf Einzeltöne**
  (`assets/sounds/gitarre-{e2-hart,e2-weich,a2-hart,e3-hart,g3-hart}.wav`,
  je 129–155 KB, 16 bit/44,1 kHz/mono), erzeugt von
  `node scripts/build_gitarrenprobe.mjs` aus einem CC0-Rohbestand (122 FLACs,
  124 MB), der **bewusst nicht eingecheckt** ist — er wäre Ballast in jedem Klon
  und jedem Deploy für einen Generator, der selten läuft. Fehlt er, bricht das
  Skript mit Meldung ab; Details und Neubau-Anleitung in
  `assets/sounds/HERKUNFT.txt`.
  **Aus den fünf Tönen baut die Ansicht mehrere `CLIPS`** (Chugs, Anschlags-
  dynamik, Powerchord, stehender Ton, hohe Lage) — ein einzelnes Signal reicht
  nicht: Intermodulation zeigt sich erst am Powerchord, Kompression erst am
  stehenden Ton, Ansprache erst im Wechsel von weichem und hartem Anschlag.
  Geladen wird **je Clip nur, was er braucht** (Standard: zwei Dateien, nicht
  fünf). Ein neuer Clip ist ein Eintrag in `CLIPS` plus zwei Labels
  (`zerrlabor_clip_<id>` und `…_text`) — braucht er einen neuen Ton, kommt der
  in `PROBEN` **im Generator** dazu, nie von Hand ins `assets/`-Verzeichnis.
  Vier Punkte hängen daran:
  - **Direktsignal, kein Verstärkerton.** Das Werkzeug hängt seine eigene Zerre
    und Box dahinter; ein bereits verzerrtes Sample wäre doppelt verzerrt und die
    Kennlinien nicht mehr auseinanderzuhalten.
  - **Verlustfrei, kein MP3/Opus.** Codec-Artefakte sitzen genau in dem Bereich,
    den die Kennlinie danach um zig dB anhebt.
  - **Ein Kanal, nicht summiert.** Die beiden Spuren des Rohbestands sind
    dieselbe Aufnahme um 3–13 Samples versetzt — summiert ergäben sie einen
    Kammfilter, der in der Aufnahme nicht drin ist.
  - **Echte Saiten statt Transposition.** Die Powerchord-Töne stammen aus
    Aufnahmen der Saiten, auf denen man sie auch greift; nur die Quinte entsteht
    aus A2 zwei Halbtöne höher.
  - **Alle Quellen und Clips sind pegelgleich eingemessen** (Ausgangs-RMS
    0,062–0,070 gegen 0,063 beim synthetischen Riff). Bei ungleichem Pegel
    klippt die Kennlinie beim Wechsel unterschiedlich stark, und die Chips
    verglichen Lautstärke statt Signal — der Powerchord lag zunächst 2,4 dB
    daneben.
  Der Generator braucht Chromium (FLAC lässt sich weder mit Node- noch mit
  Python-Bordmitteln dekodieren) und läuft deshalb **nicht** in `verify.yml`;
  dort prüft `validate.py` nur, dass die zwei WAVs existieren und Mono/16 bit/
  44,1 kHz sind. Fällt der Ladeversuch aus (offline — die WAVs stehen bewusst
  nicht in der SW-`SHELL`), schaltet das Werkzeug selbst auf das synthetische
  Riff zurück und sagt es in der Statuszeile. Ein neues Sample gehört in
  `PROBEN` im Generator, nicht von Hand ins `assets/`-Verzeichnis.
- **Boxensimulation** (`js/audio/box.js`, `data/boxen.json`): Hinter der Kennlinie
  sitzt wahlweise ein `ConvolverNode` mit einer **synthetisierten** Impulsantwort.
  Bewusst keine gemessenen Cabinet-IRs: Die wären Binärdateien fremder Herkunft
  (Lizenz je Datei zu belegen) und bildeten konkrete Produkte ab — genau das, was
  die Zerrtypen-Regel vermeidet. Eine Box ist hier eine **Bauart**, kein Modell.
  Die Impulsantwort entsteht aus vier Teilen: Direktschall, ein zweiter
  Schallweg (Mikrofonabstand → Kammfilter), abklingende Gehäuse-Reflexionen
  (seeded Rauschen) und die Bandbegrenzung (Hochpass + **zwei kaskadierte**
  Tiefpässe, 24 dB/Okt. — mit nur einem klingt es gefiltert statt nach Box).
  **Warum überhaupt Faltung:** Wäre die IR nur die Antwort einer Filterkette,
  könnte man die Filter direkt einhängen. Den Unterschied machen Kammfilter und
  Reflexionsschwanz — beides liegt in der Zeitachse, nicht im Frequenzgang.
  `python3 scripts/pruefe_boxen.py` (auch in `verify.yml`) rechnet die Formeln in
  Python nach. **Alle Bauteile werden DIFFERENZIELL gemessen** — dieselbe Box mit
  und ohne das Bauteil, an derselben Frequenz. Ein Vergleich gegen
  Nachbarfrequenzen misst die Flanken der anderen Bauteile mit und meldete beim
  ersten Anlauf drei Fehler, wo keine waren; unterhalb von 40 Hz kommt bei 70–110 ms
  Fensterlänge zusätzlich der Leckeffekt dazu. Zwei Fallstricke stecken in den
  Zahlen: Die Kammfilter-Kerbe liegt bei `sr/(2·versatz)` und **nicht** bei
  `c/(2·abstand)`, weil die Laufzeit auf ganze Samples gerundet wird (bei 4 cm
  verschiebt das die Kerbe um 300 Hz), und der Reflexionspegel muss deutlich unter
  dem Direktschall liegen (0,06–0,12) — bei 0,3 überragt der Rauschschwanz nach der
  Bandbegrenzung den Direktschall.
  **Die relative Messung sieht die Zahlen selbst nicht.** „Eine Oktave über der
  Eckfrequenz mindestens 12 dB Abfall" stimmt für *jede* Eckfrequenz — geprüft wurde
  damit, ob sich die Umsetzung wie ein Filter verhält, nicht ob der Wert plausibel
  ist. `python3 scripts/pruefe_boxen_mutation.py` (auch in `verify.yml`) hat das
  aufgedeckt: **9 von 10 absichtlich falschen Werten kamen durch**, darunter ein
  Tiefpass bei 15 kHz und ein Hochpass bei 8 Hz. Dagegen stehen jetzt
  **Plausibilitätsgrenzen** (`GRENZEN` in `pruefe_boxen.py`) plus die Kopplung
  „Tiefpass mindestens Faktor 8 über dem Hochpass" und „Präsenzbuckel im
  Durchlassbereich". Zwei weitere Prüfungen waren **tot**: Der Reflexionsschwanz
  wurde als lauteste Probe ab Sample 64 gemessen — das ist überwiegend das
  Ausschwingen des *gefilterten Direktimpulses*, mit `reflexion_pegel: 0` stand dort
  immer noch 0,06–0,15, „kein Reflexionsschwanz" konnte also nie auslösen. Er wird
  jetzt differenziell und über **Energie statt Spitze** gemessen (der Schwanz ist
  Rauschen, sein höchster Einzelwert hängt an der Saat), und geprüft wird der
  **Mechanismus** — wirksam und proportional zum Pegel — statt eines globalen
  Pegel-Grenzwerts, den eine offene Box legitim reißen würde. Und `praesenz_guete`
  war unbeschränkt: Ein Peaking-Filter hebt an seiner Mitte exakt um `praesenz_db`,
  egal wie schmal er ist; eine Güte von 12 wäre als Nadel durchgegangen. Geprüft
  wird jetzt die **Breite**. **Was bewusst nicht geprüft wird:** ein Wert, der
  *innerhalb* der plausiblen Spanne verschoben wird (Präsenz von 2400 auf 1000 Hz).
  Das ergibt eine andere, aber legitime Box — es gibt keine externe Referenz dafür,
  wo der Buckel eines 4×12 „richtig" sitzt.
  **Cone-Resonanzen** (`resonanzen`, Pflichtfeld je Box): drei bis vier schmale
  Anhebungen/Senken im Durchlassbereich. Sie sind der EINE Punkt, an dem eine
  gemessene Impulsantwort mehr kann als diese Synthese — der Frequenzgang einer
  echten Box besteht nicht aus glatten Filterflanken, sondern trägt viele schmale
  Zacken aus Cone-Aufbrüchen und Mehrweg-Interferenz. Ohne sie klingt eine
  gefaltete Box wie das, was sie dann auch ist: eine Filterkette. Die Werte sind
  **bauart-typisch, nicht gemessen** (ein großer Konus bricht tiefer auf als ein
  kleiner) und bilden kein bestimmtes Produkt ab; ihr Zweck ist, dass das Spektrum
  überhaupt eine Feinstruktur HAT. Geprüft wird beides: jede Resonanz einzeln
  (differenziell an ihrer Mitte, und im Durchlassbereich liegend) **und** die
  resultierende Welligkeit über den ganzen Durchlassbereich — ohne den zweiten
  Teil könnte jemand alle auf 0 dB setzen und die Einzelprüfungen blieben still.
  Das Feld ist **Pflicht**: Beim ersten Mutationslauf hing die Prüfung an einem
  `if resonanzen:` und übersprang sich bei einer Box ohne das Feld selbst — genau
  die Fehlerklasse, gegen die diese Datei sonst überall anschreibt.

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
- **Die App ist einsprachig, und das steht jetzt auch so da.** `labels/{en,fr,pl}.json`
  waren strukturgleiche Gerüste von `de.json` — 1934 Blätter je Datei, **davon 1934 leer**.
  Drei Dateien zu je 57 KB ohne ein übersetztes Wort, die in der SW-`SHELL` standen (also
  jede Installation mitlud) und bei **jeder** Inhaltsänderung mit-geschrieben wurden. Sie
  sind entfernt; `scripts/lift.py --skelette` erzeugt sie wieder, falls eine Übersetzung
  ansteht. Zur Laufzeit ändert sich nichts: `initI18n()` fängt eine fehlende Sprachdatei ab
  und bleibt bei `de` — auch bei Nutzern, die noch ein altes `einstellungen.sprache` im
  `localStorage` haben. Damit dieser Altbestand nicht bei **jedem** Start einen 404 ins Log
  schreibt (der Rückfall griff, der Fehler blieb trotzdem stehen), listet `js/i18n.js` die
  tatsächlich ausgelieferten Sprachen in `SPRACHEN`; alles andere wird gar nicht erst
  geholt. **Eine neue Sprache gehört an drei Stellen:** Datei erzeugen
  (`lift.py --skelette`), `SPRACHEN` in `js/i18n.js`, `SHELL` in `sw.js`.
