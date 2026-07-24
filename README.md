<div align="center">

# 🤘 mosh school

**Extreme Metal spielen lernen — Riff für Riff, direkt im Browser.**

Gitarre · Bass · Schlagzeug · Gesang — für Hardcore, Metalcore, Thrash, Death, Black & Doom.

[![Live Demo](https://img.shields.io/badge/live-daimpad.github.io%2Fmosh--school-cc2418?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://daimpad.github.io/mosh-school/)

![Code: MIT](https://img.shields.io/badge/Code-MIT-24bd47?style=flat-square)
![Inhalte: CC BY-NC 4.0](https://img.shields.io/badge/Inhalte-CC%20BY--NC%204.0-1568ad?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-offline--f%C3%A4hig-750787?style=flat-square)
![Buildfrei](https://img.shields.io/badge/Build-none-333?style=flat-square)
![Vanilla JS](https://img.shields.io/badge/Vanilla-JS%20ESM-f7df1e?style=flat-square&logo=javascript&logoColor=black)
![Sprache](https://img.shields.io/badge/Sprache-Deutsch-cc2418?style=flat-square)

`No Ads` · `No Tracking` · `No Influencer-BS` · `No NSBM` · 🏳️‍🌈 *Queer willkommen*

</div>

---

## Was ist das?

**mosh school** ist eine clientseitige Lern-App fürs Spielen von Extreme-Metal-Instrumenten —
vom ersten Powerchord bis zum Blastbeat. Sie läuft **komplett auf deinem Gerät**: kein Login,
kein Server, kein Tracking. Der Fortschritt lebt im `localStorage`, offline funktioniert alles.

> Rein statisch, **buildfrei**: HTML/CSS/JS als ES-Module, keine Bundler, keine Laufzeit-
> Abhängigkeiten. Inhalte kommen aus JSON, sichtbare Texte laufen durch eine kleine i18n-Schicht.

## Features

| | |
| --- | --- |
| 🎸 **Vier Instrumente** | Gitarre, Bass, Schlagzeug, Gesang — je nach Könnensstufe (Einsteiger → Fortgeschritten → Experte). |
| 🔥 **Genre-Achse** | Hardcore, Thrash, Death, Black, Doom, Djent, Deathcore, Grind, Sludge, Core/Noise & mehr. |
| 🧭 **Nach Tätigkeit geordnet** | Lernen · Üben · Songwriting · Experimentieren — Werkzeuge tauchen dort auf, wo man sie braucht. |
| 🛠️ **Audio-Werkzeuge** | Metronom mit Tempo-Ramp, Stimmgerät (inkl. eigener, mikrotonaler Tunings), Play-along-Loops, Pattern-Bibliothek, Pedalboard- & Amp/Box-Baukasten, Song-Struktur, Riff- & Mehrspur-Recorder. |
| 🩺 **Trainer-Layer** | Typische Fehlerbilder als Diagnose — mit abstrakten, monochromen SVG-Grafiken. |
| 🎲 **Experimentieren** | Impuls-Karten, Gefühlslandkarte (Gefühl → Genre) und Genre-Mix-Generator. |
| 📴 **Offline-first PWA** | Service Worker cacht die ganze Hülle; einmal geladen, läuft alles ohne Netz. |
| 🩹 **Gesundheitsrahmen** | Technik-, Athletik- und Gesangsinhalte betonen Prinzip statt Dosierung: aufwärmen, bei Schmerz stoppen, im Zweifel Coach/Arzt. |

## Live ausprobieren

👉 **[daimpad.github.io/mosh-school](https://daimpad.github.io/mosh-school/)**

## Lokal starten

`file://` reicht nicht — die JSON-Inhalte brauchen HTTP. Ein beliebiger statischer Server genügt:

```sh
git clone https://github.com/daimpad/mosh-school.git
cd mosh-school
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Kein `npm install`, kein Build-Schritt — es gibt keinen.

## Architektur in einem Absatz

Die **Engine** (`js/`) ist themenneutral und DOM-frei testbar; der **Inhalt** liegt getrennt in
`data/` als JSON. Bausteine tragen sprachneutrale IDs, sichtbare Titel und Texte kommen aus
`data/labels/<sprache>.json`. Der Voraussetzungsgraph *sortiert* nur, er *sperrt nie*. Ein
gemeinsamer, DOM-freier **Audio-Kern** (`js/audio/`) trägt alle Werkzeuge — ein `AudioContext`,
ein Lookahead-Scheduler, synthetische Stimmen, WAV-Export. Der Fortschritt ist baustein-gebunden
in einem einzigen, versionierten `localStorage`-Schema.

```
js/            Engine + Ansichten (ES-Module, buildfrei)
js/audio/      themenneutraler Audio-Kern (Kontext, Scheduler, Stimmen, WAV)
data/          Inhalte als JSON (Bausteine, Labels, Grafiken, Songs, Tunings …)
scripts/       Python-Helfer: validate / lift / Index- & Grafik-Build
sw.js          Service Worker (Offline-Hülle)
```

Details für Beitragende und KI-Assistenten stehen in [`CLAUDE.md`](CLAUDE.md).

## Mitmachen

Feedback, Fehlermeldungen und Pull Requests sind willkommen — jede Rückmeldung hilft.
Es gibt sogar einen eingebauten Review-Modus (Kommentator) über den `?feedback`-Link in der App.

## Lizenz

- **Code:** [MIT](LICENSE) — nutze, verändere und teile ihn frei.
- **Inhalte:** [Creative Commons BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.de) — Namensnennung, nicht kommerziell.

<div align="center">

*Gebaut von Damian Paderta. Aus einer themenneutralen Lern-Engine geforkt — die Engine ist neutral, der Inhalt ist Metal.* 🖤

</div>
