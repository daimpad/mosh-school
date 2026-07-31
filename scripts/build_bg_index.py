#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Erzeugt images/bg/bilder.json — das Verzeichnis der Hero-Hintergrundbilder.

Warum ueberhaupt eine Liste? Die Mockup-Seite (mockups/hintergrundbilder.html)
findet die Bilder lokal ueber das Verzeichnislisting von "python3 -m
http.server". GitHub Pages liefert kein solches Listing — dort waere der Ordner
unsichtbar und die Seite bliebe leer. Diese eingecheckte Liste schliesst die
Luecke: online wie lokal dieselbe Quelle.

    python3 scripts/build_bg_index.py            # schreiben
    python3 scripts/build_bg_index.py --check    # nur pruefen, nichts schreiben

Groesse und Abmessungen stehen mit in der Liste, damit die Vergleichsseite das
Gewicht eines Bildes zeigen kann — ein 5-MB-Hintergrund ist eine
Design-Entscheidung mit Preis, und der soll sichtbar sein. Nur
Standardbibliothek, passend zur buildfreien Architektur.
"""
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ORDNER = os.path.join(ROOT, 'images/bg')
ZIEL = os.path.join(ORDNER, 'bilder.json')
ENDUNGEN = ('.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif')


def masse(pfad):
    """Breite/Hoehe ohne Fremdbibliothek. Unbekanntes Format -> (None, None)."""
    with open(pfad, 'rb') as f:
        kopf = f.read(32)
        if kopf[:8] == b'\x89PNG\r\n\x1a\n':
            return struct.unpack('>II', kopf[16:24])
        if kopf[:6] in (b'GIF87a', b'GIF89a'):
            return struct.unpack('<HH', kopf[6:10])
        if kopf[:2] == b'\xff\xd8':  # JPEG: bis zum ersten SOF-Marker laufen
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


def sammle():
    if not os.path.isdir(ORDNER):
        return []
    eintraege = []
    for name in sorted(os.listdir(ORDNER)):
        if not name.lower().endswith(ENDUNGEN):
            continue
        pfad = os.path.join(ORDNER, name)
        breite, hoehe = masse(pfad)
        eintraege.append({
            'datei': name,
            'bytes': os.path.getsize(pfad),
            'breite': breite,
            'hoehe': hoehe,
        })
    return eintraege


def main(nur_pruefen=False):
    bilder = sammle()
    text = json.dumps({'bilder': bilder}, ensure_ascii=False, indent=1) + '\n'
    if nur_pruefen:
        vorhanden = open(ZIEL, encoding='utf-8').read() if os.path.exists(ZIEL) else None
        if vorhanden != text:
            print('FEHLER (--check): images/bg/bilder.json ist nicht aktuell.')
            print('  -> python3 scripts/build_bg_index.py laufen lassen und das Ergebnis committen.')
            raise SystemExit(1)
        print(f'--check: bilder.json aktuell ({len(bilder)} Bilder).')
        return
    with open(ZIEL, 'w', encoding='utf-8') as f:
        f.write(text)
    gesamt = sum(b['bytes'] for b in bilder) / 1024
    print(f'images/bg/bilder.json: {len(bilder)} Bilder, {gesamt:.0f} KB gesamt')
    for b in bilder:
        kb = b['bytes'] / 1024
        hinweis = '   <-- sehr gross fuer einen Hintergrund' if kb > 800 else ''
        # .webp/.avif werden akzeptiert, aber von masse() nicht gelesen — dann
        # sind breite/hoehe None und die numerische Formatierung brach den Lauf
        # mit einem TypeError ab, NACH dem Schreiben von bilder.json.
        masse_text = f"{b['breite']}x{b['hoehe']}" if b['breite'] and b['hoehe'] else '?'
        print(f"  {b['datei']:28} {masse_text:<13} {kb:7.0f} KB{hinweis}")


if __name__ == '__main__':
    main(nur_pruefen='--check' in sys.argv[1:])
