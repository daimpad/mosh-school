<div align="center">

# 🤘 ZERRER

**Extreme Metal spielen lernen — Riff für Riff, direkt im Browser.**

Gitarre · Bass · Schlagzeug · Gesang — für Hardcore, Metalcore, Thrash, Death, Black & Doom.

[![Live Demo](https://img.shields.io/badge/live-zerrer.org-cc2418?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://zerrer.org/)

![Code: MIT](https://img.shields.io/badge/Code-MIT-24bd47?style=flat-square)
![Inhalte: CC BY-NC 4.0](https://img.shields.io/badge/Inhalte-CC%20BY--NC%204.0-1568ad?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-offline--f%C3%A4hig-750787?style=flat-square)
![Buildfrei](https://img.shields.io/badge/Build-none-333?style=flat-square)
![Vanilla JS](https://img.shields.io/badge/Vanilla-JS%20ESM-f7df1e?style=flat-square&logo=javascript&logoColor=black)
![Sprache](https://img.shields.io/badge/Sprache-Deutsch-cc2418?style=flat-square)

`No Ads` · `No Cookies` · `No Influencer-BS` · `No NSBM` · 🏳️‍🌈 *Queer willkommen*

</div>

---

## Was ist das?

**ZERRER** ist eine clientseitige Lern-App fürs Spielen von Extreme-Metal-Instrumenten —
vom ersten Powerchord bis zum Blastbeat. Sie läuft **komplett auf deinem Gerät**: kein Login,
kein Konto, keine Server-Komponente. Der Fortschritt lebt im `localStorage`, offline
funktioniert alles.

> Rein statisch, **buildfrei**: HTML/CSS/JS als ES-Module, keine Bundler, keine Laufzeit-
> Abhängigkeiten. Inhalte kommen aus JSON, sichtbare Texte laufen durch eine kleine i18n-Schicht.

**Zum Datenschutz, genau:** ZERRER setzt keine Cookies, bindet keine Werbenetzwerke ein und legt
kein Nutzerprofil an. Für eine anonyme Reichweitenmessung ist
[GoatCounter](https://www.goatcounter.com/) eingebunden — die **einzige** Ausnahme vom Grundsatz,
keine Ressourcen von externen Anbietern zu laden. Schriften, Icons und Bibliotheken liegen alle
lokal im Repo. Nachzulesen in der [Datenschutzerklärung](https://zerrer.org/#/datenschutz).

Ausführlicher — was ZERRER kann, wofür es taugt, für wen es gedacht ist und was es
ausdrücklich **nicht** ist: [`docs/ueber-zerrer.md`](docs/ueber-zerrer.md).

## In Zahlen

| | |
| --- | --- |
| **497** Bausteine | über 60 Inhaltsdateien, 4 Instrumente + 5 Querschnitts-Domänen |
| **288** Fehlerbilder | Trainer-Layer: typische Fehler als Diagnose |
| **41** Trainingseinheiten | kuratierte Sitzungen (Erwärmung → Hauptteil → Ausklang) |
| **16** Genres | von Hardcore bis Noise Rock |
| **811** SVG-Grafiken | 785 Baustein-Motive + 26 Lehrgrafiken, alle deterministisch erzeugt |
| **12** Audio-Werkzeuge | auf einem gemeinsamen, DOM-freien Kern |

## Features

| | |
| --- | --- |
| 🎸 **Vier Instrumente** | Gitarre, Bass, Schlagzeug, Gesang — je nach Könnensstufe (Einsteiger → Fortgeschritten → Experte). |
| 🔥 **Genre-Achse** | Hardcore, Metalcore, Thrash, Death, Black, Doom, Crust, Grind, Powerviolence, Sludge, Deathcore, Djent, Stoner/Post, Screamo, Mathcore, Noise Rock. |
| 🧭 **Nach Tätigkeit geordnet** | Lernen · Üben · Songwriting · Experimentieren — Werkzeuge tauchen dort auf, wo man sie braucht. |
| 🛠️ **Audio-Werkzeuge** | Metronom mit Tempo-Ramp, Stimmgerät (inkl. eigener, mikrotonaler Tunings), Play-along-Loops, Pattern-Bibliothek, Gear-Explorer, Pedalboard- & Amp/Box-Baukasten, Song-Struktur, Riff- & Mehrspur-Recorder. |
| 🩺 **Trainer-Layer** | Typische Fehlerbilder als Diagnose — mit abstrakten, monochromen SVG-Grafiken. |
| 🎲 **Experimentieren** | Impuls-Karten, Gefühlslandkarte (Gefühl → Genre) und Genre-Mix-Generator. |
| 📴 **Offline-first PWA** | Service Worker cacht die ganze Hülle; einmal geladen, läuft alles ohne Netz. |
| 🔎 **Crawlbare Zwillingsseiten** | 534 statische Seiten unter echten Pfad-URLs — für Suchmaschinen, die hinter `#/` nicht schauen. |

## Live ausprobieren

👉 **[zerrer.org](https://zerrer.org/)**


## Architektur in einem Absatz

Die **Engine** (`js/`) ist themenneutral und DOM-frei testbar; der **Inhalt** liegt getrennt in
`data/` als JSON. Bausteine tragen sprachneutrale IDs, sichtbare Titel und Texte kommen aus
`data/labels/<sprache>.json`. Der Voraussetzungsgraph *sortiert* nur, er *sperrt nie*. Ein
gemeinsamer, DOM-freier **Audio-Kern** (`js/audio/`) trägt alle Werkzeuge — ein `AudioContext`,
ein Lookahead-Scheduler, synthetische Stimmen, WAV-Export. Der Fortschritt ist baustein-gebunden
in einem einzigen, versionierten `localStorage`-Schema.

Die App ist eine **Hash-Routing-SPA** (`#/baustein/<id>`). Weil Suchmaschinen alles hinter `#`
als dieselbe URL sehen, erzeugt `scripts/build_seiten.py` zusätzlich einen **statischen
Seiten-Layer** unter echten Pfaden (`/baustein/<id>/`) — eingecheckt wie jedes andere generierte
Artefakt, kein Build-Schritt beim Deploy.

```
js/            Engine + Ansichten (ES-Module, buildfrei)
js/audio/      themenneutraler Audio-Kern (Kontext, Scheduler, Stimmen, WAV)
data/          Inhalte als JSON (Bausteine, Labels, Grafiken, Songs, Tunings …)
css/           ein Stylesheet, alles über Tokens (dunkel ist Default)
scripts/       Python-Helfer: validate · lift · Index-, Grafik- & Seiten-Build
baustein/ pfad/ instrument/   generierte statische Seiten (Artefakt, eingecheckt)
sw.js          Service Worker (Offline-Hülle)
```

Details für Beitragende und KI-Assistenten stehen in [`CLAUDE.md`](CLAUDE.md).

## Lokal starten

Nichts zu installieren — nur ein Server, weil `fetch()` der JSON-Dateien über `file://`
nicht funktioniert:

```sh
python3 -m http.server 8000     # dann http://localhost:8000 öffnen
```

Vor jedem Commit (dieselben Prüfungen laufen in der CI):

```sh
python3 scripts/validate.py                # Cross-File-Konsistenz über den Pool
python3 scripts/lift.py                    # Titel geliftet, Sprach-Skelette aktuell
python3 scripts/build_grafiken.py --check  # Grafik-Bundles reproduzierbar
python3 scripts/build_seiten.py --check    # statische Seiten + Sitemap reproduzierbar
```

## Mitmachen

Feedback, Fehlermeldungen und Pull Requests sind willkommen — jede Rückmeldung hilft.
Es gibt sogar einen eingebauten Review-Modus (Kommentator) über den `?feedback`-Link in der App.

## Lizenz

- **Code:** [MIT](LICENSE) — nutze, verändere und teile ihn frei.
- **Inhalte:** [Creative Commons BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.de) — Namensnennung, nicht kommerziell.

<div align="center">


</div>
