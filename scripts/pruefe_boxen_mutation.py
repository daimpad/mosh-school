#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Mutationstest fuer scripts/pruefe_boxen.py — prueft den Pruefer.

    python3 scripts/pruefe_boxen_mutation.py

WARUM
pruefe_boxen.py rechnet die synthetisierten Impulsantworten nach und meldet
„OK". Was diese Meldung wert ist, haengt allein daran, ob sie bei einem
falschen Wert auch wirklich ausbleibt. Beim Zerr-Labor hat genau dieser Test
zwei Loecher gefunden, die vorher niemand vermutet hatte; hier wird dieselbe
Frage gestellt.

Jede Mutation ist ein Fehler, den jemand beim Schrauben an data/boxen.json
tatsaechlich machen koennte — ein verrutschtes Komma, eine vertauschte
Einheit, ein Bauteil, das versehentlich stillgelegt wird. `erwartet` ist ein
Textstueck, das in der Begruendung vorkommen muss: Ein Pruefer, der zwar rot
wird, aber die falsche Ursache nennt, schickt beim naechsten Mal jemanden in
die falsche Richtung.

Ein Kontrolllauf ohne Mutation stellt vorher sicher, dass der Pruefer nicht
ohnehin rot ist — sonst waere jede Mutation trivial „erkannt".

WAS DIESER TEST BEIM ERSTEN LAUF GEFUNDEN HAT
Fuenf von sieben Mutationen kamen durch. Der Grund war strukturell und in
pruefe_boxen.py inzwischen behoben: Alle Frequenz-Pruefungen massen RELATIV
zum angegebenen Wert („eine Oktave ueber der Eckfrequenz mindestens 12 dB
Abfall" — das stimmt fuer jede Eckfrequenz). Dazu zwei tote Pruefungen: Der
Reflexionsschwanz wurde am Ausschwingen des Direktimpulses gemessen und konnte
nie ausloesen, und die Guete des Praesenzbuckels war voellig unbeschraenkt.

WAS AUCH JETZT NICHT GEPRUEFT WERDEN KANN — und zwar aus einem guten Grund
Ein Wert, der INNERHALB der plausiblen Spanne verschoben wird, faellt nicht
auf: praesenz_hz von 2400 auf 1000 Hz, mikro_abstand_cm von 4 auf 12 cm. Beide
ergeben eine andere, aber vollkommen legitime Box. Es gibt keine externe
Referenz dafuer, wo der Praesenzbuckel eines 4x12 „richtig" sitzt — das ist
eine Gestaltungsentscheidung, keine Tatsache. Dieser Pruefer verantwortet
zwei Dinge: dass die Umsetzung tut, was die Zahlen sagen, und dass die Zahlen
in einer plausiblen Groessenordnung liegen. Was er nicht kann, steht hier,
damit niemand mehr aus ihm herausliest als drinsteckt.
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUELLE = os.path.join(ROOT, 'data', 'boxen.json')
PRUEFER = os.path.join(ROOT, 'scripts', 'pruefe_boxen.py')


def setze(box_id, feld, wert):
    def f(nach_id):
        nach_id[box_id][feld] = wert
    return f


def alle(feld, faktor):
    """Denselben Wert in ALLEN Boxen skalieren — faengt Fehler, die nur beim
    Zusammenspiel auffallen."""
    def f(nach_id):
        for box in nach_id.values():
            if feld in box:
                box[feld] = box[feld] * faktor
    return f


# `erwartet` nennt die Pruefung, die zustaendig SEIN SOLL. Genau daran ist beim
# ersten Lauf aufgefallen, dass die relativen Messungen die Zahlen selbst gar
# nicht pruefen: Die Frequenz-Mutationen wurden erst gefangen, nachdem es die
# Plausibilitaetsgrenzen gab — vorher liefen sie glatt durch.
MUTATIONEN = [
    ('Tiefpass 4800 -> 15000 Hz (Zehnerstelle verrutscht)',
     setze('box_412_geschlossen', 'tiefpass_hz', 15000), 'plausiblen Spanne'),
    ('Hochpass 85 -> 8 Hz (Faktor 10 vertan)',
     setze('box_412_geschlossen', 'hochpass_hz', 8), 'plausiblen Spanne'),
    ('alle Tiefpaesse halbiert (systematisch verschoben)',
     alle('tiefpass_hz', 0.5), 'Durchlassbereich'),
    # Beide Werte einzeln plausibel, zusammen bleibt kein Durchlassbereich.
    ('Hoch- und Tiefpass ruecken zusammen (je fuer sich plausibel)',
     lambda n: n['box_412_geschlossen'].update(hochpass_hz=195, tiefpass_hz=1520),
     'kein Durchlassbereich'),
    # praesenz_hz noch innerhalb seiner Grenzen, aber ueber dem Tiefpass: Der
    # Buckel hebt dort etwas an, das ohnehin weggefiltert ist.
    ('Praesenzbuckel oberhalb des Tiefpasses',
     setze('box_412_geschlossen', 'praesenz_hz', 5500), 'Durchlassbereich'),
    # Ein Peaking-Filter hebt an seiner Mitte exakt um praesenz_db, egal wie
    # schmal er ist — ohne Breitenpruefung waere das eine Nadel statt Klangfarbe.
    ('Praesenz-Guete 1.4 -> 12 (Nadel statt Buckel)',
     setze('box_412_geschlossen', 'praesenz_guete', 12.0), 'zu schmal'),
    ('Mikrofon-Pegel auf 0 (zweiter Schallweg stillgelegt)',
     setze('box_412_geschlossen', 'mikro_pegel', 0.0), 'Kammfilter'),
    ('Reflexionspegel x8 (Rauschschwanz uebernimmt)',
     alle('reflexion_pegel', 8.0), 'plausiblen Spanne'),
    ('Reflexionspegel auf 0 (kein Schwanz)',
     alle('reflexion_pegel', 0.0), 'kein Reflexionsschwanz'),
    ('Dauer 70 -> 5 ms (Impulsantwort abgeschnitten)',
     setze('box_412_geschlossen', 'dauer_ms', 5), 'plausiblen Spanne'),
    # Cone-Resonanzen: Sie sind der einzige Grund, warum der Frequenzgang nicht
    # glatt ist. Alle drei Wege, sie unwirksam zu machen, muessen auffallen.
    ('Alle Resonanzen auf 0 dB (Frequenzgang wird glatt)',
     lambda n: [r.update(db=0) for b in n.values() for r in b.get('resonanzen', [])],
     'kaum Welligkeit'),
    ('Resonanzen ganz entfernt',
     lambda n: [b.pop('resonanzen', None) for b in n.values()], 'kaum Welligkeit'),
    ('Resonanz oberhalb des Tiefpasses (wirkt dort, wo nichts mehr ist)',
     lambda n: n['box_412_geschlossen']['resonanzen'][0].update(hz=7000),
     'ausserhalb des Durchlassbereichs'),
]


def laufe(pfad):
    r = subprocess.run([sys.executable, PRUEFER, '--quelle', pfad],
                       cwd=ROOT, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def main():
    with open(QUELLE, encoding='utf-8') as f:
        original = f.read()

    with tempfile.TemporaryDirectory() as tmp:
        rein = os.path.join(tmp, 'rein.json')
        with open(rein, 'w', encoding='utf-8') as f:
            f.write(original)
        code, text = laufe(rein)
        if code != 0:
            print('FEHLER: Der Pruefer ist schon ohne Mutation rot — der Test saehe '
                  'jede Mutation als "erkannt".')
            print(text)
            sys.exit(1)
        print('Kontrolllauf ohne Mutation: gruen.\n')

        offen = []
        for beschreibung, aendern, erwartet in MUTATIONEN:
            daten = json.loads(original)
            aendern({b['id']: b for b in daten['boxen']})
            pfad = os.path.join(tmp, 'mutiert.json')
            with open(pfad, 'w', encoding='utf-8') as f:
                json.dump(daten, f, ensure_ascii=False, indent=2)
            code, text = laufe(pfad)
            passend = code != 0 and erwartet.lower() in text.lower()
            print(f"  {'erkannt      ' if passend else 'DURCHGELASSEN'} {beschreibung}")
            if not passend:
                offen.append(f'{beschreibung} (Exit {code}, "{erwartet}" nicht in der Begruendung)')

    if offen:
        print('\nFEHLER — diese Mutationen bleiben unbemerkt oder werden falsch begruendet:')
        for o in offen:
            print(' ', o)
        sys.exit(1)
    print(f'\nOK — alle {len(MUTATIONEN)} Mutationen werden erkannt und richtig begruendet.')


if __name__ == '__main__':
    main()
