# -*- coding: utf-8 -*-
"""Tranche 3: Doom-Vertiefung (8 Motive) + Fehlerbild-Grafiken für den Trainer-Layer.
Nicht direkt aufrufen — scripts/build_grafiken.py buendelt.

Fehlerbild-Grafiken sind KOMPONIERT, nicht gezeichnet: das Motiv des Basisbausteins
(aus _svg_out, Tranche 1/2 laufen vorher) wird abgeblendet und von einem
deterministisch gezackten Riss durchschlagen — Fehlerbild = gestörter Baustein.
Der Riss-Jitter ist per crc32(fehlerbild_id) geseedet und damit reproduzierbar."""
import json, math, os, random, re, zlib
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, "_svg_out")
os.makedirs(OUT, exist_ok=True)

# ---------- Primitive (identisch zu Tranche 1/2) ----------
def L(x1, y1, x2, y2, w=3):
    return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke-width="{w}"/>'

def P(d, w=3):
    return f'<path d="{d}" stroke-width="{w}"/>'

def C(cx, cy, r, w=3, fill=False):
    if fill:
        return f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="currentColor" stroke="none"/>'
    return f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" stroke-width="{w}"/>'

def RECT(x, y, w_, h, filled=True):
    if filled:
        return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w_:.1f}" height="{h:.1f}" rx="2.5" fill="currentColor" stroke="none"/>'
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w_:.1f}" height="{h:.1f}" rx="2.5" stroke-width="3"/>'

def ARC(cx, cy, r, a0, a1, w=3):
    x0 = cx + r * math.cos(math.radians(a0)); y0 = cy - r * math.sin(math.radians(a0))
    x1 = cx + r * math.cos(math.radians(a1)); y1 = cy - r * math.sin(math.radians(a1))
    large = 1 if abs(a1 - a0) > 180 else 0
    sweep = 0 if a1 > a0 else 1
    return f'<path d="M{x0:.1f},{y0:.1f} A{r:.1f},{r:.1f} 0 {large} {sweep} {x1:.1f},{y1:.1f}" stroke-width="{w}"/>'

def wavepath(x0, x1, cy, amp, cycles, step=2.5, phase=0.0, env=None):
    n = max(2, int((x1 - x0) / step)); pts = []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        t = i / n
        a = amp * (env(t) if env else 1.0)
        y = cy - a * math.sin(2 * math.pi * cycles * t + phase)
        pts.append(f"{x:.1f},{y:.1f}")
    return "M" + " L".join(pts)

def roughpath(x0, x1, cy, amp, step=4.0, seed=1, env=None):
    rnd = random.Random(seed)
    n = max(2, int((x1 - x0) / step)); pts = []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        t = i / n
        a = amp * (env(t) if env else 1.0)
        pts.append(f"{x:.1f},{cy + rnd.uniform(-a, a):.1f}")
    return "M" + " L".join(pts)

def roughline(x0, y0, x1, y1, amp, step=5.0, seed=1):
    rnd = random.Random(seed)
    n = max(2, int(math.hypot(x1 - x0, y1 - y0) / step)); pts = []
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + rnd.uniform(-amp, amp)
        pts.append(f"{x:.1f},{y:.1f}")
    return "M" + " L".join(pts)

def make(elements):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" '
            f'stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" '
            f'aria-hidden="true">{"".join(elements)}</svg>')

S = {}

# ================= DOOM-VERTIEFUNG (stil-doom, fortgeschritten) =================
# Formvokabular: Strichstärke = Gewicht, Wellen = klingend, Rauigkeit = Verzerrung,
# Ticks = Zeit, Bögen = Resonanz/Atem, Grid-Dichte = Metrik. Doom heißt: schwer,
# wenig Ereignisse, viel Raum.

# Sustain & Feedback: ein schwerer Ton klingt aus (fallende Hüllkurve) und kippt
# rechts in einen anschwellenden Oberton-Bogen.
S["doom_sustain_feedback"] = [
    P(wavepath(14, 78, 66, 12, 2.2, step=2.0, env=lambda t: 1.0 - 0.55 * t), 4.5),
    ARC(88, 52, 16, 200, 340, 3),
    ARC(88, 52, 24, 210, 330, 2),
]
# Fuzz & Fundament: raue, sägende Linie (Verzerrung) über einem ruhigen, sehr
# schweren Fundamentstrich.
S["doom_bass_fuzz"] = [
    P(roughpath(14, 106, 48, 9, step=3.0, seed=71), 3),
    L(14, 84, 106, 84, 7),
]
# Zeit dehnen: drei schwere Ticks mit weiten Leerräumen auf einer Zeitlinie,
# dazwischen ein Hohlkreis — der Raum ist das Ereignis.
S["doom_drums_zeitdehnung"] = [
    L(12, 78, 108, 78, 2.5),
    L(20, 78, 20, 46, 6),
    L(64, 78, 64, 46, 6),
    L(108, 78, 108, 46, 6),
    C(42, 62, 6, 2.5),
    C(86, 62, 6, 2.5),
]
# Getragen & schwer: eine einzige weite, langsame Stimm-Welle unter einem
# großen Atembogen.
S["doom_vocals_getragen"] = [
    ARC(60, 58, 40, 25, 155, 2.5),
    P(wavepath(16, 104, 72, 14, 1.25, step=2.0), 4.5),
]
# Doom-Harmonik: zwei schwere Liegetöne im Reibungsabstand, dazwischen die
# gezackte Reibung, die den Raum füllt.
S["doom_harmonik"] = [
    L(16, 40, 104, 40, 5),
    L(16, 84, 104, 84, 5),
    P(roughpath(34, 86, 62, 8, step=3.5, seed=13), 2.2),
]
# Dramaturgie: ein einziger langer, flacher Anstieg über die volle Breite mit
# spätem Gipfel-Ereignis (Punkt) — Spannung über Länge.
S["doom_dramaturgie"] = [
    P("M12,96 L36,94 L58,88 L76,78 L90,60 L100,38", 3.5),
    C(100, 38, 5, fill=True),
    L(12, 104, 108, 104, 2),
]
# Gewicht statt Gain: massiver Fundamentbalken unten, darüber eine dünne, raue
# Fuzz-Kante — das Gewicht sitzt unten, nicht in der Sättigung.
S["doom_sound_gewicht"] = [
    RECT(16, 74, 88, 22, filled=True),
    P(roughpath(16, 104, 56, 6, step=3.5, seed=29), 2.2),
    L(16, 34, 104, 34, 2),
]
# Gemeinsames Zeitgefühl: drei schwere Wellen in exakter Phase — die Band teilt
# ein Raster.
S["doom_band_zeitgefuehl"] = [
    P(wavepath(16, 104, 38, 8, 1.5, step=2.2), 3.5),
    P(wavepath(16, 104, 62, 8, 1.5, step=2.2), 3.5),
    P(wavepath(16, 104, 86, 8, 1.5, step=2.2), 3.5),
]

DOOM_IDS = ["doom_sustain_feedback", "doom_bass_fuzz", "doom_drums_zeitdehnung",
            "doom_vocals_getragen", "doom_harmonik", "doom_dramaturgie",
            "doom_sound_gewicht", "doom_band_zeitgefuehl"]
assert sorted(DOOM_IDS) == sorted(S), sorted(set(DOOM_IDS) ^ set(S))

for bid in DOOM_IDS:
    svg = make(S[bid])
    ET.fromstring(svg)
    with open(os.path.join(OUT, f"{bid}.svg"), "w", encoding="utf-8") as f:
        f.write(svg)

# ================= FEHLERBILD-GRAFIKEN (Trainer-Layer) =================
# Komposition statt Neuzeichnung: Basis-Motiv abgeblendet (opacity), darüber ein
# schwerer, gezackter Riss von links unten nach rechts oben. Ein Fehlerbild IST
# der gestörte Baustein — die Grafik sagt genau das.

def fb_svg(basis_svg, fb_id):
    inner = re.match(r'<svg [^>]*>(.*)</svg>\s*$', basis_svg, re.S).group(1)
    seed = zlib.crc32(fb_id.encode("utf-8"))
    riss = roughline(20, 102, 100, 18, 5.5, step=8.0, seed=seed)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" '
            f'stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" '
            f'aria-hidden="true"><g opacity="0.35">{inner}</g>'
            f'<path d="{riss}" stroke-width="5"/></svg>')

with open(os.path.join(ROOT, "data/fehlerbilder.json"), encoding="utf-8") as f:
    FEHLERBILDER = json.load(f)["fehlerbild_bausteine"]

erzeugt = 0
for fb in FEHLERBILDER:
    basis_datei = os.path.join(OUT, f'{fb["basis_baustein"]}.svg')
    assert os.path.exists(basis_datei), f'Basis-Grafik fehlt: {fb["basis_baustein"]} (fuer {fb["id"]})'
    with open(basis_datei, encoding="utf-8") as f:
        basis_svg = f.read()
    svg = fb_svg(basis_svg, fb["id"])
    ET.fromstring(svg)
    with open(os.path.join(OUT, f'{fb["id"]}.svg'), "w", encoding="utf-8") as f:
        f.write(svg)
    erzeugt += 1

print(f"{len(DOOM_IDS)} Doom-SVGs + {erzeugt} Fehlerbild-SVGs (Tranche 3) erzeugt, alle XML-wohlgeformt.")
