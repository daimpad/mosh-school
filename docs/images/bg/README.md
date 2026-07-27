# Hintergrundbilder

Ablage für die Hero-Hintergrundbilder. Die Dateien hier sind **noch nicht in der
App verdrahtet** — zum Vergleich der möglichen Umgangsweisen dient
`mockups/hintergrundbilder.html`.

## Vergleichen

Online, ohne irgendetwas zu starten:
<https://daimpad.github.io/mosh-school/mockups/hintergrundbilder.html>

Lokal: `python3 -m http.server 8000` im Projektordner, dann
<http://localhost:8000/mockups/hintergrundbilder.html>.

Auf beiden Wegen liest die Seite `bilder.json` (siehe unten). Zusätzlich lassen
sich Bilder per Drag & Drop auf die Seite ziehen — praktisch, um einen Kandidaten
zu prüfen, bevor er ins Repository wandert.

## `bilder.json` ist generiert

GitHub Pages liefert kein Verzeichnislisting; ohne eine eingecheckte Liste wäre
der Ordner online unsichtbar. Nach jedem Hinzufügen oder Entfernen eines Bildes:

```sh
python3 scripts/build_bg_index.py
```

Die CI prüft bei jedem Pull Request, dass die Liste zum Ordnerinhalt passt.

## Vor dem Einbau in die App

Die Bilder liegen im Hero **hinter** Motiv-SVG und Scrim und werden zusätzlich
unscharf gezeichnet oder hart kontrastiert — die volle Auflösung ist dort nicht
sichtbar, kostet aber Ladezeit. Rund **1600 px Breite** und **150–250 KB** je
Bild reichen aus. Sie sollten sich außerdem großzügig beschneiden lassen, weil
die Hero-Höhe schwankt (Querformat ist deshalb im Vorteil).

Wandern die Bilder in die App, gehören sie in die Service-Worker-Hülle (`SHELL`
in `sw.js`) — sonst fehlen sie offline. Genau deshalb zählt jedes Kilobyte.
