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
import datetime
import json
import os
import re
import struct
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
    'data/shows.json',
)
# Schluessel, deren Werte sprachneutrale IDs/URLs sind — nie Anzeigetext.
REFERENZ_IGNORIERT = frozenset({
    'id', 'url', 'quelle', 'instrument', 'domaene', 'kompetenzstufe', 'stil', 'typ',
    'werkzeug', 'baustein', 'basis_baustein', 'verweis_genre', 'spielziele',
    'voraussetzungen', 'genres', 'cta_ziel', 'saiten', 'halbtoene', '_meta',
})
# `kategorie` traegt je nach Datei ID (koennenscheck) oder Anzeigetext
# (brand-alert) — deshalb datei-genau statt global ignoriert.
# `bild` und `datum` in shows.json sind Dateiname bzw. Zahl, nie Anzeigetext:
# Ein Dateiname wie "2019-03-08-koeln-sonic.webp" laese der generische Detektor
# sonst als Ersatzschreibung — und eine Pruefung, die staendig falsch meldet,
# wird bald ignoriert. `bands` bleibt bewusst IM Scan: Ein Bandname mit echtem
# ae gehoert in ERSATZ_ERLAUBT, nicht an der Pruefung vorbei.
REFERENZ_IGNORIERT_EXTRA = {
    'data/koennenscheck.json': frozenset({'kategorie'}),
    'data/shows.json': frozenset({'bild', 'datum'}),
}
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


# --- Pad-Adressen nie im Klartext ---------------------------------------------
# Bei CryptPad steckt der Schluessel zum Pad im URL-Fragment (#/2/…/<schluessel>/)
# — die Adresse IST der Schluessel. Im oeffentlichen Repository macht eine
# einzige solche Zeile das Pad unwiderruflich offen: Die Historie ist geklont,
# und ein spaeteres Loeschen erreicht keinen Klon mehr. Die Adresse fuer #/intern
# steht deshalb nur VERSCHLUESSELT in js/intern-schluessel.js
# (scripts/verschluessele_pad.mjs). Diese Pruefung faengt den Klartext ab.
#
# Geprueft werden eingecheckte UND neue, noch nicht gestagte Dateien: Genau vor
# dem `git add` soll sie anschlagen, nicht erst danach.
# Seit v220 ist das eingebettete Dokument ein Google Doc. Dessen Adresse ist ein
# Schlüssel, sobald es auf „Jeder mit dem Link" steht — gleiche Regel.
PAD_ADRESSE = re.compile(
    r'cryptpad[^\s"\'<>]*#/\d+/'
    r'|docs\.google\.com/(?:document|spreadsheets|presentation|forms)/d/[A-Za-z0-9_-]{20,}',
    re.IGNORECASE)


def pruefe_pad_adressen(fehler):
    roh = subprocess.run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
                         cwd=ROOT, check=True, capture_output=True).stdout
    for pfad in sorted(set(roh.decode('utf-8').split('\0'))):
        voll = os.path.join(ROOT, pfad)
        if not pfad or not os.path.isfile(voll):
            continue
        try:
            with open(voll, encoding='utf-8') as f:
                text = f.read()
        except (UnicodeDecodeError, OSError):
            continue                     # Binaerdatei (Bild, Ton, Schrift)
        if PAD_ADRESSE.search(text):
            fehler.append(
                f'{pfad}: enthaelt eine Dokument-Adresse (CryptPad/Google) im Klartext — die '
                f'Adresse IST der Schluessel. Verschluesselt ablegen: scripts/verschluessele_pad.mjs')


# --- Shows (data/shows.json + images/shows/) ---------------------------------
# Der Flyer-Bestand hat ein EIGENES Budget neben der globalen Gesamtgrenze. Zwei
# Grenzen, weil eine nicht reicht: Ohne die zweite frisst ein wachsendes
# Bildbestand still den Kopfraum, den die Inhalts-Pipeline fuer neue Bausteine
# braucht (rund 12 KB je Baustein ueber Quelle, Index, Grafik und Tier-2-Seite),
# und der Knall kaeme spaeter in einem fremden Commit, der mit Flyern nichts zu
# tun hat. Bei 150 KB je Flyer traegt das Budget rund 68 Eintraege.
#
# Die Pro-Bild-Grenze liegt WEIT unter der globalen 1-MB-Grenze und greift vor
# ihr: Ein Handyfoto eines Flyers (4 MB) riss sonst die globale Grenze — mit
# einer Meldung, die von "gehoert das wirklich ins Repo?" spricht statt von
# "verkleinere das Bild". 400 KB ist dieselbe Zahl, die js/hintergrundbilder.js
# als MAX_BYTES fuer Hintergruende zieht.
#
# Wird eine Grenze zu eng, gehoert sie bewusst im Diff hochgesetzt — oder der
# Bestand bekommt eine generierte Miniatur-Ebene (Gitter laedt Miniaturen,
# Detailseite das Original), oder die Originale wandern auf den netcup-Speicher.
# Keiner dieser Wege muss heute gebaut sein; er soll nur nicht erst unter Druck
# erfunden werden.
SHOWS_ORDNER = 'images/shows'
SHOWS_BUDGET = 10 * 1024 * 1024       # Summe ueber images/shows/
SHOWS_BILD_FEHLER = 400 * 1024        # je Bild: Fehler
SHOWS_BILD_WARNUNG = 250 * 1024       # je Bild: Warnung
SHOWS_ID = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
SHOWS_DATUM = re.compile(r'^\d{4}(-\d{2}(-\d{2})?)?$')
SHOWS_ENDUNGEN = ('.webp', '.jpg', '.jpeg', '.png')
# Verhaeltnis breite/hoehe -> erlaubtes Wort. Grob genug, dass ein Mensch es auf
# einen Blick richtig tippt, und eng genug, dass ein Vertipper auffaellt.
SHOWS_FORMATE = ('hoch', 'quer', 'quadrat')
# Woerter, die als zweites Routen-Segment schon vergeben sind. Eine Show mit
# der ID "login" waere unter #/shows/login nicht erreichbar — dort sitzt der
# Editor. Das faellt sonst NICHT auf: Die Uebersicht zeigte die Kachel, und
# erst der Klick landete im Editor statt auf der Show.
SHOWS_GESPERRTE_IDS = frozenset({'login'})


def bildmasse(pfad):
    """Breite/Hoehe ohne Fremdbibliothek. Unbekanntes Format -> (None, None).

    Dieselbe Aufgabe wie masse() in scripts/build_bg_index.py, hier zusaetzlich
    mit WebP: Ohne den RIFF/VP8-Zweig lieferte die Funktion fuer genau das
    empfohlene Format (None, None), und die Formatpruefung waere lautlos
    wirkungslos — die Fehlerklasse, gegen die diese Datei sonst ueberall
    anschreibt.
    """
    with open(pfad, 'rb') as f:
        kopf = f.read(32)
        if kopf[:8] == b'\x89PNG\r\n\x1a\n':
            return struct.unpack('>II', kopf[16:24])
        if kopf[:6] in (b'GIF87a', b'GIF89a'):
            return struct.unpack('<HH', kopf[6:10])
        if kopf[:4] == b'RIFF' and kopf[8:12] == b'WEBP':
            art = kopf[12:16]
            if art == b'VP8X':          # erweitert: 24-bit-Masse, jeweils minus 1
                b = struct.unpack('<I', kopf[24:27] + b'\x00')[0] + 1
                h = struct.unpack('<I', kopf[27:30] + b'\x00')[0] + 1
                return b, h
            if art == b'VP8L':          # verlustfrei: 14 bit je Achse, gepackt
                bits = struct.unpack('<I', kopf[21:25])[0]
                return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
            if art == b'VP8 ':          # verlustbehaftet: Keyframe-Kopf
                return (struct.unpack('<H', kopf[26:28])[0] & 0x3FFF,
                        struct.unpack('<H', kopf[28:30])[0] & 0x3FFF)
            return None, None
        if kopf[:2] == b'\xff\xd8':    # JPEG: bis zum ersten SOF-Marker laufen
            f.seek(2)
            while True:
                byte = f.read(1)
                if not byte:
                    break
                if byte != b'\xff':
                    continue
                marker = f.read(1)
                if marker in (b'\xc0', b'\xc1', b'\xc2', b'\xc3'):
                    f.read(3)
                    hoehe, breite = struct.unpack('>HH', f.read(4))
                    return breite, hoehe
                if marker in (b'\xd8', b'\xd9') or not marker:
                    continue
                laenge = f.read(2)
                if len(laenge) < 2:
                    break
                f.seek(struct.unpack('>H', laenge)[0] - 2, 1)
    return None, None


def formatWort(breite, hoehe):
    """Gemessenes Verhaeltnis -> 'hoch'/'quadrat'/'quer'."""
    r = breite / hoehe
    if r < 0.92:
        return 'hoch'
    if r > 1.08:
        return 'quer'
    return 'quadrat'


def pruefe_shows(fehler, warnung, voka):
    """Shows: Datei, Eintraege, Flyer-Bilder, Ordner-Budget.

    Der Bestand wird ueber die GitHub-Weboberflaeche gepflegt — von Hand, ohne
    Generator und ohne Build-Schritt. Diese Pruefung ist deshalb das einzige
    Netz unter der Pflege, und sie ist absichtlich engmaschig: Was hier nicht
    auffaellt, faellt im Browser als leerer Kasten auf oder gar nicht.
    """
    try:
        datei = lade('data/shows.json')
    except FileNotFoundError:
        warnung.append('data/shows.json fehlt (Shows-Seite steht dann leer)')
        return
    except json.JSONDecodeError as e:
        fehler.append(f'data/shows.json ist kein gueltiges JSON: {e}')
        return
    if not isinstance(datei, dict) or not isinstance(datei.get('shows'), list):
        # Ohne diese Pruefung liefe die Schleife unten ins Leere und ALLES
        # darunter meldete stillschweigend nichts.
        fehler.append('data/shows.json: Top-Level muss ein Objekt mit der Liste "shows" sein')
        return
    eintraege = datei['shows']

    ordner = os.path.join(ROOT, SHOWS_ORDNER)
    vorhanden = set()
    if os.path.isdir(ordner):
        vorhanden = {n for n in os.listdir(ordner) if not n.startswith('.') and n != 'README.md'}

    jahr_jetzt = datetime.date.today().year
    gesehen = {}
    benutzte_bilder = {}
    for i, f in enumerate(eintraege):
        if not isinstance(f, dict):
            fehler.append(f'data/shows.json[{i}]: kein Objekt')
            continue
        fid = f.get('id')
        ort = fid if isinstance(fid, str) and fid else f'[{i}]'
        if not isinstance(fid, str) or not SHOWS_ID.match(fid):
            fehler.append(f'show {ort}: id fehlt oder verletzt das Muster '
                          f'a-z0-9 mit Bindestrich (z. B. 2019-03-08-sonic-ballroom)')
            continue
        if fid in SHOWS_GESPERRTE_IDS:
            fehler.append(f'show {fid}: diese id ist als Route vergeben '
                          f'(#/shows/{fid}) und kann keine Show sein')
        if fid in gesehen:
            fehler.append(f'show {fid}: doppelte id (auch an Position {gesehen[fid]})')
        gesehen[fid] = i

        # Datum: Muster, dann ECHTES Datum. 2019-02-30 und 2019-13-01 passen auf
        # das Muster und ergeben trotzdem keinen Tag.
        datum = f.get('datum')
        if not isinstance(datum, str) or not SHOWS_DATUM.match(datum):
            fehler.append(f'show {fid}: datum fehlt oder ist nicht JJJJ / JJJJ-MM / JJJJ-MM-TT')
            datum = ''
        else:
            teile = [int(x) for x in datum.split('-')]
            if not 1975 <= teile[0] <= jahr_jetzt + 2:
                # Faengt den Zahlendreher 2109 (klebt den Flyer fuer immer an die
                # Spitze) und 0219 (schiebt ihn unauffindbar ans Ende).
                fehler.append(f'show {fid}: Jahr {teile[0]} ausserhalb 1975..{jahr_jetzt + 2}')
            elif len(teile) == 2 and not 1 <= teile[1] <= 12:
                fehler.append(f'show {fid}: Monat {teile[1]} gibt es nicht')
            elif len(teile) == 3:
                try:
                    datetime.date(*teile)
                except ValueError:
                    fehler.append(f'show {fid}: "{datum}" ist kein echter Tag')
            # Die ID muss mit dem Jahr beginnen. Der haeufigste Pflegefehler beim
            # Editieren im Browser ist "Eintrag kopiert, Datum geaendert, ID
            # vergessen" — der faellt als doppelte ID auf. Der umgekehrte Fall
            # faellt NUR ueber diese Kopplung auf und sortierte den Flyer sonst
            # still an die falsche Stelle.
            if datum and not fid.startswith(datum[:4]):
                fehler.append(f'show {fid}: id beginnt nicht mit dem Jahr aus datum ({datum[:4]})')

        for schluessel in ('titel', 'bild'):
            wert = f.get(schluessel)
            if not isinstance(wert, str) or not wert.strip():
                fehler.append(f'show {fid}: Pflichtfeld "{schluessel}" fehlt oder ist leer')
        for schluessel in ('alt', 'ort', 'text'):
            if schluessel in f and not isinstance(f[schluessel], str):
                fehler.append(f'show {fid}: "{schluessel}" muss ein Text sein')
        for schluessel in ('bands', 'stil'):
            wert = f.get(schluessel)
            if wert is None:
                continue
            # Der klassische Handpflege-Fehler ist "bands": "Band A, Band B".
            # Die Ansicht iterierte dann ueber die ZEICHEN und renderte
            # Buchstabensalat, ohne dass irgendwo ein Fehler auftauchte.
            if not isinstance(wert, list) or any(not isinstance(x, str) or not x.strip() for x in wert):
                fehler.append(f'show {fid}: "{schluessel}" muss eine Liste nicht-leerer Texte sein')
        stil_voka = voka.get('stil')
        for stil in f.get('stil') or []:
            if isinstance(stil, str) and isinstance(stil_voka, list) and stil not in stil_voka:
                fehler.append(f'show {fid}: unbekanntes Genre "{stil}"')
        if not (f.get('alt') or '').strip():
            warnung.append(f'show {fid}: kein alt-Text — das Bild IST hier der Inhalt')

        fmt = f.get('format')
        if fmt is not None and fmt not in SHOWS_FORMATE:
            fehler.append(f'show {fid}: format "{fmt}" (erlaubt: {", ".join(SHOWS_FORMATE)})')
            fmt = None

        bild = f.get('bild')
        if not isinstance(bild, str) or not bild.strip():
            continue
        if '/' in bild or '\\' in bild or '..' in bild:
            fehler.append(f'show {fid}: bild "{bild}" enthaelt einen Pfad — '
                          f'erwartet nur den Dateinamen (Ordner ist {SHOWS_ORDNER}/)')
            continue
        endung = os.path.splitext(bild)[1]
        if endung not in SHOWS_ENDUNGEN:
            # Gross-/Kleinschreibung ist kein Pedantismus: netcup und GitHub
            # Pages liefern case-sensitiv aus, eine lokale macOS-Platte nicht.
            # "Flyer.JPG" funktioniert dann lokal und ist online ein 404.
            fehler.append(f'show {fid}: Endung "{endung}" (erlaubt, klein geschrieben: '
                          f'{", ".join(SHOWS_ENDUNGEN)})')
            continue
        benutzte_bilder.setdefault(bild, []).append(fid)
        voll = os.path.join(ordner, bild)
        if not os.path.isfile(voll):
            fehler.append(f'show {fid}: Bild fehlt — erwartet {SHOWS_ORDNER}/{bild}')
            continue
        groesse = os.path.getsize(voll)
        if groesse > SHOWS_BILD_FEHLER:
            fehler.append(f'show {fid}: {SHOWS_ORDNER}/{bild} ist {groesse / 1024:.0f} KB '
                          f'(Grenze {SHOWS_BILD_FEHLER // 1024} KB) — verkleinern, '
                          f'siehe {SHOWS_ORDNER}/README.md')
        elif groesse > SHOWS_BILD_WARNUNG:
            warnung.append(f'show {fid}: {SHOWS_ORDNER}/{bild} ist {groesse / 1024:.0f} KB '
                           f'(Zielgroesse 120-200 KB)')
        breite, hoehe = bildmasse(voll)
        if not breite or not hoehe:
            # Faengt die als .webp umbenannte HEIC-Datei vom Telefon — im
            # Browser nur ein leerer Kasten, sonst nirgends zu sehen.
            fehler.append(f'show {fid}: {SHOWS_ORDNER}/{bild} ist kein lesbares Bildformat')
            continue
        gemessen = formatWort(breite, hoehe)
        if fmt and fmt != gemessen:
            fehler.append(f'show {fid}: format "{fmt}", gemessen {breite}x{hoehe} '
                          f'= "{gemessen}"')
        kante = max(breite, hoehe)
        if kante < 800:
            warnung.append(f'show {fid}: laengste Kante {kante} px — auf der Detailseite '
                           f'kaum lesbar (empfohlen 1200-1600 px)')
        elif kante > 2000:
            warnung.append(f'show {fid}: laengste Kante {kante} px — unnoetiges Gewicht '
                           f'(empfohlen 1200-1600 px)')

    for bild, ids in sorted(benutzte_bilder.items()):
        if len(ids) > 1:
            warnung.append(f'show: {bild} steht bei mehreren Eintraegen ({", ".join(ids)})')

    # WAISEN sind bewusst nur eine WARNUNG, waehrend ein Eintrag ohne Bild ein
    # FEHLER ist. Die Asymmetrie folgt dem Pflegeweg: Ueber die GitHub-
    # Weboberflaeche laesst sich in EINEM Commit entweder eine Datei hochladen
    # oder eine Textdatei aendern, nicht beides. Der normale Ablauf ist also
    # zwangslaeufig zweistufig, und waere die Waise ein Fehler, liefe die CI bei
    # JEDEM Pflegevorgang einmal rot. Eine Pruefung, die im Normalbetrieb rot
    # ist, wird weggeklickt — und dann faellt auch der echte Fehler daneben
    # nicht mehr auf. Der harte Riegel dagegen ist das Budget weiter unten.
    for w in sorted(vorhanden - set(benutzte_bilder)):
        warnung.append(f'show: {SHOWS_ORDNER}/{w} hat keinen Eintrag — Eintrag ergaenzen '
                       f'oder Datei loeschen (unsichtbar, zaehlt aber gegen das Budget)')

    summe = sum(os.path.getsize(os.path.join(ordner, n)) for n in vorhanden
                if os.path.isfile(os.path.join(ordner, n)))
    if summe > SHOWS_BUDGET:
        fehler.append(f'{SHOWS_ORDNER}/: {summe / 1048576:.1f} MB ueberschreitet das '
                      f'Flyer-Budget von {SHOWS_BUDGET / 1048576:.0f} MB — Bilder verkleinern '
                      f'oder das Budget bewusst im Diff anheben (siehe Kommentar in validate.py)')
    if eintraege:
        print(f'  Shows: {len(eintraege)} Eintraege, {SHOWS_ORDNER}/ {summe / 1024:.0f} KB '
              f'(Budget {SHOWS_BUDGET // 1048576} MB)')



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

    pruefe_shows(fehler, warnung, voka)

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
    # Jedes JS-Modul muss in SHELL stehen. CLAUDE.md fuehrte bisher als
    # Fallstrick, dass genau das von KEINEM Test gedeckt ist und von Hand
    # mitgezogen werden muss — ein vergessener Eintrag faellt online nie auf
    # (der Browser holt das Modul einfach) und offline erst beim Nutzer, als
    # weisse Seite.
    #
    # `--others --exclude-standard` nimmt NEUE, noch nicht gestagte Dateien mit.
    # Ohne das meldete die Pruefung beim Anlegen eines Moduls nichts und wurde
    # erst nach dem `git add` wach — also genau dann nicht, wenn man sie braucht.
    # `--exclude-standard` haelt Ignoriertes draussen, der Pfad `js` den Rest.
    js_module = sorted(set(
        p for p in subprocess.run(['git', 'ls-files', '--cached', '--others',
                                   '--exclude-standard', 'js'],
                                  cwd=ROOT, check=True, capture_output=True,
                                  text=True).stdout.split()
        if p.endswith('.js')))
    for pfad in js_module:
        if pfad not in sw_shell:
            fehler.append(f'sw.js: JS-Modul "{pfad}" fehlt in SHELL '
                          f'(offline eine weisse Seite, online unauffaellig)')

    # Dieselbe Pruefung fuer Referenzdaten, die NICHT in INHALTSDATEIEN stehen
    # und deshalb oben durchfielen. data/shows.json gehoert in die Huelle,
    # images/shows/* ausdruecklich NICHT (Gewicht) — ein versehentlich
    # aufgenommenes Bild zoege jede Installation beim ersten Start mit.
    if 'data/shows.json' not in sw_shell:
        fehler.append('sw.js: "data/shows.json" fehlt in SHELL (Shows-Seite ist offline leer)')
    for pfad in sorted(p for p in sw_shell if p.startswith('images/shows/')):
        warnung.append(f'sw.js: "{pfad}" steht in SHELL — Flyer-Bilder gehoeren bewusst '
                       f'nicht in die Huelle (Gewicht), wie images/bg/ auch')

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
    pruefe_pad_adressen(fehler)

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
