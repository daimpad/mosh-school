# Hintergrundbilder

Ablage für die Hero-Hintergrundbilder. Die Dateien hier sind **noch nicht in der
App verdrahtet** — zum Vergleich der möglichen Umgangsweisen dient
`mockups/hintergrundbilder.html`.

## Vergleichen

Zwei Mockup-Seiten nutzen diese Bilder — online, ohne irgendetwas zu starten:

- **Behandlung im Hero** (Varianten 0/A/B/C):
  <https://daimpad.github.io/mosh-school/mockups/hintergrundbilder.html>
- **Ganze Startseite als Kachel-System** (Variante A im Container-Maßstab):
  <https://daimpad.github.io/mosh-school/mockups/startseite-muster.html>

Lokal: `python3 -m http.server 8000` im Projektordner, dann
<http://localhost:8000/mockups/hintergrundbilder.html> bzw.
<http://localhost:8000/mockups/startseite-muster.html>.

Auf beiden Wegen liest die Seite `bilder.json` (siehe unten). Zusätzlich lassen
sich Bilder per Drag & Drop auf die Seite ziehen — praktisch, um einen Kandidaten
zu prüfen, bevor er ins Repository wandert.

## Bilder ergänzen

Datei in diesen Ordner legen, committen, pushen — fertig. Um `bilder.json`
kümmert sich der Workflow `.github/workflows/bg-index.yml`: Er erzeugt das
Verzeichnis nach jedem Push auf `images/bg/` neu und committet es, falls es sich
geändert hat.

Diese Liste ist nötig, weil GitHub Pages kein Verzeichnislisting ausliefert —
ohne sie blieben neue Bilder online unsichtbar. Wer sie lokal sofort aktuell
haben will (etwa um die Seite ohne Push zu prüfen), kann den Generator auch von
Hand aufrufen:

```sh
python3 scripts/build_bg_index.py
```

## Vor dem Einbau in die App

Die Bilder liegen im Hero **hinter** Motiv-SVG und Scrim und werden zusätzlich
unscharf gezeichnet oder hart kontrastiert — die volle Auflösung ist dort nicht
sichtbar, kostet aber Ladezeit. Rund **1600 px Breite** und **150–250 KB** je
Bild reichen aus. Sie sollten sich außerdem großzügig beschneiden lassen, weil
die Hero-Höhe schwankt (Querformat ist deshalb im Vorteil).

Wandern die Bilder in die App, gehören sie in die Service-Worker-Hülle (`SHELL`
in `sw.js`) — sonst fehlen sie offline. Genau deshalb zählt jedes Kilobyte.
