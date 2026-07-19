# -*- coding: utf-8 -*-
"""Tranche 2: 108 abstrakte SVGs (Fortgeschritten/Experte + Theorie, inkl. 8 vorproduzierter
Theorie-Experte-IDs). Nicht direkt aufrufen — scripts/build_grafiken.py buendelt."""
import math, os, random, zipfile
import xml.etree.ElementTree as ET

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_svg_out")
os.makedirs(OUT, exist_ok=True)

# ---------- Primitive (identisch zu Tranche 1) ----------
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

# ================= GITARRE FORTGESCHRITTEN =================
S["tremolo_ausbau"] = [P(wavepath(16, 104, 44, 11, 5, step=1.8), 2.5), P(wavepath(16, 104, 78, 8, 7, step=1.6), 2)]
S["schnelles_tremolo"] = [P(wavepath(14, 106, 60, 10, 8, step=1.4), 2)]
S["tremolo_riffing"] = [P(wavepath(14, 44, 44, 8, 2.4, step=1.6), 2.2),
                        P(wavepath(48, 78, 66, 8, 2.4, step=1.6), 2.2),
                        P(wavepath(82, 106, 52, 8, 2, step=1.6), 2.2)]
def _dgal(y):
    return [L(14, y, 36, y, 6)] + [L(x, y, x + 8, y, 6) for x in (44, 58, 72, 86)] + [L(100, y, 104, y, 3)]
S["doppel_galopp"] = _dgal(46) + _dgal(76)
S["palm_mute_systeme"] = [L(14, 60, 26, 60, 5), P(wavepath(32, 48, 60, 6, 1), 3), L(54, 60, 66, 60, 5),
                          L(70, 60, 82, 60, 5), P(wavepath(88, 104, 60, 6, 1), 3)]
S["string_skipping"] = [L(20, 38, 100, 38, 2.2), L(20, 58, 100, 58, 2.2), L(20, 78, 100, 78, 2.2),
                        C(38, 38, 4, fill=True), C(38, 78, 4, fill=True), P("M38,38 C18,48 18,68 38,78", 3),
                        C(82, 38, 4, fill=True), C(82, 78, 4, fill=True), P("M82,38 C102,48 102,68 82,78", 3)]
S["pinch_harmonics"] = [L(16, 64, 104, 64, 3.5), C(62, 64, 3.5, fill=True),
                        L(72, 34, 88, 50, 3), L(88, 34, 72, 50, 3)]
S["legato"] = [C(x, 64, 3.5, fill=True) for x in (28, 48, 68, 88)] + \
              [P("M28,64 Q38,44 48,64", 2.5), P("M48,64 Q58,44 68,64", 2.5), P("M68,64 Q78,44 88,64", 2.5),
               L(28, 72, 28, 82, 3)]
S["slides_bends"] = [C(20, 78, 3.5, fill=True), L(20, 78, 54, 60, 4), C(54, 60, 3.5, fill=True),
                     P("M70,72 Q88,72 92,44", 4), C(92, 44, 3.5, fill=True)]
S["vibrato"] = [L(14, 60, 26, 60, 4), P(wavepath(26, 98, 60, 5, 4), 4)]
S["pentatonik_leads"] = [P("M24,84 L40,72 L56,64 L72,50 L88,38", 2)] + \
                        [C(x, y, 4, fill=True) for x, y in ((24, 84), (40, 72), (56, 64), (72, 50), (88, 38))]
S["dissonante_intervalle"] = [L(24, 54, 96, 54, 3.5), L(24, 65, 96, 65, 3.5),
                              P(roughpath(40, 80, 59.5, 2, step=3.5, seed=11), 1.8)]
S["sweep_picking_einstieg"] = [L(24, 36, 96, 36, 2), L(24, 52, 96, 52, 2), L(24, 68, 96, 68, 2), L(24, 84, 96, 84, 2),
                               P("M28,88 Q52,60 92,30", 4)]
S["rhythmus_lead_wechsel"] = [L(14, 60, 26, 60, 5), L(32, 60, 44, 60, 5), L(52, 44, 52, 76, 2),
                              P("M60,72 Q78,36 104,52", 3.5)]
S["handgesundheit_tempo"] = [C(30, 86, 3.5, fill=True), ARC(30, 86, 13, 8, 95, 3), ARC(30, 86, 25, 8, 92, 3),
                             C(66, 86, 3, fill=True), ARC(92, 86, 13, 8, 95, 3)]
S["mentale_temposteigerung"] = [P("M18,88 L38,88 L38,70 L58,70 L58,52 L78,52 L78,34 L98,34", 3.5), C(102, 34, 3.5, fill=True)]

# ================= GITARRE EXPERTE =================
S["djent_technik"] = [L(x, 84, x, 90, 1.5) for x in range(16, 105, 8)] + \
                     [RECT(16, 52, 14, 14), RECT(40, 52, 10, 14), RECT(64, 52, 18, 14), RECT(92, 52, 8, 14)]
S["blast_tempo_riffing"] = [P(wavepath(16, 104, 46, 8, 8, step=1.4), 2)] + \
                           [L(x, 70, x, 80, 2) for x in range(18, 105, 7)]
S["sweep_ausbau"] = [L(24, 36, 96, 36, 1.8), L(24, 52, 96, 52, 1.8), L(24, 68, 96, 68, 1.8), L(24, 84, 96, 84, 1.8),
                     P("M28,86 Q52,58 92,30", 3.5), P("M30,32 Q56,62 92,86", 3.5)]
S["dissonanz_voicings"] = [L(30, 44, 90, 44, 6), L(48, 51, 96, 51, 4), L(30, 72, 90, 72, 6)]
S["lead_phrasierung"] = [P("M16,64 Q34,40 52,60", 3.5), C(58, 66, 2.5, fill=True), P("M64,58 Q84,34 104,54", 3.5)]
S["recording_tightness"] = [L(x, 36, x, 84, 1.5) for x in (30, 60, 90)] + \
                           [L(x, 48, x, 72, 5) for x in (30, 60, 90)] + \
                           [L(x, 54, x, 66, 3) for x in (45, 75)]
S["gitarren_sound_architektur"] = [L(24, 36, 96, 36, 3), L(24, 58, 96, 58, 7), L(24, 80, 96, 80, 4), L(60, 30, 60, 86, 1.5)]
S["uebe_architektur"] = [C(60, 58, 26, 3)] + \
                        [C(60 + 26 * math.cos(math.radians(a)), 58 - 26 * math.sin(math.radians(a)), 3.5, fill=True)
                         for a in (90, 210, 330)] + [C(60, 58, 2.5, fill=True)]

# ================= BASS FORTGESCHRITTEN =================
S["bass_dreifinger"] = [L(18, 66, 102, 66, 4)] + \
                       [C(x, 44, 5, fill=True) for x in (38, 58, 78)] + [L(x, 52, x, 62, 3) for x in (38, 58, 78)]
S["bass_downpicking"] = [L(x, 40, x - 13, 80, 5) for x in (32, 50, 68, 86, 104)]
S["bass_galopp_varianten"] = [L(16, 46, 42, 46, 7), L(52, 46, 61, 46, 7), L(70, 46, 79, 46, 7),
                              L(16, 76, 25, 76, 7), L(34, 76, 43, 76, 7), L(53, 76, 79, 76, 7)]
S["bass_tremolo"] = [P(wavepath(16, 104, 60, 10, 6, step=1.8), 3)]
S["bass_ghostnotes"] = [C(20, 60, 5.5, fill=True), C(72, 60, 5.5, fill=True)] + \
                       [C(x, 60, 2.5, 2) for x in (33, 46, 59, 85, 98)]
S["bass_synkopen"] = [L(x, 72, x, 84, 3) for x in (24, 48, 72, 96)] + \
                     [C(x, 48, 4.5, fill=True) for x in (36, 60, 84)]
S["bass_akkordspiel"] = [L(26, 48, 54, 48, 5), L(26, 62, 54, 62, 5),
                         L(68, 40, 96, 40, 5), L(68, 54, 96, 54, 5), L(68, 68, 96, 68, 5)]
S["bass_slides_legato"] = [C(18, 80, 3.5, fill=True), L(18, 80, 48, 64, 4.5), C(48, 64, 3.5, fill=True),
                           C(64, 64, 4, fill=True), C(82, 64, 4, fill=True), C(100, 64, 4, fill=True),
                           P("M64,64 Q73,46 82,64", 2.5), P("M82,64 Q91,46 100,64", 2.5)]
S["bass_fills_uebergaenge"] = [C(x, 66, 4.5, fill=True) for x in (16, 30, 44)] + \
                              [L(58, 78, 68, 52, 4), L(72, 80, 82, 54, 4), L(86, 82, 96, 56, 4)] + [C(106, 66, 6, fill=True)]
S["bass_blast_begleitung"] = [C(x, 52, 3, fill=True) for x in range(18, 105, 12)] + \
                             [C(x, 76, 3, fill=True) for x in range(24, 111, 12)]
S["bass_hand_sync"] = [L(x, 88, x, 96, 2) for x in (30, 60, 90)] + \
                      [P("M20,44 Q40,58 56,62", 4), P("M100,44 Q80,58 64,62", 4), C(60, 66, 5, fill=True)]
S["bass_koerper_tempo"] = [C(30, 86, 4, fill=True), ARC(30, 86, 13, 8, 95, 4), ARC(30, 86, 25, 8, 92, 4),
                           C(66, 86, 3, fill=True), ARC(92, 86, 13, 8, 95, 4)]

# ================= BASS EXPERTE =================
S["bass_tapping"] = [L(16, 62, 104, 62, 4)] + \
                    [e for x in (40, 64, 88) for e in (L(x, 34, x, 54, 3), C(x, 62, 4, fill=True))]
S["bass_kontrapunkt"] = [P("M20,40 L40,32 L60,44 L80,34 L100,42", 3), P("M20,74 L40,82 L60,70 L80,80 L100,72", 3)]
S["bass_extremtempo"] = [P(wavepath(20, 100, 52, 7, 9, step=1.3), 2), L(20, 78, 100, 78, 6)]
S["bass_fuenfsaiter"] = [L(22, 32, 98, 32, 2), L(22, 46, 98, 46, 2.5), L(22, 60, 98, 60, 3),
                         L(22, 74, 98, 74, 4), L(22, 88, 98, 88, 6)]
S["bass_mikrotiming"] = [L(x, 48, x, 80, 3) for x in (30, 60, 90)] + \
                        [C(x + 4, 40, 4, fill=True) for x in (30, 60, 90)]
S["bass_linien_schreiben"] = [P("M20,66 L38,54 L56,62 L74,44 L92,56", 3)] + \
                             [C(x, y, 3, 2) for x, y in ((20, 66), (38, 54), (56, 62), (74, 44), (92, 56))]
S["bass_signalkette"] = [L(10, 58, 20, 58, 3), RECT(20, 50, 16, 16, filled=False), L(36, 58, 52, 58, 3),
                         RECT(52, 50, 16, 16, filled=False), L(68, 58, 84, 58, 3),
                         RECT(84, 50, 16, 16, filled=False), L(100, 58, 110, 58, 3)]
S["bass_buehnenpraesenz"] = [C(60, 64, 7, fill=True), ARC(60, 64, 20, -60, 60, 3), ARC(60, 64, 20, 120, 240, 3),
                             L(32, 92, 88, 92, 3)]

# ================= SCHLAGZEUG FORTGESCHRITTEN =================
S["blast_varianten"] = [L(x, 40, x, 52, 3) for x in (18, 34)] + [L(x, 64, x, 76, 3) for x in (26, 42)] + \
                       [L(x, 40, x, 52, 3) for x in (66, 82, 98)] + [L(x, 64, x, 76, 3) for x in (66, 82, 98)]
S["blast_ausdauer"] = [L(x, 52, x, 66, 2.5) for x in range(18, 105, 8)] + [L(20, 84, 100, 84, 4)]
S["double_bass_sechzehntel"] = [RECT(x, 60, 7, 7) for x in range(16, 105, 11)] + \
                               [RECT(x, 80, 7, 7) for x in range(21, 110, 11)]
S["double_bass_patterns"] = [L(x, 46, x, 52, 1.5) for x in range(16, 105, 12)] + \
                            [RECT(x, 66, 10, 10) for x in (16, 28, 52, 76, 88)]
S["skank_beat"] = [L(x, (38 if i % 2 == 0 else 62), x + 13, (58 if i % 2 == 0 else 82), 5)
                   for i, x in enumerate((20, 44, 68, 92))]
S["drums_ghostnotes"] = [C(24, 60, 6, fill=True), C(76, 60, 6, fill=True)] + \
                        [C(x, 60, 2.5, 2) for x in (37, 50, 63, 89, 102)]
S["herta_verzierungen"] = [L(20, 64, 20, 78, 2.5), L(27, 64, 27, 78, 2.5), L(38, 46, 38, 78, 5),
                           L(64, 64, 64, 78, 2.5), L(71, 64, 71, 78, 2.5), L(82, 46, 82, 78, 5)]
S["triolen_fills"] = [C(x, 62, 3.5, fill=True) for g in (24, 56, 88) for x in (g - 8, g, g + 8)] + \
                     [P(f"M{g-8},50 Q{g},40 {g+8},50", 2) for g in (24, 56, 88)]
S["halftime_china"] = [L(28, 50, 28, 80, 9), L(66, 50, 66, 80, 9),
                       L(90, 34, 106, 50, 3), L(106, 34, 90, 50, 3), C(98, 42, 2, fill=True)]
S["tempo_wechsel_drums"] = [L(x, 56, x, 80, 3) for x in (16, 32, 48)] + \
                           [L(x, 56, x, 80, 3) for x in range(66, 107, 10)] + [P("M48,44 Q57,32 66,44", 2.5)]
S["polyrhythmik_einstieg"] = [L(x, 72, x, 84, 3) for x in (24, 48, 72, 96)] + \
                             [C(x, 46, 4.5, fill=True) for x in (24, 60, 96)] + \
                             [L(24, 36, 24, 88, 1.2), L(96, 36, 96, 88, 1.2)]
S["drums_koerper_ausdauer"] = [C(38, 88, 3.5, fill=True), ARC(38, 88, 12, 12, 92, 3.5), ARC(38, 88, 24, 10, 90, 3.5),
                               C(72, 88, 3, fill=True), ARC(96, 88, 12, 12, 92, 3.5)]

# ================= SCHLAGZEUG EXPERTE =================
S["blast_spezialformen"] = [L(x, 30, x, 40, 2.5) for x in (18, 34, 50)] + [L(x, 30, x, 40, 2.5) for x in (26, 42, 58)] + \
                           [L(x, 56, x, 66, 2.5) for x in (70, 86, 102)] + [L(x + 4, 56, x + 4, 66, 2.5) for x in (70, 86, 102)] + \
                           [L(x, 82, x, 92, 2.5) for x in (24, 48)] + [C(84, 87, 4, fill=True)]
S["double_bass_extremtempo"] = [L(24, 40, 96, 40, 4)] + \
                               [RECT(x, 62, 5.5, 5.5) for x in range(16, 106, 8)] + \
                               [RECT(x, 80, 5.5, 5.5) for x in range(20, 110, 8)]
S["drums_polymetrik"] = [C(x, 46, 4, fill=True) for x in range(22, 105, 18)] + \
                        [C(x, 74, 4, fill=True) for x in range(22, 105, 24)] + \
                        [L(22, 36, 22, 84, 1.2), L(94, 36, 94, 84, 1.2)]
S["ungerade_takte_drums"] = [L(20, 42, 20, 82, 4.5), L(31, 58, 31, 82, 2.5), L(42, 58, 42, 82, 2.5),
                             L(56, 42, 56, 82, 4.5), L(67, 58, 67, 82, 2.5),
                             L(81, 42, 81, 82, 4.5), L(92, 58, 92, 82, 2.5)]
S["drums_dynamik_architektur"] = [L(x, 64 - h / 2, x, 64 + h / 2, 6) for x, h in
                                  ((22, 12), (37, 22), (52, 34), (67, 44), (82, 30), (97, 14))] + \
                                 [P("M22,52 Q60,26 97,54", 1.5)]
S["drums_fill_sprache"] = [C(x, 58, 3, fill=True) for x in (18, 27, 36)] + \
                          [L(52, 70, 60, 48, 3.5), L(64, 72, 72, 50, 3.5)] + \
                          [RECT(84, 52, 10, 10), C(106, 58, 3.5, fill=True)]
S["drums_recording"] = [C(60, 26, 4, 2)] + [L(x, 40, x, 88, 1.5) for x in (30, 60, 90)] + \
                       [L(x, 52, x, 76, 5) for x in (30, 60, 90)] + [L(x, 58, x, 70, 3) for x in (45, 75)]
S["drums_athletik_langzeit"] = [P("M16,84 L36,84 L36,74 L56,74 L56,64 L76,64", 3), C(86, 64, 3, fill=True),
                                P("M94,64 L94,54 L108,54", 3)]

# ================= GESANG FORTGESCHRITTEN =================
S["fry_verzerrung"] = [L(20, 66, 100, 66, 3)] + \
                      [L(x, 48 + j, x + 4, 48 + j, 2.5) for x, j in ((30, 0), (42, 3), (54, -2), (66, 2), (78, -3), (90, 1))]
S["false_cord_ansatz"] = [L(24, 60, 96, 60, 4), P(roughpath(30, 90, 48, 2.5, step=4, seed=21), 2),
                          P(roughpath(30, 90, 72, 2.5, step=4, seed=22), 2)]
S["growl_resonanz"] = [P(roughpath(24, 96, 76, 6, step=7, seed=23), 5),
                       ARC(60, 76, 26, 40, 140, 2.5), ARC(60, 76, 38, 45, 135, 2)]
S["scream_hoehe"] = [P(roughline(22, 80, 94, 34, 3, step=5, seed=24), 3.5), P("M24,92 Q60,80 96,62", 3)]
S["harsh_artikulation"] = [P(roughpath(16, 104, 60, 4, step=5, seed=25), 3.5)] + \
                          [L(x, 48, x, 72, 4) for x in (36, 56, 76, 96)]
S["harsh_phrasierung_atmung"] = [P(roughpath(16, 46, 58, 4, step=4.5, seed=26), 3.5), C(54, 58, 2.5, fill=True),
                                 P(roughpath(62, 88, 58, 4, step=4.5, seed=27), 3.5), C(96, 58, 2.5, fill=True),
                                 P(roughpath(102, 108, 58, 3, step=3, seed=28), 3)]
S["clean_harsh_wechsel"] = [P(wavepath(16, 58, 60, 12, 1), 3.5), P(roughpath(62, 104, 60, 8, step=5, seed=29), 4)]
S["harsh_dynamik_intensitaet"] = [P(roughpath(16, 104, 62, 9, step=4.5, seed=30, env=lambda t: 0.2 + 0.8 * t), 4)]
S["mikrofon_harsh"] = [P(roughpath(10, 24, 60, 3, step=3.5, seed=31), 2.5), C(32, 60, 5, fill=True),
                       ARC(32, 60, 13, -60, 60, 5), ARC(32, 60, 34, -50, 50, 2)]
S["vocal_aufnahme_feedback"] = [P(wavepath(20, 100, 44, 8, 2), 3), P(wavepath(20, 100, 76, 8, 2), 2),
                                P("M100,44 Q114,60 100,76", 2)]
S["set_pacing"] = [L(14, 60, 30, 60, 7), L(38, 60, 50, 60, 7), L(58, 60, 86, 60, 7), L(94, 60, 104, 60, 4)] + \
                  [C(x, 78, 2.5, fill=True) for x in (34, 54, 90)]
S["stimm_regeneration"] = [P(wavepath(16, 96, 60, 14, 2.5, env=lambda t: 1 - t), 3), C(102, 60, 3, fill=True)]

# ================= GESANG EXPERTE =================
S["harsh_range_erweiterung"] = [P(roughpath(28, 96, 40, 3, step=4.5, seed=32), 2.5),
                                P(roughpath(28, 96, 60, 4, step=4.5, seed=33), 4),
                                P(roughpath(28, 96, 80, 3, step=4.5, seed=34), 2.5),
                                L(16, 40, 16, 80, 2), L(12, 40, 20, 40, 2), L(12, 80, 20, 80, 2)]
S["harsh_texturen"] = [P(roughpath(16, 44, 60, 3, step=2.5, seed=35), 2.5),
                       P(roughpath(50, 78, 60, 6, step=6, seed=36), 4),
                       P(roughpath(84, 106, 60, 8, step=8, seed=37), 5.5)]
S["harsh_rhythmische_praezision"] = [L(x, 68, x, 80, 3) for x in (24, 48, 72, 96)] + \
                                    [P(roughpath(x - 5, x + 5, 48, 4, step=2.5, seed=38 + x), 3.5) for x in (24, 48, 72, 96)]
S["harsh_projektion_band"] = [L(x, 78, x, 90, 1.5) for x in range(18, 105, 7)] + \
                             [C(34, 52, 5, fill=True), ARC(34, 52, 16, -50, 50, 3.5), ARC(34, 52, 30, -45, 45, 2.5)]
S["vocal_identitaet"] = [L(24, 34, 96, 34, 1.5), L(24, 86, 96, 86, 1.5),
                         P("M20,64 Q36,40 50,58 L64,44 Q80,66 100,50", 4)]
S["vocals_studio"] = [L(x, 32, x, 88, 1.5) for x in (30, 60, 90)] + \
                     [P(wavepath(20, 100, 60, 10, 1.5), 3)] + [C(x, 60, 3, fill=True) for x in (30, 60, 90)]
S["vocals_live_monitoring"] = [C(60, 62, 5, fill=True), ARC(60, 62, 14, -50, 50, 3), ARC(60, 62, 26, -45, 45, 2.5),
                               ARC(60, 62, 14, 130, 230, 2.5)]
S["vocals_tour_haushalt"] = [P("M14,80 Q26,54 38,80", 3), P("M46,80 Q58,54 70,80", 3), P("M78,80 Q90,54 102,80", 3),
                             C(42, 90, 2.5, fill=True), C(74, 90, 2.5, fill=True)]

# ================= THEORIE EINSTEIGER =================
S["intervalle_grundlagen"] = [L(24, 64, 96, 64, 2), C(36, 64, 5, fill=True), C(84, 64, 5, fill=True),
                              P("M36,48 L36,42 L84,42 L84,48", 2.5)]
S["powerchord_theorie"] = [L(32, 44, 88, 44, 6), L(32, 76, 88, 76, 6)] + \
                          [L(x, 60, x + 7, 60, 2) for x in (42, 56, 70)]
S["moll_phrygisch"] = [P("M24,80 L34,74 L50,62 L66,54 L82,46 L96,38", 1.8)] + \
                      [C(x, y, 3.5, fill=True) for x, y in ((24, 80), (34, 74), (50, 62), (66, 54), (82, 46), (96, 38))] + \
                      [P("M24,90 Q29,95 34,90", 2)]
S["tritonus_dissonanz"] = [C(30, 60, 5, fill=True), C(90, 60, 5, fill=True),
                           P(roughpath(40, 80, 60, 3.5, step=4, seed=41), 2.5)]
S["taktarten_unterteilungen"] = [L(x, 44, x, 84, 4.5) for x in (22, 54, 86)] + \
                                [L(x, 60, x, 84, 2.5) for x in (38, 70, 102)] + \
                                [P("M22,36 Q30,28 38,36", 2), P("M54,36 Q62,28 70,36", 2)]
S["tempo_genres"] = [P(wavepath(24, 96, 36, 8, 1), 4), P(wavepath(24, 96, 60, 8, 2.5), 3),
                     P(wavepath(24, 96, 84, 8, 5), 2.2)]
S["songstruktur_breakdown"] = [RECT(14, 48, 14, 14), RECT(34, 48, 14, 14), RECT(54, 48, 14, 14),
                               RECT(80, 42, 9, 28), RECT(98, 42, 9, 28)]
S["riff_baukasten"] = [RECT(22, 32, 10, 10), C(52, 37, 5, fill=True), L(70, 37, 86, 37, 5),
                       RECT(22, 72, 10, 10), L(42, 77, 56, 77, 5), C(68, 77, 5, fill=True), RECT(80, 72, 10, 10)]

# ================= THEORIE FORTGESCHRITTEN =================
S["modi_im_metal"] = [C(x, 64, 3.5, 2) for x in range(20, 105, 14)] + \
                     [C(20, 64, 3.5, fill=True), C(48, 64, 3.5, fill=True)]
S["harmonisch_moll_exotik"] = [P("M20,84 L34,76 L48,68 L62,60 L76,44 L90,38", 1.8)] + \
                              [C(x, y, 3.5, fill=True) for x, y in ((20, 84), (34, 76), (48, 68), (62, 60), (76, 44), (90, 38))] + \
                              [L(62, 70, 76, 54, 2)]
S["akkordfolgen_metal"] = [L(20, 52, 40, 52, 4), L(20, 66, 40, 66, 4),
                           L(50, 52, 70, 52, 4), L(50, 66, 70, 66, 4),
                           L(80, 60, 100, 60, 4), L(80, 74, 100, 74, 4)]
S["ungerade_takte_theorie"] = [L(20, 42, 20, 80, 4.5), L(32, 58, 32, 80, 2.5),
                               L(46, 42, 46, 80, 4.5), L(58, 58, 58, 80, 2.5),
                               L(72, 42, 72, 80, 4.5), L(84, 58, 84, 80, 2.5), L(96, 58, 96, 80, 2.5)]
S["polyrhythmik_theorie"] = [C(x, 44, 4.5, fill=True) for x in (24, 48, 72)] + \
                            [C(x, 76, 4.5, fill=True) for x in (24, 60)] + \
                            [L(24, 34, 24, 86, 1.2), L(96, 34, 96, 86, 1.2), C(96, 44, 4.5, 2), C(96, 76, 4.5, 2)]
S["tonartwechsel_dramaturgie"] = [P("M16,72 L52,72 L62,48 L104,48", 4)] + \
                                 [L(x, 72, x + 6, 72, 1.5) for x in (64, 76, 88)]
S["gehoer_transkription"] = [P(wavepath(14, 50, 56, 8, 1.5), 3), L(66, 48, 104, 48, 1),
                             L(66, 60, 104, 60, 1)] + \
                            [C(x, y, 3.5, fill=True) for x, y in ((72, 48), (82, 60), (92, 44), (100, 56))]
S["arrangement_dichte"] = [L(x, 48, x, 76, 3.5) for x in (20, 44, 52, 60, 66, 72, 96)]

# ================= THEORIE EXPERTE =================
S["erweiterte_harmonik"] = [L(32, 48, 88, 48, 6), L(32, 64, 88, 64, 6), C(72, 34, 4.5, 2.5), L(72, 40, 72, 46, 2)]
S["chromatik_atonalitaet"] = [P("M22,70 L30,58 L38,66", 1.5), P("M52,58 L60,46 L68,54", 1.5), P("M82,50 L90,62 L98,54", 1.5)] + \
                             [C(x, y, 3, fill=True) for x, y in ((22, 70), (30, 58), (38, 66), (52, 58), (60, 46), (68, 54), (82, 50), (90, 62), (98, 54))]
S["modulation_vertieft"] = [L(16, 76, 56, 76, 3), L(64, 44, 104, 44, 3),
                            P("M52,76 L60,62 L54,58 L62,44", 2.5), P("M42,76 C56,72 58,48 66,44", 2.5)]
S["metrische_modulation"] = [L(x, 60, x, 84, 3) for x in (16, 31, 46)] + \
                            [C(x, 44, 2.5, fill=True) for x in (52, 60, 68)] + [P("M52,34 Q60,28 68,34", 2)] + \
                            [L(x, 60, x, 84, 3) for x in (76, 86, 96, 106)]
S["kontrapunkt_stimmfuehrung"] = [P("M18,50 L42,42 L66,50 L90,34 L104,38", 3),
                                  P("M18,64 L42,56 L66,64 L90,80 L104,76", 3)]
S["klangregie_arrangement"] = [L(20, 38, 100, 38, 2.5), L(20, 60, 64, 60, 6), L(80, 60, 100, 60, 6), L(20, 82, 100, 82, 4)]
S["produktionswissen_frequenz"] = [L(18, 58, 46, 58, 7), L(30, 65, 58, 65, 7),
                                   L(70, 46, 98, 46, 7), L(70, 76, 98, 76, 7)]
S["werkanalyse_repertoire"] = [L(22, 78, 30, 78, 3.5), C(40, 78, 2.5, fill=True), L(48, 78, 56, 78, 3.5),
                               C(66, 78, 2.5, fill=True), L(74, 78, 82, 78, 3.5), C(92, 78, 2.5, fill=True),
                               C(52, 52, 16, 3), L(64, 64, 78, 78, 3.5)]

# ---------- Sets & Validierung ----------
SETS2 = {
    "gitarre fortgeschritten": ["tremolo_ausbau","schnelles_tremolo","tremolo_riffing","doppel_galopp","palm_mute_systeme","string_skipping","pinch_harmonics","legato","slides_bends","vibrato","pentatonik_leads","dissonante_intervalle","sweep_picking_einstieg","rhythmus_lead_wechsel","handgesundheit_tempo","mentale_temposteigerung"],
    "gitarre experte": ["djent_technik","blast_tempo_riffing","sweep_ausbau","dissonanz_voicings","lead_phrasierung","recording_tightness","gitarren_sound_architektur","uebe_architektur"],
    "bass fortgeschritten": ["bass_dreifinger","bass_downpicking","bass_galopp_varianten","bass_tremolo","bass_ghostnotes","bass_synkopen","bass_akkordspiel","bass_slides_legato","bass_fills_uebergaenge","bass_blast_begleitung","bass_hand_sync","bass_koerper_tempo"],
    "bass experte": ["bass_tapping","bass_kontrapunkt","bass_extremtempo","bass_fuenfsaiter","bass_mikrotiming","bass_linien_schreiben","bass_signalkette","bass_buehnenpraesenz"],
    "schlagzeug fortgeschritten": ["blast_varianten","blast_ausdauer","double_bass_sechzehntel","double_bass_patterns","skank_beat","drums_ghostnotes","herta_verzierungen","triolen_fills","halftime_china","tempo_wechsel_drums","polyrhythmik_einstieg","drums_koerper_ausdauer"],
    "schlagzeug experte": ["blast_spezialformen","double_bass_extremtempo","drums_polymetrik","ungerade_takte_drums","drums_dynamik_architektur","drums_fill_sprache","drums_recording","drums_athletik_langzeit"],
    "gesang fortgeschritten": ["fry_verzerrung","false_cord_ansatz","growl_resonanz","scream_hoehe","harsh_artikulation","harsh_phrasierung_atmung","clean_harsh_wechsel","harsh_dynamik_intensitaet","mikrofon_harsh","vocal_aufnahme_feedback","set_pacing","stimm_regeneration"],
    "gesang experte": ["harsh_range_erweiterung","harsh_texturen","harsh_rhythmische_praezision","harsh_projektion_band","vocal_identitaet","vocals_studio","vocals_live_monitoring","vocals_tour_haushalt"],
    "theorie einsteiger": ["intervalle_grundlagen","powerchord_theorie","moll_phrygisch","tritonus_dissonanz","taktarten_unterteilungen","tempo_genres","songstruktur_breakdown","riff_baukasten"],
    "theorie fortgeschritten": ["modi_im_metal","harmonisch_moll_exotik","akkordfolgen_metal","ungerade_takte_theorie","polyrhythmik_theorie","tonartwechsel_dramaturgie","gehoer_transkription","arrangement_dichte"],
    "theorie experte": ["erweiterte_harmonik","chromatik_atonalitaet","modulation_vertieft","metrische_modulation","kontrapunkt_stimmfuehrung","klangregie_arrangement","produktionswissen_frequenz","werkanalyse_repertoire"],
}

alle2 = [i for ids in SETS2.values() for i in ids]
fehlend = [i for i in alle2 if i not in S]
extra = [i for i in S if i not in alle2]
assert not fehlend, f"Ohne Grafik: {fehlend}"
assert not extra, f"Unbekannte ids: {extra}"
assert len(alle2) == len(set(alle2)) == 108, len(alle2)

for bid in alle2:
    svg = make(S[bid])
    ET.fromstring(svg)
    with open(os.path.join(OUT, f"{bid}.svg"), "w", encoding="utf-8") as f:
        f.write(svg)
print(f"{len(alle2)} SVGs (Tranche 2) erzeugt, alle XML-wohlgeformt.")
