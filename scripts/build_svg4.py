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

ALLE = ["grundbeat", "d_beat", "blastbeat", "skank_beat", "powerchords", "palm_muting",
        "drop_tuning", "tremolo_picking", "chugs_breakdown", "plektrum_technik",
        "sludge_erstes_riff", "pv_stopp_spiel"]
assert sorted(ALLE) == sorted(S), sorted(set(ALLE) ^ set(S))

for bid in ALLE:
    svg = make(S[bid])
    ET.fromstring(svg)
    with open(os.path.join(OUT, f"{bid}.svg"), "w", encoding="utf-8") as f:
        f.write(svg)
print(f"{len(ALLE)} Lehrgrafiken (Tranche 4) erzeugt, alle XML-wohlgeformt.")
