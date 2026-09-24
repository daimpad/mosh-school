#!/usr/bin/env python3
"""Erzeugt die vier Kollektiv-Porträts (assets/images/kollektiv/*.svg).

KEINE FOTOS, UND DAS MIT ABSICHT. Die Kacheln auf #/kollektiv sollen Menschen
andeuten, nicht zeigen: weißes Blatt, schwarzes Gewirr in einer Kopf-und-
Schultern-Silhouette, verzerrt und verwackelt. Niemand soll darauf zu erkennen
sein — auch nicht „ungefähr". Deshalb wird hier nichts nachgezeichnet, sondern
aus einem Zufallsgenerator gewürfelt, dessen Saat nur der Vorname ist.

Aufbau eines Bildes, von unten nach oben:
  1. weiße Fläche (fest, kippt NICHT mit dem Thema — wie ein Flyer ist das Bild
     ein Blatt, kein Oberflächenelement)
  2. ein dunkler, weicher Kern (ein paar halbtransparente Ellipsen) — gibt der
     Silhouette Masse, sonst wirkt das Gewirr wie eine Drahtfigur
  3. das Gewirr: Zufallswege, die innerhalb der Silhouette bleiben
  4. Filter: Turbulenz-Verschiebung (verzerrt) + leichte waagerechte Unschärfe
     (verwackelt) + harte Kontrastkurve auf den Alphakanal: Der blasse Hof der
     Unschärfe fällt weg, Mittelgrau wird Schwarz. Dazu eine versetzte, blasse
     Zweitbelichtung — per <use>
     auf dieselbe Gruppe, nicht doppelt gezeichnet (halbiert die Datei)

Deterministisch: gleiche Namen → byte-gleiche Dateien. `--check` baut nur im
Speicher und meldet Abweichungen (wie build_grafiken.py/build_marken.py).
"""

import math
import os
import random
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIEL = os.path.join(ROOT, 'assets', 'images', 'kollektiv')

# Dateiname (ASCII) → Vorname. Die sichtbaren Namen stehen in
# data/app-info.json (kollektiv.mitglieder), nicht hier.
PORTRAETS = ['damian', 'patrick', 'christian', 'bjoern']

B, H = 300, 375  # 4:5, Hochformat wie ein Passfoto


def silhouette(rnd):
    """Kopf (gedrehte Ellipse) + Hals + Schultern, mit Zufall je Person."""
    # Kopf groß, Hals kurz, Schultern breit und flach abfallend: So liest sich
    # das als Brustbild. Mit kleinem Kopf und langem Hals (erster Entwurf) sah
    # jede Figur aus wie ein Pilz.
    kopf = {
        'cx': B / 2 + rnd.uniform(-14, 14),
        'cy': H * rnd.uniform(0.35, 0.39),
        'rx': rnd.uniform(62, 72),
        'ry': rnd.uniform(78, 88),
        'dreh': math.radians(rnd.uniform(-12, 12)),
    }
    schulter = {
        'cy': H * rnd.uniform(0.97, 1.0),
        'rx': rnd.uniform(142, 158),
        'ry': rnd.uniform(96, 110),
        'versatz': rnd.uniform(-10, 10),
    }
    return kopf, schulter


def innen(x, y, kopf, schulter):
    # Kopf: Punkt in die Ellipse zurückdrehen.
    dx, dy = x - kopf['cx'], y - kopf['cy']
    c, s = math.cos(-kopf['dreh']), math.sin(-kopf['dreh'])
    ux, uy = dx * c - dy * s, dx * s + dy * c
    if (ux / kopf['rx']) ** 2 + (uy / kopf['ry']) ** 2 <= 1:
        return True
    # Hals: schmales Band zwischen Kinn und Schultern.
    if abs(x - kopf['cx']) < kopf['rx'] * 0.5 and kopf['cy'] + kopf['ry'] * 0.55 < y < schulter['cy']:
        return True
    # Schultern: obere Hälfte einer breiten Ellipse, unten vom Bildrand gekappt.
    sx = x - (B / 2 + schulter['versatz'])
    sy = y - schulter['cy']
    return sy > -schulter['ry'] and (sx / schulter['rx']) ** 2 + (sy / schulter['ry']) ** 2 <= 1 and y < H


def zufallspunkt(rnd, kopf, schulter):
    while True:
        x, y = rnd.uniform(0, B), rnd.uniform(0, H)
        if innen(x, y, kopf, schulter):
            return x, y


def gewirr(rnd, kopf, schulter, anzahl):
    wege = []
    for _ in range(anzahl):
        x, y = zufallspunkt(rnd, kopf, schulter)
        winkel = rnd.uniform(0, 2 * math.pi)
        punkte = [(x, y)]
        for _ in range(rnd.randint(16, 30)):
            # Harte Knicke statt Bogen: breite Winkelstreuung, und jeder vierte
            # Schritt schlägt fast um — das gibt das Gekritzel, nicht die Welle.
            winkel += rnd.gauss(0, 1.25) + (rnd.choice((-2.4, 2.4)) if rnd.random() < 0.25 else 0)
            schritt = rnd.uniform(4, 17)
            nx, ny = x + math.cos(winkel) * schritt, y + math.sin(winkel) * schritt
            if not innen(nx, ny, kopf, schulter):
                winkel += math.pi * rnd.uniform(0.6, 1.4)   # am Rand abprallen
                continue
            x, y = nx, ny
            punkte.append((x, y))
        if len(punkte) > 3:
            wege.append((punkte, rnd.uniform(0.9, 2.6), rnd.uniform(0.7, 1.0)))
    return wege


def pfad(punkte):
    # Gerade Stücke mit harten Ecken — gewollt zackig. (Die erste Fassung zog
    # weiche Kurven; das wirkte unter der Unschärfe wie Nebel, nicht wie Kratzer.)
    # Ganze Pixel reichen und halten die Dateien klein.
    return 'M' + 'L'.join(f'{x:.0f} {y:.0f}' for x, y in punkte)


def kratzer(rnd, kopf, schulter, anzahl):
    """Lange Risse quer durch die Figur, bis über ihren Rand hinaus."""
    risse = []
    for _ in range(anzahl):
        y = rnd.uniform(kopf['cy'] - kopf['ry'] * 0.8, schulter['cy'] - 20)
        x = rnd.uniform(20, 60)
        punkte = [(x, y)]
        while x < B - 20:
            x += rnd.uniform(6, 18)
            y += rnd.uniform(-9, 9)
            punkte.append((x, y))
        risse.append((punkte, rnd.uniform(0.6, 1.4), rnd.uniform(0.55, 0.85)))
    return risse


def portraet(name):
    rnd = random.Random(zlib.crc32(name.encode()))
    kopf, schulter = silhouette(rnd)
    wege = gewirr(rnd, kopf, schulter, rnd.randint(52, 62)) + kratzer(rnd, kopf, schulter, rnd.randint(3, 5))
    saat = rnd.randint(1, 999)
    wackel_x = rnd.uniform(2.2, 3.2)
    zweit_dx = rnd.uniform(7, 13) * rnd.choice((-1, 1))
    zweit_dy = rnd.uniform(-3, 3)

    kern = []
    for _ in range(4):
        kern.append(
            f'<ellipse cx="{kopf["cx"] + rnd.uniform(-14, 14):.1f}" cy="{kopf["cy"] + rnd.uniform(-10, 18):.1f}" '
            f'rx="{kopf["rx"] * rnd.uniform(0.55, 0.85):.1f}" ry="{kopf["ry"] * rnd.uniform(0.55, 0.85):.1f}" '
            f'opacity="{rnd.uniform(0.08, 0.14):.2f}"/>')
    kern.append(
        f'<ellipse cx="{B / 2 + schulter["versatz"]:.1f}" cy="{schulter["cy"] + 10:.1f}" '
        f'rx="{schulter["rx"] * 0.85:.1f}" ry="{schulter["ry"] * 0.8:.1f}" opacity="0.12"/>')

    striche = ''.join(
        f'<path d="{pfad(p)}" stroke-width="{w:.2f}" opacity="{o:.2f}"/>' for p, w, o in wege)

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {B} {H}" width="{B}" height="{H}">
<defs>
<filter id="z" x="-10%" y="-10%" width="120%" height="120%">
<feTurbulence type="fractalNoise" baseFrequency="0.011 0.03" numOctaves="2" seed="{saat}"/>
<feDisplacementMap in="SourceGraphic" scale="28" xChannelSelector="R" yChannelSelector="G"/>
<feGaussianBlur stdDeviation="{wackel_x:.1f} 0.7"/>
<feComponentTransfer><feFuncA type="linear" slope="1.7" intercept="-0.2"/></feComponentTransfer>
</filter>
<g id="p" fill="#000" stroke="#000" stroke-linecap="round">{''.join(kern)}<g fill="none">{striche}</g></g>
</defs>
<rect width="{B}" height="{H}" fill="#fff"/>
<g filter="url(#z)">
<use href="#p" transform="translate({zweit_dx:.1f} {zweit_dy:.1f})" opacity="0.4"/>
<use href="#p"/>
</g>
</svg>
'''


def main():
    pruefen = '--check' in sys.argv
    abweichend = []
    for name in PORTRAETS:
        inhalt = portraet(name)
        datei = os.path.join(ZIEL, f'{name}.svg')
        if pruefen:
            try:
                with open(datei, encoding='utf-8') as f:
                    if f.read() != inhalt:
                        abweichend.append(datei)
            except FileNotFoundError:
                abweichend.append(datei)
        else:
            os.makedirs(ZIEL, exist_ok=True)
            with open(datei, 'w', encoding='utf-8') as f:
                f.write(inhalt)
            print(f'{os.path.relpath(datei, ROOT)}: {len(inhalt.encode()) / 1024:.1f} KB')
    if pruefen:
        if abweichend:
            sys.exit('--check: Porträts weichen von ihrer Quelle ab: '
                     + ', '.join(os.path.relpath(d, ROOT) for d in abweichend)
                     + ' — python3 scripts/build_portraets.py neu laufen lassen.')
        print(f'--check: {len(PORTRAETS)} Porträts aus der Quelle reproduzierbar.')


if __name__ == '__main__':
    main()
