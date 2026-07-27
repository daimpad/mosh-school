# Hintergrundbilder

Ablage für die Hero- und Kachel-Hintergrundbilder. Sie liegen **hinter** Motiv-SVG
und Scrim, stark weichgezeichnet und heruntergeregelt („Nebel"): Es bleibt Farbe
und Textur, kein erkennbarer Gegenstand.

Verdrahtet über `js/hintergrundbilder.js`. Welches Bild wo landet, entscheidet ein
Hash über den Bereichs-Schlüssel — deterministisch, damit eine Kachel über Reloads
hinweg gleich aussieht, und bewusst ohne inhaltliche Zuordnung (nach der
Weichzeichnung ist das Motiv ohnehin nicht mehr zu erkennen).

Die Bilder sind **reine Zutat**: Fehlt `bilder.json`, rendern Heros und Kacheln
unverändert mit Motiv und Scrim.

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

## Größe: 150–250 KB je Bild

Rund **1600 px Breite** und **150–250 KB** je Bild reichen aus — die volle
Auflösung ist hinter 18 px Weichzeichnung ohnehin nicht sichtbar, kostet aber
Ladezeit. Querformat ist im Vorteil, weil die Hero-Höhe schwankt und großzügig
beschnitten wird.

Das zählt hier mehr als anderswo: Die Startseite lädt rund **acht bis zehn**
Hintergründe auf einmal. Deshalb übergeht die App Bilder über **400 KB**
(`MAX_BYTES` in `js/hintergrundbilder.js`) — ein einzelner Ausreißer schlug sonst
mit mehr Gewicht zu Buche als alle anderen zusammen. Ein übergangenes Bild ist
nicht verloren: Es bleibt im Ordner, bleibt auf den Mockup-Seiten sichtbar und
kommt von selbst zurück, sobald es verkleinert ist.

`python3 scripts/build_bg_index.py` listet beim Lauf Maße und Gewicht jedes
Bildes auf — dort fallen Ausreißer sofort auf.

Die Bilder sind bewusst **nicht** in der Service-Worker-Hülle (`SHELL` in
`sw.js`): Rund 1,9 MB beim ersten Start wären zu viel für eine Zutat, ohne die
alles unverändert funktioniert. Sie landen beim ersten Ansehen über
stale-while-revalidate von selbst im Cache. Nur `bilder.json` ist vorgeladen.
