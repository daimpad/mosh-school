#!/usr/bin/env python3
"""Cross-File-Validator fuer den mosh-school Baustein-Pool.

Spiegelt die Konsistenzpruefungen der Engine (js/daten.js -> pruefeDaten,
js/graph.js -> topoSortiere) gegen den *gemischten* Pool — genau die Dateien,
die INHALTSDATEIEN in js/daten.js laedt. Buildfrei, nur Standardbibliothek.

    python3 scripts/validate.py

Exit 0 = strukturell sauber. Exit 1 = strukturelle Fehler.
Der ASCII-Umlaut-Verdacht (ae/oe/ue/ss statt echter Umlaute) und fehlende
Titel-Lifts warnen nur — sie brechen nicht ab.
"""
import json
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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


# Sichtbare Textfelder fuer den Umlaut-Scan; Schluessel/IDs bleiben aussen vor.
IGNORIERTE_FELDER = {
    'id', 'domaene', 'kompetenzstufe', 'typ', 'stil', 'spielziele',
    'voraussetzungen', 'transfer_herkunft', '_datei', '_meta',
}
UMLAUT_VERDACHT = re.compile(
    r'\b(ausser|groess\w*|fuer|koenn\w*|koerp\w*|muede|muess\w*|schoen\w*|'
    r'hoeher|frueh\w*|ueb\w*|ueber\w*|fuehl\w*|fuehr\w*|gehoert|zerstoer\w*|'
    r'stoerung|loesung\w*|erhoeht|natuerlich|ungefaehr|waehrend|maessig|'
    r'grundsaetzlich|regelmaessig|massnahme\w*|schluessel\w*)',
    re.IGNORECASE,
)


def sichtbare_texte(obj):
    out = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k not in IGNORIERTE_FELDER:
                out += sichtbare_texte(v)
    elif isinstance(obj, list):
        for v in obj:
            out += sichtbare_texte(v)
    elif isinstance(obj, str):
        out.append(obj)
    return out


def main():
    dateien = inhaltsdateien()
    fehler, warnung, umlaut = [], [], []

    bausteine, voka = [], None
    for fn in dateien:
        data = lade(fn)
        if 'vokabulare' in data:
            if voka is None:
                voka = data['vokabulare']  # erste Datei ist kanonisch
            else:
                fehler.append(f'{fn}: zweiter vokabulare-Block (nur die erste Datei darf)')
        for b in data.get('bausteine', []):
            b['_datei'] = fn
            bausteine.append(b)

    if voka is None:
        sys.exit('FEHLER: keine Datei mit vokabulare-Block gefunden.')

    ziel_faktoren = set()
    for faktoren in (voka.get('spielziele') or {}).values():
        ziel_faktoren.update(faktoren)

    def gueltig(liste, wert):
        return not isinstance(liste, list) or wert in liste

    # eindeutige IDs im Gesamtpool
    quelle = {}
    for b in bausteine:
        if b['id'] in quelle:
            fehler.append(f"{b['id']}: doppelte ID ({b['_datei']} & {quelle[b['id']]})")
        quelle[b['id']] = b['_datei']
    idset = set(quelle)

    titel = lade('data/labels/de.json').get('bausteine', {})

    for b in bausteine:
        bid = b['id']
        for d in (b.get('domaene') or []):
            if not gueltig(voka.get('domaene'), d):
                fehler.append(f'{bid}: unbekannte domaene "{d}"')
        if not b.get('kompetenzstufe'):
            fehler.append(f'{bid}: keine kompetenzstufe')
        for s in (b.get('kompetenzstufe') or []):
            if not gueltig(voka.get('kompetenzstufe'), s):
                fehler.append(f'{bid}: unbekannte kompetenzstufe "{s}"')
        if not gueltig(voka.get('baustein_typ'), b.get('typ')):
            fehler.append(f'{bid}: unbekannter typ "{b.get("typ")}"')
        for st in (b.get('stil') or []):
            if not gueltig(voka.get('stil'), st):
                fehler.append(f'{bid}: unbekannter stil "{st}"')
        for v in (b.get('voraussetzungen') or []):
            if v not in idset:
                fehler.append(f'{bid}: voraussetzung "{v}" existiert nicht im Pool')
        for z in (b.get('spielziele') or []):
            if z not in ziel_faktoren:
                fehler.append(f'{bid}: unbekanntes spielziel "{z}"')
        hat_ub = b.get('uebungsteil') is not None
        hat_ref = b.get('reflexionsaufgabe') is not None
        if hat_ub and hat_ref:
            fehler.append(f'{bid}: uebungsteil UND reflexionsaufgabe (genau eines erlaubt)')
        if not hat_ub and not hat_ref:
            fehler.append(f'{bid}: weder uebungsteil noch reflexionsaufgabe')
        if hat_ref and not isinstance(b['reflexionsaufgabe'].get('de'), str):
            fehler.append(f'{bid}: reflexionsaufgabe.de fehlt oder ist kein Text')
        if not (b.get('anzeigetitel') or {}).get('de'):
            fehler.append(f'{bid}: anzeigetitel.de fehlt')
        if not (b.get('erklaerteil') or {}).get('de'):
            fehler.append(f'{bid}: erklaerteil.de fehlt')
        if bid not in titel:
            warnung.append(f'{bid}: Titel nicht nach labels/de.json geliftet (scripts/lift.py laufen lassen)')
        for txt in sichtbare_texte(b):
            for treffer in UMLAUT_VERDACHT.finditer(txt):
                umlaut.append(f'{bid}: ASCII-Umlaut-Verdacht "{treffer.group(0)}"')

    # Trainingseinheiten (Spez. 6.4): Referenzen zeigen auf existierende Bausteine
    # MIT Uebungsteil; kompetenzstufe aus dem Vokabular; Titel im Label-File
    # (Abschnitt trainingseinheiten — lift.py hebt nur Baustein-Titel, Einheiten
    # werden von Hand gelabelt). Spiegelt pruefeDaten (js/daten.js).
    einheiten = lade('data/trainingseinheiten.json').get('trainingseinheiten') or []
    einheit_titel = lade('data/labels/de.json').get('trainingseinheiten') or {}
    von_id_pool = {b['id']: b for b in bausteine}
    e_ids = [e.get('id') for e in einheiten]
    if len(e_ids) != len(set(e_ids)):
        fehler.append('trainingseinheiten: doppelte Einheiten-ids')
    for e in einheiten:
        eid = e.get('id') or '<ohne id>'
        if not gueltig(voka.get('kompetenzstufe'), e.get('kompetenzstufe')):
            fehler.append(f'{eid}: unbekannte kompetenzstufe "{e.get("kompetenzstufe")}"')
        refs = [ref for phase in ('erwaermung', 'hauptteil', 'ausklang')
                for ref in (e.get('phasen') or {}).get(phase, [])]
        if not refs:
            fehler.append(f'{eid}: keine Baustein-Referenzen in den Phasen')
        for ref in refs:
            ziel = von_id_pool.get(ref.get('baustein'))
            if ziel is None:
                fehler.append(f'{eid}: referenzierter Baustein "{ref.get("baustein")}" existiert nicht')
            elif ziel.get('uebungsteil') is None:
                fehler.append(f'{eid}: Baustein "{ref.get("baustein")}" hat keinen Uebungsteil')
        if eid not in einheit_titel:
            warnung.append(f'{eid}: Einheiten-Titel fehlt in labels/de.json (Abschnitt trainingseinheiten)')
        for txt in sichtbare_texte(e):
            for treffer in UMLAUT_VERDACHT.finditer(txt):
                umlaut.append(f'{eid}: ASCII-Umlaut-Verdacht "{treffer.group(0)}"')

    # Fehlerbilder (Trainer-Layer, Spez. 5): eigene Entitaeten mit Relation zum
    # Basisbaustein, drei Erklaerfelder (symptom/ursache/korrektur), Trainer-Stufe,
    # kein eigener Uebungsteil. Spiegelt pruefeDaten (js/daten.js).
    fbs = lade('data/fehlerbilder.json').get('fehlerbild_bausteine') or []
    fb_titel = lade('data/labels/de.json').get('fehlerbilder') or {}
    fb_ids = [fb.get('id') for fb in fbs]
    if len(fb_ids) != len(set(fb_ids)):
        fehler.append('fehlerbilder: doppelte Fehlerbild-ids')
    for fb in fbs:
        fid = fb.get('id') or '<ohne id>'
        if fid in idset:
            fehler.append(f'{fid}: Fehlerbild-id kollidiert mit einem Basisbaustein')
        if fb.get('typ') != 'fehlerbild':
            fehler.append(f'{fid}: typ "{fb.get("typ")}" statt "fehlerbild"')
        if fb.get('basis_baustein') not in idset:
            fehler.append(f'{fid}: Basisbaustein "{fb.get("basis_baustein")}" existiert nicht')
        if 'trainer' not in (fb.get('kompetenzstufe') or []):
            fehler.append(f'{fid}: Fehlerbild ohne Trainer-Stufe')
        if fb.get('uebungsteil') is not None:
            fehler.append(f'{fid}: Fehlerbild mit eigenem Uebungsteil (Trainer-Layer-Regel)')
        inhalt = (fb.get('erklaerteil') or {}).get('de') or {}
        for feld in ('symptom', 'ursache', 'korrektur'):
            if not isinstance(inhalt.get(feld), str) or not inhalt.get(feld).strip():
                fehler.append(f'{fid}: Erklaerfeld "{feld}" fehlt oder ist leer')
        if fid not in fb_titel:
            warnung.append(f'{fid}: Fehlerbild-Titel fehlt in labels/de.json (Abschnitt fehlerbilder)')
        for txt in sichtbare_texte(fb):
            for treffer in UMLAUT_VERDACHT.finditer(txt):
                umlaut.append(f'{fid}: ASCII-Umlaut-Verdacht "{treffer.group(0)}"')

    # Zyklen (Kahn) ueber den ganzen Pool
    von_id = {b['id']: b for b in bausteine}
    offen = {b['id']: 0 for b in bausteine}
    abhaengig = {b['id']: [] for b in bausteine}
    for b in bausteine:
        for v in (b.get('voraussetzungen') or []):
            if v in von_id:
                offen[b['id']] += 1
                abhaengig[v].append(b['id'])
    bereit = [b['id'] for b in bausteine if offen[b['id']] == 0]
    gesehen = 0
    while bereit:
        n = bereit.pop()
        gesehen += 1
        for f in abhaengig[n]:
            offen[f] -= 1
            if offen[f] == 0:
                bereit.append(f)
    if gesehen != len(bausteine):
        fehler.append('ZYKLUS im Voraussetzungsgraph: ' + ', '.join(i for i in offen if offen[i] > 0))

    # Bericht
    print(f'Pool: {len(bausteine)} Bausteine ueber {len(dateien)} Dateien')
    dom = Counter(d for b in bausteine for d in (b.get('domaene') or []))
    stufe = Counter(s for b in bausteine for s in (b.get('kompetenzstufe') or []))
    print('  Domaenen:', dict(dom))
    print('  Stufen:  ', dict(stufe))
    print(f'  Uebung: {sum(1 for b in bausteine if b.get("uebungsteil"))}, '
          f'Reflexion: {sum(1 for b in bausteine if b.get("reflexionsaufgabe"))}')

    if umlaut:
        print('\nASCII-Umlaut-Verdacht (nur Warnung — pruefen):')
        for u in umlaut:
            print(' ', u)
    if warnung:
        print('\nWarnungen:')
        for w in warnung:
            print(' ', w)
    if fehler:
        print('\nFEHLER:')
        for f in fehler:
            print(' ', f)
        sys.exit(1)
    print('\nOK — strukturell sauber.')


if __name__ == '__main__':
    main()
