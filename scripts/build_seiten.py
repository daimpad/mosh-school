#!/usr/bin/env python3
"""Baut die statischen, crawlbaren Tier-2-SEO-Seiten (Baustein-Detailseiten +
Genre-/Kompetenz-/Themen-/Instrument-Landingpages + 4 Hub-Übersichtsseiten)
sowie sitemap.xml.

Hintergrund: ZERRER ist eine Hash-Routing-SPA (#/baustein/<id>, #/pfad/stil/
<stil>, …) — fuer Suchmaschinen zaehlt alles hinter "#" als dieselbe URL wie
"/", bekommt also nie einen eigenen Title/Snippet und taucht nie einzeln in
der Sitemap auf. Dieses Skript erzeugt einen ZUSAETZLICHEN, statischen
Seiten-Layer unter echten Pfad-URLs (baustein/<id>/, pfad/stil/<stil>/, …),
der 1:1 auf die Hash-Routen zeigt, aber ohne JS/Zustand auskommt. Die
interaktive SPA bleibt unveraendert; jede generierte Seite verlinkt per CTA
in die Hash-Route ("In ZERRER ueben").

    python3 scripts/build_seiten.py            # baustein/**, pfad/**, instrument/**, sitemap.xml
    python3 scripts/build_seiten.py --check     # nur pruefen (Drift + Waisen), nichts schreiben

Buildfrei, nur Standardbibliothek. Generiertes Artefakt (wie data/index.json/
data/grafiken.json) — wird eingecheckt, kein Build-Schritt beim Deploy.
Quellen: js/daten.js (INHALTSDATEIEN), data/bausteine.*.json, data/labels/
de.json, data/genres.json, data/fehlerbilder.json.
"""
import html
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://zerrer.org'


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


def esc(wert):
    return html.escape('' if wert is None else str(wert), quote=True)


def kurzfassung(text, limit=157):
    """Meta-Description: Whitespace glaetten, auf Wortgrenze kuerzen."""
    text = re.sub(r'\s+', ' ', (text or '')).strip()
    if len(text) <= limit:
        return text
    geschnitten = text[:limit].rsplit(' ', 1)[0]
    return geschnitten + '…'


def wurzel(tiefe):
    return '../' * tiefe


# ---------------------------------------------------------------------------
# Daten laden (spiegelt js/daten.js baueIndizes fuer die hier benoetigten Teile)
# ---------------------------------------------------------------------------

def lade_pool():
    dateien = inhaltsdateien()
    bausteine = []
    vokabulare = {}
    for fn in dateien:
        d = lade(fn)
        if 'vokabulare' in d:
            vokabulare = d['vokabulare']  # erste Datei ist kanonisch (validate.py prueft das)
        bausteine.extend(d.get('bausteine', []))
    return bausteine, vokabulare


BAUSTEINE, VOKABULARE = lade_pool()
BAUSTEIN_VON_ID = {b['id']: b for b in BAUSTEINE}
POOL_INDEX = {b['id']: i for i, b in enumerate(BAUSTEINE)}
KOENNENS_ORDNUNG = [s for s in (VOKABULARE.get('kompetenzstufe') or []) if s != 'trainer']
DOMAENE_ORDNUNG = VOKABULARE.get('domaene') or []
STIL_ORDNUNG = VOKABULARE.get('stil') or []

LABELS = lade('data/labels/de.json')
TITEL_DE = LABELS.get('bausteine', {})
FB_TITEL = LABELS.get('fehlerbilder', {})
VOKABELN = LABELS.get('vokabeln', {})
UI = LABELS.get('ui', {})

GENRES = lade('data/genres.json').get('genres', {})

FB_VON_BASIS = {}
for _fb in lade('data/fehlerbilder.json').get('fehlerbild_bausteine', []):
    FB_VON_BASIS.setdefault(_fb['basis_baustein'], []).append(_fb)


def label_baustein(bid):
    return TITEL_DE.get(bid) or bid


def label_fehlerbild(fid):
    return FB_TITEL.get(fid) or fid


def label_vok(gruppe, wert):
    return (VOKABELN.get(gruppe) or {}).get(wert) or wert


def uitext(schluessel):
    return UI.get(schluessel) or schluessel


def domaenen_von(b):
    d = b.get('domaene')
    return d if isinstance(d, list) else [d] if d else []


def stil_von(b):
    return b.get('stil') or []


def hat_uebungsteil(b):
    return b.get('uebungsteil') is not None


def hat_reflexion(b):
    return b.get('reflexionsaufgabe') is not None


def niedrigste_stufe(b):
    stufen = b.get('kompetenzstufe') or []
    for s in KOENNENS_ORDNUNG:
        if s in stufen:
            return s
    return 'trainer' if 'trainer' in stufen else None


def ist_umgebungs_baustein(b):
    return b.get('typ') == 'umgebungs_baustein'


def ist_nur_trainer(b):
    return niedrigste_stufe(b) == 'trainer'


def standard_sortierschluessel(b):
    dom = domaenen_von(b)
    idx = DOMAENE_ORDNUNG.index(dom[0]) if dom and dom[0] in DOMAENE_ORDNUNG else len(DOMAENE_ORDNUNG)
    return (idx, POOL_INDEX.get(b['id'], 0))


# ---------------------------------------------------------------------------
# Instrument-Achse — Port der Mengenbildung aus js/pfade.js `instrumentpfad`
# und der Reiter-Konstanten aus js/ansichten/pfad.js.
# ---------------------------------------------------------------------------

INSTRUMENTE = ['gitarre', 'bass', 'schlagzeug', 'gesang']
INSTR_STUFEN = ['einsteiger', 'fortgeschritten', 'experte']
INSTR_STIMMUNG = ['gitarre', 'bass']
INSTR_WERKZEUGE = {
    'gitarre': ['stimmgeraet', 'metronom', 'pedalboard', 'ampbox', 'loops', 'recorder'],
    'bass': ['stimmgeraet', 'metronom', 'pedalboard', 'ampbox', 'loops', 'recorder'],
    'schlagzeug': ['metronom', 'loops', 'struktur', 'recorder', 'mehrspur'],
    'gesang': ['stimmgeraet', 'recorder', 'metronom', 'loops', 'struktur'],
}


def instrument_stufe(b):
    for s in INSTR_STUFEN:
        if s in (b.get('kompetenzstufe') or []):
            return s
    return 'einsteiger'


def instrument_mengen(domaene):
    """Die drei Inhaltsmengen einer Instrument-Seite — wie `instrumentpfad`.

    Theorie ist bewusst instrumentuebergreifend (die Musiktheorie-Domaene plus
    die Reflexions-Bausteine des Instruments): dieselbe Menge steht damit auf
    allen vier Seiten. Das ist so gewollt — das Wissens-Fundament gehoert an
    jedes Instrument — und faellt fuer die Suche nicht ins Gewicht, weil Praxis
    und Equipment die Seiten deutlich voneinander unterscheiden.
    """
    sichtbar = lambda b: not ist_nur_trainer(b) and not ist_umgebungs_baustein(b)
    ist_gear = lambda b: 'ausruestung' in domaenen_von(b)
    am_instrument = [b for b in BAUSTEINE if domaene in domaenen_von(b) and sichtbar(b)]
    theorie = [
        b for b in BAUSTEINE
        if sichtbar(b) and ('theorie' in domaenen_von(b)
                            or (domaene in domaenen_von(b) and b.get('reflexionsaufgabe') is not None))
    ]
    praxis = [b for b in am_instrument if not ist_gear(b) and b.get('reflexionsaufgabe') is None]
    ausruestung = sorted([b for b in am_instrument if ist_gear(b)], key=standard_sortierschluessel)
    return theorie, praxis, ausruestung


# ---------------------------------------------------------------------------
# Werkzeug-Verlinkung — Port von js/werkzeug-links.js (nur die reinen
# Daten-Regeln; die Sortierung "prominent zuerst" ist fuer eine statische
# Linkliste nicht noetig).
# ---------------------------------------------------------------------------

ID_REGELN = {
    'metronom_prinzip': [('metronom', {})],
    'mentale_temposteigerung': [('metronom', {'rampe': '1'})],
    'd_beat': [('loops', {'beat': 'd_beat'})],
    'blastbeat': [('loops', {'beat': 'blastbeat'})],
    'galopp_rhythmus': [('loops', {'beat': 'thrash_galopp'})],
    'metalcore_groove': [('loops', {'beat': 'metalcore_groove'})],
    'doom_feel': [('loops', {'beat': 'doom_feel'})],
    'drop_tuning': [('stimmgeraet', {'tuning': 'drop_d'})],
    'duo_bv_tonzentrum': [('stimmgeraet', {'note': 'E2'})],
    'duo_gv_tonart_melodie': [('stimmgeraet', {'note': 'E2'})],
    'tonhoehe_clean': [('stimmgeraet', {'note': 'A2'})],
    'pedalboard_grundlagen': [('pedalboard', {}), ('ampbox', {})],
    'gitarren_sound_architektur': [('pedalboard', {'instrument': 'gitarre'}), ('ampbox', {'instrument': 'gitarre'})],
    'bass_signalkette': [('pedalboard', {'instrument': 'bass'}), ('ampbox', {'instrument': 'bass'})],
    'bass_ton_gear': [('stimmgeraet', {'tuning': 'bass_standard'}), ('pedalboard', {'instrument': 'bass'}), ('ampbox', {'instrument': 'bass'})],
    'amp_grundlagen': [('ampbox', {})],
    'box_grundlagen': [('ampbox', {})],
    'song_arrangieren_ganz': [('struktur', {})],
    'parts_verteilen': [('struktur', {})],
    'uebergaenge_arrangieren': [('struktur', {})],
    'songidee_teilen': [('recorder', {})],
    'riff_zu_part_entwickeln': [('recorder', {})],
    'tracking_reihenfolge': [('mehrspur', {}), ('metronom', {})],
    'pre_production_plan': [('mehrspur', {}), ('metronom', {})],
    'signal_aufnehmen': [('mehrspur', {}), ('recorder', {})],
    'genres_als_werkzeug': [('landkarte', {})],
    'spannung_zwischen_genres': [('landkarte', {}), ('genremix', {})],
    'gefuehl_vor_genre': [('genremix', {}), ('landkarte', {})],
    'serendipitaet_methode': [('genremix', {})],
    'eigenen_sound_finden': [('genremix', {}), ('landkarte', {})],
    'zwei_genres_ein_riff': [('genremix', {}), ('recorder', {'kreativ': '1'})],
    'von_referenz_zum_eigenen': [('recorder', {'kreativ': '1'}), ('genremix', {})],
}

LOOP_STILE = {
    'hardcore', 'crust', 'powerviolence', 'grindcore', 'black_metal', 'death_metal',
    'thrash', 'metalcore', 'djent', 'deathcore', 'doom', 'sludge', 'stoner_post',
}

GEAR_REGION = {
    'sattel_typen': 'gitarre_bass', 'saitenlage_setup': 'gitarre_bass', 'saiten_mensur': 'gitarre_bass',
    'tonabnehmer_typen': 'gitarre_bass', 'steg_typen': 'gitarre_bass', 'plektren_saitenpflege': 'gitarre_bass',
    'pedalboard_grundlagen': 'signalweg', 'amp_grundlagen': 'signalweg', 'box_grundlagen': 'signalweg',
    'schlagzeug_komponenten': 'schlagzeug', 'felle_stimmung': 'schlagzeug', 'becken_typen': 'schlagzeug',
    'fussmaschine_double': 'schlagzeug', 'trigger_edrums': 'schlagzeug',
    'mikrofon_typen': 'gesang', 'proberaum_ausruestung': 'gesang',
}

WERKZEUG_META = {
    'metronom': ('#/werkzeug/metronom', 'wz_metronom_titel'),
    'loops': ('#/werkzeug/loops', 'wz_loops_titel'),
    'stimmgeraet': ('#/werkzeug/stimmgeraet', 'wz_stimmgeraet_titel'),
    'pedalboard': ('#/werkzeug/pedalboard', 'wz_pedalboard_titel'),
    'ampbox': ('#/werkzeug/ampbox', 'wz_ampbox_titel'),
    'struktur': ('#/werkzeug/struktur', 'wz_struktur_titel'),
    'recorder': ('#/werkzeug/recorder', 'wz_recorder_titel'),
    'mehrspur': ('#/werkzeug/mehrspur', 'wz_mehrspur_titel'),
    'explorer': ('#/werkzeug/explorer', 'wz_explorer_titel'),
    'landkarte': ('#/werkzeug/landkarte', 'wz_landkarte_titel'),
    'genremix': ('#/werkzeug/genremix', 'wz_genremix_titel'),
}


def werkzeug_route(werkzeug, params):
    basis = WERKZEUG_META.get(werkzeug, (f'#/werkzeug/{werkzeug}', None))[0]
    if not params:
        return basis
    query = '&'.join(f'{k}={v}' for k, v in params.items())
    return f'{basis}?{query}'


def generische_werkzeug_regeln(b):
    treffer = []
    if 'timing_zum_klick' in (b.get('spielziele') or []):
        treffer.append(('metronom', {'bpm': '160'}))
    stil = next((s for s in (b.get('stil') or []) if s in LOOP_STILE), None)
    if stil:
        treffer.append(('loops', {'stil': stil}))
    region = GEAR_REGION.get(b['id'])
    if region:
        treffer.append(('explorer', {'ansicht': region, 'region': b['id']}))
    return treffer


def werkzeuge_fuer(b):
    roh = list(ID_REGELN.get(b['id'], [])) + generische_werkzeug_regeln(b)
    gesehen = set()
    links = []
    for werkzeug, params in roh:
        if werkzeug in gesehen or werkzeug not in WERKZEUG_META:
            continue
        gesehen.add(werkzeug)
        route, label_key = WERKZEUG_META[werkzeug]
        links.append((werkzeug_route(werkzeug, params), uitext(label_key)))
    return links


# ---------------------------------------------------------------------------
# HTML-Geruest
# ---------------------------------------------------------------------------

def seiten_kopf(tiefe, titel, beschreibung, pfad, jsonld):
    w = wurzel(tiefe)
    canonical = f'{SITE}/{pfad}'
    return f'''<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(titel)} — ZERRER</title>
<meta name="description" content="{esc(beschreibung)}">
<meta name="author" content="Damian Paderta">
<link rel="canonical" href="{esc(canonical)}">
<link rel="icon" href="{w}assets/images/logo.svg">
<meta property="og:type" content="article">
<meta property="og:site_name" content="ZERRER">
<meta property="og:locale" content="de_DE">
<meta property="og:title" content="{esc(titel)}">
<meta property="og:description" content="{esc(beschreibung)}">
<meta property="og:url" content="{esc(canonical)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{esc(titel)}">
<meta name="twitter:description" content="{esc(beschreibung)}">
<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False, sort_keys=True)}</script>
<link rel="stylesheet" href="{w}css/schriften.css">
<link rel="stylesheet" href="{w}css/app.css">
</head>
<body>
<header class="kopf">
<div class="kopf-innen">
<a class="marke" href="{w}">
<img class="marke-logo" src="{w}assets/images/logo.svg" alt="" width="32" height="32">
<span class="marke-text">ZERRER</span>
</a>
</div>
</header>
<main id="ansicht">
'''


def seiten_fuss(tiefe, app_href):
    w = wurzel(tiefe)
    return f'''
</main>
<footer class="seiten-footer">
<div class="footer-innen">
<p class="info-cta"><a class="knopf knopf-primaer" href="{w}{app_href}">In ZERRER üben <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></p>
</div>
<div class="footer-schluss">Inhalte unter <a href="https://creativecommons.org/licenses/by-nc/4.0/deed.de" rel="license noopener" target="_blank">Creative Commons BY-NC 4.0</a> — Namensnennung, nicht kommerziell. · <a href="{w}#/impressum">Impressum</a> · <a href="{w}#/datenschutz">Datenschutz</a></div>
</footer>
</body>
</html>
'''


def seite(tiefe, titel, beschreibung, pfad, jsonld, body_html, app_href):
    return seiten_kopf(tiefe, titel, beschreibung, pfad, jsonld) + body_html + seiten_fuss(tiefe, app_href)


def stationsliste(bausteine_liste, tiefe):
    eintraege = ''.join(
        f'<li><a href="{wurzel(tiefe)}baustein/{esc(b["id"])}/">{esc(label_baustein(b["id"]))}</a></li>'
        for b in bausteine_liste
    )
    return f'<ul class="stationsliste">{eintraege}</ul>'


# ---------------------------------------------------------------------------
# Baustein-Detailseiten
# ---------------------------------------------------------------------------

def baustein_html(b):
    bid = b['id']
    tiefe = 2  # baustein/<id>/index.html
    w = wurzel(tiefe)
    titel = label_baustein(bid)

    meta_teile = (
        [label_vok('domaene', d) for d in domaenen_von(b)]
        + [label_vok('kompetenzstufe', s) for s in (b.get('kompetenzstufe') or []) if s != 'trainer']
        + [label_vok('stil', s) for s in stil_von(b)]
    )
    meta_zeile = ' · '.join(meta_teile)

    erklaerteil = (b.get('erklaerteil') or {}).get('de') or ''
    beschreibung = kurzfassung(erklaerteil) or f'{titel} — ein Lern-Baustein bei ZERRER.'
    absaetze = ''.join(f'<p>{esc(a)}</p>' for a in re.split(r'\n\s*\n', erklaerteil) if a.strip())

    aufgabe_html = ''
    if hat_uebungsteil(b):
        u = (b.get('uebungsteil') or {}).get('de') or {}
        teile = []
        kopf = uitext('uebungsteil')
        if u.get('titel'):
            kopf += f': {u["titel"]}'
        teile.append(f'<h2>{esc(kopf)}</h2>')
        if u.get('ziel'):
            teile.append(f'<p><strong>{esc(uitext("ue_ziel"))}:</strong> {esc(u["ziel"])}</p>')
        schritte = u.get('schritte')
        if isinstance(schritte, list) and schritte:
            teile.append(f'<p>{esc(uitext("ue_schritte"))}:</p><ol>' + ''.join(f'<li>{esc(s)}</li>' for s in schritte) + '</ol>')
        if u.get('steigerung'):
            teile.append(f'<p><strong>{esc(uitext("ue_steigerung"))}:</strong> {esc(u["steigerung"])}</p>')
        if u.get('selbstkontrolle'):
            teile.append(f'<p><strong>{esc(uitext("ue_selbstkontrolle"))}:</strong> {esc(u["selbstkontrolle"])}</p>')
        aufgabe_html = '<section class="abschnitt">' + ''.join(teile) + '</section>'
    elif hat_reflexion(b):
        text = (b.get('reflexionsaufgabe') or {}).get('de') or ''
        aufgabe_html = f'<section class="abschnitt"><h2>{esc(uitext("reflexionsaufgabe"))}</h2><p>{esc(text)}</p></section>'

    voraus = [v for v in (b.get('voraussetzungen') or []) if v in BAUSTEIN_VON_ID]
    voraus_html = ''
    if voraus:
        links = ''.join(f'<li><a href="{w}baustein/{esc(v)}/">{esc(label_baustein(v))}</a></li>' for v in voraus)
        voraus_html = f'<p class="leise">{esc(uitext("meta_voraussetzungen"))}:</p><ul>{links}</ul>'

    fbs = FB_VON_BASIS.get(bid) or []
    fb_html = ''
    if fbs:
        karten = ''
        for fb in fbs:
            inhalt = (fb.get('erklaerteil') or {}).get('de') or {}
            karten += (
                '<article class="fb-karte">'
                f'<h3>{esc(label_fehlerbild(fb["id"]))}</h3>'
                f'<p><strong>{esc(uitext("fb_symptom"))}:</strong> {esc(inhalt.get("symptom", ""))}</p>'
                f'<p><strong>{esc(uitext("fb_ursache"))}:</strong> {esc(inhalt.get("ursache", ""))}</p>'
                f'<p><strong>{esc(uitext("fb_korrektur"))}:</strong> {esc(inhalt.get("korrektur", ""))}</p>'
                '</article>'
            )
        fb_html = f'<section class="abschnitt trainer-layer"><h2>{esc(uitext("trainer_layer"))}</h2>{karten}</section>'

    werkzeuge = werkzeuge_fuer(b)
    werkzeug_html = ''
    if werkzeuge:
        chips = ''.join(f'<li><a href="{w}{route}">{esc(bezeichnung)}</a></li>' for route, bezeichnung in werkzeuge)
        werkzeug_html = f'<p class="leise">Passendes Werkzeug:</p><ul class="werkzeug-anbindung">{chips}</ul>'

    body = (
        f'<h1>{esc(titel)}</h1>'
        + (f'<p class="leise">{esc(meta_zeile)}</p>' if meta_zeile else '')
        + f'<section class="abschnitt"><h2>{esc(uitext("erklaerteil"))}</h2>{absaetze}</section>'
        + aufgabe_html
        + voraus_html
        + werkzeug_html
        + fb_html
    )

    jsonld = {
        '@context': 'https://schema.org',
        '@type': 'LearningResource',
        'name': titel,
        'description': beschreibung,
        'url': f'{SITE}/baustein/{bid}/',
        'inLanguage': 'de',
        'isAccessibleForFree': True,
        'learningResourceType': uitext('uebungsteil') if hat_uebungsteil(b) else uitext('reflexionsaufgabe'),
    }
    if meta_teile:
        jsonld['about'] = meta_teile

    return seite(tiefe, titel, beschreibung, f'baustein/{bid}/', jsonld, body, f'#/baustein/{bid}')


# ---------------------------------------------------------------------------
# Instrument-Landingpages
#
# Die App zeigt die Bereiche als In-Page-Reiter (Theorie/Praxis/Tools/Pruefung/
# Geraete/Stimmung/Patterns). Reiter sparen Platz auf dem Schirm — auf einer
# statischen Seite gibt es diesen Zwang nicht, und gestapelte Abschnitte bringen
# ALLES in ein crawlbares Dokument statt hinter Klicks. Deshalb hier: ein
# Abschnitt je Reiter, untereinander.
#
# Bewusst NICHT dabei: der Reiter "Pruefung" (Koennens-Check) — ein reines
# Frage-Antwort-Widget aus clientseitigem Zustand, das statisch nichts aussagt.
# Er wird stattdessen verlinkt.
# ---------------------------------------------------------------------------

def instrument_html(domaene):
    tiefe = 2  # instrument/<name>/index.html
    w = wurzel(tiefe)
    titel = label_vok('domaene', domaene)
    theorie, praxis, ausruestung = instrument_mengen(domaene)

    def nach_stufen(menge):
        """Bausteine nach Koennensstufe gruppiert — wie `stufenListe` in der App."""
        blocks = ''
        for stufe in INSTR_STUFEN:
            teil = sorted([b for b in menge if instrument_stufe(b) == stufe], key=standard_sortierschluessel)
            if not teil:
                continue
            blocks += (f'<h3>{esc(label_vok("kompetenzstufe", stufe))}</h3>'
                       + stationsliste(teil, tiefe))
        return blocks or f'<p class="leise">{esc(uitext("instrument_leer_abschnitt"))}</p>'

    def werkzeugliste(ids):
        eintraege = ''
        for wid in ids:
            route = WERKZEUG_META.get(wid, (f'#/werkzeug/{wid}', None))[0]
            eintraege += f'<li><a href="{w}{route}">{esc(uitext("wz_" + wid + "_titel"))}</a></li>'
        return f'<ul class="werkzeug-anbindung">{eintraege}</ul>'

    abschnitte = (
        f'<section class="abschnitt"><h2>{esc(uitext("instrument_praxis"))}</h2>'
        f'{nach_stufen(praxis)}</section>'
        f'<section class="abschnitt"><h2>{esc(uitext("wz_explorer_titel"))}</h2>'
        + (stationsliste(ausruestung, tiefe) if ausruestung
           else f'<p class="leise">{esc(uitext("instrument_keine_ausruestung"))}</p>')
        + '</section>'
        f'<section class="abschnitt"><h2>{esc(uitext("nav_werkzeuge"))}</h2>'
        f'<p class="leise">{esc(uitext("instrument_tools_text"))}</p>'
        f'{werkzeugliste(INSTR_WERKZEUGE.get(domaene, []))}</section>'
    )

    if domaene in INSTR_STIMMUNG:
        abschnitte += (
            f'<section class="abschnitt"><h2>{esc(uitext("instrument_stimmung"))}</h2>'
            f'<p class="leise">{esc(uitext("instrument_stimmung_text"))}</p>'
            f'<ul class="werkzeug-anbindung">'
            f'<li><a href="{w}#/stimmungen">{esc(uitext("nav_stimmungen"))}</a></li>'
            f'<li><a href="{w}#/werkzeug/stimmgeraet">{esc(uitext("wz_stimmgeraet_titel"))}</a></li>'
            f'</ul></section>'
        )
    if domaene == 'schlagzeug':
        abschnitte += (
            f'<section class="abschnitt"><h2>{esc(uitext("nav_patterns"))}</h2>'
            f'<p class="leise">{esc(uitext("instrument_patterns_text"))}</p>'
            f'<ul class="werkzeug-anbindung">'
            f'<li><a href="{w}#/patterns">{esc(uitext("nav_patterns"))}</a></li>'
            f'<li><a href="{w}#/werkzeug/metronom">{esc(uitext("wz_metronom_titel"))}</a></li>'
            f'</ul></section>'
        )

    # Theorie steht bewusst NACH Praxis und Equipment: Sie ist auf allen vier
    # Instrument-Seiten dieselbe Menge, das Instrument-Eigene gehoert nach oben.
    abschnitte += (
        f'<section class="abschnitt"><h2>{esc(uitext("instrument_theorie"))}</h2>'
        f'{nach_stufen(theorie)}</section>'
    )

    beschreibung = (f'{titel} für Extreme Metal lernen: {len(praxis)} Technik-Bausteine, '
                    f'{len(ausruestung)} zum Equipment und {len(theorie)} zur Theorie — '
                    f'kostenlos und werbefrei im Browser.')
    body = (
        f'<h1>{esc(titel)}</h1>'
        f'<p class="leise">{esc(uitext("instrument_untertitel"))}</p>'
        + abschnitte
    )
    jsonld = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        'name': titel,
        'description': beschreibung,
        'url': f'{SITE}/instrument/{domaene}/',
        'inLanguage': 'de',
        'isAccessibleForFree': True,
    }
    return seite(tiefe, titel, beschreibung, f'instrument/{domaene}/', jsonld, body, f'#/instrument/{domaene}')


def instrument_hub_html(eintraege):
    """eintraege: Liste von (domaene, label, anzahl)."""
    tiefe = 1  # instrument/index.html
    titel = uitext('instrument_picker_titel')
    beschreibung = uitext('instrument_picker_text')
    zeilen = ''.join(
        f'<li><a href="{esc(d)}/">{esc(lab)}</a> <span class="chip">{n}</span></li>'
        for d, lab, n in eintraege
    )
    body = (f'<h1>{esc(titel)}</h1><p>{esc(beschreibung)}</p>'
            f'<ul class="stationsliste">{zeilen}</ul>')
    jsonld = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        'name': titel,
        'description': beschreibung,
        'url': f'{SITE}/instrument/',
        'inLanguage': 'de',
        'isAccessibleForFree': True,
    }
    return seite(tiefe, titel, beschreibung, 'instrument/', jsonld, body, '#/instrument')


# ---------------------------------------------------------------------------
# Landingpages (Genre/Kompetenz/Themen) + Hubs
# ---------------------------------------------------------------------------

def stil_mitglieder(stil):
    treffer = [b for b in BAUSTEINE if stil in stil_von(b)]
    treffer.sort(key=lambda b: POOL_INDEX.get(b['id'], 0))
    return treffer


def kompetenz_mitglieder(stufe):
    ziel_index = KOENNENS_ORDNUNG.index(stufe)
    treffer = [
        b for b in BAUSTEINE
        if not ist_umgebungs_baustein(b) and not ist_nur_trainer(b)
        and niedrigste_stufe(b) in KOENNENS_ORDNUNG
        and KOENNENS_ORDNUNG.index(niedrigste_stufe(b)) <= ziel_index
    ]
    treffer.sort(key=standard_sortierschluessel)
    return treffer


def themen_mitglieder(domaene):
    treffer = [
        b for b in BAUSTEINE
        if domaene in domaenen_von(b) and not ist_umgebungs_baustein(b) and not ist_nur_trainer(b)
    ]
    treffer.sort(key=lambda b: POOL_INDEX.get(b['id'], 0))
    return treffer


def landing_html(art, schluessel, titel, blurb, mitglieder):
    tiefe = 3  # pfad/<art>/<schluessel>/index.html
    beschreibung = kurzfassung(blurb) if blurb else f'{titel} bei ZERRER: {len(mitglieder)} Lern-Bausteine.'
    body = (
        f'<h1>{esc(titel)}</h1>'
        + (f'<p>{esc(blurb)}</p>' if blurb else '')
        + f'<p class="leise">{len(mitglieder)} Bausteine</p>'
        + stationsliste(mitglieder, tiefe)
    )
    jsonld = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        'name': titel,
        'description': beschreibung,
        'url': f'{SITE}/pfad/{art}/{schluessel}/',
        'inLanguage': 'de',
        'isAccessibleForFree': True,
    }
    return seite(tiefe, titel, beschreibung, f'pfad/{art}/{schluessel}/', jsonld, body, f'#/pfad/{art}/{schluessel}')


def hub_html(art, titel, beschreibung, eintraege):
    """eintraege: Liste von (schluessel, label, anzahl)."""
    tiefe = 2  # pfad/<art>/index.html
    zeilen = ''.join(
        f'<li><a href="{esc(schluessel)}/">{esc(label)}</a> <span class="chip">{anzahl}</span></li>'
        for schluessel, label, anzahl in eintraege
    )
    body = f'<h1>{esc(titel)}</h1><ul class="stationsliste">{zeilen}</ul>'
    jsonld = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        'name': titel,
        'description': beschreibung,
        'url': f'{SITE}/pfad/{art}/',
        'inLanguage': 'de',
        'isAccessibleForFree': True,
    }
    return seite(tiefe, titel, beschreibung, f'pfad/{art}/', jsonld, body, f'#/pfad/{art}')


# ---------------------------------------------------------------------------
# Sitemap
# ---------------------------------------------------------------------------

def sitemap_xml(pfade_prioritaet):
    zeilen = ['<url><loc>' + SITE + '/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>']
    for pfad, prio in pfade_prioritaet:
        zeilen.append(f'<url><loc>{SITE}/{pfad}</loc><changefreq>monthly</changefreq><priority>{prio}</priority></url>')
    koerper = '\n  '.join(zeilen)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'  {koerper}\n'
        '</urlset>\n'
    )


# ---------------------------------------------------------------------------
# Alles bauen
# ---------------------------------------------------------------------------

def build_all():
    manifest = {}
    sitemap_eintraege = []

    for b in BAUSTEINE:
        manifest[f'baustein/{b["id"]}/index.html'] = baustein_html(b)
        sitemap_eintraege.append((f'baustein/{b["id"]}/', '0.6'))

    stile = [s for s in STIL_ORDNUNG if stil_mitglieder(s)]
    hub_eintraege = []
    for stil in stile:
        mitglieder = stil_mitglieder(stil)
        titel = label_vok('stil', stil)
        blurb = (GENRES.get(stil) or {}).get('kurz') or ''
        manifest[f'pfad/stil/{stil}/index.html'] = landing_html('stil', stil, titel, blurb, mitglieder)
        sitemap_eintraege.append((f'pfad/stil/{stil}/', '0.7'))
        hub_eintraege.append((stil, titel, len(mitglieder)))
    manifest['pfad/stil/index.html'] = hub_html(
        'stil', 'Genres', 'Alle Metal- und Hardcore-Genres bei ZERRER, mit den passenden Lern-Bausteinen.', hub_eintraege,
    )
    sitemap_eintraege.append(('pfad/stil/', '0.8'))

    hub_eintraege = []
    for stufe in KOENNENS_ORDNUNG:
        mitglieder = kompetenz_mitglieder(stufe)
        titel = label_vok('kompetenzstufe', stufe)
        manifest[f'pfad/kompetenz/{stufe}/index.html'] = landing_html('kompetenz', stufe, titel, '', mitglieder)
        sitemap_eintraege.append((f'pfad/kompetenz/{stufe}/', '0.7'))
        hub_eintraege.append((stufe, titel, len(mitglieder)))
    manifest['pfad/kompetenz/index.html'] = hub_html(
        'kompetenz', 'Könnensstufen', 'Der ZERRER-Lernweg nach Könnensstufe: Einsteiger, Fortgeschritten, Experte.', hub_eintraege,
    )
    sitemap_eintraege.append(('pfad/kompetenz/', '0.8'))

    hub_eintraege = []
    for domaene in DOMAENE_ORDNUNG:
        mitglieder = themen_mitglieder(domaene)
        if not mitglieder:
            continue
        titel = label_vok('domaene', domaene)
        manifest[f'pfad/themen/{domaene}/index.html'] = landing_html('themen', domaene, titel, '', mitglieder)
        sitemap_eintraege.append((f'pfad/themen/{domaene}/', '0.7'))
        hub_eintraege.append((domaene, titel, len(mitglieder)))
    manifest['pfad/themen/index.html'] = hub_html(
        'themen', 'Themen', 'ZERRER nach Thema: Instrumente, Körper & Gesundheit, Kopf & Fokus, Equipment, Theorie.', hub_eintraege,
    )
    sitemap_eintraege.append(('pfad/themen/', '0.8'))

    # Instrument-Achse: die vier Einstiegsseiten mit der hoechsten Suchrelevanz
    # ("Gitarre lernen", "Growlen lernen") — entsprechend hohe Prioritaet.
    hub_eintraege = []
    for domaene in INSTRUMENTE:
        _, praxis, ausruestung = instrument_mengen(domaene)
        manifest[f'instrument/{domaene}/index.html'] = instrument_html(domaene)
        sitemap_eintraege.append((f'instrument/{domaene}/', '0.9'))
        hub_eintraege.append((domaene, label_vok('domaene', domaene), len(praxis) + len(ausruestung)))
    manifest['instrument/index.html'] = instrument_hub_html(hub_eintraege)
    sitemap_eintraege.append(('instrument/', '0.9'))

    manifest['sitemap.xml'] = sitemap_xml(sitemap_eintraege)
    return manifest


def main(nur_pruefen=False):
    manifest = build_all()

    if not nur_pruefen:
        for d in ('baustein', 'pfad', 'instrument'):
            voll = os.path.join(ROOT, d)
            if os.path.isdir(voll):
                shutil.rmtree(voll)
        for relpfad, inhalt in manifest.items():
            voll = os.path.join(ROOT, relpfad)
            os.makedirs(os.path.dirname(voll), exist_ok=True)
            with open(voll, 'w', encoding='utf-8') as f:
                f.write(inhalt)
        seiten = len(manifest) - 1  # minus sitemap.xml
        print(f'{seiten} statische Seiten + sitemap.xml geschrieben '
              f'({len(BAUSTEINE)} Bausteine, {len(STIL_ORDNUNG)} Genres, '
              f'{len(KOENNENS_ORDNUNG)} Könnensstufen, {len(DOMAENE_ORDNUNG)} Themen, '
              f'{len(INSTRUMENTE)} Instrumente + 4 Hubs)')
        return

    abweichungen = []
    for relpfad, inhalt in manifest.items():
        voll = os.path.join(ROOT, relpfad)
        try:
            with open(voll, encoding='utf-8') as f:
                alt = f.read()
        except FileNotFoundError:
            alt = None
        if alt != inhalt:
            abweichungen.append(relpfad)

    vorhanden = set()
    for d in ('baustein', 'pfad', 'instrument'):
        voll_d = os.path.join(ROOT, d)
        for dirpath, _, dateinamen in os.walk(voll_d):
            for name in dateinamen:
                relp = os.path.relpath(os.path.join(dirpath, name), ROOT).replace(os.sep, '/')
                vorhanden.add(relp)
    waisen = sorted(vorhanden - set(manifest))

    if abweichungen or waisen:
        print('FEHLER (--check): generierte Seiten weichen vom Quellstand ab:')
        for pfad in abweichungen[:40]:
            print(f'  geaendert: {pfad}')
        for pfad in waisen[:40]:
            print(f'  WAISE (nicht mehr erzeugt): {pfad}')
        rest = len(abweichungen) + len(waisen) - 80
        if rest > 0:
            print(f'  … und {rest} weitere')
        print('  -> python3 scripts/build_seiten.py ohne --check laufen lassen.')
        raise SystemExit(1)
    print(f'--check: {len(manifest)} Dateien aus den Quellen reproduzierbar, keine Waisen.')


if __name__ == '__main__':
    main(nur_pruefen='--check' in sys.argv[1:])
