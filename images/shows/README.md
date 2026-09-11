# Shows — Flyer-Bilder

Hier liegen die Scans der Flyer, die `#/shows` zeigt. Die Texte dazu stehen in
[`../../data/shows.json`](../../data/shows.json); diese beiden Orte sind das
ganze Mikro-CMS.

Bewusst **zwei getrennte Orte**: `images/bg/bilder.json` daneben ist ein
*generiertes* Verzeichnis (ein Workflow schreibt es), `data/shows.json` dagegen
gepflegter Inhalt. Beides in einer Datei hiesse, dass ein Generator in das
schreibt, was ein Mensch über die GitHub-Weboberfläche editiert.

## Eine Show einpflegen

Zwei Commits, beide im Browser auf github.com — ein Commit kann nicht zugleich
eine Datei hochladen und eine Textdatei ändern:

1. **Bild hochladen** in diesen Ordner (`Add file → Upload files`).
2. **Eintrag ergänzen** in `data/shows.json` — Pflichtfelder `id`, `datum`,
   `titel`, `bild`. Welche Felder es sonst gibt, steht in `_meta.felder`
   derselben Datei.

Nach Schritt 1 meldet `scripts/validate.py` das Bild als **Waise** (Warnung,
kein Fehler) — genau damit dieser zweistufige Weg nicht bei jedem Pflegevorgang
die CI rot färbt. Nach Schritt 2 ist die Warnung weg.

Ein Eintrag **ohne** Bild ist dagegen ein **Fehler**: Die Detailseite ist dann
kaputt, und dieser Zustand ist zu keinem Zeitpunkt richtig.

## Bildvorgabe

| | |
| --- | --- |
| Format | WebP (bevorzugt) oder JPEG. Kein PNG — ein Scan ist ein Foto, als PNG ein Vielfaches schwerer. |
| Längste Kante | 1200–1600 px |
| Dateigröße | 120–200 KB · Warnung ab 250 KB · **Fehler ab 400 KB** |
| Dateiname | klein geschrieben, Endung klein (`.webp`, nicht `.WEBP`) |

Die kleingeschriebene Endung ist kein Pedantismus: netcup und GitHub Pages
liefern case-sensitiv aus, eine lokale macOS-Platte nicht. `Flyer.JPG`
funktioniert dann lokal und ist online ein 404.

**Ein Handyfoto direkt aus der Kamera ist rund zehnmal zu groß.** Verkleinern
geht in jedem Bildprogramm, unter GNOME/macOS auch in der Vorschau; auf der
Kommandozeile z. B. `cwebp -q 75 -resize 1400 0 roh.jpg -o flyer.webp`.

## Warum die Grenzen so eng sind

Ein Gitter lädt viele Bilder, nicht eins. `scripts/validate.py` deckelt den
eingecheckten Bestand insgesamt (30 MB) und zusätzlich **diesen Ordner** mit
einem eigenen Budget (`SHOWS_BUDGET`, 10 MB) — sonst frisst das Archiv still
den Platz, den die Inhalts-Pipeline für neue Bausteine braucht, und der Knall
käme später in einem fremden Commit. Bei 150 KB je Flyer trägt das Budget rund
68 Einträge.

Wird es zu eng, gibt es drei Wege — und der wird bewusst im Diff gewählt, von
einem Menschen, mit Begründung: Budget hochsetzen · eine generierte
Miniatur-Ebene einziehen (Gitter lädt Miniaturen, Detailseite das Original) ·
die Originale auf den netcup-Speicher legen und im Repo nur Miniaturen halten.

## Rechte

Flyer sind gestaltete Werke von Dritten. `gestaltung` und `quelle` im Eintrag
sind deshalb keine Deko, sondern der Grund, warum die Seite zeigbar bleibt.
Wer eine Arbeit hier nicht sehen möchte, schreibt an kollektiv@zerrer.org —
dann kommt sie raus.

## Nicht im Service Worker

Die Bilder stehen bewusst **nicht** in der `SHELL` von `sw.js` (Gewicht), genau
wie `images/bg/`. Sie landen beim ersten Ansehen über stale-while-revalidate im
Cache. Offline zeigt das Gitter dann Titel, Datum und Ort als Textkachel statt
eines kaputten Bildsymbols — der Eintrag verschwindet nie.
