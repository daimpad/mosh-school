#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Rechnet die synthetisierten Box-Impulsantworten nach.

Spiegelt die Formeln aus js/audio/box.js (RBJ-Biquads, xorshift-Rauschen,
FNV-1a-Saat) in reinem Python und prueft, ob die fertige Impulsantwort das
tut, was data/boxen.json behauptet:

  * Der Hoch- und Tiefpass greifen dort, wo sie angegeben sind (Toleranz, weil
    zwei kaskadierte Tiefpaesse die -3-dB-Stelle nach unten ziehen).
  * Der Praesenzbuckel hebt um so viel dB, wie angegeben ist.
  * Der Mikrofonabstand erzeugt eine Ausloeschung an der gerechneten Stelle.

Praesenz und Kammfilter werden DIFFERENZIELL gemessen — dieselbe Box einmal mit
und einmal ohne das Bauteil. Ein Vergleich mit Nachbarfrequenzen misst die
Flanke des Tiefpasses mit und meldet Fehler, wo keine sind.
  * Der Reflexionsschwanz ist da, aber leiser als der Direktschall.

Warum ueberhaupt: Die Beschreibungen in boxen.json sind Zahlen, die niemand
hoert. Ohne diese Pruefung koennte ein Tippfehler (4800 statt 480) die Box
lautlos unbrauchbar machen — der Klang waere immer noch „irgendwie dumpf".

Laeuft ohne numpy: die DFT wird an wenigen Stuetzstellen direkt ausgewertet.
"""

import cmath
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
SCHALL_M_PRO_S = 343


def lade(pfad):
    with open(os.path.join(ROOT, pfad), encoding='utf-8') as f:
        return json.load(f)


# --- Spiegel von js/audio/box.js ------------------------------------------

def saat_von(text):
    h = 2166136261
    for zeichen in text:
        h ^= ord(zeichen)
        h = (h * 16777619) & 0xFFFFFFFF
    return h or 1


def rausch_quelle(saat):
    z = saat & 0xFFFFFFFF

    def naechstes():
        nonlocal z
        z ^= (z << 13) & 0xFFFFFFFF
        z ^= z >> 17
        z ^= (z << 5) & 0xFFFFFFFF
        z &= 0xFFFFFFFF
        return (z / 0xFFFFFFFF) * 2 - 1

    return naechstes


def biquad(art, f0, sr, q, db=0.0):
    w0 = 2 * math.pi * f0 / sr
    cos, sin = math.cos(w0), math.sin(w0)
    alpha = sin / (2 * q)
    if art == 'lowpass':
        b0, b1, b2 = (1 - cos) / 2, 1 - cos, (1 - cos) / 2
        a0, a1, a2 = 1 + alpha, -2 * cos, 1 - alpha
    elif art == 'highpass':
        b0, b1, b2 = (1 + cos) / 2, -(1 + cos), (1 + cos) / 2
        a0, a1, a2 = 1 + alpha, -2 * cos, 1 - alpha
    else:
        A = 10 ** (db / 40)
        b0, b1, b2 = 1 + alpha * A, -2 * cos, 1 - alpha * A
        a0, a1, a2 = 1 + alpha / A, -2 * cos, 1 - alpha / A
    return (b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def filtere(daten, k):
    b0, b1, b2, a1, a2 = k
    x1 = x2 = y1 = y2 = 0.0
    for i, x in enumerate(daten):
        y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, x, y1, y
        daten[i] = y
    return daten


def impulsantwort(box, sr=SR, ohne=(), normieren=True):
    """`ohne` schaltet einzelne Bauteile ab ('mikro', 'praesenz', 'hochpass',
    'tiefpass', 'reflexion') — nur so laesst sich ihr Beitrag isoliert messen. `normieren`
    muss beim Vergleich zweier Varianten aus sein, sonst verschiebt die
    Spitzennormierung den Bezugspegel und man misst sie statt des Bauteils."""
    laenge = max(64, round(box['dauer_ms'] / 1000 * sr))
    d = [0.0] * laenge
    d[0] = 1.0
    versatz = round(box['mikro_abstand_cm'] / 100 / SCHALL_M_PRO_S * sr)
    if 0 < versatz < laenge and 'mikro' not in ohne:
        d[versatz] += box.get('mikro_pegel', 0.6)
    if 'reflexion' not in ohne:
        rnd = rausch_quelle(saat_von(box['id']))
        tau = max(1.0, box['reflexion_ms'] / 1000 * sr)
        for i in range(1, laenge):
            d[i] += rnd() * box['reflexion_pegel'] * math.exp(-i / tau)
    if 'hochpass' not in ohne:
        filtere(d, biquad('highpass', box['hochpass_hz'], sr, 0.7))
    if 'tiefpass' not in ohne:
        filtere(d, biquad('lowpass', box['tiefpass_hz'], sr, 0.7))
        filtere(d, biquad('lowpass', box['tiefpass_hz'], sr, 0.7))
    if box.get('praesenz_db') and 'praesenz' not in ohne:
        filtere(d, biquad('peaking', box['praesenz_hz'], sr,
                          box.get('praesenz_guete', 1.2), box['praesenz_db']))
    if not normieren:
        return d
    spitze = max(abs(x) for x in d)
    if spitze > 0:
        d = [x / spitze for x in d]
    return d


# --- Auswertung ------------------------------------------------------------

def pegel_db(daten, f, sr=SR):
    """Betrag der DFT an EINER Frequenz. Der Drehzeiger wird fortlaufend
    multipliziert statt je Sample neu berechnet — sonst dauert der Lauf ueber
    fuenf Boxen mit je einem Dutzend Messpunkten Minuten statt Sekunden."""
    schritt = cmath.exp(-2j * math.pi * f / sr)
    zeiger = 1 + 0j
    summe = 0j
    for x in daten:
        summe += x * zeiger
        zeiger *= schritt
    return 20 * math.log10(max(abs(summe), 1e-12))


def main():
    daten = lade('data/boxen.json')
    boxen = daten.get('boxen') or []
    if not boxen:
        print('data/boxen.json enthaelt keine Boxen', file=sys.stderr)
        return 1

    fehler = []
    for box in boxen:
        ir = impulsantwort(box)
        bez = box['id']

        # ALLE Bauteile werden DIFFERENZIELL gemessen: dieselbe Box einmal mit
        # und einmal ohne das Bauteil, an derselben Frequenz. Der erste Anlauf
        # verglich stattdessen Nachbarfrequenzen gegen eine Referenzstelle — und
        # mass damit jedes Mal die Flanken der anderen Bauteile mit. Bei 70–110 ms
        # Fensterlaenge kommt der Leckeffekt dazu: unterhalb von 40 Hz misst eine
        # Einzelpunkt-DFT mehr Fenster als Signal. Die Differenz zweier Varianten
        # kuerzt beides heraus, weil beide Seiten dieselben Artefakte tragen.
        voll = impulsantwort(box, normieren=False)

        def unterschied(ohne, f):
            return pegel_db(voll, f) - pegel_db(impulsantwort(box, ohne=ohne, normieren=False), f)

        # 1. Tiefpass: eine Oktave ueber der Eckfrequenz mindestens 12 dB Abfall
        #    (zwei kaskadierte Biquads, 24 dB/Oktave).
        ueber = unterschied(('tiefpass',), box['tiefpass_hz'] * 2)
        if ueber > -12:
            fehler.append(f'{bez}: Hoehenabfall zu flach ({ueber:+.1f} dB eine Oktave ueber '
                          f'{box["tiefpass_hz"]} Hz, erwartet <= -12)')

        # 2. Hochpass: an der Eckfrequenz rund -3 dB (Guete 0.7), eine Oktave
        #    darunter deutlich mehr.
        an_ecke = unterschied(('hochpass',), box['hochpass_hz'])
        unter = unterschied(('hochpass',), box['hochpass_hz'] / 2)
        if not -6 < an_ecke < -1:
            fehler.append(f'{bez}: Hochpass greift an seiner Eckfrequenz nicht wie erwartet '
                          f'({an_ecke:+.1f} dB bei {box["hochpass_hz"]} Hz, erwartet rund -3)')
        if unter > an_ecke - 4:
            fehler.append(f'{bez}: Bassabfall zu flach ({unter:+.1f} dB eine Oktave unter '
                          f'{box["hochpass_hz"]} Hz gegenueber {an_ecke:+.1f} dB an der Ecke)')

        # 3. Praesenzbuckel hebt um genau so viel, wie angegeben ist.
        if box.get('praesenz_db'):
            hub = unterschied(('praesenz',), box['praesenz_hz'])
            soll = box['praesenz_db']
            if abs(hub - soll) > 1.5:
                fehler.append(f'{bez}: Praesenzbuckel hebt um {hub:+.1f} dB statt der '
                              f'angegebenen {soll:+.1f} dB')

        # 4. Mikrofonabstand. Die Ausloeschung liegt NICHT bei c/(2*d), sondern
        #    bei sr/(2*versatz): js/audio/box.js rundet die Laufzeit auf ganze
        #    Samples, und bei 4 cm sind das 6 statt 5,6 — der Unterschied
        #    verschiebt die Kerbe um 300 Hz. Der erste Anlauf mass an der
        #    idealen Stelle und fand dort folgerichtig keinen Einbruch.
        versatz = round(box['mikro_abstand_cm'] / 100 / SCHALL_M_PRO_S * SR)
        f_notch = SR / (2 * versatz) if versatz > 0 else float('inf')
        if f_notch < box['tiefpass_hz']:
            # OHNE den Reflexionsschwanz gemessen: Bei der offenen Box fuellt er
            # die Kerbe teilweise auf (Pegel 0.12 gegenueber 0.06 der
            # geschlossenen) — physikalisch richtig, aber hier soll geprueft
            # werden, ob der zweite Schallweg ueberhaupt und an der richtigen
            # Stelle wirkt, nicht wie hoerbar er am Ende bleibt.
            ohne_beide = pegel_db(impulsantwort(box, ohne=('mikro', 'reflexion'), normieren=False), f_notch)
            nur_reflexionslos = pegel_db(impulsantwort(box, ohne=('reflexion',), normieren=False), f_notch)
            einbruch = nur_reflexionslos - ohne_beide
            if einbruch > -2.0:
                fehler.append(f'{bez}: kein Kammfilter-Einbruch bei {f_notch:.0f} Hz '
                              f'({einbruch:+.1f} dB gegenueber derselben Box ohne den '
                              f'zweiten Schallweg) — Mikrofonabstand wirkungslos')
        else:
            einbruch = float('nan')

        # 5. Reflexionsschwanz vorhanden, aber leiser als der Direktschall.
        schwanz = max(abs(x) for x in ir[64:]) if len(ir) > 64 else 0
        if schwanz <= 0:
            fehler.append(f'{bez}: kein Reflexionsschwanz — die Faltung waere reine Filterung')
        elif schwanz > 0.5:
            fehler.append(f'{bez}: Reflexionsschwanz zu laut ({schwanz:.2f} vom Spitzenwert)')

        print(f'  {bez:22} {len(ir):5} Samples · Hoehen {ueber:+6.1f} · Bass {an_ecke:+5.1f}/{unter:+6.1f} '
              f'· Kamm {f_notch:5.0f} Hz ({einbruch:+5.1f}) · Schwanz {schwanz:.2f}')

    if fehler:
        print('\nFEHLER:', file=sys.stderr)
        for f in fehler:
            print(' ', f, file=sys.stderr)
        return 1
    print('\nOK — Impulsantworten treffen ihre Beschreibung.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
