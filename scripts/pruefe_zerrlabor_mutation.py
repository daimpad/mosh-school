#!/usr/bin/env python3
"""Mutationstest fuer scripts/pruefe_zerrlabor.py — prueft den Pruefer.

    python3 scripts/pruefe_zerrlabor_mutation.py

WARUM DAS HIER STEHT
Die zwei mehrstufigen Kennlinien (Kaskade, Multiband) liefen lange gar nicht
durch die Pruefung: Sie lassen sich nicht als eine gedaechtnislose Kurve
schreiben, also stand statt ihrer Kennwerte ein Platzhalter da und der Pruefer
uebersprang sie stillschweigend. Das ist die unangenehmste Fehlerklasse dieses
Projekts — eine Pruefung, die gruen meldet, ohne etwas geprueft zu haben.

Sie werden jetzt end-zu-ende gemessen. Aber: Ihre Kennwerte stammen aus der
Umsetzung selbst, sie BELEGEN sie also nicht, sondern frieren sie ein. Der Wert
eines solchen Ankers haengt vollstaendig daran, ob er bei einer Aenderung auch
wirklich ausschlaegt. Genau das rechnet dieses Skript nach: Es setzt je EINEN
Parameter falsch und verlangt, dass pruefe_zerrlabor.py mit Exit 1 und einer
passenden Begruendung antwortet.

Zwei Luecken sind dabei aufgefallen und geschlossen worden:

1. Die Stufenzahl der Kaskade (3 -> 2) blieb unbemerkt. Bei Gain 3.5 und
   Eingangspegel 0.7 saettigen zwei wie drei Stufen zur selben Rechteckwelle —
   THD und RMS sind identisch. Erst am LEISEN Eingang trennen sie sich
   (RMS 0.05 / 0.18 / 0.54 / 0.90 fuer eine bis vier Stufen). Dafuer gibt es
   jetzt `ausgangspegel_rms_leise`.
2. `gain_tief` des Multibands (2.0 -> 3.0) verschob den 1-kHz-RMS nur um 0.015
   und blieb damit unter der Toleranz. Im Tiefband schlaegt es voll durch
   (THD 0.19 / 0.26 / 0.38 fuer 1.5 / 2.0 / 3.0). Dafuer gibt es `thd_80hz`.

Ausserdem hat der Test eine falsche BEGRUENDUNG aufgedeckt: Eine Aenderung am
Nach-Tiefpass liess die Kapitelaussage „Tiefen sauberer als Hoehen" umkippen,
weil der hohe Pruefton bei 2 kHz seine Oberwellen an den Tiefpass verlor. Der
Pruefer meldete daraufhin „sind gain_tief und gain_hoch vertauscht?" — richtig
angeschlagen, falsch begruendet. Der hohe Pruefton liegt deshalb jetzt bei
800 Hz.
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUELLE = os.path.join(ROOT, 'data', 'zerrlabor-kennlinien.json')
PRUEFER = os.path.join(ROOT, 'scripts', 'pruefe_zerrlabor.py')


def setze(kennlinien_id, *pfad, wert):
    def f(nach_id):
        ziel = nach_id[kennlinien_id]
        for k in pfad[:-1]:
            ziel = ziel[k]
        ziel[pfad[-1]] = wert
    return f


# Jede Mutation ist ein Fehler, den jemand beim Schrauben an den Kennlinien
# tatsaechlich machen koennte. `erwartet` ist ein Textstueck, das in der
# Begruendung vorkommen muss — sonst schlaegt der Pruefer zwar an, aber aus
# einem anderen Grund, und das waere beim naechsten Mal irrefuehrend.
MUTATIONEN = [
    ('Multiband: gain_tief und gain_hoch vertauscht',
     lambda n: n['kl_multiband']['parameter'].update(gain_tief=9.0, gain_hoch=2.0),
     'vertauscht'),
    ('Multiband: gain_tief 2.0 -> 3.0 (kleine Aenderung)',
     setze('kl_multiband', 'parameter', 'gain_tief', wert=3.0), '80 Hz'),
    ('Multiband: Trennfrequenz 250 -> 900 Hz',
     setze('kl_multiband', 'parameter', 'trennfrequenz_hz', wert=900), 'weicht'),
    ('Multiband: Nach-Tiefpass 7000 -> 3000 Hz',
     setze('kl_multiband', 'post_tiefpass_hz', wert=3000), 'THD'),
    ('Kaskade: Zwischen-Hochpass abgeschaltet',
     setze('kl_highgain_kaskade', 'parameter', 'zwischen_hochpass_hz', wert=0),
     'strafft den Bass nicht'),
    ('Kaskade: Zwischen-Hochpass 180 -> 2000 Hz',
     setze('kl_highgain_kaskade', 'parameter', 'zwischen_hochpass_hz', wert=2000),
     'auch bei 1 kHz'),
    ('Kaskade: Stufenzahl 3 -> 2',
     setze('kl_highgain_kaskade', 'parameter', 'stufen', wert=2), 'leisem Eingang'),
    ('Kaskade: Stufenzahl 3 -> 4',
     setze('kl_highgain_kaskade', 'parameter', 'stufen', wert=4), 'leisem Eingang'),
    ('Kaskade: Vor-Hochpass 150 -> 400 Hz',
     setze('kl_highgain_kaskade', 'pre_hochpass_hz', wert=400), 'weicht'),
    ('Einzelkurve: LED-Schwelle 1.7 -> 0.7 (Pegelaussage des Kapitels)',
     setze('kl_led', 'parameter', 'schwelle', wert=0.7), 'weicht'),
]


def laufe(pfad):
    r = subprocess.run([sys.executable, PRUEFER, '--quelle', pfad],
                       cwd=ROOT, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def main():
    with open(QUELLE, encoding='utf-8') as f:
        original = f.read()

    # Erst der Kontrolllauf: Ohne Mutation MUSS der Pruefer gruen sein. Ohne
    # diesen Schritt koennte er dauerhaft rot sein und jede Mutation waere
    # "erkannt".
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
            aendern({k['id']: k for k in daten['kennlinien']})
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
