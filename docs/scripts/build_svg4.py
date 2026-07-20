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

# Grundbeat: Hi-Hat-Achtel, Snare auf 2 und 4, Kick auf 1 und 3.
S["grundbeat"] = beat_schema(hh=list(range(8)), sn=[2, 6], bd=[0, 4])
# D-Beat: das Galopp-Muster — Kick auf 1, 3 und 3-und, Snare auf 2 und 4.
S["d_beat"] = beat_schema(hh=list(range(8)), sn=[2, 6], bd=[0, 4, 5])
# Traditional Blast: Kick und Snare wechseln sich auf jedem Achtel ab.
S["blastbeat"] = beat_schema(hh=[1, 3, 5, 7], sn=[1, 3, 5, 7], bd=[0, 2, 4, 6])
# Skank: Punk-Beat — Kick 1 und 3, Snare 2 und 4, Hi-Hat auf den Vierteln.
S["skank_beat"] = beat_schema(hh=[0, 2, 4, 6], sn=[2, 6], bd=[0, 4])

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
S["powerchords"] = (
    saiten()
    + [L(56, 20, 56, 108, 5)]  # Sattel
    + [L(56 + i * 57, 22, 56 + i * 57, 106, 1.5) for i in (1, 2, 3)]
    + [C(84, 104, 7, fill=True), C(141, 88, 7, fill=True), C(141, 72, 7, fill=True)]
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

# Intervalle: Halbton-Lineal, Grundton (0) und Oktave (12) gefüllt, Quinte (7)
# als Ring, kleine Sekunde (1) als kleiner Ring dicht am Grundton.
S["intervalle_grundlagen"] = (
    lineal(markante=(0, 7, 12))
    + [grad(0, 7, fill=True), grad(12, 7, fill=True), grad(7, 6), grad(1, 4)]
    + [ARC(hpos(3.5), RY - 6, hpos(7) - hpos(0), 200, 340, 1.5)]
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
    + [ARC(hpos(3), RY - 6, hpos(6) - hpos(0), 200, 340, 1.5)]
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
# auf 2 und 4, Hi-Hat auf den Vierteln.
S["double_bass_sechzehntel"] = beat_schema(hh=[0, 4, 8, 12], sn=[4, 12], bd=list(range(16)), n=16)
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
    L(60, 34, 180, 34, 6),
    L(60, 90, 180, 90, 2.5),
    L(60, 34, 60, 90, 2),
    L(180, 34, 180, 90, 2),
    ARC(120, 62, 30, 210, 330, 1.2),
]
# Stimmen: Trommel von oben, Stimmschrauben im Kreis — die Pfeile zeigen das
# Spannen über Kreuz.
S["drum_stimmen_basis"] = (
    [C(120, 62, 40, 2.5)]
    + [C(120 + 40 * math.cos(math.radians(a)), 62 - 40 * math.sin(math.radians(a)), 4, fill=True)
       for a in range(0, 360, 45)]
    + [L(96, 38, 144, 86, 1.5), L(144, 38, 96, 86, 1.5)]
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
    L(40, 96, 120, 84, 6),
    C(120, 84, 5, fill=True),
    P("M120,84 L150,40", 4),
    C(154, 34, 8, fill=True),
    P("M164,96 L172,80 L164,66 L172,52 L164,40", 2.5),
    L(178, 40, 200, 40, 5),
    TRI([(154, 34), (170, 30), (166, 40)]),
]

ALLE = ["grundbeat", "d_beat", "blastbeat", "skank_beat", "powerchords", "palm_muting",
        "drop_tuning", "tremolo_picking", "chugs_breakdown", "plektrum_technik",
        "sludge_erstes_riff", "pv_stopp_spiel",
        "intervalle_grundlagen", "powerchord_theorie", "moll_phrygisch", "tritonus_dissonanz",
        "taktarten_unterteilungen", "ungerade_takte_theorie", "polyrhythmik_theorie",
        "songstruktur_breakdown", "double_bass_sechzehntel", "blast_varianten",
        "felle_grundlagen", "drum_stimmen_basis", "becken_typen", "fussmaschinen"]
assert sorted(ALLE) == sorted(S), sorted(set(ALLE) ^ set(S))

for bid in ALLE:
    svg = make(S[bid])
    ET.fromstring(svg)
    with open(os.path.join(OUT, f"{bid}.svg"), "w", encoding="utf-8") as f:
        f.write(svg)
print(f"{len(ALLE)} Lehrgrafiken (Tranche 4) erzeugt, alle XML-wohlgeformt.")
