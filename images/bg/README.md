# Hintergrundbilder

Ablage für die Hero-Hintergrundbilder. Die Dateien hier sind **noch nicht in der
App verdrahtet** — zum Vergleich der möglichen Umgangsweisen dient
`mockups/hintergrundbilder.html`.

So vergleichst du:

1. Bilder in diesen Ordner legen (JPG, PNG, WebP oder AVIF).
2. Im Projektordner `python3 -m http.server 8000` starten.
3. <http://localhost:8000/mockups/hintergrundbilder.html> öffnen — die Seite
   liest das Verzeichnis von selbst aus und zeigt jedes Bild in allen Varianten.

Ohne Server geht es auch: Die Dateien lassen sich auf der Mockup-Seite einfach
per Drag & Drop ablegen.

Vor dem Einbau in die App beachten: Die Bilder liegen im Hero hinter dem
Motiv-SVG und dem Scrim, tragen also keine Information. Sie sollten großzügig
beschnitten werden können (die Hero-Höhe schwankt) und komprimiert sein — sie
gehören sonst in die Service-Worker-Hülle und würden den Erstaufruf belasten.
