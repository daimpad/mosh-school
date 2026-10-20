#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Strichraster: legt die Strichstärken der Baustein-Motive auf eine feste Skala.

Die Motive stammen aus vier Quellen (drei Generatoren, eingecheckte Einzel-SVGs)
und waren über die Zeit mit rund 40 verschiedenen Strichstärken zwischen 1 und 14
gezeichnet — die Hauptlinie eines Motivs lag mal bei 1,5, mal bei 6. Nebeneinander
in einer Liste sah das aus wie zwei verschiedene Icon-Sätze. Statt jede Quelle von
Hand nachzuziehen (und beim nächsten Motiv wieder auseinanderzulaufen), legt
build_grafiken.py jedes Motiv beim Bündeln über dieses Raster.

Zwei Arten von Strich, weil ein Strich hier zwei Aufgaben hat:

- **Linie** (Kontur, Welle, Achse, Tick, Hohlkreis): Ihre Stärke ist das, was
  vereinheitlicht wird. Je Motiv wird die Hauptlinie bestimmt — die Stärke mit der
  größten Strichlänge (gewichteter Median) — und auf NORMAL gesetzt; alle anderen
  Linien behalten ihr Verhältnis dazu und rasten auf die nächste Stufe aus LINIEN
  ein. So bleibt „Strichstärke = Gewicht“ innerhalb eines Motivs lesbar
  (fein/normal/kräftig/schwer), aber zwischen den Motiven gilt dieselbe Hauptlinie.
- **Marke** (Punkt, Schlag, Balken — ein breiter Strich, der samt runder Kappen
  höchstens sechsmal so lang wie breit ist): Hier IST die Breite die Form. Ein Punkt aus einem Strich der
  Länge 0 mit Breite 7 ist ein Punkt von 7 Einheiten Durchmesser; ihn mit der
  Linie mitzuskalieren, änderte die Komposition. Marken rasten deshalb nur auf die
  nächste Stufe aus MARKEN ein, ohne Skalierung.

**Doom und Sludge tragen eine schwerere Hauptlinie.** Bei ihnen ist das Gewicht
der Inhalt: zähes Tempo, Fuzz-Wand, Ton, der stehen bleibt. Auf der normalen
Hauptlinie sah die Welle von „Doom-Bass“ aus wie jede andere Welle. Motive, deren
Baustein nur zu dieser Familie gehört (stil ⊆ SCHWERE_STILE, mit doom oder
sludge darunter), bekommen deshalb das doppelte Gewicht: Hauptlinie 6 statt 3,
Linienstufen LINIEN_SCHWER (4/6/9). Marken bleiben, wie sie sind. Gemischte
Bausteine (Powerchords: hardcore, doom, metalcore) bleiben normal; Fehlerbilder
folgen ihrem Basis-Motiv. Die Klasse kommt aus den Inhaltsdaten, nicht aus einer
Liste hier: Ein neuer Doom-Baustein wird von selbst schwer.

**Hohlkreise bleiben hohl.** Ein gestrichener Kreis ist im Formvokabular eine
Ghost Note; das Loch ist die Aussage. Sein Strich bleibt deshalb höchstens
HOHL × Radius breit — sonst wuchs er mit der Hauptlinie, bis der Kreis voll war.

Gefüllte Flächen (stroke="none") und Striche der Breite 0 berührt das Raster nicht.

Die Umformung ist idempotent: Ein bereits gerastertes Motiv hat seine Hauptlinie
auf NORMAL und alle Stärken auf Stufen, ein zweiter Lauf ändert nichts. Das ist
die Voraussetzung dafür, dass die eingecheckten statischen Motive selbst schon
gerastert sein können (Quelle = Bündel) und dass --check stabil bleibt.

    python3 scripts/strichraster.py --bericht    # Verteilung im Bündel ausgeben

svg_static/ legt der Normallauf von build_grafiken.py selbst auf das Raster.
"""
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# Stufen in viewBox-Einheiten (viewBox 0 0 120 120). Bei der kleinsten
# Einsatzgröße (Listen-Icon, 2.1rem ≈ 34 px) ist NORMAL knapp ein Pixel.
FEIN, NORMAL, KRAEFTIG, SCHWER = 2, 3, 4.5, 6.5
LINIEN = (FEIN, NORMAL, KRAEFTIG, SCHWER)
# Doom/Sludge: doppeltes Gewicht, Hauptlinie 6. Die Stufen sind die normalen mal
# zwei, aber gedeckelt bei 9 — eine Akzentlinie von 13 war kein Strich mehr,
# sondern ein Klotz.
GEWICHT_SCHWER = 2
LINIEN_SCHWER = (4, 6, 9)
HOHL = 0.8  # Hohlkreis: Strich höchstens 0,8 × Radius, sonst läuft das Loch zu
SCHWERE_STILE = {'doom', 'sludge', 'stoner_post'}
MARKEN = (4.5, 6.5, 9, 13)
MARKE_MIN_BREITE = 4  # dünner ist immer Linie (Tick, Hilfsstrich)
MARKE_SEITEN = 6      # sichtbare Länge (mit Kappen) / Breite darunter → Marke

_ELEMENT = re.compile(r'<(line|path|circle|rect|polyline|polygon|ellipse)\b[^>]*?/?>')
_ATTR = re.compile(r'([\w-]+)="([^"]*)"')
_ZAHL = re.compile(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?')


def _zahl(text):
    return f'{text:g}'


def raste(wert, stufen):
    """Nächste Stufe auf logarithmischer Skala (Verhältnis, nicht Differenz)."""
    return min(stufen, key=lambda s: abs(math.log(wert / s)))


def _bezier(punkte, schritte=16):
    laenge, vor = 0.0, punkte[0]
    n = len(punkte) - 1
    for i in range(1, schritte + 1):
        t = i / schritte
        x = y = 0.0
        for k, (px, py) in enumerate(punkte):
            b = math.comb(n, k) * (1 - t) ** (n - k) * t ** k
            x += b * px
            y += b * py
        laenge += math.dist(vor, (x, y))
        vor = (x, y)
    return laenge


def _bogen(p0, rx, ry, phi, gross, dreh, p1):
    """Länge eines elliptischen Bogens (SVG-Endpunktform → Mittelpunktform)."""
    if p0 == p1:
        return 0.0
    rx, ry = abs(rx), abs(ry)
    if not rx or not ry:
        return math.dist(p0, p1)
    c, s = math.cos(math.radians(phi)), math.sin(math.radians(phi))
    dx, dy = (p0[0] - p1[0]) / 2, (p0[1] - p1[1]) / 2
    x1, y1 = c * dx + s * dy, -s * dx + c * dy
    lam = x1 ** 2 / rx ** 2 + y1 ** 2 / ry ** 2
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    zaehler = rx ** 2 * ry ** 2 - rx ** 2 * y1 ** 2 - ry ** 2 * x1 ** 2
    nenner = rx ** 2 * y1 ** 2 + ry ** 2 * x1 ** 2
    k = math.sqrt(max(0.0, zaehler / nenner))
    if gross == dreh:
        k = -k
    cx, cy = k * rx * y1 / ry, -k * ry * x1 / rx

    def winkel(ux, uy, vx, vy):
        return math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)

    t1 = winkel(1, 0, (x1 - cx) / rx, (y1 - cy) / ry)
    dt = winkel((x1 - cx) / rx, (y1 - cy) / ry, (-x1 - cx) / rx, (-y1 - cy) / ry)
    if not dreh and dt > 0:
        dt -= 2 * math.pi
    elif dreh and dt < 0:
        dt += 2 * math.pi
    laenge, vor, schritte = 0.0, None, 32
    for i in range(schritte + 1):
        t = t1 + dt * i / schritte
        p = (rx * math.cos(t), ry * math.sin(t))
        if vor is not None:
            laenge += math.dist(vor, p)
        vor = p
    return laenge


def pfadlaenge(d):
    """Länge eines Pfads aus absoluten Befehlen (M L H V C Q A Z — mehr kommt nicht vor)."""
    teile = re.findall(r'[A-Za-z]|' + _ZAHL.pattern, d)
    laenge, pos, start, i, befehl = 0.0, (0.0, 0.0), (0.0, 0.0), 0, None

    def zahlen(n):
        nonlocal i
        werte = [float(v) for v in teile[i:i + n]]
        i += n
        return werte

    while i < len(teile):
        if teile[i].isalpha():
            befehl = teile[i]
            i += 1
            if befehl in 'Zz':
                laenge += math.dist(pos, start)
                pos = start
                continue
        if befehl is None or befehl.islower():
            raise ValueError(f'Pfadbefehl {befehl!r} nicht unterstützt: {d[:60]}')
        if befehl == 'M':
            pos = start = tuple(zahlen(2))
            befehl = 'L'
        elif befehl == 'L':
            p = tuple(zahlen(2))
            laenge += math.dist(pos, p)
            pos = p
        elif befehl == 'H':
            p = (zahlen(1)[0], pos[1])
            laenge += math.dist(pos, p)
            pos = p
        elif befehl == 'V':
            p = (pos[0], zahlen(1)[0])
            laenge += math.dist(pos, p)
            pos = p
        elif befehl == 'C':
            w = zahlen(6)
            p = (w[4], w[5])
            laenge += _bezier([pos, (w[0], w[1]), (w[2], w[3]), p])
            pos = p
        elif befehl == 'Q':
            w = zahlen(4)
            p = (w[2], w[3])
            laenge += _bezier([pos, (w[0], w[1]), p])
            pos = p
        elif befehl == 'A':
            w = zahlen(7)
            p = (w[5], w[6])
            laenge += _bogen(pos, w[0], w[1], w[2], int(w[3]), int(w[4]), p)
            pos = p
        else:
            raise ValueError(f'Pfadbefehl {befehl!r} nicht unterstützt: {d[:60]}')
    return laenge


def elementlaenge(tag, a):
    f = lambda k: float(a.get(k, 0) or 0)
    if tag == 'line':
        return math.dist((f('x1'), f('y1')), (f('x2'), f('y2')))
    if tag == 'circle':
        return 2 * math.pi * f('r')
    if tag == 'ellipse':
        rx, ry = f('rx'), f('ry')
        return math.pi * (3 * (rx + ry) - math.sqrt((3 * rx + ry) * (rx + 3 * ry)))
    if tag == 'rect':
        return 2 * (f('width') + f('height'))
    if tag in ('polyline', 'polygon'):
        p = [float(v) for v in _ZAHL.findall(a.get('points', ''))]
        pts = list(zip(p[::2], p[1::2]))
        laenge = sum(math.dist(pts[k], pts[k + 1]) for k in range(len(pts) - 1))
        return laenge + (math.dist(pts[-1], pts[0]) if tag == 'polygon' and pts else 0)
    if tag == 'path':
        return pfadlaenge(a.get('d', ''))
    return 0.0


def striche(svg):
    """[(match, tag, breite, laenge)] aller gestrichenen Elemente."""
    aus = []
    for m in _ELEMENT.finditer(svg):
        a = dict(_ATTR.findall(m.group(0)))
        if a.get('stroke') == 'none' or float(a.get('stroke-width', 0)) <= 0:
            continue  # Breite 0 ist ein absichtlich unsichtbarer Strich
        aus.append((m, m.group(1), float(a['stroke-width']), elementlaenge(m.group(1), a)))
    return aus


def ist_marke(breite, laenge):
    # Die runden Kappen verlängern den Strich um eine Breite — ein Punkt ist ein
    # Strich der Länge 0 und sieht trotzdem aus wie ein Kreis.
    return breite >= MARKE_MIN_BREITE and (laenge + breite) / breite < MARKE_SEITEN


def hauptlinie(liste):
    """Gewichteter Median der Linienstärken (Gewicht = Strichlänge)."""
    linien = sorted((b, l) for _, _, b, l in liste if not ist_marke(b, l))
    if not linien:
        return None
    haelfte, summe = sum(l for _, l in linien) / 2, 0.0
    for b, l in linien:
        summe += l
        if summe >= haelfte:
            return b
    return linien[-1][0]


def _ein_lauf(svg, schwer):
    liste = striche(svg)
    haupt = hauptlinie(liste)
    ziel, stufen = (GEWICHT_SCHWER * NORMAL, LINIEN_SCHWER) if schwer else (NORMAL, LINIEN)
    faktor = ziel / haupt if haupt else 1.0
    teile, pos = [], 0
    for m, tag, breite, laenge in liste:
        if ist_marke(breite, laenge):
            neu = raste(breite, MARKEN)
        else:
            neu = raste(breite * faktor, stufen)
            if tag == 'circle':
                # Hohlkreis = Ghost Note: Das Loch ist die Aussage. Skaliert die
                # Hauptlinie hoch, darf der Kreis nicht mitwachsen, bis er voll ist.
                r = float(dict(_ATTR.findall(m.group(0)))['r'])
                passend = [s for s in stufen if s <= HOHL * r]
                if neu > HOHL * r:
                    neu = max(passend) if passend else min(stufen)
        alt = m.group(0)
        ersetzt = re.sub(r'stroke-width="[^"]*"', f'stroke-width="{_zahl(neu)}"', alt, count=1)
        teile.append(svg[pos:m.start()])
        teile.append(ersetzt)
        pos = m.end()
    teile.append(svg[pos:])
    return ''.join(teile)


def raster(svg, schwer=False):
    """Gibt das Motiv mit gerasterten Strichstärken zurück.

    Läuft bis zum Fixpunkt: Ändert sich eine Breite, kann ein Strich nahe der
    Grenze zwischen Linie und Marke die Seite wechseln. Erst der Fixpunkt macht
    die Umformung idempotent.
    """
    for _ in range(6):
        neu = _ein_lauf(svg, schwer)
        if neu == svg:
            return svg
        svg = neu
    raise ValueError('Strichraster findet keinen Fixpunkt')


def auf_raster(svg, schwer=False):
    return raster(svg, schwer) == svg


_SCHWERE_IDS = None


def schwere_ids():
    """Baustein-IDs der Doom-/Sludge-Familie (siehe Docstring), aus dem Pool gelesen."""
    global _SCHWERE_IDS
    if _SCHWERE_IDS is None:
        with open(os.path.join(ROOT, 'js/daten.js'), encoding='utf-8') as f:
            src = f.read()
        m = re.search(r'const INHALTSDATEIEN\s*=\s*\[(.*?)\]', src, re.S)
        if not m:
            raise SystemExit('strichraster: INHALTSDATEIEN in js/daten.js nicht gefunden')
        ids = set()
        for fn in re.findall(r"'([^']+\.json)'", m.group(1)):
            with open(os.path.join(ROOT, fn), encoding='utf-8') as f:
                for b in json.load(f).get('bausteine', []):
                    stil = set(b.get('stil', []))
                    if stil and stil <= SCHWERE_STILE and stil & {'doom', 'sludge'}:
                        ids.add(b['id'])
        _SCHWERE_IDS = frozenset(ids)
    return _SCHWERE_IDS


def raster_fuer(motiv_id, svg):
    """Rastert ein Motiv in der Gewichtsklasse seines Bausteins."""
    return raster(svg, motiv_id in schwere_ids())


def _bericht():
    from collections import Counter
    with open(os.path.join(ROOT, 'data/grafiken.json'), encoding='utf-8') as f:
        g = json.load(f)
    linien, marken = Counter(), Counter()
    for svg in g.values():
        for _, _, b, l in striche(svg):
            (marken if ist_marke(b, l) else linien)[b] += 1
    print('Linien:', dict(sorted(linien.items())))
    print('Marken:', dict(sorted(marken.items())))


if __name__ == '__main__':
    if '--bericht' in sys.argv[1:]:
        _bericht()
    else:
        print(__doc__)
