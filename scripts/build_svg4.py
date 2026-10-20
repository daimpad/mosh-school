# -*- coding: utf-8 -*-
"""Tranche 4: LEHRGRAFIKEN — erklärende Technik-Schemata (Beat-Raster, Griffbilder,
Anschlagsmuster) für die Baustein-Ansicht. Nicht direkt aufrufen —
scripts/build_grafiken.py buendelt nach data/lehrgrafiken.json.

Anders als die abstrakten Baustein-Icons (Tranche 1–3) sind Lehrgrafiken breit
(viewBox 0 0 240 120) und werden im Erklärteil als <figure> gerendert. Sie
bleiben textfrei (i18n-neutral) — die Legende liefert die figcaption aus
labels/de.json (Abschnitt lehrgrafiken). Konventionen der Beat-Raster:
oberste Zeile Hi-Hat (x-Kreuze), Mitte Snare (Hohlkreise), unten Kick
(gefüllte Kreise); Viertel als hohe, Achtel als kurze Rasterstriche."""
import math
import os
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "_svg_lehre")
os.makedirs(OUT, exist_ok=True)

def make(elements, breite=240, hoehe=120):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {breite} {hoehe}" fill="none" '
            f'stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" '
            f'aria-hidden="true">{"".join(elements)}</svg>')

def L(x1, y1, x2, y2, w=2):
    return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke-width="{w}"/>'

def C(cx, cy, r, w=2, fill=False):
    if fill:
        return f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="currentColor" stroke="none"/>'
    return f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" stroke-width="{w}"/>'

def X(cx, cy, r=4, w=2):
    return (f'<line x1="{cx - r:.1f}" y1="{cy - r:.1f}" x2="{cx + r:.1f}" y2="{cy + r:.1f}" stroke-width="{w}"/>'
            f'<line x1="{cx - r:.1f}" y1="{cy + r:.1f}" x2="{cx + r:.1f}" y2="{cy - r:.1f}" stroke-width="{w}"/>')

def TRI(pts):
    p = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    return f'<polygon points="{p}" fill="currentColor" stroke="none"/>'

def P(d, w=2):
    return f'<path d="{d}" stroke-width="{w}"/>'

def ARC(cx, cy, r, a0, a1, w=2):
    x0 = cx + r * math.cos(math.radians(a0)); y0 = cy - r * math.sin(math.radians(a0))
    x1 = cx + r * math.cos(math.radians(a1)); y1 = cy - r * math.sin(math.radians(a1))
    large = 1 if abs(a1 - a0) > 180 else 0
    sweep = 0 if a1 > a0 else 1
    return f'<path d="M{x0:.1f},{y0:.1f} A{r:.1f},{r:.1f} 0 {large} {sweep} {x1:.1f},{y1:.1f}" stroke-width="{w}"/>'

def RECT(x, y, w_, h, filled=True, rx=2):
    if filled:
        return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w_:.1f}" height="{h:.1f}" rx="{rx}" fill="currentColor" stroke="none"/>'
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w_:.1f}" height="{h:.1f}" rx="{rx}" stroke-width="2"/>'

# ---------- Beat-Raster (Achtel über einen 4/4-Takt) ----------
X0, X1 = 30, 232
def spalte(i, n=8):
    return X0 + (X1 - X0) * (i + 0.5) / n

def raster(n=8):
    teile = [L(X0, 108, X1, 108, 1.5)]
    for i in range(n + 1):
        x = X0 + (X1 - X0) * i / n
        hoch = 10 if i % 2 == 0 else 5
        teile.append(L(x, 108, x, 108 - hoch, 1.5 if i % 2 == 0 else 1))
    return teile

BEAT_SPALTEN = {}   # id -> (n, snare, kick) — für den Abgleich mit dem Hörbeispiel unten

def beat_schema(hh, sn, bd, hh_stil="x", n=8):
    """hh/sn/bd: Liste von Spaltenindizes (0-basiert, Achtel)."""
    teile = raster(n)
    # Zeilen-Anker links: Legende ohne Text — x, Hohlkreis, Punkt.
    teile += [X(14, 30, 4), C(14, 60, 5, 2), C(14, 90, 5, fill=True)]
    for i in hh:
        teile.append(X(spalte(i, n), 30, 4) if hh_stil == "x" else C(spalte(i, n), 30, 4, 2))
    for i in sn:
        teile.append(C(spalte(i, n), 60, 6, 2.5))
    for i in bd:
        teile.append(C(spalte(i, n), 90, 6, fill=True))
    return teile

S = {}

def beat(bid, hh, sn, bd, n=8):
    """Beat-Schema, das seine Snare-/Kick-Spalten für den Abgleich mit dem Hörbeispiel einträgt."""
    BEAT_SPALTEN[bid] = (n, sn, bd)
    return beat_schema(hh=hh, sn=sn, bd=bd, n=n)

# Grundbeat: Hi-Hat-Achtel, Snare auf 2 und 4, Kick auf 1 und 3.
S["grundbeat"] = beat("grundbeat", hh=list(range(8)), sn=[2, 6], bd=[0, 4])
# Die Beat-Schemata müssen zum Hörbeispiel (`demonstration`) ihres Bausteins
# passen. Bis v222 taten das drei nicht: D-Beat hatte die Kick auf 1, 3 und
# 3-und, der Blast die Hi-Hat bei der Snare, der Skank einen Rockbeat.
# D-Beat: das Galopp-Muster — Kick auf 1, dem Und von 2 und auf 3, Snare auf 2 und 4.
S["d_beat"] = beat("d_beat", hh=list(range(8)), sn=[2, 6], bd=[0, 3, 4])
# Traditional Blast: Kick und Snare wechseln sich ab, die Hi-Hat (bzw. das Ride)
# läuft mit der Kick.
S["blastbeat"] = beat_schema(hh=[0, 2, 4, 6], sn=[1, 3, 5, 7], bd=[0, 2, 4, 6])
# Skank: Kick auf den Zählzeiten, Snare auf jedem „und“, Hi-Hat in Achteln.
S["skank_beat"] = beat("skank_beat", hh=list(range(8)), sn=[1, 3, 5, 7], bd=[0, 2, 4, 6])

# ---------- Saiten- und Griff-Schemata ----------
def saiten(y0=24, y1=104, x0=56, x1=228, n=6, staerken=None):
    teile = []
    for i in range(n):
        y = y0 + (y1 - y0) * i / (n - 1)
        w = staerken[i] if staerken else 1.2 + i * 0.8
        teile.append(L(x0, y, x1, y, w))
    return teile

# Powerchord-Griffbild: sechs Saiten (dünn oben, dick unten), drei Bünde,
# Punkte auf Grundton + Quinte + Oktave, x-Kreuze an den stummen Saiten.
# Der Grundton sitzt am 1. Bund der tiefen E-Saite (x=84); Quinte (A-Saite) und
# Oktave (D-Saite) liegen ZWEI Bünde höher, also am 3. Bund (x=198) — die Quinte
# ist immer +2 Bünde, nie +1. Bundmitten: 1. Bund≈84, 2.≈141, 3.≈198.
S["powerchords"] = (
    saiten()
    + [L(56, 20, 56, 108, 5)]  # Sattel
    + [L(56 + i * 57, 22, 56 + i * 57, 106, 1.5) for i in (1, 2, 3)]
    + [C(84, 104, 7, fill=True), C(198, 88, 7, fill=True), C(198, 72, 7, fill=True)]
    + [X(40, 24, 4), X(40, 40, 4), X(40, 56, 4)]
)
# Palm Muting: Saiten laufen auf den Steg (Block rechts) zu; der Handballen
# (Bogen) liegt DIREKT am Steg — der Pfeil zeigt die Millimeter-Suche nach vorn.
S["palm_muting"] = (
    saiten(y0=34, y1=94, x0=16, x1=196, n=6)
    + [RECT(196, 24, 14, 80, filled=True, rx=3)]
    + [f'<path d="M170,110 A34,30 0 0 1 206,96" stroke-width="4"/>']
    + [L(176, 20, 148, 20, 2), TRI([(148, 20), (156, 15), (156, 25)])]
)
# Drop-Tuning: sechs Saiten, die tiefste hervorgehoben mit Abwärts-Pfeil am
# Stimmmechanik-Ende — nur EINE Saite wandert.
S["drop_tuning"] = (
    saiten(y0=24, y1=96, x0=44, x1=228, n=6)
    + [L(44, 96, 228, 96, 5.5)]
    + [C(28, 96, 8, 2.5), L(28, 88, 28, 76, 2.5), L(28, 104, 28, 116, 3.5), TRI([(28, 116), (22, 106), (34, 106)])]
)
# Tremolo-Picking: eine Saite, dichte Wechselschlag-Pfeile (ab/auf im Wechsel).
S["tremolo_picking"] = (
    [L(16, 64, 224, 64, 3)]
    + [TRI([(30 + i * 28, 34), (24 + i * 28, 48), (36 + i * 28, 48)]) if i % 2 == 0
       else TRI([(30 + i * 28, 48), (24 + i * 28, 34), (36 + i * 28, 34)])
       for i in range(8)]
    + [L(30 + i * 28, 52, 30 + i * 28, 60, 2) for i in range(8)]
)
# Chugs im Breakdown: gedämpfte Blöcke mit bewusster Stille — Raster wie bei
# den Beats, Blöcke nur dort, wo gespielt wird.
S["chugs_breakdown"] = (
    raster(8)
    + [RECT(spalte(i) - 10, 56, 20, 28, filled=True) for i in (0, 1, 3, 4, 6)]
    + [L(spalte(i) - 10, 50, spalte(i) + 10, 50, 3) for i in (0, 1, 3, 4, 6)]
)
# Bass-Plektrum: eine dicke Saite, weite Wechselschlag-Pfeile — mehr Masse,
# gleicher Wechsel.
S["plektrum_technik"] = (
    [L(16, 64, 224, 64, 6)]
    + [TRI([(44 + i * 48, 28), (34 + i * 48, 48), (54 + i * 48, 48)]) if i % 2 == 0
       else TRI([(44 + i * 48, 48), (34 + i * 48, 28), (54 + i * 48, 28)])
       for i in range(4)]
    + [L(44 + i * 48, 52, 44 + i * 48, 58, 2.5) for i in range(4)]
)
# Sludge-Riff: zwei schwere Akkord-Blöcke über dem Takt-Raster — dazwischen
# die bewusste Stille, das Abstoppen als kurzer Riegel.
S["sludge_erstes_riff"] = (
    raster(8)
    + [RECT(spalte(0) - 11, 40, 22, 48, filled=True), RECT(spalte(4) - 11, 52, 22, 36, filled=True)]
    + [L(spalte(3) - 6, 40, spalte(3) + 6, 40, 4), L(spalte(7) - 6, 40, spalte(7) + 6, 40, 4)]
)
# Stopp-Spiel: Beat läuft, harter letzter Schlag, gezählte Stille (Hohlkreise),
# entschlossener Wiedereinstieg.
S["pv_stopp_spiel"] = (
    raster(8)
    + [C(spalte(i), 64, 6, fill=True) for i in (0, 1, 2)]
    + [L(spalte(2) + 12, 40, spalte(2) + 12, 88, 3)]
    + [C(spalte(i), 64, 5, 2) for i in (4, 5)]
    + [C(spalte(6), 64, 8, fill=True)]
)

# ---------- Halbton-Lineal (Theorie: Intervalle, Skalen) ----------
RX0, RX1, RY = 24, 228, 66
def hpos(i, n=12):
    return RX0 + (RX1 - RX0) * i / n
def lineal(n=12, markante=(0, 12)):
    teile = [L(RX0, RY, RX1, RY, 2)]
    for i in range(n + 1):
        x = hpos(i, n)
        h = 13 if i in markante else 6
        teile.append(L(x, RY, x, RY - h, 2 if i in markante else 1))
    return teile
def grad(i, r=6, fill=False, n=12):
    return C(hpos(i, n), RY + 16, r, 2.5, fill=fill)
def spanne(a, b, hoehe=22):
    """Bogen über dem Lineal von Stufe a bis b — zeigt den Abstand eines Intervalls."""
    xa, xb = hpos(a), hpos(b)
    return P(f"M{xa:.1f},{RY - 16:.1f} Q{(xa + xb) / 2:.1f},{RY - 16 - 2 * hoehe:.1f} {xb:.1f},{RY - 16:.1f}", 2)

# Intervalle: Halbton-Lineal, Grundton (0) und Oktave (12) gefüllt, Quinte (7)
# als Ring, kleine Sekunde (1) als kleiner Ring dicht am Grundton.
S["intervalle_grundlagen"] = (
    lineal(markante=(0, 7, 12))
    + [grad(0, 7, fill=True), grad(12, 7, fill=True), grad(7, 6), grad(1, 4)]
    + [spanne(0, 7)]
)
# Powerchord-Theorie: Grundton + Quinte + Oktave gefüllt, die Terz (4) fehlt
# bewusst — mit x markiert.
S["powerchord_theorie"] = (
    lineal(markante=(0, 7, 12))
    + [grad(0, 7, fill=True), grad(7, 7, fill=True), grad(12, 7, fill=True)]
    + [X(hpos(4), RY + 16, 5)]
)
# Moll vs. Phrygisch: Grundton und die tiefe zweite Stufe (1) direkt daneben —
# der eine Halbton, der Phrygisch dunkel macht.
S["moll_phrygisch"] = (
    lineal(markante=(0, 1, 12))
    + [grad(0, 7, fill=True), grad(1, 6, fill=True)]
    + [L(hpos(0), RY + 30, hpos(1), RY + 30, 3)]
    + [grad(i, 4) for i in (3, 5, 7, 8, 10)]
)
# Tritonus: genau zwischen Quarte (5) und Quinte (7) — drei Ganztöne über dem
# Grundton, das instabile Intervall.
S["tritonus_dissonanz"] = (
    lineal(markante=(0, 6, 12))
    + [grad(0, 7, fill=True), grad(6, 7, fill=True)]
    + [grad(5, 4), grad(7, 4)]
    + [spanne(0, 6)]
)

# ---------- Rhythmus-Schemata ----------
# Taktarten-Unterteilungen: vier Zeilen über denselben 4/4-Takt — Viertel,
# Achtel, Sechzehntel, Triolen.
def unterteilung(y, n, gruppe=None):
    teile = [L(24, y, 228, y, 1.5)]
    for i in range(n):
        x = 24 + (228 - 24) * (i + 0.5) / n
        hoch = 12 if (gruppe and i % gruppe == 0) or (not gruppe and i == 0) else 8
        teile.append(L(x, y, x, y - hoch, 2.5 if hoch == 12 else 1.5))
    return teile
S["taktarten_unterteilungen"] = (
    unterteilung(26, 4) + unterteilung(56, 8, 2)
    + unterteilung(86, 16, 4) + unterteilung(116, 12, 3)
)
# Ungerade Takte: 7/8 als Kette 2+2+3 — Gruppenanfänge betont (gefüllt),
# Klammern zeigen die Gruppierung.
def sieben():
    teile = [L(24, 70, 228, 70, 2)]
    xs = [24 + (228 - 24) * (i + 0.5) / 7 for i in range(7)]
    for i, x in enumerate(xs):
        stark = i in (0, 2, 4)
        teile.append(C(x, 70, 6 if stark else 4, 2.5, fill=stark))
    for a, b in ((0, 1), (2, 3), (4, 6)):
        teile.append(L(xs[a] - 6, 52, xs[b] + 6, 52, 2))
        teile.append(L(xs[a] - 6, 52, xs[a] - 6, 58, 2))
        teile.append(L(xs[b] + 6, 52, xs[b] + 6, 58, 2))
    return teile
S["ungerade_takte_theorie"] = sieben()
# Polyrhythmik: 3 gegen 4 — beide teilen Anfang und Ende, treffen sich nur dort.
S["polyrhythmik_theorie"] = (
    [L(24, 44, 228, 44, 1.5)]
    + [C(24 + (228 - 24) * i / 3, 44, 6, fill=True) for i in range(4)]
    + [L(24, 92, 228, 92, 1.5)]
    + [C(24 + (228 - 24) * i / 4, 92, 6, 2.5) for i in range(5)]
    + [L(24, 40, 24, 96, 2), L(228, 40, 228, 96, 2)]
)
# Songstruktur: Energieprofil über die Zeit — Intro, Strophe, Refrain, Bridge,
# Breakdown als Blöcke wachsender/fallender Höhe.
S["songstruktur_breakdown"] = (
    [L(20, 108, 228, 108, 1.5)]
    + [RECT(24, 84, 30, 24, filled=True), RECT(60, 60, 30, 48, filled=True),
       RECT(100, 40, 30, 68, filled=True), RECT(140, 68, 30, 40, filled=True),
       RECT(184, 24, 34, 84, filled=True)]
)

# ---------- Drum-Technik ----------
# Double-Bass-Sechzehntel: durchgehende Kick auf allen 16 Sechzehnteln, Snare
# auf 2 und 4, Hi-Hat in Achteln (wie im Übungsteil: „Achtel auf der Hi-Hat“).
S["double_bass_sechzehntel"] = beat_schema(hh=list(range(0, 16, 2)), sn=[4, 12], bd=list(range(16)), n=16)
# Blastbeat-Varianten: oben Traditional (Kick/Snare im Wechsel), unten Hammer
# (Kick und Snare gleichzeitig) — dieselbe Dichte, andere Verteilung.
S["blast_varianten"] = (
    [L(24, 42, 228, 42, 1.5)]
    + [C(24 + (228 - 24) * (i + 0.5) / 8, 42, 5, fill=(i % 2 == 0)) for i in range(8)]
    + [C(24 + (228 - 24) * (i + 0.5) / 8, 42, 5, 2) for i in range(8) if i % 2 == 1]
    + [L(24, 94, 228, 94, 1.5)]
    + [C(24 + (228 - 24) * (i + 0.5) / 4, 88, 5, 2) for i in range(4)]
    + [C(24 + (228 - 24) * (i + 0.5) / 4, 100, 5, fill=True) for i in range(4)]
)

# ---------- Drum-Gear-Schemata ----------
# Felle: Trommel im Querschnitt — dickes Schlagfell oben, dünnes Resonanzfell
# unten, der Kessel dazwischen.
S["felle_grundlagen"] = [
    L(60, 38, 180, 38, 6),            # Schlagfell
    L(60, 86, 180, 86, 1.5),          # Resonanzfell
    L(60, 38, 60, 86, 4), L(180, 38, 180, 86, 4),   # Kessel
    L(132, 10, 112, 28, 3), C(110, 30, 3.5, fill=True),  # Stockspitze aufs Schlagfell
    ARC(120, 86, 14, 200, 340, 1.5), ARC(120, 86, 24, 205, 335, 1.5),  # Ausklang
]
# Stimmen: Trommel von oben, Stimmschrauben im Kreis — die Pfeile zeigen das
# Spannen über Kreuz.
def _schraube(k, r=46):
    a = math.radians(90 - 45 * k)
    return 120 + r * math.cos(a), 60 - r * math.sin(a)
_STERN = [0, 4, 2, 6, 1, 5, 3, 7]
S["drum_stimmen_basis"] = (
    [C(120, 60, 46, 2.5)]
    + [C(*_schraube(k), 4, fill=True) for k in range(8)]
    + [C(*_schraube(0), 7.5, 2)]
    + [P("M" + " L".join(f"{_schraube(k, 40)[0]:.1f},{_schraube(k, 40)[1]:.1f}" for k in _STERN), 1.4)]
)
# Beckentypen: Hi-Hat-Paar, Crash, Ride, China (umgedreht) — je Größe und
# Form unterscheidbar auf der Ständer-Linie.
S["becken_typen"] = [
    L(20, 100, 228, 100, 1.5),
    ARC(50, 54, 20, 200, 340, 2.5), ARC(50, 60, 20, 200, 340, 1.8), L(50, 60, 50, 100, 2),
    ARC(104, 50, 16, 200, 340, 2.5), L(104, 56, 104, 100, 2),
    ARC(156, 46, 26, 200, 340, 3), L(156, 54, 156, 100, 2),
    ARC(204, 60, 18, 20, 160, 2.5), L(204, 56, 204, 100, 2),
]
# Fußmaschine: Trittbrett, Feder (Zickzack) und Schlägel am Drehpunkt — der
# Pfeil zeigt den Schlag gegen das Fell.
S["fussmaschinen"] = [
    L(24, 106, 214, 106, 1.5),                       # Boden
    C(40, 100, 4, fill=True), L(40, 100, 140, 74, 6),  # Fersenlager + Trittbrett
    L(140, 74, 148, 52, 2), C(150, 46, 6, fill=True),  # Kette + Achse
    L(150, 46, 168, 14, 3.5), C(170, 10, 8, fill=True),  # Schlägel in Ruhe
    P("M178,14 Q196,24 198,44", 2), TRI([(198, 50), (192, 40), (204, 41)]),  # Weg zum Fell
    L(212, 8, 212, 106, 5),                          # Schlagfell der Bassdrum
    P("M150,52 L144,62 L156,70 L144,78 L156,86 L144,94 L150,104", 2),  # Feder
]

# ======================================================================
# Ergänzung v223: Lehrgrafiken für Kerntechniken, die bis dahin keine hatten.
# Muster und Tonfolgen folgen dem Hörbeispiel (`demonstration`) des Bausteins.
# ======================================================================
def wavepath(x0, x1, cy, amp, cycles, step=2.5, phase=0.0, env=None):
    """Sinuszug wie in Tranche 1 — env(t) skaliert die Amplitude über den Weg."""
    n = max(2, int((x1 - x0) / step)); pts = []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        a = amp * (env(i / n) if env else 1.0)
        pts.append(f"{x:.1f},{cy - a * math.sin(2 * math.pi * cycles * i / n + phase):.1f}")
    return "M" + " L".join(pts)

def PD(d, w=2, strich="3 4"):
    """Gestrichelter Pfad — für Wege, auf denen nichts klingt (Rückweg, Führungslinie)."""
    return f'<path d="{d}" stroke-width="{w}" stroke-dasharray="{strich}"/>'

def ab(x, y, s=6):
    """Abschlag: Dreieck mit der Spitze nach unten."""
    return TRI([(x - s, y - s), (x + s, y - s), (x, y + s * 0.8)])

def auf(x, y, s=6):
    """Aufschlag: Dreieck mit der Spitze nach oben."""
    return TRI([(x - s, y + s * 0.8), (x + s, y + s * 0.8), (x, y - s)])

def zelle(n):
    return (X1 - X0) / n

# Galopp: auf jeder Zählzeit ein langer Ton und zwei kurze (Sechzehntel-Raster) —
# Anschlag ab, ab, auf.
def _galopp_lehre():
    teile = raster(16)
    for b in range(4):
        x0 = X0 + zelle(16) * 4 * b
        z = zelle(16)
        teile += [RECT(x0 + 2, 68, 2 * z - 6, 12), RECT(x0 + 2 * z + 2, 68, z - 5, 12),
                  RECT(x0 + 3 * z + 2, 68, z - 5, 12)]
        teile += [ab(spalte(4 * b, 16), 44), ab(spalte(4 * b + 2, 16), 44), auf(spalte(4 * b + 3, 16), 44)]
    return teile
S["galopp_rhythmus"] = _galopp_lehre()

# Downpicking: jede Achtel ein Abschlag; der Rückweg der Hand (gestrichelt)
# läuft über der Saite, ohne zu klingen.
S["downpicking"] = (
    raster(8)
    + [RECT(spalte(i) - 8, 70, 16, 12) for i in range(8)]
    + [ab(spalte(i), 44) for i in range(8)]
    + [PD(f"M{spalte(i) + 4:.1f},34 Q{spalte(i) + zelle(8) / 2:.1f},18 {spalte(i + 1) - 4:.1f},34", 1.5) for i in range(7)]
)

# Wechselschlag: Sechzehntel auf einer Saite, ab auf den geraden, auf den ungeraden
# Positionen — der Abschlag fällt immer auf die Achtel.
S["wechselschlag"] = (
    raster(16)
    + [L(X0, 76, X1, 76, 2.5)]
    + [C(spalte(i, 16), 76, 3.5, fill=True) for i in range(16)]
    + [ab(spalte(i, 16), 50, 5) if i % 2 == 0 else auf(spalte(i, 16), 50, 5) for i in range(16)]
)

# String Skipping: Wechsel zwischen tiefer E- (unten) und D-Saite, die A-Saite
# dazwischen bleibt stumm (gestrichelt, x am Sattel); die Bögen zeigen den Sprung.
def _skipping():
    ys = [24 + 16 * i for i in range(6)]          # Saite 1 oben … Saite 6 unten
    teile = [L(56, ys[i], 228, ys[i], 1.2 + i * 0.8) for i in (0, 1, 2, 3, 5)]
    teile += [PD(f"M56,{ys[4]} L228,{ys[4]}", 3.6, "5 5"), X(40, ys[4], 4)]
    xs = [68 + 22 * i for i in range(8)]
    for i, x in enumerate(xs):
        teile.append(C(x, ys[5] if i % 2 == 0 else ys[3], 5.5, fill=True))
        if i < 7:
            y_a = ys[5] if i % 2 == 0 else ys[3]
            y_b = ys[3] if i % 2 == 0 else ys[5]
            teile.append(P(f"M{x + 5:.1f},{y_a - 6} Q{x + 11:.1f},{min(y_a, y_b) - 8} {xs[i + 1] - 5:.1f},{y_b - 6}", 1.2))
    return teile
S["string_skipping"] = _skipping()

# Legato: nur der erste Ton wird angeschlagen; danach Hammer-ons (Bögen
# aufwärts, durchgezogen) und Pull-offs (abwärts, gestrichelt). Höhe = Bund 5/7/9.
def _legato():
    hoehe = {5: 88, 7: 66, 9: 44}
    folge = [5, 7, 9, 7, 5, 7, 9, 7]
    xs = [40 + 26 * i for i in range(8)]
    teile = [L(30, 104, 228, 104, 1.5)] + [L(x, 104, x, 98, 1) for x in xs]
    teile.append(ab(xs[0], hoehe[5] - 20, 5))
    for i, (x, b) in enumerate(zip(xs, folge)):
        teile.append(C(x, hoehe[b], 6, fill=True))
        if i < 7:
            n = folge[i + 1]; x2 = xs[i + 1]
            d = f"M{x + 6:.1f},{hoehe[b] - 4} Q{(x + x2) / 2:.1f},{min(hoehe[b], hoehe[n]) - 18} {x2 - 6:.1f},{hoehe[n] - 4}"
            teile.append(P(d, 2) if n > b else PD(d, 2))
    return teile
S["legato"] = _legato()

# Slide und Bend (Tonhöhe über der Zeit): links gleitet der Ton ohne Absetzen
# zum Zielbund, rechts wird die Saite auf den Zielton gezogen — die gestrichelte
# Linie ist der Zielton, den du vorher hörst.
S["slides_bends"] = [
    L(120, 14, 120, 108, 1),
    C(30, 86, 6, fill=True), L(36, 86, 60, 86, 3), L(60, 86, 92, 50, 3), C(98, 50, 6, fill=True),
    C(142, 86, 6, fill=True), L(148, 86, 168, 86, 3),
    P("M168,86 Q190,86 198,52", 3), TRI([(198, 44), (192, 56), (205, 55)]),
    PD("M150,46 L230,46", 1.5), C(222, 46, 5, 2),
]

# Vibrato (Tonhöhe über der Zeit): der Ton steht, dann schwingt er gleichmäßig
# über seine Höhe und zurück — oben eng und schnell, unten weit und langsam.
def _vib(y0, amp, zyklen, x0=30, xa=84, x1=228):
    pts = [f"{x0},{y0}", f"{xa},{y0}"]
    n = 160
    for i in range(1, n + 1):
        x = xa + (x1 - xa) * i / n
        y = y0 - amp * (1 - math.cos(2 * math.pi * zyklen * i / n)) / 2
        pts.append(f"{x:.1f},{y:.1f}")
    return [PD(f"M{x0},{y0} L{x1},{y0}", 1, "2 4"), P("M" + " L".join(pts), 2.5), C(x0, y0, 4, fill=True)]
S["vibrato"] = _vib(48, 10, 8) + _vib(104, 26, 2.5)

# Pinch Harmonic: der Daumen berührt die Saite direkt nach dem Plektrum genau an
# einem Knoten des Obertons — die Saite schwingt dann in Abschnitten (Bögen).
def _pinch():
    y = 70; x0, x1 = 16, 226; n = 6
    teile = [L(x0, y, x1, y, 2.5)]
    breite = (x1 - x0) / n
    for k in range(n):
        a = x0 + k * breite; b = a + breite
        teile.append(P(f"M{a:.1f},{y} Q{(a + b) / 2:.1f},{y - 30} {b:.1f},{y}", 1.4))
        teile.append(P(f"M{a:.1f},{y} Q{(a + b) / 2:.1f},{y + 30} {b:.1f},{y}", 1.4))
    knoten = x0 + 4 * breite
    teile += [TRI([(knoten - 16, y - 36), (knoten - 4, y - 36), (knoten - 10, y - 6)]),
              ARC(knoten + 6, y - 14, 12, 200, 340, 3.5), C(knoten, y, 3.5, fill=True)]
    return teile
S["pinch_harmonics"] = _pinch()

# Sweep-Picking: ein Ton pro Saite (D-, G-, H-Saite), das Plektrum fährt in
# EINER Bewegung durch — hin (links) und zurück (rechts).
def _sweep():
    ys = [24 + 16 * i for i in range(6)]
    teile = saiten(y0=24, y1=104, x0=16, x1=228)
    links = [(64, ys[3]), (94, ys[2]), (124, ys[1])]
    rechts = [(152, ys[1]), (182, ys[2]), (212, ys[3])]
    for x, yy in links + rechts:
        teile.append(C(x, yy, 6, fill=True))
    # Die Pfeile laufen genau durch die Töne (Steigung 32/60) — ein Zug, ein Ton je Saite.
    teile += [P("M46,81.6 L130,36.8", 2.5), TRI([(138, 32.5), (127.5, 33), (132.6, 42.5)])]
    teile += [P("M146,36.8 L220,76.3", 2.5), TRI([(228, 80.6), (217.4, 81.4), (222.6, 71.9)])]
    return teile
S["sweep_picking_einstieg"] = _sweep()

# Pedalboard-Reihenfolge: Instrument → Stimmgerät → Kompressor/Wah → Verzerrung
# → Noise Gate → Verstärker; Delay und Reverb hängen im Effektweg (unten).
def _box(x, y, inhalt, b=26, h=26):
    return [RECT(x, y, b, h, filled=False, rx=3)] + inhalt
def _pfeil_r(x, y):
    return TRI([(x, y), (x - 6, y - 4), (x - 6, y + 4)])
def _kette():
    y = 44
    t = [C(10, y, 4, fill=True), L(14, y, 24, y, 2), _pfeil_r(26, y)]
    # Stimmgerät: Zeiger auf der Skala
    t += _box(26, 31, [ARC(39, 54, 10, 30, 150, 1.5), L(39, 54, 44, 40, 2)])
    t += [L(52, y, 60, y, 2), _pfeil_r(62, y)]
    # Kompressor: große Welle wird schmal
    t += _box(62, 31, [P(wavepath(65, 85, y, 9, 3, step=0.8, env=lambda s: 1 - 0.7 * s), 1.5)])
    t += [L(88, y, 96, y, 2), _pfeil_r(98, y)]
    # Verzerrung: abgeflachte Welle
    t += _box(98, 31, [P("M101,48 L104,38 L109,38 L112,50 L117,50 L120,38 L122,38", 1.6)])
    t += [L(124, y, 132, y, 2), _pfeil_r(134, y)]
    # Noise Gate: Wellenstücke mit Lücken
    t += _box(134, 31, [P(wavepath(137, 144, y, 6, 1.5, step=0.7), 1.5), P(wavepath(152, 157, y, 6, 1, step=0.7), 1.5)])
    t += [L(160, y, 168, y, 2), _pfeil_r(170, y)]
    # Verstärker: großer Kasten mit Reglern und Gitter
    t += [RECT(170, 24, 58, 40, filled=False, rx=3)] + [C(178 + 8 * i, 31, 2, fill=True) for i in range(6)]
    t += [L(176, 40 + 6 * i, 222, 40 + 6 * i, 1.2) for i in range(4)]
    # Effektweg: Send runter zum Delay, weiter zum Reverb, Return zurück
    t += [L(184, 64, 184, 80, 2), TRI([(184, 82), (180, 76), (188, 76)])]
    t += _box(170, 82, [C(176 + 6 * i, 95, 3 - 0.6 * i, fill=True) for i in range(4)])
    t += [L(196, 95, 202, 95, 2), _pfeil_r(204, 95)]
    t += _box(204, 82, [ARC(210, 95, 5 + 5 * i, -40, 40, 1.4) for i in range(3)])
    t += [L(217, 82, 217, 66, 2), TRI([(217, 64), (213, 70), (221, 70)])]
    return t
S["pedalboard_grundlagen"] = _kette()

# Metronom: oben sitzen die Töne genau auf den Klicks (hohe Striche), unten
# rutschen sie davor und danach — die Pfeile zeigen die Abweichung.
def _metronom():
    t = []
    xs = [40 + 52 * i for i in range(4)]
    for x in xs:
        t.append(L(x, 12, x, 108, 1.2))
        t.append(L(x, 100, x, 112, 3))
    t += [C(x, 36, 7, fill=True) for x in xs]
    versatz = [-9, 6, -12, 10]
    for x, v in zip(xs, versatz):
        t.append(C(x + v, 78, 7, 2.5))
        t.append(L(x, 64, x + v, 64, 1.5))
    return t
S["metronom_prinzip"] = _metronom()

# Ghost Notes am Schlagzeug: Snare laut auf 2 und 4 (große Ringe), dazwischen
# leise Ghost Notes (kleine Ringe); Hi-Hat in Achteln, Kick darunter.
def _ghost():
    n = 16
    t = raster(n) + [X(14, 30, 4), C(14, 60, 5, 2), C(14, 90, 5, fill=True)]
    t += [X(spalte(i, n), 30, 4) for i in range(0, 16, 2)]
    for i in (2, 4, 8, 10, 12, 14):
        t.append(C(spalte(i, n), 60, 7, 3) if i in (4, 12) else C(spalte(i, n), 60, 3, 1.5))
    t += [C(spalte(i, n), 90, 6, fill=True) for i in (0, 6, 8)]
    return t
S["drums_ghostnotes"] = _ghost()

# Half-Time: dasselbe Tempo, dieselben Achtel — oben normal (Snare auf 2 und 4),
# unten Half-Time (Snare nur auf der 3, China auf den schweren Schlägen).
def _halftime():
    sn, bd = [4], [0, 5]
    BEAT_SPALTEN["halftime_china"] = (8, sn, bd)
    t = raster(8)
    t += [C(spalte(i), 30, 6, 2.5) for i in (2, 6)] + [C(spalte(i), 30, 6, fill=True) for i in (0, 4)]
    t += [L(X0, 52, X1, 52, 1)]
    t += [C(spalte(i), 80, 6, 2.5) for i in sn] + [C(spalte(i), 80, 6, fill=True) for i in bd]
    for i in (0, 4):
        x = spalte(i)
        t += [X(x, 64, 5, 2.5), L(x - 7, 64, x + 7, 64, 2.5)]
    return t
S["halftime_china"] = _halftime()

# Triolen gegen Sechzehntel: oben vier, unten drei Schläge pro Zählzeit — beide
# landen auf der nächsten Eins (großer Punkt rechts).
def _triolen():
    t = []
    xs = [30 + 46 * i for i in range(5)]
    for x in xs:
        t.append(L(x, 50, x, 70, 2.5))
    t.append(L(30, 60, 214, 60, 1))
    for b in range(4):
        for k in range(4):
            t.append(C(xs[b] + 46 * k / 4, 34, 3.5, fill=True))
        for k in range(3):
            t.append(C(xs[b] + 46 * k / 3, 92, 3.5, fill=True))
        t += [L(xs[b] - 2, 106, xs[b] + 46 * 2 / 3 + 2, 106, 1.5),
              L(xs[b] - 2, 106, xs[b] - 2, 101, 1.5), L(xs[b] + 46 * 2 / 3 + 2, 106, xs[b] + 46 * 2 / 3 + 2, 101, 1.5)]
    t += [C(214, 34, 6, fill=True), C(214, 92, 6, fill=True)]
    return t
S["triolen_fills"] = _triolen()

# Rudiments: oben Einzelschläge (rechts über, links unter der Linie im Wechsel),
# unten Doppelschläge (je zwei pro Hand) — dieselbe Zahl Schläge.
def _rudiment(y, folge):
    t = [L(24, y, 228, y, 1.5)]
    for i, h in enumerate(folge):
        x = 34 + 24.5 * i
        dy = -14 if h == "R" else 14
        t += [L(x, y, x, y + dy, 2.5), C(x, y + dy, 4, fill=True)]
    return t
S["rudiments_grundlage"] = _rudiment(36, "RLRLRLRL") + _rudiment(88, "RRLLRRLL")

# Ghost Notes am Bass: klingende Töne (Punkte) im Wechsel mit tonlosen,
# gedämpften Anschlägen (x) auf derselben Saite.
S["bass_ghostnotes"] = (
    raster(8)
    + [L(X0, 64, X1, 64, 5)]
    + [C(spalte(i), 64, 7, fill=True) if i % 2 == 0 else X(spalte(i), 64, 6, 3) for i in range(8)]
)

# Mikrofonabstand: oben die leise Passage nah am Mikro, unten die laute weiter
# weg — der Pegel (Balken rechts) bleibt gleich.
def _mikro(y, laut, abstand):
    amp = 14 if laut else 5
    t = [P(wavepath(16, 64, y, amp, 3, step=1.2), 2)]
    mx = 76 + abstand
    t += [C(mx, y, 9, 2.5), L(mx + 9, y, mx + 30, y, 4)]
    if abstand:
        t += [PD(f"M68,{y + 20} L{mx - 10},{y + 20}", 1.2, "2 3")]
    t += [RECT(208, y - 12, 10, 24), RECT(222, y - 12, 10, 24, filled=False)]
    return t
S["mikrofontechnik"] = _mikro(32, False, 0) + _mikro(86, True, 70)

# Abgleich mit dem Hörbeispiel: Snare und Kick eines Beat-Schemas müssen dort
# liegen, wo die `demonstration` des gleichnamigen Bausteins sie spielt. Bis v222
# zeigten drei Schemata (D-Beat, Blast, Skank) ein anderes Muster als ihr Klang —
# niemandem fiel es auf, weil Bild und Ton auf derselben Seite nie verglichen wurden.
def _pruefe_beats():
    import glob, json
    demos = {}
    for pfad in glob.glob(os.path.join(HERE, "..", "data", "bausteine.*.json")):
        for b in json.load(open(pfad, encoding="utf-8")).get("bausteine", []):
            d = b.get("demonstration") or {}
            if d.get("typ") == "pattern":
                demos[b["id"]] = d
    for bid, (n, sn, bd) in BEAT_SPALTEN.items():
        d = demos.get(bid)
        assert d, f"{bid}: kein Pattern-Hörbeispiel zum Abgleichen"
        assert d["aufloesung"] == n, f"{bid}: Raster {n}, Hörbeispiel {d['aufloesung']}"
        spur = {s["instrument"]: s["schritte"][:n] for s in d["spuren"]}
        ist_sn = [i for i, v in enumerate(spur.get("snare", [])) if v]
        ist_bd = [i for i, v in enumerate(spur.get("kick", [])) if v]
        assert ist_sn == sn and ist_bd == bd, (
            f"{bid}: Zeichnung Snare {sn} Kick {bd}, Hörbeispiel Snare {ist_sn} Kick {ist_bd}")
_pruefe_beats()

ALLE = ["grundbeat", "d_beat", "blastbeat", "skank_beat", "powerchords", "palm_muting",
        "drop_tuning", "tremolo_picking", "chugs_breakdown", "plektrum_technik",
        "sludge_erstes_riff", "pv_stopp_spiel",
        "intervalle_grundlagen", "powerchord_theorie", "moll_phrygisch", "tritonus_dissonanz",
        "taktarten_unterteilungen", "ungerade_takte_theorie", "polyrhythmik_theorie",
        "songstruktur_breakdown", "double_bass_sechzehntel", "blast_varianten",
        "felle_grundlagen", "drum_stimmen_basis", "becken_typen", "fussmaschinen",
        "galopp_rhythmus", "downpicking", "wechselschlag", "string_skipping", "legato",
        "slides_bends", "vibrato", "pinch_harmonics", "sweep_picking_einstieg",
        "pedalboard_grundlagen", "metronom_prinzip", "drums_ghostnotes", "halftime_china",
        "triolen_fills", "rudiments_grundlage", "bass_ghostnotes", "mikrofontechnik"]
assert sorted(ALLE) == sorted(S), sorted(set(ALLE) ^ set(S))

for bid in ALLE:
    svg = make(S[bid])
    ET.fromstring(svg)
    with open(os.path.join(OUT, f"{bid}.svg"), "w", encoding="utf-8") as f:
        f.write(svg)
print(f"{len(ALLE)} Lehrgrafiken (Tranche 4) erzeugt, alle XML-wohlgeformt.")
