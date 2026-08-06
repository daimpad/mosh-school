#!/usr/bin/env python3
"""Zerlegt die Marken-SVGs in Masken-Ebenen fuer css/app.css.

    python3 scripts/build_marken.py            # schreibt assets/images/marke/
    python3 scripts/build_marken.py --check     # baut nur im Speicher, meldet Drift

WARUM UEBERHAUPT ZERLEGEN: Die gelieferten Marken sind ZWEIFARBIG — das rote
Zerre-Zeichen (#fa100d) plus eine Flaeche, die in der schwarzen Fassung schwarz
und in der weissen weiss ist. Genau diese zweite Farbe muss mit dem Thema
kippen. Ein `<img>` kann das nicht: Es traegt seine Farben in sich, und ein
Wechsel ueber `prefers-color-scheme` wuerde am Betriebssystem haengen statt am
Themen-Umschalter der App (der drei Stellungen hat, nicht zwei).

Der Weg, den diese App fuer Icons ohnehin geht, loest es: eine CSS-`mask` plus
`background-color`. Die Maske traegt nur die Form, die Farbe kommt aus CSS und
damit aus den Tokens. Eine Maske ist aber einfarbig — deshalb je Marke ZWEI
Dateien, eine je Farbebene, die im CSS uebereinanderliegen.

QUELLE DER WAHRHEIT sind die schwarzen Fassungen in scripts/marken_quelle/. Die
weissen Fassungen des Lieferanten sind bewusst nicht eingecheckt: Sie tragen
dieselbe Geometrie mit anderer Klassennummerierung (in der weissen
WortBildmarke heisst die Schrift `cls-1`, in der schwarzen ist Rot `cls-1`) —
zwei Quellen fuer dieselbe Form waeren eine Einladung, sie auseinanderlaufen zu
lassen. Wer die Marke aendert, ersetzt die schwarze Fassung und laesst dieses
Skript laufen.

KLASSENZUORDNUNG in den Quellen (geprueft, s. `EBENEN`):
    cls-1        -> rote Ebene
    cls-2, ohne  -> Tinten-Ebene (Schrift + Flaeche)
Aendert der Lieferant das, bricht das Skript hart ab, statt eine halbe Marke zu
schreiben — eine lautlos leere Ebene faellt sonst erst im Browser auf.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUELLE = os.path.join(ROOT, 'scripts', 'marken_quelle')
ZIEL = os.path.join(ROOT, 'assets', 'images', 'marke')

# Datei -> welche Ebenen sie hergibt. Die Wortmarke ist einfarbig und braucht
# keine Aufteilung; sie bekommt trotzdem denselben Weg, damit alle Marken
# gleich eingebunden werden.
MARKEN = {
    'bildmarke.svg': 'bild',
    'wortmarke.svg': 'wort',
    'wortbildmarke-moshskool.svg': 'wortbild-moshskool',
    'wortbildmarke-kollektiv.svg': 'wortbild-kollektiv',
}
EBENEN = {'rot': ('cls-1',), 'tinte': ('cls-2', None)}   # None = Pfad ohne class


def pfad_klasse(tag):
    m = re.search(r'class="([^"]*)"', tag)
    return m.group(1).strip() if m else None


def zerlege(quelltext, name):
    """Liefert {ebene: svg} — leere Ebenen fallen weg."""
    vb = re.search(r'viewBox="([^"]+)"', quelltext)
    if not vb:
        sys.exit(f'FEHLER: {name} hat keine viewBox.')
    pfade = re.findall(r'<path\b[^>]*?/?>', quelltext)
    if not pfade:
        sys.exit(f'FEHLER: {name} enthaelt keine <path>-Elemente.')
    bekannt = set(EBENEN['rot']) | {k for k in EBENEN['tinte'] if k}
    for tag in pfade:
        k = pfad_klasse(tag)
        if k is not None and k not in bekannt:
            sys.exit(f'FEHLER: {name} nutzt unbekannte Klasse "{k}" — '
                     f'Zuordnung in EBENEN pruefen, bevor eine Ebene leer bleibt.')

    ergebnis = {}
    for ebene, klassen in EBENEN.items():
        teil = [t for t in pfade if pfad_klasse(t) in klassen]
        if not teil:
            continue
        # Fuer eine Maske zaehlt nur die Deckung, nicht die Farbe. `fill-rule`
        # zaehlt sehr wohl: Die Quellen setzen evenodd ueber die Klasse, und
        # ohne sie fuellen sich die Aussparungen im Zeichen zu.
        koerper = ''.join(
            re.sub(r'\sclass="[^"]*"', '', t).replace('<path', '<path fill="#000"', 1)
            for t in teil
        )
        regel = 'path{fill-rule:evenodd}' if 'fill-rule:evenodd' in quelltext else ''
        ergebnis[ebene] = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb.group(1)}">'
            f'{f"<style>{regel}</style>" if regel else ""}{koerper}</svg>\n'
        )
    return ergebnis


def baue():
    dateien = {}
    for quelle, kurz in MARKEN.items():
        pfad = os.path.join(QUELLE, quelle)
        if not os.path.isfile(pfad):
            sys.exit(f'FEHLER: Quelle fehlt: scripts/marken_quelle/{quelle}')
        with open(pfad, encoding='utf-8') as f:
            teile = zerlege(f.read(), quelle)
        for ebene, svg in teile.items():
            # Einfarbige Marken bekommen keinen Ebenen-Zusatz im Namen.
            name = f'{kurz}.svg' if len(teile) == 1 else f'{kurz}-{ebene}.svg'
            dateien[name] = svg
    return dateien


def main():
    pruefen = '--check' in sys.argv
    dateien = baue()
    os.makedirs(ZIEL, exist_ok=True)
    vorhanden = {f for f in os.listdir(ZIEL) if f.endswith('.svg')}
    drift = []
    for name, svg in sorted(dateien.items()):
        ziel = os.path.join(ZIEL, name)
        alt = None
        if os.path.isfile(ziel):
            with open(ziel, encoding='utf-8') as f:
                alt = f.read()
        if alt == svg:
            continue
        drift.append(name)
        if not pruefen:
            with open(ziel, 'w', encoding='utf-8') as f:
                f.write(svg)
    waisen = sorted(vorhanden - set(dateien))
    for w in waisen:
        if not pruefen:
            os.remove(os.path.join(ZIEL, w))

    if pruefen:
        if drift or waisen:
            for d in drift:
                print(f'DRIFT assets/images/marke/{d}', file=sys.stderr)
            for w in waisen:
                print(f'WAISE assets/images/marke/{w} (keine Quelle)', file=sys.stderr)
            sys.exit('Marken weichen von den Quellen ab — scripts/build_marken.py laufen lassen.')
        print(f'--check: {len(dateien)} Marken-Ebenen aus den Quellen reproduzierbar.')
        return
    print(f'{len(dateien)} Marken-Ebenen geschrieben:')
    for name, svg in sorted(dateien.items()):
        print(f'  assets/images/marke/{name} ({len(svg) / 1024:.1f} KB)')


if __name__ == '__main__':
    main()
