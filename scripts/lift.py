#!/usr/bin/env python3
"""Titel-Lift + Skelett-Regeneration fuer mosh-school.

1. Hebt alle anzeigetitel.de aus den INHALTSDATEIEN (js/daten.js) nach
   data/labels/de.json, Abschnitt "bausteine" (id -> sichtbarer Titel). Die
   Inhaltsdatei ist die Quelle der Wahrheit; bestehende Eintraege werden
   aktualisiert, Reihenfolge = Pool-Reihenfolge.
2. Erzeugt data/labels/{en,fr,pl}.json als strukturgleiche Skelette von de.json
   neu: jedes Text-Blatt wird "" — ausser die Zielsprache traegt dort bereits
   eine nicht-leere Uebersetzung, die bleibt erhalten. Leere Werte fallen zur
   Laufzeit ohnehin auf de zurueck (js/i18n.js).

    python3 scripts/lift.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIELSPRACHEN = ('en', 'fr', 'pl')


def pfad(*teile):
    return os.path.join(ROOT, *teile)


def lade(rel):
    with open(pfad(rel), encoding='utf-8') as f:
        return json.load(f)


def schreibe(rel, obj):
    with open(pfad(rel), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write('\n')


def inhaltsdateien():
    with open(pfad('js/daten.js'), encoding='utf-8') as f:
        src = f.read()
    m = re.search(r'const INHALTSDATEIEN\s*=\s*\[(.*?)\]', src, re.S)
    if not m:
        raise SystemExit('INHALTSDATEIEN nicht in js/daten.js gefunden.')
    return re.findall(r"'([^']+\.json)'", m.group(1))


def skelett(vorlage, bestehend):
    """Strukturklon von `vorlage`; Text-Blaetter -> "" ausser `bestehend` traegt Text."""
    if isinstance(vorlage, dict):
        return {
            k: skelett(v, bestehend.get(k) if isinstance(bestehend, dict) else None)
            for k, v in vorlage.items()
        }
    if isinstance(vorlage, list):
        return [skelett(v, None) for v in vorlage]
    if isinstance(vorlage, str):
        return bestehend if isinstance(bestehend, str) and bestehend != '' else ''
    return vorlage


def main():
    de = lade('data/labels/de.json')
    titel = de.setdefault('bausteine', {})

    neu = []
    for fn in inhaltsdateien():
        for b in lade(fn).get('bausteine', []):
            t = (b.get('anzeigetitel') or {}).get('de')
            if not t:
                continue
            if b['id'] not in titel:
                neu.append(b['id'])
            titel[b['id']] = t
    schreibe('data/labels/de.json', de)
    print(f'de.json: {len(titel)} Baustein-Titel ({len(neu)} neu)')
    if neu:
        print('  neu:', ', '.join(neu))

    for lang in ZIELSPRACHEN:
        rel = f'data/labels/{lang}.json'
        bestehend = lade(rel) if os.path.exists(pfad(rel)) else {}
        skel = skelett(de, bestehend)
        schreibe(rel, skel)
        blaetter = uebersetzt = 0
        stapel = [skel]
        while stapel:
            o = stapel.pop()
            if isinstance(o, dict):
                stapel.extend(o.values())
            elif isinstance(o, str):
                blaetter += 1
                uebersetzt += 1 if o else 0
        print(f'{lang}.json: {blaetter} Blaetter, {uebersetzt} uebersetzt')


if __name__ == '__main__':
    main()
