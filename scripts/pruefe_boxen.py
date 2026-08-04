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

WAS DIESE PRUEFUNG LANGE NICHT KONNTE
Genau den Tippfehler aus dem Absatz darueber. Alle Frequenz-Pruefungen messen
RELATIV zum angegebenen Wert: „eine Oktave ueber der Eckfrequenz mindestens
12 dB Abfall" stimmt fuer JEDE Eckfrequenz. Damit wurde geprueft, ob die
Umsetzung sich wie ein Filter verhaelt — nicht, ob die Zahl in den Daten
plausibel ist. scripts/pruefe_boxen_mutation.py hat das aufgedeckt: Von sieben
absichtlich falschen Werten kamen fuenf durch, darunter ein Tiefpass bei
15 kHz und ein Hochpass bei 8 Hz. Deshalb gibt es jetzt zusaetzlich
PLAUSIBILITAETSGRENZEN fuer die deklarierten Werte selbst (GRENZEN weiter
unten) — grob genug, um jede sinnvolle Bauart zuzulassen, eng genug, um eine
verrutschte Stelle zu fangen.

Zwei weitere Loecher aus demselben Lauf:
  * Der Reflexionsschwanz wurde als „lauteste Probe ab Sample 64" gemessen.
    Das ist aber ueberwiegend das Ausschwingen des GEFILTERTEN Direktimpulses:
    Mit reflexion_pegel = 0 stand dort immer noch 0,06 bis 0,15, die Pruefung
    „kein Reflexionsschwanz" konnte also nie ausloesen. Ein tiefer gesetzter
    Tiefpass liess sie umgekehrt faelschlich als „zu laut" anschlagen. Sie
    misst jetzt differenziell wie alle anderen Bauteile.
  * praesenz_guete war unbeschraenkt: Ein Peaking-Filter hebt an seiner
    Mittenfrequenz exakt um praesenz_db, egal wie schmal er ist. Eine Guete
    von 12 haette eine nadelduenne Resonanz erzeugt und waere durchgegangen.
    Geprueft wird jetzt die BREITE des Buckels.

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

# Plausibilitaetsgrenzen der DEKLARIERTEN Werte. Sie ersetzen keine Messung —
# sie fangen die Fehlerklasse, die eine relative Messung prinzipiell nicht
# sehen kann: eine verrutschte Zehnerstelle. Bewusst weit: Jede Bauart, die
# als Gitarren- oder Bassbox durchgeht, muss hineinpassen. Zu enge Grenzen
# waeren schlimmer als keine, weil sie eine legitime neue Box blockieren und
# dann jemand die Pruefung entschaerft statt die Zahl.
GRENZEN = {
    'hochpass_hz': (20, 200),        # Gehaeuse-Abstimmung; Bass tiefer als Gitarre
    'tiefpass_hz': (1500, 8000),     # Membran-Obergrenze; darueber gibt es keine Box
    'praesenz_hz': (300, 6000),
    'praesenz_db': (-12, 12),
    'mikro_abstand_cm': (0.5, 40),
    'mikro_pegel': (0.1, 1.0),
    'reflexion_ms': (2, 60),
    'reflexion_pegel': (0.01, 0.3),  # darueber uebertoent der Rauschschwanz den Direktschall
    'dauer_ms': (30, 300),
}
# Der Tiefpass muss deutlich ueber dem Hochpass liegen, sonst bleibt kein
# Durchlassbereich — das faengt vertauschte Werte, die einzeln je fuer sich
# noch in ihren Grenzen laegen.
MIN_BANDBREITE = 8


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
    if 'resonanzen' not in ohne:
        for r in box.get('resonanzen') or []:
            filtere(d, biquad('peaking', r['hz'], sr, r.get('guete', 4), r['db']))
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


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    # --quelle erlaubt es, gegen eine Kopie zu pruefen. Genutzt von
    # scripts/pruefe_boxen_mutation.py, das absichtlich falsche Werte einsetzt
    # und sehen will, ob dieses Skript anschlaegt — ohne dafuer die
    # eingecheckte Datei anfassen zu muessen.
    if '--quelle' in argv:
        with open(argv[argv.index('--quelle') + 1], encoding='utf-8') as f:
            daten = json.load(f)
    else:
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

        # 0. Plausibilitaet der DEKLARIERTEN Werte. Muss vor den Messungen
        #    stehen: Alles Folgende misst relativ zu diesen Zahlen und kann
        #    deshalb nicht bemerken, wenn eine davon um eine Zehnerstelle
        #    danebenliegt.
        for feld, (unten, oben) in GRENZEN.items():
            if feld not in box:
                continue
            wert = box[feld]
            if not unten <= wert <= oben:
                fehler.append(f'{bez}: {feld} = {wert} liegt ausserhalb der plausiblen '
                              f'Spanne {unten}..{oben} — Zehnerstelle verrutscht?')
        if box['tiefpass_hz'] < box['hochpass_hz'] * MIN_BANDBREITE:
            fehler.append(f'{bez}: kein Durchlassbereich — Tiefpass {box["tiefpass_hz"]} Hz '
                          f'liegt weniger als Faktor {MIN_BANDBREITE} ueber dem Hochpass '
                          f'{box["hochpass_hz"]} Hz')
        if box.get('praesenz_db') and not (box['hochpass_hz'] * 2 < box['praesenz_hz']
                                           < box['tiefpass_hz']):
            fehler.append(f'{bez}: Praesenzbuckel bei {box["praesenz_hz"]} Hz liegt nicht im '
                          f'Durchlassbereich ({box["hochpass_hz"]}..{box["tiefpass_hz"]} Hz) — '
                          f'er hebt dort etwas an, das ohnehin weggefiltert ist')

        # 3. Praesenzbuckel hebt um genau so viel, wie angegeben ist — UND ist
        #    ein Buckel, keine Nadel. Ein Peaking-Filter hebt an seiner
        #    Mittenfrequenz exakt um praesenz_db, voellig unabhaengig von der
        #    Guete; ohne die Breitenpruefung waere eine Guete von 12 (eine
        #    schmale Resonanz statt einer Klangfarbe) nicht von der
        #    beabsichtigten 1,0 zu unterscheiden.
        if box.get('praesenz_db'):
            hub = unterschied(('praesenz',), box['praesenz_hz'])
            soll = box['praesenz_db']
            if abs(hub - soll) > 1.5:
                fehler.append(f'{bez}: Praesenzbuckel hebt um {hub:+.1f} dB statt der '
                              f'angegebenen {soll:+.1f} dB')
            flanke = max(unterschied(('praesenz',), box['praesenz_hz'] / 1.5),
                         unterschied(('praesenz',), box['praesenz_hz'] * 1.5))
            if abs(hub) > 0.5 and flanke / hub < 0.25:
                fehler.append(f'{bez}: Praesenzbuckel ist zu schmal — eine Quinte neben der '
                              f'Mitte bleiben nur {flanke:+.2f} dB von {hub:+.2f} dB '
                              f'({flanke / hub:.0%}, erwartet >= 25%). Guete zu hoch?')

        # 4. Mikrofonabstand. Die Ausloeschung liegt NICHT bei c/(2*d), sondern
        #    bei sr/(2*versatz): js/audio/box.js rundet die Laufzeit auf ganze
        #    Samples, und bei 4 cm sind das 6 statt 5,6 — der Unterschied
        #    verschiebt die Kerbe um 300 Hz. Der erste Anlauf mass an der
        #    idealen Stelle und fand dort folgerichtig keinen Einbruch.
        versatz = round(box['mikro_abstand_cm'] / 100 / SCHALL_M_PRO_S * SR)
        f_notch = SR / (2 * versatz) if versatz > 0 else float('inf')
        # OHNE Reflexionsschwanz UND ohne Tiefpass gemessen. Der Schwanz fuellt
        # die Kerbe bei der offenen Box teilweise auf (Pegel 0,12 gegenueber
        # 0,06 der geschlossenen); der Tiefpass drueckt sie bei drei der fuenf
        # Boxen unter seine eigene Eckfrequenz. Vorher wurde die Pruefung in
        # genau diesen drei Faellen UEBERSPRUNGEN und der Bericht zeigte „nan" —
        # der Mikrofonabstand war dort also voellig ungeprueft. Ohne beide
        # Bauteile ist die Kerbe immer messbar, unabhaengig davon, wo der
        # Tiefpass sitzt.
        ohne_lp = ('reflexion', 'tiefpass')
        ohne_beide = pegel_db(impulsantwort(box, ohne=ohne_lp + ('mikro',), normieren=False), f_notch)
        mit_mikro = pegel_db(impulsantwort(box, ohne=ohne_lp, normieren=False), f_notch)
        einbruch = mit_mikro - ohne_beide
        if einbruch > -2.0:
            fehler.append(f'{bez}: kein Kammfilter-Einbruch bei {f_notch:.0f} Hz '
                          f'({einbruch:+.1f} dB gegenueber derselben Box ohne den '
                          f'zweiten Schallweg) — Mikrofonabstand wirkungslos')

        # 4b. Cone-Resonanzen. Sie sind der einzige Grund, warum der Frequenzgang
        #     nicht glatt ist — und genau das unterscheidet eine gefaltete Box von
        #     einer Filterkette. Geprueft wird beides: dass jede einzelne wirkt
        #     (differenziell an ihrer Mitte) und dass sie zusammen eine messbare
        #     WELLIGKEIT erzeugen. Ohne den zweiten Teil koennte jemand alle
        #     Resonanzen auf 0 dB setzen und die Einzelpruefungen blieben still.
        # PFLICHTFELD, nicht optional: Beim ersten Mutationslauf war die Pruefung
        # in ein `if resonanzen:` gehuellt — eine Box ohne das Feld rutschte
        # stillschweigend durch, und zwar bei genau der Eigenschaft, die eine
        # gefaltete Box von einer Filterkette unterscheidet. Dieselbe Fehlerklasse
        # wie ueberall sonst in dieser Datei: eine Pruefung, die sich selbst
        # ueberspringt, meldet gruen und hat nichts geprueft.
        resonanzen = box.get('resonanzen') or []
        welligkeit = 0.0
        if not resonanzen:
            fehler.append(f'{bez}: keine Resonanzen — ohne sie ist der Frequenzgang glatt '
                          f'und die Faltung waere reine Filterung (siehe kaum Welligkeit)')
        else:
            for r in resonanzen:
                hub = unterschied(('resonanzen',), r['hz'])
                if abs(hub - r['db']) > 1.5:
                    fehler.append(f'{bez}: Resonanz bei {r["hz"]} Hz hebt um {hub:+.1f} dB '
                                  f'statt der angegebenen {r["db"]:+.1f} dB')
                if not box['hochpass_hz'] < r['hz'] < box['tiefpass_hz']:
                    fehler.append(f'{bez}: Resonanz bei {r["hz"]} Hz liegt ausserhalb des '
                                  f'Durchlassbereichs ({box["hochpass_hz"]}..{box["tiefpass_hz"]} Hz)')
            # Welligkeit: groesster Pegelunterschied zwischen benachbarten
            # Messpunkten im Durchlassbereich, gegen dieselbe Box ohne Resonanzen.
            glatt = impulsantwort(box, ohne=('resonanzen',), normieren=False)
            punkte = [box['hochpass_hz'] * 2 * (1.1 ** k) for k in range(40)]
            punkte = [f for f in punkte if f < box['tiefpass_hz'] * 0.8]
            abweichung = [pegel_db(voll, f) - pegel_db(glatt, f) for f in punkte]
            welligkeit = max(abweichung) - min(abweichung)
            if welligkeit < 3.0:
                fehler.append(f'{bez}: Resonanzen erzeugen kaum Welligkeit ({welligkeit:.1f} dB '
                              f'Spanne im Durchlassbereich) — der Frequenzgang bleibt glatt')

        # 5. Reflexionsschwanz — DIFFERENZIELL, wie alle anderen Bauteile auch.
        #
        #    Vorher war es die lauteste Probe ab Sample 64. Das ist aber
        #    ueberwiegend das Ausschwingen des gefilterten Direktimpulses: Mit
        #    reflexion_pegel = 0 stand dort immer noch 0,06 bis 0,15, die
        #    Pruefung „kein Reflexionsschwanz" konnte also nie ausloesen, und
        #    ein tiefer gesetzter Tiefpass liess sie faelschlich als „zu laut"
        #    anschlagen.
        #
        #    Gemessen wird ENERGIE (RMS), nicht die Spitze: Der Schwanz ist
        #    Rauschen, sein hoechster Einzelwert haengt vom Zufall der Saat ab.
        #    Mit der Spitze ueberlappten die fuenf gelieferten Boxen (0,11–0,41)
        #    und eine verdoppelte Mutation (0,21–0,82) so weit, dass keine
        #    Schwelle sie trennen konnte.
        #
        #    Geprueft wird der MECHANISMUS statt des Pegels, weil die Boxen
        #    konstruktiv unterschiedlich viel Schwanz haben sollen (eine offene
        #    Box mehr als eine geschlossene) und eine globale Pegelschwelle
        #    deshalb entweder die offene Box verbietet oder gar nichts faengt:
        #      a) wirksam    — ohne Schwanz nahe null, mit Schwanz deutlich mehr
        #      b) proportional — halber Pegel ergibt halbe Energie
        #    Was das NICHT faengt, ist ein von Hand geaenderter, aber immer noch
        #    plausibler Pegel (0,06 -> 0,12). Dagegen steht GRENZEN oben.
        mit_schwanz = impulsantwort(box, normieren=False)
        ohne_schwanz = impulsantwort(box, ohne=('reflexion',), normieren=False)
        halb = impulsantwort({**box, 'reflexion_pegel': box['reflexion_pegel'] / 2},
                             normieren=False)

        def rms(werte):
            return math.sqrt(sum(x * x for x in werte) / len(werte)) if werte else 0.0

        direkt = rms(ohne_schwanz) or 1.0
        beitrag = rms([a - b for a, b in zip(mit_schwanz, ohne_schwanz)]) / direkt
        beitrag_halb = rms([a - b for a, b in zip(halb, ohne_schwanz)]) / direkt
        if beitrag < 0.05:
            fehler.append(f'{bez}: kein Reflexionsschwanz ({beitrag:.3f} der Direktschall-'
                          f'Energie) — die Faltung waere reine Filterung')
        elif beitrag > 3.0:
            fehler.append(f'{bez}: Reflexionsschwanz uebertoent den Direktschall '
                          f'({beitrag:.2f}-fache Energie)')
        elif beitrag_halb > 0 and not 1.8 < beitrag / beitrag_halb < 2.2:
            fehler.append(f'{bez}: der Reflexionspegel steuert den Schwanz nicht proportional — '
                          f'halber Pegel ergibt {beitrag / beitrag_halb:.2f}-fach statt 2-fach '
                          f'weniger Energie')

        print(f'  {bez:22} {len(ir):5} Samples · Hoehen {ueber:+6.1f} · Bass {an_ecke:+5.1f}/{unter:+6.1f} '
              f'· Kamm {f_notch:5.0f} Hz ({einbruch:+5.1f}) · Schwanz {beitrag:.3f} '
              f'· Welligkeit {welligkeit:4.1f} dB ({len(resonanzen)} Res.)')

    if fehler:
        print('\nFEHLER:', file=sys.stderr)
        for f in fehler:
            print(' ', f, file=sys.stderr)
        return 1
    print('\nOK — Impulsantworten treffen ihre Beschreibung.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
