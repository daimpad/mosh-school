#!/usr/bin/env python3
"""Baut den kompakten Such-/Metadaten-Index data/index.json (§0a Trainings-Loop).

Ein Eintrag je durchsuchbarer Entität (Bausteine + Fehlerbilder) mit den Facetten-
Feldern (domaene/kompetenzstufe/stil/spielziele/typ), dem Voraussetzungsgraph,
einem `hat_demo`-Flag und einem klein gehaltenen, kleingeschriebenen `text`-Feld
für die reine In-Memory-Volltextsuche (kein externer Index, keine Lib).

    python3 scripts/build_index.py

Buildfrei, nur Standardbibliothek. Der Index ist ein generiertes Artefakt (wie
data/grafiken.json) und wird eingecheckt; nach Inhaltsänderungen neu erzeugen.
`typ` ist abgeleitet: Baustein mit Übungsteil -> "uebung", mit Reflexion ->
"reflexion", Fehlerbild -> "fehlerbild".
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Kurze/strukturarme Tokens tragen für die Suche wenig und blähen den Index.
MIN_TOKEN = 3
# Text-Feld je Eintrag deckeln (Größenbudget, §8): Titel + frühe Erklär-Tokens
# tragen die meiste Trefferqualität; das Ranking gewichtet Titel/Metadaten ohnehin
# über den Volltext. 48 eindeutige Tokens halten den Index klein und relevant.
MAX_TOKENS = 48
# Häufige Füllwörter raus — hält den Text-Index klein, ohne Trefferqualität zu kosten.
STOPWORTE = {
    'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine',
    'einen', 'einem', 'einer', 'eines', 'ist', 'sind', 'war', 'wird', 'werden',
    'nicht', 'auch', 'auf', 'aus', 'bei', 'mit', 'von', 'vom', 'zum', 'zur',
    'für', 'als', 'aber', 'dann', 'wenn', 'weil', 'dass', 'sich', 'noch', 'nur',
    'schon', 'sehr', 'mehr', 'man', 'kann', 'wie', 'was', 'wo', 'ohne', 'über',
    'unter', 'durch', 'gegen', 'immer', 'etwas', 'diese', 'dieser', 'dieses',
    'zwischen', 'dabei', 'darum', 'damit', 'sodass', 'also', 'beim', 'zum',
}

TOKEN_RE = re.compile(r'[a-zäöüß0-9]+', re.IGNORECASE)


def lade(pfad):
    with open(os.path.join(ROOT, pfad), encoding='utf-8') as f:
        return json.load(f)


def inhaltsdateien():
    """Liest die INHALTSDATEIEN-Liste direkt aus js/daten.js (Single Source)."""
    with open(os.path.join(ROOT, 'js/daten.js'), encoding='utf-8') as f:
        src = f.read()
    m = re.search(r'const INHALTSDATEIEN\s*=\s*\[(.*?)\]', src, re.S)
    if not m:
        sys.exit('FEHLER: INHALTSDATEIEN nicht in js/daten.js gefunden.')
    return re.findall(r"'([^']+\.json)'", m.group(1))


def sammle_strings(obj, out):
    """Alle String-Blätter unter obj einsammeln (für das Text-Feld)."""
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            sammle_strings(v, out)
    elif isinstance(obj, list):
        for v in obj:
            sammle_strings(v, out)


def text_tokens(*quellen):
    """Deduplizierte, kleingeschriebene Tokens aus den Textquellen (kompakt)."""
    roh = []
    for q in quellen:
        sammle_strings(q, roh)
    tokens = []
    gesehen = set()
    for stueck in roh:
        for tok in TOKEN_RE.findall(stueck.lower()):
            if len(tok) < MIN_TOKEN or tok in STOPWORTE or tok in gesehen:
                continue
            gesehen.add(tok)
            tokens.append(tok)
            if len(tokens) >= MAX_TOKENS:
                return ' '.join(tokens)
    return ' '.join(tokens)


def main():
    dateien = inhaltsdateien()
    titel_de = lade('data/labels/de.json').get('bausteine', {})
    fb_titel = lade('data/labels/de.json').get('fehlerbilder', {})

    eintraege = []

    for fn in dateien:
        data = lade(fn)
        for b in data.get('bausteine', []):
            bid = b['id']
            typ = 'uebung' if b.get('uebungsteil') is not None else 'reflexion'
            eintraege.append({
                'id': bid,
                'titel': titel_de.get(bid) or (b.get('anzeigetitel') or {}).get('de') or bid,
                'domaene': b.get('domaene') or [],
                'kompetenzstufe': b.get('kompetenzstufe') or [],
                'stil': b.get('stil') or [],
                'spielziele': b.get('spielziele') or [],
                'typ': typ,
                'voraussetzungen': b.get('voraussetzungen') or [],
                'hat_demo': b.get('demonstration') is not None,
                'text': text_tokens(
                    titel_de.get(bid) or '',
                    b.get('erklaerteil'),
                    b.get('uebungsteil'),
                    b.get('reflexionsaufgabe'),
                ),
            })

    # Fehlerbilder (Trainer-Layer) sind ebenfalls durchsuchbar (Facette typ=fehlerbild).
    fbs = lade('data/fehlerbilder.json').get('fehlerbild_bausteine') or []
    for fb in fbs:
        fid = fb['id']
        inhalt = (fb.get('erklaerteil') or {}).get('de') or {}
        eintraege.append({
            'id': fid,
            'titel': fb_titel.get(fid) or fid,
            'domaene': fb.get('domaene') or [],
            'kompetenzstufe': fb.get('kompetenzstufe') or [],
            'stil': fb.get('stil') or [],
            'spielziele': fb.get('spielziele') or [],
            'typ': 'fehlerbild',
            'voraussetzungen': fb.get('voraussetzungen') or [],
            'hat_demo': False,
            'basis_baustein': fb.get('basis_baustein'),
            'text': text_tokens(fb_titel.get(fid) or '', inhalt),
        })

    ausgabe = {
        'schema': 1,
        'anzahl': len(eintraege),
        'eintraege': eintraege,
    }
    pfad = os.path.join(ROOT, 'data/index.json')
    with open(pfad, 'w', encoding='utf-8') as f:
        json.dump(ausgabe, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')

    groesse = os.path.getsize(pfad)
    print(f'index.json: {len(eintraege)} Einträge, {groesse/1024:.1f} KB '
          f'({sum(1 for e in eintraege if e["typ"] != "fehlerbild")} Bausteine, '
          f'{sum(1 for e in eintraege if e["typ"] == "fehlerbild")} Fehlerbilder)')


if __name__ == '__main__':
    main()
