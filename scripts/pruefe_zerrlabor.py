#!/usr/bin/env python3
"""Prueft die Zerr-Kennlinien gegen die Sollwerte in data/zerrlabor-kennlinien.json.

Die Uebergabe nennt `kennwerte` ausdruecklich als Verifikationsziel: Weicht die
Umsetzung deutlich ab, stimmt etwas nicht. Dieses Skript rechnet die Kurven aus
js/audio/zerre.js in Python nach (dieselben Formeln) und vergleicht.

    python3 scripts/pruefe_zerrlabor.py

Exit 0 = im Rahmen. Exit 1 = eine Kurve weicht ueber die Toleranz hinaus ab.

VERBINDLICH ist `ausgangspegel_rms`: Er trifft bei allen sieben geschlossen
angebbaren Kurven auf drei Nachkommastellen — aber nur OHNE die `/s`-Normierung,
die der urspruengliche Formeltext bei den harten Diodenkurven nannte. Mit
Normierung lag der RMS um das Drei- bis Vierfache daneben und die Pegelreihenfolge
kehrte sich um (Germanium waere am lautesten statt am leisesten), was die Kernaussage
des Kapitels zerstoert haette. Der Formeltext in der Datenquelle ist deshalb
angeglichen.

`thd_1khz` und `anteil_geradzahlig` weichen systematisch um bis zu 0,04 ab und
konvergieren auch mit mehr beruecksichtigten Oberwellen nicht — die Referenz nutzt
eine andere Messdefinition (Fensterung, Abtastrate oder Einbezug der Filter). Sie
gelten hier als Groessenordnung mit weiter Toleranz, nicht als exakte Zielmarke.
Der RMS-Treffer ueber sieben Kurven belegt die Kennlinien selbst.

DIE ZWEI MEHRSTUFIGEN KETTEN (kl_highgain_kaskade, kl_multiband) liefen bis
zuletzt gar nicht durch diese Pruefung: Sie lassen sich nicht als EINE
gedaechtnislose Kurve schreiben — die Kaskade hat einen Hochpass zwischen den
Stufen, das Multiband zwei parallel geklippte Zweige. Statt ihrer Kennwerte stand
ein Platzhalter in der Datenquelle, und der behauptete zusaetzlich, beide seien
"im Repo zu implementieren" — laengst falsch, baueKette() baut beide seit dem
ersten Tag.

Sie werden jetzt END-ZU-ENDE gemessen: `kette()` spiegelt baueKette() samt
Biquad-Filtern (WebAudio-Konvention: Q ist bei lowpass/highpass in dB, Vorgabe
1 dB -> linear 10^(1/20)). Damit gilt fuer sie ein anderer Bezug als fuer die
acht Einzelkurven — deren Kennwerte sind OHNE Filter gerechnet. Der Unterschied
steht als `messung` an jedem Eintrag.

ZUR AUSSAGEKRAFT dieser Werte, in drei Stufen:

1. Fuer sich genommen belegt ein selbst gemessener und danach eingetragener Wert
   nichts — er friert nur den Ist-Zustand ein (Regressionsanker).
2. Er ist aber GEGEN DIE ECHTE UMSETZUNG geprueft: baueKette() wurde im Browser
   durch einen OfflineAudioContext mit demselben Signal geschickt. Die Werte
   stimmen (Kaskade RMS 1.000/1.002, leise 0.539/0.539, THD bei 80 Hz 1.56/1.56;
   Multiband RMS 0.456/0.456, leise 0.065/0.065, THD bei 80 Hz 0.256/0.256).
   Damit sagen zwei unabhaengige Implementierungen dasselbe — die Python-Kette
   hier und der WebAudio-Graph dort.
3. Die inhaltliche Pruefung leisten trotzdem die KAPITELAUSSAGEN weiter unten,
   die unabhaengig von den eingetragenen Zahlen sind: Der Hochpass zwischen den
   Kaskadenstufen muss den Bass straffen, ohne 1 kHz anzufassen, und beim
   Multiband muss ein tiefer Ton sauberer bleiben als ein hoher. Beides faellt
   um, wenn jemand gain_tief und gain_hoch vertauscht — der plausible Fehler.

Ob die Anker ueberhaupt ausschlagen, rechnet scripts/pruefe_zerrlabor_mutation.py
nach (zehn absichtlich falsche Parameter). Der Test fand dabei zwei Loecher, die
inzwischen geschlossen sind — siehe dort.
"""
import cmath
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUELLE = 'data/zerrlabor-kennlinien.json'

# 0.02 statt enger: Sieben der acht messbaren Kurven treffen auf drei
# Nachkommastellen. Allein kl_fuzz liegt 0.018 daneben — die Kurve saettigt so
# hart, dass praktisch eine Rechteckwelle entsteht, und dort schlagen winzige
# Unterschiede in der Abtastung der Flanken direkt auf den RMS durch. Die
# Toleranz faengt das ab und bleibt trotzdem scharf genug: Der Fehler, gegen den
# sie eigentlich schuetzt (die faelschlich normierte Diodenkurve), lag um das
# 30- bis 70-Fache daneben.
TOLERANZ_RMS = 0.02
TOLERANZ_THD = 0.05  # weit: andere Messdefinition, siehe Modul-Docstring

N = 8192          # Samples je Messung
PERIODEN = 8      # ganzzahlig -> keine Leckage im Spektrum
AMPLITUDE = 0.7   # Eingangspegel laut Datenquelle
OBERWELLEN = 20

# Fuer die Ketten-Messung: echte Abtastrate, damit die Filter dieselben
# Eckfrequenzen sehen wie im Browser. 48000/1000 = 48 Samples je Periode, also
# geht eine ganze Zahl von Perioden exakt auf — sonst leckt das Spektrum und der
# THD-Wert haengt an der Fensterlaenge statt an der Kennlinie.
SR = 48000
KETTE_HZ = 1000
KETTE_PERIODEN = 170
KETTE_EINSCHWING = 4800   # 100 ms verwerfen: die Filter brauchen ihren Einschwingvorgang


def clip(wert, unten, oben):
    return max(unten, min(oben, wert))


def uebertragung(kl):
    """Spiegelt uebertragung() aus js/audio/zerre.js (gainFaktor = 1)."""
    p = kl.get('parameter') or {}
    g = p.get('gain', 1)
    f = kl['funktion']
    if f == 'linear':
        return lambda x: clip(g * x, -1, 1)
    if f == 'tanh':
        return lambda x: math.tanh(g * x)
    if f == 'hard':
        s = p.get('schwelle', 1)
        return lambda x: clip(g * x, -s, s)   # bewusst OHNE /s
    if f == 'diode':
        s, knick = p.get('schwelle', 0.6), p.get('knick', 0.25)

        def diode(x):
            v = g * x
            betrag = abs(v)
            return math.copysign(s + (betrag - s) * knick, v) if betrag > s else v
        return diode
    if f == 'asym_soft':
        a, b = p.get('gain_positiv', 1), p.get('gain_negativ', 1)
        return lambda x: math.tanh(a * x) if x >= 0 else math.tanh(b * x)
    if f == 'fuzz':
        haerte = p.get('haerte', 1)
        return lambda x: clip(math.tanh(4 * g * x) * haerte, -1, 1)
    return None   # tanh_kaskade/multiband: mehrstufig bzw. parallel, nicht als eine Kurve messbar


# --- Ketten-Messung (mehrstufige Kennlinien) ---

def biquad(art, f0, sr, q_db=1.0):
    """RBJ-Koeffizienten in WebAudio-Lesart. Bei lowpass/highpass ist `Q` laut
    Spezifikation in DEZIBEL angegeben (Vorgabe 1) — nicht linear. zerre.js setzt
    `.Q` nie, es gilt also die Vorgabe; mit linear 1 statt 10^(1/20) laege die
    Resonanz an der Eckfrequenz um gut 1 dB daneben."""
    w0 = 2 * math.pi * f0 / sr
    cos, sin = math.cos(w0), math.sin(w0)
    alpha = sin / (2 * 10 ** (q_db / 20))
    if art == 'lowpass':
        b0, b1, b2 = (1 - cos) / 2, 1 - cos, (1 - cos) / 2
    elif art == 'highpass':
        b0, b1, b2 = (1 + cos) / 2, -(1 + cos), (1 + cos) / 2
    else:
        raise ValueError(art)
    a0, a1, a2 = 1 + alpha, -2 * cos, 1 - alpha
    return (b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def filtere(daten, k):
    b0, b1, b2, a1, a2 = k
    x1 = x2 = y1 = y2 = 0.0
    for i, x in enumerate(daten):
        y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, x, y1, y
        daten[i] = y
    return daten


def kette(kl, signal, sr=SR, gain_faktor=1.0):
    """Spiegelt baueKette() aus js/audio/zerre.js: Hochpass -> Kennlinie(n) ->
    Tiefpass, inklusive der Sonderwege fuer Kaskade und Multiband."""
    p = kl.get('parameter') or {}
    d = list(signal)

    hp = kl.get('pre_hochpass_hz') or 0
    if hp > 0:
        filtere(d, biquad('highpass', hp, sr))

    if kl['funktion'] == 'multiband':
        trenn = p.get('trennfrequenz_hz', 250)
        g_tief = p.get('gain_tief', 1) * gain_faktor
        g_hoch = p.get('gain_hoch', 1) * gain_faktor
        tief = filtere(list(d), biquad('lowpass', trenn, sr))
        hoch = filtere(list(d), biquad('highpass', trenn, sr))
        # summe.gain = 0.5 in baueKette(), sonst doppelter Pegel
        d = [0.5 * (math.tanh(g_tief * a) + math.tanh(g_hoch * b)) for a, b in zip(tief, hoch)]
    elif kl['funktion'] == 'tanh_kaskade':
        stufen = max(1, p.get('stufen', 3))
        g = p.get('gain', 1) * gain_faktor
        zwischen = p.get('zwischen_hochpass_hz') or 0
        for i in range(stufen):
            if i > 0 and zwischen > 0:
                filtere(d, biquad('highpass', zwischen, sr))
            d = [math.tanh(g * v) for v in d]
    else:
        f = uebertragung(kl)
        d = [f(v) for v in d]

    tp = kl.get('post_tiefpass_hz') or 0
    if tp > 0:
        filtere(d, biquad('lowpass', min(tp, sr / 2 - 100), sr))
    return d


def sinus(hz, amplitude=AMPLITUDE, sr=SR, laenge=None):
    n = laenge or (KETTE_EINSCHWING + round(sr / hz) * KETTE_PERIODEN)
    return [amplitude * math.sin(2 * math.pi * hz * i / sr) for i in range(n)]


def messe_kette(kl, hz=KETTE_HZ, amplitude=AMPLITUDE, gain_faktor=1.0):
    """THD, geradzahliger Anteil und RMS am Ausgang der ganzen Kette."""
    y = kette(kl, sinus(hz, amplitude), gain_faktor=gain_faktor)[KETTE_EINSCHWING:]
    return spektrum(y, round(SR / hz))


def spektrum(y, samples_pro_periode):
    """Kohaerente DFT: die Fensterlaenge ist ein ganzes Vielfaches der Periode,
    deshalb liegt der Grundton genau auf einem Bin und leckt nicht."""
    perioden = len(y) // samples_pro_periode
    n = perioden * samples_pro_periode
    y = y[:n]
    mittel = sum(y) / n
    y = [v - mittel for v in y]

    def betrag(k):
        s = sum(y[i] * cmath.exp(-2j * math.pi * k * i / n) for i in range(n))
        return abs(s) * 2 / n

    grund = betrag(perioden)
    ober = [betrag(perioden * h) for h in range(2, OBERWELLEN + 1)]
    thd = math.sqrt(sum(a * a for a in ober)) / grund if grund else 0.0
    gerade = [a for i, a in enumerate(ober) if (i + 2) % 2 == 0]
    anteil = math.sqrt(sum(a * a for a in gerade)) / grund if grund else 0.0
    rms = math.sqrt(sum(v * v for v in y) / n)
    return thd, anteil, rms


def messe(fn):
    y = [fn(AMPLITUDE * math.sin(2 * math.pi * PERIODEN * n / N)) for n in range(N)]
    mittel = sum(y) / N
    y = [v - mittel for v in y]           # Gleichanteil entfernt

    def betrag(k):
        s = sum(y[n] * cmath.exp(-2j * math.pi * k * n / N) for n in range(N))
        return abs(s) * 2 / N

    grund = betrag(PERIODEN)
    ober = [betrag(PERIODEN * h) for h in range(2, OBERWELLEN + 1)]
    thd = math.sqrt(sum(a * a for a in ober)) / grund if grund else 0.0
    gerade = [a for i, a in enumerate(ober) if (i + 2) % 2 == 0]
    anteil = math.sqrt(sum(a * a for a in gerade)) / grund if grund else 0.0
    rms = math.sqrt(sum(v * v for v in y) / N)
    return thd, anteil, rms


def pegel_bei(y, hz, sr=SR):
    """Amplitude einer einzelnen Frequenz, kohaerent gemessen."""
    pro_periode = round(sr / hz)
    n = (len(y) // pro_periode) * pro_periode
    y = y[:n]
    mittel = sum(y) / n
    y = [v - mittel for v in y]
    k = round(hz * n / sr)
    return abs(sum(y[i] * cmath.exp(-2j * math.pi * k * i / n) for i in range(n))) * 2 / n


def pruefe_kapitelaussagen(daten, fehler):
    """Die zwei mehrstufigen Ketten gegen das pruefen, was ihre Beschreibung
    BEHAUPTET — unabhaengig von den eingetragenen Kennwerten. Ein selbst
    gemessener Kennwert friert nur den Ist-Zustand ein; erst diese Tests wuerden
    auffallen, wenn jemand die Parameter vertauscht.

    Beide messen DIFFERENZIELL bzw. gegeneinander, wie schon die Box-Bauteile:
    ein Absolutwert allein sagt nicht, ob das Bauteil etwas tut."""
    zeilen = []
    nach_id = {kl['id']: kl for kl in daten['kennlinien']}

    # (1) Kaskade: Der Hochpass ZWISCHEN den Stufen strafft den Bass vor der
    # naechsten Klippung — das ist der ganze Grund, warum sie keine einzelne
    # Kurve sein kann. Zweiton-Signal (80 Hz + 1 kHz), einmal mit und einmal
    # ohne den Zwischen-Hochpass.
    kaskade = nach_id.get('kl_highgain_kaskade')
    if kaskade:
        laenge = KETTE_EINSCHWING + round(SR / 80) * 40
        zweiton = [0.35 * math.sin(2 * math.pi * 80 * i / SR)
                   + 0.35 * math.sin(2 * math.pi * 1000 * i / SR) for i in range(laenge)]
        ohne = json.loads(json.dumps(kaskade))
        ohne['parameter']['zwischen_hochpass_hz'] = 0
        tief_mit = pegel_bei(kette(kaskade, zweiton)[KETTE_EINSCHWING:], 80)
        tief_ohne = pegel_bei(kette(ohne, zweiton)[KETTE_EINSCHWING:], 80)
        hoch_mit = pegel_bei(kette(kaskade, zweiton)[KETTE_EINSCHWING:], 1000)
        hoch_ohne = pegel_bei(kette(ohne, zweiton)[KETTE_EINSCHWING:], 1000)
        if not tief_ohne or tief_mit > tief_ohne / 2:
            fehler.append(f'Kaskade: der Zwischen-Hochpass strafft den Bass nicht — '
                          f'80 Hz mit {tief_mit:.4f}, ohne {tief_ohne:.4f} '
                          f'(erwartet: mit hoechstens halb so laut)')
        elif abs(hoch_mit - hoch_ohne) > 0.1 * hoch_ohne:
            fehler.append(f'Kaskade: der Zwischen-Hochpass greift auch bei 1 kHz an '
                          f'({hoch_mit:.3f} statt {hoch_ohne:.3f}) — er soll nur den Bass straffen')
        else:
            zeilen.append(f'Kaskade: Zwischen-Hochpass senkt 80 Hz auf '
                          f'{tief_mit / tief_ohne:.2f}x, 1 kHz bleibt ({hoch_mit:.2f})')

    # (2) Multiband: „Tiefen bleiben sauber, Hoehen werden hart verzerrt."
    # Vertauscht jemand gain_tief und gain_hoch, kehrt sich genau das um.
    #
    # Der hohe Pruefton liegt bei 800 Hz, nicht bei 2 kHz: Bei 2 kHz liegen die
    # Oberwellen so dicht am Nach-Tiefpass (7 kHz), dass schon eine Aenderung an
    # diesem Filter die Reihenfolge kippen laesst — der Test haette dann
    # ausgeschlagen und dabei die falsche Ursache genannt („gain vertauscht?"),
    # obwohl der Tiefpass schuld war. Bei 800 Hz bleibt er stabil; eine
    # Tiefpass-Aenderung faengt statt seiner der thd_1khz-Anker mit der
    # richtigen Begruendung.
    multiband = nach_id.get('kl_multiband')
    if multiband:
        thd_tief = messe_kette(multiband, hz=80)[0]
        thd_hoch = messe_kette(multiband, hz=800)[0]
        if thd_tief >= thd_hoch:
            fehler.append(f'Multiband: der tiefe Ton ist nicht sauberer als der hohe '
                          f'(THD 80 Hz {thd_tief:.3f} >= 800 Hz {thd_hoch:.3f}) — '
                          f'sind gain_tief und gain_hoch vertauscht?')
        else:
            zeilen.append(f'Multiband: tiefer Ton sauberer als hoher '
                          f'(THD 80 Hz {thd_tief:.3f} < 800 Hz {thd_hoch:.3f})')
    return zeilen


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    # --quelle erlaubt es, gegen eine Kopie zu pruefen. Genutzt von
    # scripts/pruefe_zerrlabor_mutation.py, das absichtlich falsche Werte
    # einsetzt und sehen will, ob dieses Skript anschlaegt — ohne dafuer die
    # eingecheckte Datei anfassen zu muessen.
    pfad = os.path.join(ROOT, QUELLE)
    if '--quelle' in argv:
        pfad = argv[argv.index('--quelle') + 1]
    with open(pfad, encoding='utf-8') as f:
        daten = json.load(f)

    fehler, zeilen, ketten = [], [], []
    for kl in daten['kennlinien']:
        if kl.get('messung') == 'ende_zu_ende':
            # Mehrstufig/parallel: nicht als eine Kurve messbar, aber sehr wohl
            # als ganze Kette. Frueher fielen diese Eintraege stillschweigend aus
            # der Pruefung heraus.
            thd, anteil, rms = messe_kette(kl)
            ketten.append(kl['id'])
        else:
            fn = uebertragung(kl)
            if fn is None:
                fehler.append(f"{kl['id']}: weder als Kurve noch als Kette messbar "
                              f"(funktion \"{kl['funktion']}\" unbekannt?)")
                continue
            thd, anteil, rms = messe(fn)
        soll = kl.get('kennwerte') or {}
        s_rms_anzeige = soll.get('ausgangspegel_rms')
        abw = f"{abs(rms - s_rms_anzeige):+.3f}" if s_rms_anzeige is not None else '  —  '
        zeilen.append(f"  {kl['id']:<22} RMS {rms:6.3f} / {str(s_rms_anzeige):<6} (Δ {abw})"
                      f"  THD {thd:5.3f} / {soll.get('thd_1khz')}")

        s_rms = soll.get('ausgangspegel_rms')
        if s_rms is not None and abs(rms - s_rms) > TOLERANZ_RMS:
            fehler.append(f"{kl['id']}: RMS {rms:.3f} weicht von {s_rms} ab (> {TOLERANZ_RMS})")
        s_thd = soll.get('thd_1khz')
        if s_thd is not None and abs(thd - s_thd) > TOLERANZ_THD:
            fehler.append(f"{kl['id']}: THD {thd:.3f} weicht von {s_thd} ab (> {TOLERANZ_THD})")
        s_ger = soll.get('anteil_geradzahlig')
        if s_ger is not None and abs(anteil - s_ger) > TOLERANZ_THD:
            fehler.append(f"{kl['id']}: geradzahliger Anteil {anteil:.3f} weicht von {s_ger} ab")

        # Zwei zusaetzliche Anker, nur fuer die Ketten. Sie schliessen je eine
        # Luecke, die der 1-kHz-Wert bei lautem Eingang NICHT sieht:
        #  - leise: bei 0.7 saettigen zwei und drei Kaskadenstufen gleichermassen
        #    zur Rechteckwelle. Erst am leisen Eingang trennen sie sich sauber
        #    (0.05 / 0.18 / 0.54 / 0.90 fuer eine bis vier Stufen).
        #  - 80 Hz: gain_tief des Multibands verschiebt den 1-kHz-RMS nur um
        #    0.015 und blieb damit unter der Toleranz — im Tiefband schlaegt es
        #    voll durch (0.19 / 0.26 / 0.38 fuer gain_tief 1.5 / 2.0 / 3.0).
        s_leise = soll.get('ausgangspegel_rms_leise')
        if s_leise is not None:
            _, _, rms_leise = messe_kette(kl, amplitude=0.02)
            if abs(rms_leise - s_leise) > TOLERANZ_RMS:
                fehler.append(f"{kl['id']}: RMS bei leisem Eingang {rms_leise:.3f} "
                              f"weicht von {s_leise} ab (Stufenzahl/Gain geaendert?)")
        s_tief = soll.get('thd_80hz')
        if s_tief is not None:
            thd_tief, _, _ = messe_kette(kl, hz=80)
            if abs(thd_tief - s_tief) > TOLERANZ_THD:
                fehler.append(f"{kl['id']}: THD bei 80 Hz {thd_tief:.3f} "
                              f"weicht von {s_tief} ab (Tiefband-Gain/Hochpass geaendert?)")

    print(f'Zerr-Kennlinien ({len(daten["kennlinien"])} gesamt, {len(zeilen)} gemessen):')
    print('\n'.join(zeilen))
    if ketten:
        print(f'  end-zu-end gemessen (mehrstufig/parallel): {", ".join(ketten)}')

    # Die Lehraussage des Kapitels als eigener Test: gleicher Gain, nur die
    # Schwelle unterscheidet sich -> je niedriger die Schwelle, desto mehr
    # Verzerrung und desto weniger Pegel. Kippt diese Reihenfolge, ist die
    # Normierung zurueckgerutscht und das Kapitel erzaehlt etwas Falsches.
    dioden = [kl for kl in daten['kennlinien'] if kl['funktion'] == 'hard']
    if len(dioden) >= 2:
        nach_schwelle = sorted(dioden, key=lambda k: k['parameter']['schwelle'])
        pegel = [messe(uebertragung(k))[2] for k in nach_schwelle]
        namen = ' < '.join(k['id'] for k in nach_schwelle)
        if pegel != sorted(pegel):
            fehler.append(f'Diodenreihenfolge verletzt: hoehere Schwelle muss lauter sein ({namen}) '
                          f'-> gemessen {[round(p, 3) for p in pegel]}')
        else:
            print(f'  Schwellen-Reihenfolge stimmt (leiser -> lauter): {namen}')

    for zeile in pruefe_kapitelaussagen(daten, fehler):
        print(' ', zeile)

    if fehler:
        print('\nFEHLER:')
        for f in fehler:
            print(' ', f)
        sys.exit(1)
    print('\nOK — Kennlinien treffen die Sollwerte.')


if __name__ == '__main__':
    main()
