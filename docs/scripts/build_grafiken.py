#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bündelt die abstrakten Baustein-Grafiken nach data/grafiken.json.

Quelle der Wahrheit sind die deterministischen Generatoren build_svg.py
(Tranche 1: Einsteiger, 64), build_svg2.py (Tranche 2: Fortgeschritten/
Experte + Theorie, 108) und build_svg3.py (Tranche 3: Doom-Vertiefung +
Fehlerbild-Grafiken, komponiert aus Basis-Motiv und Riss) — Motiv-
Korrekturen dort vornehmen und neu generieren, nie SVGs oder das Bundle
von Hand editieren. Tranche 3 liest die Ausgaben von 1/2 und muss zuletzt
laufen.

    python3 scripts/build_grafiken.py

Ergebnis: data/grafiken.json als {baustein_id: "<svg …>"} (sortierte Keys).
Die Grafiken nutzen ausschließlich currentColor und wirken daher nur bei
INLINE-Einbettung (js/oberflaeche.js -> bausteinIcon) — nie als <img src>.
Vorproduzierte IDs ohne Baustein (künftige Sets) sind erlaubt und werden
mitgebündelt; Bausteine OHNE Grafik meldet der Bericht als Lücke.
"""
import json
import os
import re
import runpy
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, '_svg_out')


def pool_ids():
    with open(os.path.join(ROOT, 'js/daten.js'), encoding='utf-8') as f:
        src = f.read()
    m = re.search(r'const INHALTSDATEIEN\s*=\s*\[(.*?)\]', src, re.S)
    ids = set()
    for fn in re.findall(r"'([^']+\.json)'", m.group(1)):
        with open(os.path.join(ROOT, fn), encoding='utf-8') as f:
            ids.update(b['id'] for b in json.load(f).get('bausteine', []))
    return ids


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    lehr_out = os.path.join(HERE, '_svg_lehre')
    if os.path.isdir(lehr_out):
        shutil.rmtree(lehr_out)
    runpy.run_path(os.path.join(HERE, 'build_svg.py'))
    runpy.run_path(os.path.join(HERE, 'build_svg2.py'))
    runpy.run_path(os.path.join(HERE, 'build_svg3.py'))
    runpy.run_path(os.path.join(HERE, 'build_svg4.py'))

    grafiken = {}
    for name in sorted(os.listdir(OUT)):
        if not name.endswith('.svg'):
            continue
        with open(os.path.join(OUT, name), encoding='utf-8') as f:
            grafiken[name[:-4]] = f.read()

    ziel = os.path.join(ROOT, 'data/grafiken.json')
    with open(ziel, 'w', encoding='utf-8') as f:
        json.dump(grafiken, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')

    # Lehrgrafiken (Tranche 4) getrennt buendeln: breite Erklaer-Schemata fuer die
    # Baustein-Ansicht, Registry setzeLehrgrafiken() -> lehrgrafik().
    lehrgrafiken = {}
    for name in sorted(os.listdir(lehr_out)):
        if not name.endswith('.svg'):
            continue
        with open(os.path.join(lehr_out, name), encoding='utf-8') as f:
            lehrgrafiken[name[:-4]] = f.read()
    lehr_ziel = os.path.join(ROOT, 'data/lehrgrafiken.json')
    with open(lehr_ziel, 'w', encoding='utf-8') as f:
        json.dump(lehrgrafiken, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')

    pool = pool_ids()
    with open(os.path.join(ROOT, 'data/fehlerbilder.json'), encoding='utf-8') as f:
        fb_ids = {fb['id'] for fb in json.load(f)['fehlerbild_bausteine']}
    ohne_grafik = sorted(pool - set(grafiken))
    fb_ohne_grafik = sorted(fb_ids - set(grafiken))
    vorproduziert = sorted(set(grafiken) - pool - fb_ids)
    kb = os.path.getsize(ziel) / 1024
    print(f'data/grafiken.json: {len(grafiken)} Grafiken ({kb:.0f} KB)')
    print(f'  Pool: {len(pool)} Bausteine, davon ohne Grafik: {ohne_grafik or "keine"}')
    print(f'  Fehlerbilder: {len(fb_ids)}, davon ohne Grafik: {fb_ohne_grafik or "keine"}')
    lehr_waisen = sorted(set(lehrgrafiken) - pool)
    print(f'data/lehrgrafiken.json: {len(lehrgrafiken)} Lehrgrafiken'
          + (f' (ohne Baustein: {", ".join(lehr_waisen)})' if lehr_waisen else ''))
    if vorproduziert:
        print(f'  vorproduziert (noch kein Baustein): {", ".join(vorproduziert)}')
    if ohne_grafik or fb_ohne_grafik:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
