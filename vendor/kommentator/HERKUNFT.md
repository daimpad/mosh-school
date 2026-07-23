# vendor/kommentator

Lokal eingecheckte, gebaute Dateien des Kommentators (Review-/Feedback-Overlay).

- **Quelle:** https://github.com/daimpad/kommentator
- **Commit:** `b5fb2a7`
- **Dateien:** `kommentare.js`, `kommentare.css` (Wurzel des Quell-Repos, buildfrei),
  `LICENSE` (MIT).

Buildfrei vendored, damit die App ihrer Nicht-verhandelbaren Architektur treu
bleibt (kein CDN, kein Bundler): geladen wird nur auf Wunsch — über `?feedback`
in der URL oder den Knopf unter „Mitmachen" (`js/feedback.js`). Normale Besucher
laden nichts davon.

**Aktualisieren:** die beiden Dateien aus dem Quell-Repo neu kopieren und den
Commit oben nachziehen. Das Overlay ist ein klassisches Skript (`window.Kommentare`),
kein ES-Modul — nicht in `INHALTSDATEIEN`/`SHELL` aufnehmen.
