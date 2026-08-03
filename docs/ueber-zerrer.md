# ZERRER — was es ist, was es kann, wofür es taugt, für wen

Ausführliche Selbstbeschreibung des Projekts. Gedacht für alle, die ZERRER
einordnen müssen, ohne es benutzt zu haben — Beitragende, Presse, Förderstellen,
Lehrende, oder schlicht Neugierige.

> **Zahlen in diesem Dokument sind ein Stand, kein Versprechen.** Der Bestand
> wächst. Eine gekürzte Fassung derselben Beschreibung steht im „Über"-Reiter der
> App (`data/app-info.json` → `ueber.steckbrief`) und zieht ihre Zahlen zur
> Laufzeit aus den geladenen Daten — die ist immer aktuell, diese hier nicht.
> Nachrechnen lässt sich alles mit `python3 scripts/validate.py`.

---

## 1. Was ZERRER ist

ZERRER (**zerrer.org**) ist eine Lern-App für Extreme-Metal- und
Hardcore-Instrumente — Gitarre, Bass, Schlagzeug, Gesang — über die Genres
Hardcore, Metalcore, Thrash, Death, Black, Doom, Crust, Grindcore, Powerviolence,
Screamo, Mathcore, Noise Rock, Sludge, Deathcore und weitere.

Technisch ist es das Gegenteil einer üblichen Lernplattform: **rein
clientseitig, ohne Build-Schritt, ohne Server-Komponente, ohne Konto.** 66
JavaScript-Module (~14.500 Zeilen) und 4.100 Zeilen CSS werden als statische
Dateien ausgeliefert; alle Inhalte liegen als JSON daneben. Es gibt keine
Registrierung, keine Datenbank, kein Tracking mit Cookies. Der Fortschritt lebt
im `localStorage` des Geräts, Aufnahmen in dessen IndexedDB. Ein Service Worker
macht die App offline benutzbar — im Proberaum ohne Empfang funktioniert sie
vollständig.

Die Marke trägt zwei Zweige: **Zerrer Mosh Skool** (das Lernangebot, um das es
hier geht) und **Zerrer Kollektiv** (Shows im Raum Köln/Bonn).

Sprache ist durchgehend Deutsch, du-Form, sachlich statt werblich.

---

## 2. Was ZERRER kann

### Der Inhaltskern: 509 Bausteine

Ein **Baustein** ist die kleinste Lerneinheit — ein Erklärteil plus *genau eine*
von zwei Aufgabenarten: ein **Übungsteil** (Ziel, Schritte, Steigerung,
Selbstkontrolle) für Bewegungsthemen oder eine **Reflexionsaufgabe** für
Wissens- und Haltungsthemen. Aktuell 247 Übungsteile und 262
Reflexionsaufgaben.

| Domäne | Bausteine |     | Könnensstufe | Bausteine |
| --- | ---: | --- | --- | ---: |
| Gitarre | 116 | | Einsteiger | 154 |
| Theorie | 93 | | Fortgeschritten | 282 |
| Mentales | 85 | | Experte | 67 |
| Schlagzeug | 83 | | Trainer (quer) | 6 |
| Bass | 79 | | | |
| Gesang | 64 | | **Ausrüstung** (quer) | **116** |
| Körper/Gesundheit | 44 | | **Kontext/Szene** | **16** |

Die Querschnitts-Domänen sind der eigentliche Unterschied zu einem
Riff-Tutorial-Kanal: **Gesundheit, Mentales, Ausrüstung und Musiktheorie** stehen
gleichberechtigt neben der Instrumentaltechnik. 44 Bausteine allein zu Körper und
Aufwärmen, 85 zu mentalen Themen.

### Der Trainer-Layer: 288 Fehlerbilder

Zu den Bausteinen kommen 288 **Fehlerbilder** — jedes mit Symptom, Ursache und
Korrektur, verankert an seinem Basis-Baustein. Das ist die Ebene, die sonst nur
eine anwesende Lehrperson liefert: *„Das klingt so — woran liegt es — was änderst
du."*

### Vier Wege durch denselben Stoff

707 Voraussetzungskanten verbinden die Bausteine zu einem Graphen. Entscheidend:
**der Graph sortiert, er sperrt nicht.** Fehlende Voraussetzungen erscheinen als
Hinweis, nie als Schloss. Niemand wird von Inhalten ausgesperrt, für die er sich
interessiert.

- **Kompetenzpfad** — stufen-kumulativ, Einsteiger → Fortgeschritten → Experte
- **Genre-Achse** — 16 Genres mit 309 Zuordnungen, quer über Instrumente und Stufen
- **Themen/Domänen** — nach Instrument oder Querschnittsthema
- **Individualpfad** — nach dem eigenen Spielziel

Dazu **41 Trainingseinheiten** als fertig geschnürte Sessions.

### 12 interaktive Audio-Werkzeuge

Alle auf einem gemeinsamen, synthese-basierten Audio-Kern (ein `AudioContext`,
ein Lookahead-Scheduler, keine Samples, kein CDN):

| Werkzeug | Was es tut |
| --- | --- |
| Metronom / Klick-Track | Tempo-Rampen, Gruppen-Akzente, WAV-Export |
| Play-along-Loops | Genre-typische Beats zum Mitspielen |
| Stimmgerät | Live-Tuner über Mikro (Autokorrelation) + 35 Stimmungen als Zielton |
| Zerr-Labor | Verzerrer-Kennlinien hörbar und messbar gegenübergestellt |
| Pedalboard-Baukasten | Signalketten aus 14 Pedaltypen bauen und speichern |
| Amp-/Box-Baukasten | Verstärker- und Lautsprecher-Physik durchspielen |
| Geräte-Explorer | Equipment-Landkarte je Instrument |
| Song-Struktur | Songaufbau skizzieren |
| Riff-Recorder | Einzelaufnahmen (IndexedDB) |
| Mehrspur-Skizze | mehrspurige Ideen-Aufnahme |
| Gefühlslandkarte | vom Gefühl zum passenden Genre (2 Achsen, 16 Genres) |
| Genre-Mix | Fusionsvorschläge aus zwei Genres |

### Referenzbereiche

Nachschlagewerke ohne Fortschrittslogik: **35 Stimmungen** (Standard, Drop, Offen
— mit Saitenstärke-Empfehlung und Genre-Zuordnung), **60 Rhythmus-Patterns**,
**15 Griffe**, **16 Zerrtypen** in 6 Gruppen, **66 Glossarbegriffe**, **72
Experimentier-Methoden** in 8 Kategorien, **606 Beispielsongs** in 20
Genre-Pools.

Dazu 797 abstrakte SVG-Grafiken (eine je Baustein und Fehlerbild, deterministisch
generiert) und 26 Lehrgrafiken (Beat-Raster, Griffbilder, Anschlagsmuster).

### Was noch dazugehört

- **Könnens-Check** — ehrliche Selbsteinschätzung je Stufe über 5 Kategorien
- **Volltextsuche** mit Facetten über alle 797 Einträge, komplett im Browser
- **Datensicherung** — Fortschritt als portables JSON exportieren und
  importieren; ohne Konto ist das die einzige Brücke zwischen zwei Geräten
- **545 statische Seiten** parallel zur App, damit die Inhalte für Suchmaschinen
  überhaupt einzeln auffindbar sind (eine Hash-Routing-App ist es sonst nicht)
- **Brand-Alert** — 61 Einträge in 8 Kategorien zu problematischen Marken und
  Modellen

---

## 3. Wozu ZERRER gebraucht werden kann

**Strukturiert allein lernen.** Der häufigste Weg in diese Musik ist YouTube plus
Zufall. ZERRER ersetzt das durch eine sortierte Reihenfolge mit Begründung — und
sagt bei jedem Baustein, worauf er aufbaut und wohin er führt.

**Gezielt ein Problem lösen.** Wer weiß, was nicht klingt, sucht das Fehlerbild
statt eines Kurses. 288 Symptom-Ursache-Korrektur-Einträge sind darauf ausgelegt,
punktuell angesteuert zu werden.

**Ein Genre erschließen.** Die Genre-Achse bündelt quer über Instrumente, was
einen Stil ausmacht — vom Anschlag über die Stimmung bis zum Sound. Nützlich für
alle, die aus einer anderen Ecke kommen.

**Üben mit Werkzeug statt daneben.** Metronom, Loops, Stimmgerät und Recorder
sind in denselben Bausteinen verlinkt, in denen sie gebraucht werden — kein
Wechsel in fünf Apps.

**Equipment verstehen, bevor Geld fließt.** 116 Ausrüstungs-Bausteine plus
Zerr-Labor, Pedalboard- und Amp-Baukasten erklären *Funktionsprinzipien*, nicht
Kaufempfehlungen. Zerrtypen sind bewusst funktional benannt (Mittenbuckel-Booster,
Gegenkopplungs-Overdrive) statt nach Modellen — damit aus einer Typologie kein
Markenkatalog wird.

**Unterricht vorbereiten und ergänzen.** Der Trainer-Layer und die
Trainingseinheiten sind so geschnitten, dass Lehrende sie als Übungsvorrat und
gemeinsame Sprache mit Schülern nutzen können.

**Offline im Proberaum.** Ohne Netz voll funktionsfähig — inklusive Werkzeuge und
Aufnahmen.

---

## 4. Wer sich damit auseinandersetzen sollte

**Einsteigende in extreme Genres.** Die 154 Einsteiger-Bausteine setzen keine
Vorbildung voraus, und der Gesundheitsrahmen ist gerade hier wichtig: Extreme
Vocals und harte Anschlagstechnik verletzen Menschen regelmäßig, weil sie sie
sich falsch selbst beibringen.

**Fortgeschrittene mit Lücken.** Mit 282 Bausteinen ist das die größte Stufe —
gedacht für Leute, die spielen können, aber merken, dass Theorie, Sound oder
Körperarbeit fehlt.

**Sänger:innen und alle, die schreien wollen.** 64 Gesangs-Bausteine mit dem
Grundsatz, dass Verzerrung aus Luft und Resonanz kommt, nicht aus Pressen — plus
konsequentem Hinweis auf HNO-Arzt bei Beschwerden.

**Bands und Proberaum-Gruppen.** Songwriting-Werkzeuge, Song-Struktur,
Mehrspur-Skizze und die Kontext-Bausteine zu Ensemble und Proberaum zielen auf
die Gruppe, nicht auf die Einzelperson.

**Lehrende, Coaches, Workshopleitende.** Der Trainer-Layer ist explizit für sie
gebaut.

**Menschen mit Gear-Fragen.** Wer nicht weiß, warum sein Bass im Mix verschwindet
oder was ein Zerrer eigentlich tut, findet hier Physik statt Forenmeinung.

**Beitragende und Entwickler:innen.** Buildfrei, ES-Module, Inhalte als JSON,
Engine themenneutral vom Inhalt getrennt — die Einstiegshürde für inhaltliche
Beiträge ist bewusst niedrig gehalten. Die Engine stammt aus einem Fork einer
Crossminton-Lernanwendung und ist deshalb nicht metal-spezifisch. Einstieg:
[`CLAUDE.md`](../CLAUDE.md).

---

## 5. Was ZERRER ausdrücklich nicht ist

Ehrlichkeitshalber, weil es die Einordnung bestimmt:

- **Kein Ersatz für Unterricht oder ärztlichen Rat.** Bei Schmerz, Kratzen oder
  Beschwerden lautet die Anweisung überall: sofort stoppen, Coach bzw. Arzt.
- **Kein Konto, keine Synchronisation.** Fortschritt hängt am Gerät. Wer
  wechselt, muss exportieren.
- **Nur Deutsch.** Label-Gerüste für EN/FR/PL existieren, sind aber leer.
- **Keine Community-Funktionen** — kein Forum, keine Kommentare, keine
  Nutzerprofile.
- **Keine Tabs oder Noten fremder Songs.** Die 606 Beispielsongs sind
  Hörempfehlungen mit Quellenverweis, kein Notenmaterial.
- **Die Songlisten sind kuratiert nach einem einzigen, offengelegten Maßstab:**
  Bands, die rassistisch oder antisemitisch aufgetreten sind oder den
  Nationalsozialismus verherrlichen, relativieren oder normalisieren, stehen
  nicht drin. Andere Kontroversen führen ausdrücklich nicht zum Ausschluss;
  darüber urteilen die Listen nicht.

---

## Lizenz

Code unter [MIT](../LICENSE), Inhalte unter
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.de).
