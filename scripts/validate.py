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


# Demonstrations-Schema (§0c/§1 Trainings-Loop): optionales Feld am Baustein.
DEMO_INSTRUMENTE = {
    'kick', 'snare', 'hihat_closed', 'hihat_open',
    'tom_hi', 'tom_lo', 'crash', 'ride', 'china',
}
DEMO_TECHNIKEN = {'normal', 'palm_mute', 'chug', 'slide', 'bend', 'dead_note'}


def pruefe_demonstration(bid, demo, fehler):
    """Validiert eine vorhandene `demonstration`. Abwesenheit ist zulässig."""
    if not isinstance(demo, dict):
        fehler.append(f'{bid}: demonstration ist kein Objekt')
        return
    typ = demo.get('typ')
    if typ not in ('pattern', 'tab', 'hoerbeispiel'):
        fehler.append(f'{bid}: demonstration.typ "{typ}" ungültig (pattern|tab|hoerbeispiel)')
        return
    if typ == 'pattern':
        spuren = demo.get('spuren')
        if not isinstance(spuren, list) or not spuren:
            fehler.append(f'{bid}: demonstration(pattern) ohne spuren')
            return
        aufl = demo.get('aufloesung')
        for sp in spuren:
            if sp.get('instrument') not in DEMO_INSTRUMENTE:
                fehler.append(f'{bid}: demonstration-Instrument "{sp.get("instrument")}" ungültig')
            schritte = sp.get('schritte')
            if not isinstance(schritte, list) or any(x not in (0, 1) for x in schritte):
                fehler.append(f'{bid}: demonstration-schritte müssen eine 0/1-Liste sein')
            elif isinstance(aufl, int) and len(schritte) != aufl * (demo.get('takte') or 1):
                fehler.append(f'{bid}: demonstration-schritte-Länge passt nicht zu aufloesung*takte')
    elif typ == 'tab':
        events = demo.get('events')
        if not isinstance(events, list) or not events:
            fehler.append(f'{bid}: demonstration(tab) ohne events')
            return
        if not isinstance(demo.get('tuning'), list) or not demo['tuning']:
            fehler.append(f'{bid}: demonstration(tab) ohne tuning')
        for ev in events:
            if not isinstance(ev.get('schritt'), int):
                fehler.append(f'{bid}: demonstration-event ohne schritt')
            saite = ev.get('saite')
            if not isinstance(saite, int) or not 1 <= saite <= 6:
                fehler.append(f'{bid}: demonstration-event saite "{saite}" außerhalb 1..6')
            if not isinstance(ev.get('bund'), int) or ev['bund'] < 0:
                fehler.append(f'{bid}: demonstration-event bund ungültig')
            if ev.get('technik', 'normal') not in DEMO_TECHNIKEN:
                fehler.append(f'{bid}: demonstration-Technik "{ev.get("technik")}" ungültig')
    elif typ == 'hoerbeispiel':
        if not demo.get('verweis_genre'):
            fehler.append(f'{bid}: demonstration(hoerbeispiel) ohne verweis_genre')


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
        if b.get('demonstration') is not None:
            pruefe_demonstration(bid, b['demonstration'], fehler)
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

    # Delta-Bausteine (Transfer-Layer, Spez. 4.2/5): Ersetzen bei passender
    # Herkunft NUR den Erklaerteil des Basisbausteins. Spiegelt pruefeDaten:
    # Basis existiert, Herkunft im Vokabular + Label, kein eigener Uebungsteil,
    # Buendelungs-Verweise aufloesbar, keine doppelte Ersetzung je Basis::Herkunft.
    # Zusaetzlich: der Basisbaustein listet die Herkunft in transfer_herkunft
    # (sonst fehlt der sichtbare Chip in der Baustein-Ansicht).
    deltas = [d for fn in dateien for d in (lade(fn).get('delta_bausteine') or [])]
    herkunft_labels = lade('data/labels/de.json').get('vokabeln', {}).get('transfer_herkunft') or {}
    delta_ids = {d.get('id') for d in deltas}
    delta_schluessel = set()
    for dl in deltas:
        did = dl.get('id') or '<ohne id>'
        basis = von_id_pool.get(dl.get('basis_baustein'))
        if basis is None:
            fehler.append(f'{did}: Basisbaustein "{dl.get("basis_baustein")}" existiert nicht')
        herkunft = dl.get('ersetzt_bei_herkunft')
        if not gueltig(voka.get('transfer_herkunft'), herkunft):
            fehler.append(f'{did}: unbekannte Herkunft "{herkunft}"')
        if herkunft not in herkunft_labels:
            fehler.append(f'{did}: Herkunft "{herkunft}" ohne Label (vokabeln.transfer_herkunft)')
        if dl.get('eigener_uebungsteil') or dl.get('uebungsteil'):
            fehler.append(f'{did}: Delta mit eigenem Uebungsteil verletzt die Delta-Uebungsregel (Spez. 5)')
        if not ((dl.get('erklaerteil') or {}).get('de') or '').strip():
            fehler.append(f'{did}: erklaerteil.de fehlt oder ist leer')
        schluessel = f'{dl.get("basis_baustein")}::{herkunft}'
        if schluessel in delta_schluessel:
            fehler.append(f'{did}: doppelte Ersetzung fuer {schluessel}')
        delta_schluessel.add(schluessel)
        for verweis in dl.get('delta_buendelung') or []:
            if verweis not in delta_ids:
                fehler.append(f'{did}: Buendelungs-Verweis "{verweis}" existiert nicht')
        if basis is not None and herkunft not in (basis.get('transfer_herkunft') or []):
            warnung.append(f'{did}: Basis "{basis["id"]}" listet Herkunft {herkunft} nicht in transfer_herkunft (Chip fehlt)')
        for txt in sichtbare_texte(dl):
            for treffer in UMLAUT_VERDACHT.finditer(txt):
                umlaut.append(f'{did}: ASCII-Umlaut-Verdacht "{treffer.group(0)}"')
    if deltas:
        print(f'  Deltas: {len(deltas)} ueber {len({d.get("ersetzt_bei_herkunft") for d in deltas})} Herkuenfte')

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

    # Baustein-Grafiken (data/grafiken.json, generiert via scripts/build_grafiken.py):
    # jeder Baustein soll eine Grafik tragen; ueberzaehlige IDs sind vorproduziert
    # (kuenftige Sets) und nur eine Info, kein Fehler.
    try:
        grafiken = set(lade('data/grafiken.json'))
    except FileNotFoundError:
        grafiken = set()
        warnung.append('data/grafiken.json fehlt (scripts/build_grafiken.py laufen lassen)')
    if grafiken:
        for bid in sorted(idset - grafiken):
            warnung.append(f'{bid}: keine Baustein-Grafik (scripts/build_svg*.py ergaenzen + build_grafiken.py)')

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
