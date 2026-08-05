#!/usr/bin/env python3
"""Cross-File-Validator fuer den ZERRER Baustein-Pool.

Spiegelt die Konsistenzpruefungen der Engine (js/daten.js -> pruefeDaten,
js/graph.js -> topoSortiere) gegen den *gemischten* Pool — genau die Dateien,
die INHALTSDATEIEN in js/daten.js laedt. Buildfrei, nur Standardbibliothek.

    python3 scripts/validate.py

Zusaetzlich zur Struktur deckelt `pruefe_groessen` die Groesse des eingecheckten
Bestands — siehe Kommentar dort.

Exit 0 = strukturell sauber. Exit 1 = strukturelle Fehler.
Der ASCII-Umlaut-Verdacht (ae/oe/ue/ss statt echter Umlaute) und fehlende
Titel-Lifts warnen nur — sie brechen nicht ab.
"""
import json
import os
import re
import subprocess
import sys
import wave
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
    # Relations-IDs sind sprachneutral und duerfen ae/oe/ue tragen. Ohne
    # 'basis_baustein' meldete der Umlaut-Scan bei JEDEM Lauf zwei Fehlerbilder
    # ("uebergaenge_bauen", "uebergaenge_arrangieren") — Dauer-Falschmeldungen,
    # die den Abschnitt insgesamt entwerten.
    'basis_baustein',
}
UMLAUT_VERDACHT = re.compile(
    r'\b(ausser|groess\w*|fuer|koenn\w*|koerp\w*|muede|muess\w*|schoen\w*|'
    r'hoeher|frueh\w*|ueb\w*|ueber\w*|fuehl\w*|fuehr\w*|gehoert|zerstoer\w*|'
    r'stoerung|loesung\w*|erhoeht|natuerlich|ungefaehr|waehrend|maessig|'
    r'grundsaetzlich|regelmaessig|massnahme\w*|schluessel\w*|lueck\w*|'
    r'zwoelf|toen\w*|geruest\w*|gleichmaessig\w*|abschlaeg\w*|zaehl\w*|'
    r'gruppenanfaeng\w*|daempf\w*)',
    re.IGNORECASE,
)

# --- Umlaut-Scan fuer die Referenzbereiche ausserhalb des Baustein-Pools ------
# Andere Bauart als oben: generisch (jedes Wort mit ae/oe/ue) plus eine Liste
# legitimer Treffer. Eine Stamm-Allowlist muesste jedes neue Wort kennen; dieser
# Weg meldet unbekannte Woerter von selbst und braucht nur bei echten deutschen
# ae/oe/ue-Woertern und Eigennamen gepflegt zu werden.
REFERENZ_DATEIEN = (
    'data/songs.black-metal.json', 'data/songs.crust.json', 'data/songs.dark-post-punk.json',
    'data/songs.death-metal.json', 'data/songs.deathcore.json', 'data/songs.doom.json',
    'data/songs.grenzgaenger.json', 'data/songs.grindcore.json', 'data/songs.hardcore.json',
    'data/songs.industrial.json', 'data/songs.mathcore.json', 'data/songs.metalcore.json',
    'data/songs.noise-rock.json', 'data/songs.post-hardcore.json', 'data/songs.post-metal.json',
    'data/songs.powerviolence.json', 'data/songs.screamo.json', 'data/songs.sludge.json',
    'data/songs.stoner.json', 'data/songs.thrash.json',
    'data/genres.json', 'data/glossar.json', 'data/tunings.json', 'data/griffe.json',
    'data/zerrtypen.json',
    'data/patterns.json', 'data/brand-alert.json', 'data/pedale.json', 'data/ampbox.json',
    'data/experimente.json', 'data/koennenscheck.json', 'data/gefuehlslandkarte.json',
)
# Schluessel, deren Werte sprachneutrale IDs/URLs sind — nie Anzeigetext.
REFERENZ_IGNORIERT = frozenset({
    'id', 'url', 'quelle', 'instrument', 'domaene', 'kompetenzstufe', 'stil', 'typ',
    'werkzeug', 'baustein', 'basis_baustein', 'verweis_genre', 'spielziele',
    'voraussetzungen', 'genres', 'cta_ziel', 'saiten', 'halbtoene', '_meta',
})
# `kategorie` traegt je nach Datei ID (koennenscheck) oder Anzeigetext
# (brand-alert) — deshalb datei-genau statt global ignoriert.
REFERENZ_IGNORIERT_EXTRA = {'data/koennenscheck.json': frozenset({'kategorie'})}
ERSATZ_VERDACHT = re.compile(r'\b[A-Za-zÄÖÜäöüß]*(?:ae|oe|ue)[A-Za-zÄÖÜäöüß]*\b', re.IGNORECASE)
# `ss` statt `ß` braucht eine Stammliste statt des generischen Musters: „Schluss",
# „muss" und „Fluss" sind korrekt, „ausschliesslich" und „gross" nicht — generisch
# waere jedes zweite Wort ein Treffer. Ergaenzt den ae/oe/ue-Scan oben.
SS_VERDACHT = re.compile(
    r'\b\w*(?:ausschliess|schliess|ausser|gross|heiss|weiss|fliess|giess|reiss|'
    r'beiss|massnahm|maessig|strass|gruss|spass|stoss|schoss|blass\w*los)\w*\b',
    re.IGNORECASE,
)
# Legitime Wortbestandteile: echte deutsche ae/oe/ue-Folgen (Quelle, Dauer, bauen,
# Frequenz …), gaengige Fremdwoerter und Eigennamen aus den Song-Listen.
ERSATZ_ERLAUBT = tuple(w.lower() for w in (
    'quell', 'quer', 'frequenz', 'konsequen', 'sequenz', 'dauer', 'teuer', 'steuer', 'bequem',
    'bau', 'neu', 'trauen', 'traue', 'schauen', 'klauen', 'streuen', 'zuerst', 'zueinander',
    'genau', 'raue', 'grau', 'feuer', 'aktuell', 'manuell', 'visuell', 'individuell',
    'eventuell', 'ritual', 'rituel', 'graduell', 'punktuell', 'virtuell', 'silhouette',
    'museum', 'poet', 'duett', 'statue', 'aeon', 'aeturnus', 'queer', 'queen', 'que',
    'guest', 'guitar', 'league', 'due', 'doe', 'goes', 'blue', 'plague', 'vogue', 'tongue',
    'shoegaze', 'conqueror', 'squeal', 'squelette', 'langue', 'virtue', 'saetia', 'raein',
    'bouquet', 'mooer', 'toe', 'foetus', 'haemorrhag', 'issue', 'venue', 'rescue', 'argue',
    'value', 'tissue', 'blues', 'bluegrass', 'influencer', 'true', 'cruel', 'fuel', 'duel',
    'woe', 'gaerea',
))


def ersatzschreibungen(knoten, pfad='', ignoriert=REFERENZ_IGNORIERT):
    """Liefert (pfad, wort) fuer jedes verdaechtige Wort in sichtbaren Texten."""
    if isinstance(knoten, dict):
        for k, v in knoten.items():
            if k in ignoriert:
                continue
            yield from ersatzschreibungen(v, f'{pfad}.{k}', ignoriert)
    elif isinstance(knoten, list):
        for i, v in enumerate(knoten):
            yield from ersatzschreibungen(v, f'{pfad}[{i}]', ignoriert)
    elif isinstance(knoten, str):
        for wort in ERSATZ_VERDACHT.findall(knoten):
            klein = wort.lower()
            if not any(teil in klein for teil in ERSATZ_ERLAUBT):
                yield pfad, wort
        for treffer in SS_VERDACHT.finditer(knoten):
            yield pfad, treffer.group(0)


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
    # `gruppierung` (optional): Gruppenlängen für ungerade/verkettete Metren
    # (z. B. 5/8+7/8 → [2,3,2,2,3]). Ist sie gesetzt, ergibt sich die Schrittzahl
    # aus ihrer Summe, NICHT aus aufloesung*takte (7/8 hat 7 Schritte, nicht 8).
    grp = demo.get('gruppierung')
    if grp is not None and (not isinstance(grp, list) or not grp
                            or any(not isinstance(x, int) or x < 1 for x in grp)):
        fehler.append(f'{bid}: demonstration.gruppierung muss eine Liste positiver Ganzzahlen sein')
        grp = None
    if typ == 'pattern':
        spuren = demo.get('spuren')
        if not isinstance(spuren, list) or not spuren:
            fehler.append(f'{bid}: demonstration(pattern) ohne spuren')
            return
        aufl = demo.get('aufloesung')
        soll = sum(grp) if isinstance(grp, list) else (
            aufl * (demo.get('takte') or 1) if isinstance(aufl, int) else None)
        for sp in spuren:
            if sp.get('instrument') not in DEMO_INSTRUMENTE:
                fehler.append(f'{bid}: demonstration-Instrument "{sp.get("instrument")}" ungültig')
            schritte = sp.get('schritte')
            if not isinstance(schritte, list) or any(x not in (0, 1) for x in schritte):
                fehler.append(f'{bid}: demonstration-schritte müssen eine 0/1-Liste sein')
            elif soll is not None and len(schritte) != soll:
                fehler.append(f'{bid}: demonstration-schritte-Länge passt nicht zu '
                              f'{"gruppierung-Summe" if isinstance(grp, list) else "aufloesung*takte"}')
            # `betonung` (optional): -1 leise (Ghost Note) / 0 normal / +1 betont,
            # gleich lang wie `schritte`. Ohne sie klingen Akzent- und
            # Ghost-Note-Uebungen wie eine Reihe gleich lauter Schlaege.
            bet = sp.get('betonung')
            if bet is not None:
                if not isinstance(bet, list) or any(x not in (-1, 0, 1) for x in bet):
                    fehler.append(f'{bid}: demonstration-betonung muss eine Liste aus -1/0/1 sein')
                elif isinstance(schritte, list) and len(bet) != len(schritte):
                    fehler.append(f'{bid}: demonstration-betonung-Länge passt nicht zu schritte')
                elif isinstance(schritte, list) and any(b and not s for b, s in zip(bet, schritte)):
                    fehler.append(f'{bid}: demonstration-betonung setzt einen Wert auf eine Pause')
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
            if ev.get('betonung', 0) not in (-1, 0, 1):
                fehler.append(f'{bid}: demonstration-event betonung "{ev.get("betonung")}" '
                              f'ungültig (-1/0/1)')
    elif typ == 'hoerbeispiel':
        if not demo.get('verweis_genre'):
            fehler.append(f'{bid}: demonstration(hoerbeispiel) ohne verweis_genre')


# --- Groessenbremse ---------------------------------------------------------
# WARUM ES DIESE PRUEFUNG GIBT: Einmal sind 124 MB Rohaufnahmen (122 FLACs, je
# rund 1,3 MB) in main gelandet und erst Monate spaeter aufgefallen. Herausholen
# liess sich das nur mit einem Rewrite der Historie — die unangenehmste
# Operation, die man an einem Repo machen kann: Sie hat 429 Commit-Signaturen
# vernichtet und jeden bestehenden Klon ungueltig gemacht. Diese Pruefung soll
# verhindern, dass es ein zweites Mal so weit kommt.
#
# ZWEI GRENZEN, weil eine nicht reicht:
#   - Je Datei, weil eine einzelne fette Datei sonst durchrutscht.
#   - Ueber alles, weil genau das der eingetretene Fall war: Keine einzelne
#     Datei war ungeheuerlich, die Menge war es. Eine reine Pro-Datei-Grenze
#     haette 122 Dateien knapp ueber der Schwelle gemeldet, eine bei 2 MB gar
#     nichts.
#
# Beide Grenzen sind FEHLER, keine Warnungen: Ein Hinweis, den man wegklicken
# kann, haette den Fall nicht verhindert. Wird eine Grenze zu eng, gehoert sie
# bewusst im Diff hochgesetzt — mit Begruendung, von einem Menschen.
DATEI_GRENZE = 1 * 1024 * 1024        # 1 MB je eingecheckter Datei
GESAMT_GRENZE = 30 * 1024 * 1024      # 30 MB ueber alle eingecheckten Dateien


def pruefe_groessen(fehler):
    """Deckelt eingecheckte Dateien einzeln und in Summe."""
    # Gefragt ist der EINGECHECKTE Bestand, nicht der Arbeitsbaum: Ein Lauf ueber
    # das Dateisystem schluege bei jedem lokalen node_modules/venv an, und eine
    # Pruefung, die staendig falsch meldet, wird bald ignoriert.
    try:
        roh = subprocess.run(['git', 'ls-files', '-z'], cwd=ROOT, check=True,
                             capture_output=True).stdout
    except (OSError, subprocess.CalledProcessError) as e:
        # Bewusst hart: Eine Groessenbremse, die im Zweifel nichts prueft, ist
        # schlimmer als keine — sie meldet Erfolg, wo sie nichts gesehen hat.
        sys.exit(f'FEHLER: "git ls-files" nicht ausfuehrbar ({e}) — Groessen ungeprueft.')

    gesamt = 0
    for pfad in roh.decode('utf-8').split('\0'):
        if not pfad:
            continue
        voll = os.path.join(ROOT, pfad)
        if not os.path.isfile(voll):      # geloescht, aber noch im Index
            continue
        groesse = os.path.getsize(voll)
        gesamt += groesse
        if groesse > DATEI_GRENZE:
            fehler.append(
                f'{pfad}: {groesse / 1048576:.1f} MB ueberschreitet die Grenze von '
                f'{DATEI_GRENZE / 1048576:.0f} MB je Datei — gehoert sie wirklich ins Repo?')
    if gesamt > GESAMT_GRENZE:
        fehler.append(
            f'Eingecheckter Bestand {gesamt / 1048576:.0f} MB ueberschreitet die Grenze von '
            f'{GESAMT_GRENZE / 1048576:.0f} MB — Rohmaterial gehoert nicht in die Historie.')
    return gesamt


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
    bundle_fehlt = False
    try:
        grafiken = set(lade('data/grafiken.json'))
    except FileNotFoundError:
        grafiken = set()
        bundle_fehlt = True
        warnung.append('data/grafiken.json fehlt (scripts/build_grafiken.py laufen lassen)')
    if grafiken:
        for bid in sorted(idset - grafiken):
            warnung.append(f'{bid}: keine Baustein-Grafik (scripts/build_svg*.py ergaenzen + build_grafiken.py)')
    elif not bundle_fehlt:
        # Vorhanden, aber leer: `if grafiken:` sprang bisher stillschweigend
        # ueber die ganze Pruefung — „keine Grafik fehlt" und „ich konnte gar
        # nicht pruefen" sahen im Ergebnis identisch aus, obwohl im zweiten Fall
        # JEDE Grafik fehlt. Der Fall „Datei fehlt" meldet sich schon oben, der
        # darf hier nicht ein zweites Mal warnen.
        warnung.append('data/grafiken.json ist leer — Grafik-Abdeckung ungeprueft (scripts/build_grafiken.py laufen lassen)')

    # Referenzbereiche (Songs, Genres, Glossar, Stimmungen, Griffe, Patterns …)
    # liegen ausserhalb von INHALTSDATEIEN und wurden vom Umlaut-Scan bis hierher
    # gar nicht erfasst: 34 Ersatzschreibungen standen in sichtbarem Text, davon
    # ein Bandname ("Einstuerzende Neubauten"). Hier laeuft deshalb der generische
    # Detektor statt der Stamm-Allowlist oben — die kennt nur ~30 Woerter und
    # haette "duesterste"/"praegender"/"Baesse" auch im Pool durchgelassen.
    for datei in REFERENZ_DATEIEN:
        try:
            inhalt = lade(datei)
        except FileNotFoundError:
            continue
        ignoriert = REFERENZ_IGNORIERT | REFERENZ_IGNORIERT_EXTRA.get(datei, frozenset())
        for pfad, wort in ersatzschreibungen(inhalt, '', ignoriert):
            umlaut.append(f'{datei}{pfad}: ASCII-Umlaut-Verdacht "{wort}"')

    # Stimmungen (data/tunings.json): seit v179 die EINZIGE Tuning-Quelle — die
    # Referenz (#/stimmungen) und das Stimmgeraet lesen beide diesen Pool und
    # beschriften ueber label('stimmung', id). Ein Eintrag ohne Label rendert
    # deshalb still seine rohe ID, ohne dass irgendwo ein Fehler auffiele.
    try:
        stimmungen = lade('data/tunings.json').get('stimmungen') or []
    except FileNotFoundError:
        stimmungen = []
        warnung.append('data/tunings.json fehlt (Stimmungs-Referenz + Stimmgeraet stehen dann leer)')
    stimm_labels = lade('data/labels/de.json').get('vokabeln', {}).get('stimmung') or {}
    art_labels = lade('data/labels/de.json').get('vokabeln', {}).get('stimmungsart') or {}
    NOTE = re.compile(r'^[A-G][#b]?-?\d$')
    gesehene_stimmungen = set()
    for s in stimmungen:
        sid = s.get('id') or '<ohne id>'
        if sid in gesehene_stimmungen:
            fehler.append(f'stimmung {sid}: doppelte id')
        gesehene_stimmungen.add(sid)
        if sid not in stimm_labels:
            fehler.append(f'stimmung {sid}: kein Label (vokabeln.stimmung in labels/de.json)')
        art = s.get('art')
        if art not in art_labels:
            fehler.append(f'stimmung {sid}: art "{art}" ohne Label (vokabeln.stimmungsart)')
        if s.get('instrument') not in ('gitarre', 'bass'):
            fehler.append(f'stimmung {sid}: instrument "{s.get("instrument")}" (erlaubt: gitarre, bass)')
        for note in s.get('saiten') or []:
            # frequenzVon() in js/ansichten/stimmungen.js gibt fuer alles andere
            # null zurueck — der Referenzton bliebe stumm, ohne Fehlermeldung.
            if not NOTE.match(str(note)):
                fehler.append(f'stimmung {sid}: Note "{note}" nicht lesbar (erwartet z. B. E2, Eb2, F#1)')
        for g in s.get('genres') or []:
            if not gueltig(voka.get('stil'), g):
                fehler.append(f'stimmung {sid}: unbekanntes Genre "{g}"')
    if stimmungen:
        arten = Counter(s.get('art') for s in stimmungen)
        print(f'  Stimmungen: {len(stimmungen)} ({dict(arten)})')

    # UI-Label-Schluessel: jeder literale t('…')-Aufruf in js/ muss unter `ui` in
    # labels/de.json stehen. Ein Treffer daneben wirft KEINEN Fehler — i18n gibt
    # den rohen Schluessel zurueck, und der steht dann als Text auf der Seite.
    # Genau so stand im Zerr-Labor „AUDIO_AKTIVIEREN" auf dem Knopf (der Aufruf
    # las `audio_aktivieren` statt `wz_audio_aktivieren`), und keine Pruefung
    # schlug an — bis es jemandem im Browser auffiel.
    #
    # Zusammengesetzte Schluessel (`t('such_status_' + wert)`) sind nicht
    # statisch aufloesbar; sie enden im Quelltext auf `_` und werden bewusst
    # uebersprungen, statt reihenweise falsch zu melden.
    ui_labels = lade('data/labels/de.json').get('ui') or {}
    T_AUFRUF = re.compile(r"\bt\(\s*'([a-z0-9_]+)'")
    for wurzel, _, namen in os.walk(os.path.join(ROOT, 'js')):
        for name in sorted(namen):
            if not name.endswith('.js'):
                continue
            pfad = os.path.join(wurzel, name)
            with open(pfad, encoding='utf-8') as f:
                quelle = f.read()
            rel = os.path.relpath(pfad, ROOT)
            for schluessel in sorted({m.group(1) for m in T_AUFRUF.finditer(quelle)}):
                if schluessel.endswith('_'):
                    continue
                if schluessel not in ui_labels:
                    fehler.append(f'{rel}: t("{schluessel}") hat kein Label unter `ui` in labels/de.json')

    # Icon-Masken: jede in js/ verwendete .fa-*-Klasse braucht eine `--ti`-Maske
    # in css/schriften.css. Fehlt sie, faerbt `background-color: currentColor`
    # die ganze Flaeche — der Knopf wird zum gefuellten Kasten. Kein Fehler, kein
    # Log, nur ein Klotz. Genau so stand `.fa-trash` seit dem Bau der eigenen
    # Stimmungen im Stimmgeraet, gesehen hat es niemand.
    with open(os.path.join(ROOT, 'css', 'schriften.css'), encoding='utf-8') as f:
        icon_css = f.read()
    vorhanden = set(re.findall(r'^\.fa-([a-z0-9-]+)\s*\{', icon_css, re.M))
    ICON_KLASSE = re.compile(r"fa-solid\s+fa-([a-z0-9-]+)|icon:\s*'fa-([a-z0-9-]+)'")
    benutzt = {}
    for wurzel, _, namen in os.walk(os.path.join(ROOT, 'js')):
        for name in sorted(namen):
            if not name.endswith('.js'):
                continue
            pfad = os.path.join(wurzel, name)
            with open(pfad, encoding='utf-8') as f:
                quelle = f.read()
            for m in ICON_KLASSE.finditer(quelle):
                benutzt.setdefault(m.group(1) or m.group(2), set()).add(os.path.relpath(pfad, ROOT))
    for icon in sorted(benutzt):
        if icon not in vorhanden:
            wo = ', '.join(sorted(benutzt[icon]))
            fehler.append(f'css/schriften.css: Icon "fa-{icon}" hat keine Maske '
                          f'(benutzt in {wo}) — rendert als gefuellter Kasten')

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

    # Service-Worker-Huelle: jede Inhaltsdatei muss in sw.js SHELL stehen, sonst
    # bekommen Offline-Nutzer sie nie (CLAUDE.md "SW-Wartung"). Bis hierher deckte
    # das kein Test ab — die Liste wurde von Hand mitgezogen und konnte lautlos
    # zurueckfallen.
    with open(os.path.join(ROOT, 'sw.js'), encoding='utf-8') as f:
        sw_src = f.read()
    sw_shell = set(re.findall(r"'([^']+)'", re.search(r'const SHELL\s*=\s*\[(.*?)\];', sw_src, re.S).group(1)))
    for pfad in dateien:
        if pfad not in sw_shell:
            fehler.append(f'sw.js: Inhaltsdatei "{pfad}" fehlt in SHELL (Offline-Nutzer bekommen sie nie)')

    # Tier-2-SEO-Seiten (generiert via scripts/build_seiten.py): jeder Pool-Baustein
    # soll eine statische, crawlbare Detailseite haben, sonst fehlt er der Sitemap
    # und bleibt fuer Suchmaschinen unsichtbar. Nur Warnung, da leicht nachzuziehen.
    for bid in sorted(idset):
        if not os.path.isfile(os.path.join(ROOT, 'baustein', bid, 'index.html')):
            warnung.append(f'{bid}: keine generierte Seite (scripts/build_seiten.py laufen lassen)')

    # Klangproben des Zerr-Labors: Die Pfade stehen in der View, die Dateien
    # entstehen aus scripts/build_gitarrenprobe.mjs. Jener Generator braucht
    # Chromium (FLAC-Dekodierung) und laeuft deshalb NICHT in der CI — hier
    # steht die billige Variante: existiert die Datei, und ist sie das, was die
    # View erwartet? Ein kaputtes oder versehentlich geloeschtes WAV faellt
    # sonst erst beim Hoeren auf, und dort nur als stiller Rueckfall aufs
    # synthetische Riff.
    zerrlabor_js = os.path.join(ROOT, 'js', 'ansichten', 'werkzeug-zerrlabor.js')
    with open(zerrlabor_js, encoding='utf-8') as f:
        proben_pfade = re.findall(r"'(assets/sounds/[^']+\.wav)'", f.read())
    if not proben_pfade:
        fehler.append('werkzeug-zerrlabor.js: keine Klangproben-Pfade gefunden (Literal umbenannt?)')
    for pfad in proben_pfade:
        voll = os.path.join(ROOT, pfad)
        if not os.path.isfile(voll):
            fehler.append(f'Klangprobe "{pfad}" fehlt (node scripts/build_gitarrenprobe.mjs)')
            continue
        with wave.open(voll) as w:
            ist = (w.getnchannels(), w.getsampwidth(), w.getframerate())
        if ist != (1, 2, 44100):
            fehler.append(f'Klangprobe "{pfad}": erwartet Mono/16 bit/44100 Hz, ist {ist}')

    gesamt = pruefe_groessen(fehler)

    # Bericht
    print(f'Pool: {len(bausteine)} Bausteine ueber {len(dateien)} Dateien')
    print(f'  Eingecheckt: {gesamt / 1048576:.1f} MB (Grenze {GESAMT_GRENZE / 1048576:.0f} MB)')
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
