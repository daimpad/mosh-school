#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bündelt die abstrakten Baustein-Grafiken nach data/grafiken.json.

Quelle der Wahrheit sind die deterministischen Generatoren build_svg.py
(Tranche 1: Einsteiger, 64) und build_svg2.py (Tranche 2: Fortgeschritten/
Experte + Theorie, 108) — Motiv-Korrekturen dort vornehmen und neu
generieren, nie SVGs oder das Bundle von Hand editieren.

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
    runpy.run_path(os.path.join(HERE, 'build_svg.py'))
    runpy.run_path(os.path.join(HERE, 'build_svg2.py'))

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

    pool = pool_ids()
    ohne_grafik = sorted(pool - set(grafiken))
    vorproduziert = sorted(set(grafiken) - pool)
    kb = os.path.getsize(ziel) / 1024
    print(f'data/grafiken.json: {len(grafiken)} Grafiken ({kb:.0f} KB)')
    print(f'  Pool: {len(pool)} Bausteine, davon ohne Grafik: {ohne_grafik or "keine"}')
    if vorproduziert:
        print(f'  vorproduziert (noch kein Baustein): {", ".join(vorproduziert)}')
    if ohne_grafik:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
