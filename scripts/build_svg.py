# -*- coding: utf-8 -*-
"""Tranche 1: 64 abstrakte SVGs (Einsteiger-Sets). Nicht direkt aufrufen —
scripts/build_grafiken.py fuehrt beide Tranchen aus und buendelt data/grafiken.json."""
import math, os, random, zipfile
import xml.etree.ElementTree as ET

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_svg_out")
os.makedirs(OUT, exist_ok=True)

# ---------- Primitive ----------
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

def TRI(pts):
    p = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    return f'<polygon points="{p}" fill="currentColor" stroke="none"/>'

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

def roughpath(x0, x1, cy, amp, step=4.0, seed=1):
    rnd = random.Random(seed)
    n = max(2, int((x1 - x0) / step)); pts = []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        y = cy + rnd.uniform(-amp, amp)
        pts.append(f"{x:.1f},{y:.1f}")
    return "M" + " L".join(pts)

def make(name, elements):
    body = "".join(elements)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" '
            f'stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" '
            f'aria-hidden="true">{body}</svg>')

S = {}

# ================= GITARRE =================
S["grundhaltung"] = [L(60, 22, 60, 78, 3), C(60, 40, 10, 3), P("M28,88 Q60,72 92,88", 3)]
S["greifhand_grundlagen"] = [L(82, 20, 82, 100, 4)] + [C(70, y, 4, fill=True) for y in (32, 50, 68, 86)]
S["fingerdruck_oekonomie"] = [L(20, 72, 100, 72, 3), P("M20,34 Q60,76 100,34", 3), C(60, 72, 3.5, fill=True)]
S["anschlaghand_grundlagen"] = [L(x, 44, x + 11, 76, 3.5) for x in (20, 38, 56, 74, 92)]
S["wechselschlag"] = [P("M14,60 L28,40 L42,80 L56,40 L70,80 L84,40 L98,80 L106,66", 3.5)]
S["palm_muting"] = [P(wavepath(14, 52, 72, 16, 1.5), 3), L(62, 46, 104, 46, 8), P(wavepath(62, 106, 72, 3.5, 2.5), 3)]
S["powerchords"] = [L(30, 42, 90, 42, 7), L(30, 60, 90, 60, 7), L(38, 78, 82, 78, 4)]
S["downpicking"] = [L(x, 40, x - 13, 80, 4) for x in (32, 50, 68, 86, 104)]
S["tremolo_picking"] = [P(wavepath(14, 106, 60, 13, 5.5, step=1.8), 2.5)]
S["drop_tuning"] = [L(20, 36, 100, 36, 2.5), L(20, 52, 100, 52, 2.5), P("M20,68 L54,68 L64,84 L100,84", 5)]
def _galopp(y, w):
    return [L(16, y, 42, y, w), L(52, y, 61, y, w), L(70, y, 79, y, w), L(88, y, 97, y, w * 0.55)]
S["galopp_rhythmus"] = _galopp(46, 6) + _galopp(76, 6)
S["chugs_breakdown"] = ([RECT(16, 50, 15, 17), RECT(38, 50, 15, 17), RECT(82, 50, 15, 17)] +
                        [L(x, 84, x, 92, 2) for x in (23.5, 45.5, 67.5, 89.5)])
S["doom_riffing"] = [L(20, 56, 68, 56, 14), ARC(80, 56, 12, -55, 55, 3), ARC(80, 56, 22, -50, 50, 2.5)]
S["einfaches_riff"] = [L(14, 58, 26, 58, 5), L(32, 58, 44, 58, 5),
                       L(52, 50, 68, 50, 5), L(52, 66, 68, 66, 5),
                       L(76, 58, 88, 58, 5), C(100, 58, 4, fill=True)]
S["aufwaermen_handgesundheit"] = [C(30, 86, 3.5, fill=True), ARC(30, 86, 13, 8, 95, 3), ARC(30, 86, 25, 8, 92, 3), ARC(30, 86, 37, 8, 90, 3)]
S["metronom_prinzip"] = [L(60, 28, 40, 86, 3.5), C(40, 86, 5, fill=True)] + \
                        [L(x, 96, x, 104, 2.5) for x in (24, 42, 60, 78, 96)]

# ================= BASS =================
S["bass_grundhaltung"] = [L(60, 22, 60, 78, 6), C(60, 40, 11, 4), P("M26,88 Q60,72 94,88", 4)]
S["bass_greifhand"] = [L(84, 18, 84, 102, 5)] + [C(68, y, 5, fill=True) for y in (28, 52, 76, 100)]
S["greifhand_daempfen"] = [L(20, 38, 100, 38, 3), L(20, 58, 100, 58, 3), P(wavepath(20, 100, 82, 10, 2), 4)]
S["fingerstyle"] = [L(20, 66, 100, 66, 4), C(42, 44, 5, fill=True), L(42, 52, 42, 62, 3),
                    C(70, 44, 5, fill=True), L(70, 52, 70, 62, 3)]
S["plektrum_technik"] = [TRI([(28, 40), (48, 40), (38, 60)])] + [L(x, 46, x + 10, 74, 4) for x in (60, 78, 96)]
S["anschlagpunkt_ton"] = [L(16, 62, 104, 62, 3.5), P(wavepath(22, 52, 62, 14, 1), 3),
                          P(wavepath(70, 90, 62, 5, 1.6), 3), L(100, 48, 100, 76, 6)]
S["palm_muting_bass"] = [P(wavepath(14, 50, 74, 15, 1.5), 4), L(60, 44, 104, 44, 10), P(wavepath(60, 106, 74, 3.5, 2.5), 4)]
S["grundton_folgen"] = [P("M20,38 L36,30 L52,44 L68,32 L84,46 L100,36", 3),
                        L(20, 78, 100, 78, 2)] + [C(x, 78, 4.5, fill=True) for x in (20, 52, 84)]
S["schnelles_fingerspiel"] = [ARC(x, 60, 8, 20, 160, 3.5) if i % 2 == 0 else ARC(x, 60, 8, 200, 340, 3.5)
                              for i, x in enumerate((22, 37, 52, 67, 82, 97))]
S["galopp_bass"] = _galopp(46, 7.5) + _galopp(76, 7.5)
S["lock_zur_bassdrum"] = [L(x, 82, x, 92, 3) for x in (24, 48, 72, 96)] + \
                         [C(x, 82, 2.5, fill=True) for x in (24, 72, 96)] + [C(48, 52, 14, 4), C(48, 52, 5, fill=True)]
S["doom_bass"] = [L(18, 58, 62, 58, 16), ARC(76, 58, 13, -55, 55, 4), ARC(76, 58, 24, -50, 50, 3)]
S["einfache_basslinie"] = [L(x, 34, x, 34 + h, 3) for x, h in ((20, 14), (36, 8), (52, 16), (68, 8), (84, 14), (100, 10))] + \
                          [C(x, 78, 4.5, fill=True) for x in (20, 36, 52, 68, 84, 100)]
S["bass_ton_gear"] = [L(20, 34, 100, 34, 3), L(28, 57, 92, 57, 8), L(20, 80, 100, 80, 5)]
S["bass_aufwaermen"] = [C(32, 88, 4, fill=True), ARC(32, 88, 13, 8, 95, 4), ARC(32, 88, 25, 8, 92, 4), ARC(32, 88, 37, 8, 90, 4)]
S["bass_timing_klick"] = [L(x, 76, x, 88, 3) for x in (24, 48, 72, 96)] + \
                         [P(wavepath(24, 96, 46, 11, 1.5), 3.5)]

# ================= SCHLAGZEUG =================
S["kit_sitzhaltung"] = [C(60, 50, 6, fill=True), L(60, 56, 60, 96, 3.5), L(56, 62, 32, 94, 3.5),
                        L(64, 62, 88, 94, 3.5), P("M36,34 Q60,26 84,34", 3)]
S["stockhaltung"] = [TRI([(53, 80), (67, 80), (60, 66)]), L(24, 76, 96, 56, 4), ARC(96, 56, 12, 20, 110, 2.5)]
S["fusstechnik"] = [L(20, 86, 100, 86, 3.5), P("M30,86 Q60,40 88,86", 4), C(88, 86, 4, fill=True), ARC(96, 86, 8, 20, 150, 2.5)]
S["puls_zaehlzeiten"] = [L(x, 38, x, 86, 5) for x in (22, 60, 98)] + \
                        [L(x, 56, x, 86, 3) for x in (41, 79)] + \
                        [L(x, 70, x, 86, 2) for x in (31.5, 50.5, 69.5, 88.5)]
S["rudiments_grundlage"] = [L(24, 30, 33, 50, 3.5), L(46, 50, 55, 30, 3.5), L(68, 30, 77, 50, 3.5), L(90, 50, 99, 30, 3.5),
                            L(28, 68, 37, 88, 3.5), L(43, 68, 52, 88, 3.5), L(74, 88, 83, 68, 3.5), L(89, 88, 98, 68, 3.5)]
S["grundbeat"] = [C(x, 34, 2.6, fill=True) for x in range(20, 105, 12)] + \
                 [L(44, 52, 44, 64, 7), L(92, 52, 92, 64, 7)] + \
                 [L(20, 76, 20, 88, 7), L(68, 76, 68, 88, 7)]
S["koordination"] = [P(wavepath(18, 102, 46, 11, 2), 3), P(wavepath(18, 102, 74, 11, 2, phase=math.pi), 3)] + \
                    [L(x, 34, x, 88, 2) for x in (39, 60, 81)]
S["dynamik_akzente"] = [C(x, 60, (6 if i in (0, 4) else 2.5), fill=True) for i, x in enumerate(range(18, 111, 13))]
S["double_bass"] = [RECT(x, 62, 11, 11) for x in (18, 42, 66, 90)] + \
                   [RECT(x, 82, 11, 11) for x in (30, 54, 78, 102 - 9)]
S["d_beat"] = [L(x, (36 if i % 2 == 0 else 60), x + 12, (56 if i % 2 == 0 else 80), 5) for i, x in enumerate((16, 32, 48, 64, 80, 96))]
S["blastbeat"] = [L(x, 42, x, 54, 3) for x in range(18, 105, 12)] + \
                 [L(x, 66, x, 78, 3) for x in range(24, 111, 12)]
S["doom_feel"] = [RECT(22, 48, 20, 20), RECT(80, 48, 20, 20)] + [C(x, 88, 2, fill=True) for x in (52, 61, 70)]
S["fills"] = [C(x, 46, 3, fill=True) for x in (16, 28, 40, 52)] + \
             [L(64, 62, 74, 38, 3.5), L(76, 66, 86, 40, 3.5), L(88, 70, 98, 42, 3.5)] + [C(106, 46, 6, fill=True)]
S["metalcore_groove"] = [C(x, 40, 2.5, fill=True) for x in (18, 34, 50)] + \
                        [L(x, 66, x, 80, 3) for x in (18, 27, 36, 45, 54)] + \
                        [L(76, 42, 76, 82, 12), L(98, 42, 98, 82, 12)]
S["timing_klick"] = [L(60, 28, 80, 86, 3.5), C(80, 86, 5, fill=True)] + \
                    [L(x, 96, x, 104, 2.5) for x in (24, 42, 60, 78, 96)]
S["aufwaermen_gesundheit"] = [C(60, 92, 4, fill=True), ARC(60, 92, 14, 20, 160, 3.5), ARC(60, 92, 26, 18, 162, 3.5), ARC(60, 92, 38, 16, 164, 3.5)]

# ================= GESANG =================
S["gesang_haltung_atmung"] = [L(60, 20, 60, 40, 3), C(60, 62, 8, fill=True),
                              ARC(60, 62, 18, 200, 340, 3), ARC(60, 62, 29, 205, 335, 3), ARC(60, 62, 40, 210, 330, 3)]
S["atemstuetze"] = [L(20, 52, 100, 52, 6), P("M28,82 Q60,64 92,82", 3.5)]
S["stimmuebungen_sanft"] = [C(18, 74, 3.5, fill=True), P("M18,74 Q38,26 58,52 Q78,78 102,36", 3)]
S["tonhoehe_clean"] = [L(58, 40, 104, 40, 3.5), P("M16,82 Q48,76 74,44", 3), C(78, 40, 5, fill=True)]
S["resonanz_projektion"] = [C(32, 60, 4.5, fill=True), ARC(32, 60, 16, -55, 55, 3.5), ARC(32, 60, 30, -52, 52, 3), ARC(32, 60, 44, -50, 50, 2.5)]
S["artikulation_text"] = [P(wavepath(16, 104, 60, 4, 2.5), 3)] + [L(x, 48, x, 72, 4) for x in (36, 56, 76, 96)]
S["rhythmus_phrasierung"] = [L(x, 72, x, 84, 3) for x in (24, 48, 72, 96)] + \
                            [C(24, 48, 4.5, fill=True), C(60, 48, 4.5, fill=True), C(72, 48, 4.5, fill=True), C(100, 48, 4.5, fill=True)]
S["clean_im_metal"] = [P(wavepath(16, 104, 60, 17, 1.5), 4)]
S["dynamik_ausdruck"] = [P(wavepath(16, 104, 60, 18, 3, env=lambda t: 0.18 + 0.82 * t), 3.5)]
S["mikrofontechnik"] = [C(30, 60, 5, fill=True), ARC(30, 60, 15, -60, 60, 4.5), ARC(30, 60, 36, -52, 52, 2)]
S["aufwaermen_stimmgesundheit"] = [P("M16,86 Q60,26 104,86", 3.5)] + \
                                  [C(x, y, 3, fill=True) for x, y in ((32, 66), (60, 41), (88, 66))]
S["stimme_schuetzen_alltag"] = [P("M24,64 Q60,16 96,64", 4), P(wavepath(38, 82, 82, 5, 1.5), 3)]
S["verzerrung_prinzip"] = [P(wavepath(16, 104, 66, 14, 1.5), 5), P(roughpath(30, 90, 45, 4, step=4.5, seed=7), 2)]
S["harsh_stile_ueberblick"] = [P(roughpath(20, 100, 34, 4, step=3.2, seed=2), 2.5),
                               P(roughpath(20, 100, 60, 6, step=5.5, seed=3), 3.5),
                               P(roughpath(20, 100, 86, 7, step=8, seed=4), 5)]
S["sanfter_einstieg_verzerrung"] = [C(16, 60, 3, fill=True), L(20, 60, 50, 60, 3),
                                    P(roughpath(52, 68, 60, 3.5, step=3, seed=5), 3), L(70, 60, 104, 60, 3)]
S["zur_musik_singen"] = [L(x, 74, x, 86, 3) for x in (24, 48, 72, 96)] + [P(wavepath(24, 96, 46, 10, 1.5), 3)]

# ---------- Erzeugen + Validieren ----------
SETS = {
    "gitarre": ["grundhaltung","greifhand_grundlagen","fingerdruck_oekonomie","anschlaghand_grundlagen","wechselschlag","palm_muting","powerchords","downpicking","tremolo_picking","drop_tuning","galopp_rhythmus","chugs_breakdown","doom_riffing","einfaches_riff","aufwaermen_handgesundheit","metronom_prinzip"],
    "bass": ["bass_grundhaltung","bass_greifhand","greifhand_daempfen","fingerstyle","plektrum_technik","anschlagpunkt_ton","palm_muting_bass","grundton_folgen","schnelles_fingerspiel","galopp_bass","lock_zur_bassdrum","doom_bass","einfache_basslinie","bass_ton_gear","bass_aufwaermen","bass_timing_klick"],
    "schlagzeug": ["kit_sitzhaltung","stockhaltung","fusstechnik","puls_zaehlzeiten","rudiments_grundlage","grundbeat","koordination","dynamik_akzente","double_bass","d_beat","blastbeat","doom_feel","fills","metalcore_groove","timing_klick","aufwaermen_gesundheit"],
    "gesang": ["gesang_haltung_atmung","atemstuetze","stimmuebungen_sanft","tonhoehe_clean","resonanz_projektion","artikulation_text","rhythmus_phrasierung","clean_im_metal","dynamik_ausdruck","mikrofontechnik","aufwaermen_stimmgesundheit","stimme_schuetzen_alltag","verzerrung_prinzip","harsh_stile_ueberblick","sanfter_einstieg_verzerrung","zur_musik_singen"],
}

alle = [i for ids in SETS.values() for i in ids]
fehlend = [i for i in alle if i not in S]
extra = [i for i in S if i not in alle]
assert not fehlend, f"Ohne Grafik: {fehlend}"
assert not extra, f"Unbekannte ids: {extra}"

groessen = []
for bid in alle:
    svg = make(bid, S[bid])
    ET.fromstring(svg)  # wohlgeformtes XML
    path = os.path.join(OUT, f"{bid}.svg")
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)
    groessen.append(len(svg))

print(f"{len(alle)} SVGs erzeugt, alle XML-wohlgeformt.")
print(f"Groesse: min {min(groessen)} B, max {max(groessen)} B, gesamt {sum(groessen)/1024:.1f} KB")
