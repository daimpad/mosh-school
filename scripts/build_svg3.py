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

# ================= HARDCORE-VERTIEFUNG (stil-hardcore, fortgeschritten) =================
# Hardcore: kantig, synkopiert, körperlich — Akzente gegen den Beat, Kollektiv-Motive.

# Groove & Bounce: Beat-Grundlinie mit synkopierten schweren Blöcken — die Lücken
# gehören zum Riff.
S["hardcore_groove_bounce"] = [
    L(12, 90, 108, 90, 2.5),
    RECT(16, 62, 16, 22, filled=True),
    RECT(44, 62, 10, 22, filled=True),
    RECT(70, 42, 16, 42, filled=True),
    RECT(96, 62, 10, 22, filled=True),
]
# Der Motor: durchgehende schwere Achtel-Striche, zwei mit der Kick verzahnte
# Akzent-Keile darunter.
S["hardcore_bass_motor"] = [
    *[L(16 + i * 13, 48, 16 + i * 13, 72, 5) for i in range(8)],
    TRI([(29, 84), (37, 84), (33, 94)]),
    TRI([(81, 84), (89, 84), (85, 94)]),
]
# Energie kontrollieren: dichter schneller Beat kippt an einer harten Kante in
# den halb so dichten Stomp — gleiche Grundlinie, halbierte Dichte.
S["hardcore_drums_energie"] = [
    L(12, 76, 108, 76, 2.5),
    *[L(16 + i * 8, 76, 16 + i * 8, 56, 3) for i in range(6)],
    L(62, 40, 62, 96, 3.5),
    L(76, 76, 76, 46, 6),
    L(98, 76, 98, 46, 6),
]
# Gang-Shouts: drei Stimmen (aufsteigende Striche) unter einem gemeinsamen
# Ruf-Bogen — ein Schlag, viele Kehlen.
S["hardcore_gangshouts"] = [
    L(38, 92, 38, 62, 5),
    L(60, 92, 60, 54, 5),
    L(82, 92, 82, 62, 5),
    ARC(60, 58, 38, 30, 150, 3),
]
# Songwriting direkt: ein kurzer, kompromissloser Pfad — geradeaus, harte Ecke,
# Schluss auf dem Punkt.
S["hardcore_songwriting_direkt"] = [
    P("M14,48 L74,48 L74,84 L98,84", 4.5),
    C(104, 84, 4.5, fill=True),
]
# Bühne & Community: Kreis aus Punkten um ein Zentrum — durchlässige Grenze,
# ein Punkt gehört zu beiden Welten.
S["hardcore_buehne_community"] = [
    C(60, 60, 9, fill=True),
    *[C(60 + 34 * math.cos(math.radians(a)), 60 - 34 * math.sin(math.radians(a)), 4, fill=True)
      for a in (20, 70, 110, 160, 200, 250, 290, 340)],
]

# ================= CRUST / GRINDCORE / POWERVIOLENCE (stil-punk-extrem) =================

# D-Beat als Dauerlauf: das Galopp-Paar-Muster läuft ununterbrochen über die
# volle Breite — Konstanz als Motiv.
S["crust_dbeat_ausbau"] = [
    L(12, 82, 108, 82, 2.5),
    *[L(x, 82, x, 58, 4) for pair in range(4) for x in (18 + pair * 24, 26 + pair * 24)],
    C(60, 96, 3, fill=True),
]
# Dreck mit Absicht: maximal raue, sägende Doppellinie — die Kettensäge.
S["crust_sound_dreck"] = [
    P(roughpath(12, 108, 48, 10, step=2.6, seed=42), 3.5),
    P(roughpath(12, 108, 76, 10, step=2.6, seed=43), 3.5),
]
# Rau & dringlich: eine rufende Welle mit rauer Kante — Sprechgesang mit
# Schmirgel, kein geformtes Monster.
S["crust_vocals_rau"] = [
    P(roughpath(16, 104, 60, 7, step=3.0, seed=17, env=lambda t: 0.5 + 0.5 * math.sin(math.pi * t)), 4),
    ARC(60, 66, 34, 200, 340, 2),
]
# Radikale Reduktion: dichte Tremolo-Fläche bricht hart in einen einzelnen
# schweren Block — zwei Riffs, nichts dazwischen.
S["grind_riff_reduktion"] = [
    P(wavepath(14, 66, 60, 9, 5, step=1.4), 2),
    RECT(76, 46, 28, 28, filled=True),
]
# Tief-Hoch-Wechsel: schwere tiefe Welle und raue hohe Welle im harten Wechsel —
# eine Stütze, zwei Register.
S["grind_vocals_wechsel"] = [
    P(wavepath(14, 56, 78, 10, 1.6, step=1.8), 5),
    P(roughpath(64, 106, 40, 7, step=2.4, seed=23), 2.2),
    L(60, 30, 60, 90, 2),
]
# Der komprimierte Song: alles auf kleinstem Raum — ein dichter Block aus
# Ereignis-Strichen, drumherum nichts.
S["grind_kompression"] = [
    RECT(38, 44, 44, 32, filled=False),
    *[L(44 + i * 6, 50, 44 + i * 6, 70, 3) for i in range(6)],
    L(12, 60, 30, 60, 2),
    L(90, 60, 108, 60, 2),
]
# Start-Stopp-Präzision: dichte Fläche, harte Lücke, schwerer Einzelblock —
# die Kante ist das Ereignis.
S["pv_start_stopp"] = [
    P(wavepath(14, 54, 60, 9, 4, step=1.4), 2),
    L(58, 36, 58, 84, 3.5),
    RECT(72, 48, 14, 24, filled=True),
    L(94, 36, 94, 84, 3.5),
]
# Dramaturgie der Miniatur: Zustandsfolge als Blöcke verschiedener Dichte mit
# harten Schnitten — keine Übergänge.
S["pv_miniatur_dramaturgie"] = [
    RECT(14, 52, 22, 16, filled=True),
    RECT(44, 40, 10, 40, filled=True),
    RECT(62, 58, 30, 10, filled=True),
    RECT(100, 44, 6, 32, filled=True),
]
# Gemeinsame Abrisskanten: zwei Linien springen an derselben Kante gemeinsam
# auf ein neues Niveau — alle wissen den Wechsel.
S["pv_band_abrisskanten"] = [
    P("M12,44 L56,44 L56,76 L108,76", 3.5),
    P("M12,56 L56,56 L56,88 L108,88", 3.5),
    C(56, 32, 4, 2.5),
]

# ================= SLUDGE (stil-sludge) + GRIND-VERTIEFUNG =================

# Langsam & giftig: eine schwere, langsame Welle mit rauer Dreckkante obenauf —
# Doom-Gewicht mit Hardcore-Biss.
S["sludge_riffing_dreck"] = [
    P(wavepath(14, 106, 70, 12, 1.5, step=2.0), 5),
    P(roughpath(30, 92, 42, 6, step=3.0, seed=51), 2.2),
]
# Hinter dem Beat: Raster-Ticks auf der Zeitlinie, die schweren Backbeat-Schläge
# konstant knapp NACH dem Raster — kontrolliertes Schleppen.
S["sludge_drums_hinterm_beat"] = [
    L(12, 72, 108, 72, 2.5),
    *[L(20 + i * 22, 72, 20 + i * 22, 56, 2) for i in range(5)],
    L(47, 72, 47, 40, 6),
    L(91, 72, 91, 40, 6),
]
# Der raue Schrei: eine hohe, aufsteigende raue Linie unter einem weiten
# Atembogen — klingt gequält, bleibt getragen.
S["sludge_vocals_verzweiflung"] = [
    ARC(60, 64, 40, 20, 160, 2),
    P(roughpath(18, 102, 74, 7, step=2.8, seed=37, env=lambda t: 0.4 + 0.6 * t), 4),
]
# Blast-Übergänge: zwei Raster verschiedener Dichte, an der Naht ein
# markierter Schaltpunkt — die Naht ist das Ereignis.
S["grind_blast_uebergaenge"] = [
    L(12, 74, 108, 74, 2.5),
    *[L(16 + i * 7, 74, 16 + i * 7, 54, 2.5) for i in range(6)],
    C(60, 64, 5, 2.5),
    *[L(70 + i * 12, 74, 70 + i * 12, 46, 4) for i in range(4)],
]
# Verzahnung im Extremtempo: schwere Skelett-Striche greifen exakt in die
# Lücken einer feinen Textur — zwei Stimmen, eine Wand.
S["grind_bass_verzahnung"] = [
    *[L(18 + i * 24, 42, 18 + i * 24, 66, 6) for i in range(4)],
    *[L(30 + i * 24, 54, 30 + i * 24, 78, 2.2) for i in range(4)],
    L(12, 90, 108, 90, 2.5),
]

# ================= GENRE-EINSTEIGER + PV-VERTIEFUNG =================

# Genrekunde: eine Wurzel verzweigt in eine schnelle (dichte Ticks) und eine
# langsame Linie (schwerer Strich) — die Landkarte der Familie.
S["genrekunde_extreme_familie"] = [
    L(60, 96, 60, 66, 4),
    P("M60,66 L34,46", 3), P("M60,66 L86,46", 3),
    *[L(22 + i * 8, 40, 22 + i * 8, 26, 2.5) for i in range(4)],
    L(78, 33, 104, 33, 6),
]
# Das erste Sludge-Riff: zwei schwere Blöcke mit breiter Lücke — zwei Akkorde,
# volles Gewicht, die Stille dazwischen gehört dazu.
S["sludge_erstes_riff"] = [
    RECT(16, 48, 30, 26, filled=True),
    RECT(74, 56, 30, 26, filled=True),
    L(12, 92, 108, 92, 2.5),
]
# Das Stopp-Spiel: laufender Puls, harte Lücke mit Hohlkreisen (gezählte
# Stille), entschlossener Wiedereinstieg.
S["pv_stopp_spiel"] = [
    *[L(16 + i * 9, 74, 16 + i * 9, 52, 3.5) for i in range(4)],
    C(60, 63, 4, 2.2), C(74, 63, 4, 2.2),
    L(88, 74, 88, 44, 6),
    L(12, 74, 108, 74, 2.5),
]
# Ausbrüche in Serie: kurze steile Salven-Spitzen mit Stille dazwischen,
# darunter der ruhige Stütz-Bogen — vorbereiteter Einsatz.
S["pv_vocals_ausbruch"] = [
    TRI([(20, 68), (28, 68), (24, 40)]),
    TRI([(48, 68), (56, 68), (52, 40)]),
    TRI([(76, 68), (84, 68), (80, 40)]),
    ARC(60, 76, 40, 200, 340, 2.5),
]
# Zustände schalten: dichte Fläche und massiver Block, getrennt durch eine
# harte Schnittkante — zwei Welten, ein Schlag.
S["pv_gitarre_zustaende"] = [
    P(wavepath(14, 52, 60, 9, 4.5, step=1.4), 2),
    L(58, 34, 58, 86, 4),
    RECT(68, 44, 36, 32, filled=True),
]
# Die Säge führen: eine lange, gleichmäßig raue Schnittlinie mit Abwärts-Keilen —
# Downpicking-Ausdauer unter Zerre.
S["crust_gitarre_saege"] = [
    P(roughpath(12, 108, 56, 8, step=2.8, seed=61), 3.5),
    TRI([(28, 74), (36, 74), (32, 88)]),
    TRI([(56, 74), (64, 74), (60, 88)]),
    TRI([(84, 74), (92, 74), (88, 88)]),
]
# Die zweite Säge: zwei parallele raue Linien, die untere schwerer — exakt
# übereinander, eine Wand.
S["crust_bass_wand"] = [
    P(roughpath(12, 108, 44, 7, step=2.8, seed=67), 2.5),
    P(roughpath(12, 108, 72, 7, step=2.8, seed=67), 5),
]

# ================= SOUND-&-GEAR-KAPITEL (ausruestung) =================
# Kästen = Geräte/Kettenglieder · Linien = Signalweg · Rauigkeit = Zerre/Noise ·
# Ticks/Balken = Pegel · Bögen = Raum.

# Signalkette: drei Kettenglieder, seriell verbunden — vom Instrument zum Ton.
S["signalkette_grundlagen"] = [
    L(12, 60, 26, 60, 2.5),
    RECT(26, 48, 20, 24, filled=False),
    L(46, 60, 58, 60, 2.5),
    RECT(58, 48, 20, 24, filled=False),
    L(78, 60, 90, 60, 2.5),
    RECT(90, 48, 20, 24, filled=True),
]
# Verzerrer-Typen: dieselbe Welle dreimal — clean, geclippt, zersägt.
S["verzerrer_typen"] = [
    P(wavepath(14, 106, 34, 8, 2.2, step=2.0), 2.2),
    P("M14,62 L24,54 L34,54 L38,70 L48,70 L52,54 L62,54 L66,70 L76,70 L80,54 L90,54 L94,70 L106,70", 2.5),
    P(roughpath(14, 106, 94, 8, step=2.4, seed=77), 3),
]
# Saiten & Tunings: vier Saiten wachsender Stärke — Tuning und Stärke gehören zusammen.
S["saiten_tunings_standards"] = [
    L(14, 36, 106, 36, 1.5),
    L(14, 54, 106, 54, 2.5),
    L(14, 72, 106, 72, 4),
    L(14, 90, 106, 90, 6),
]
# Proberaum-Pegel: Schallkeil trifft auf den Schutzbalken — die Wellen dahinter
# bleiben klein.
S["proberaum_pegel"] = [
    TRI([(14, 46), (14, 74), (52, 60)]),
    ARC(52, 60, 14, -35, 35, 2.5),
    ARC(52, 60, 22, -35, 35, 2),
    L(84, 36, 84, 84, 6),
    ARC(90, 60, 8, -30, 30, 2),
]
# Thrash-Attack: harte Zickzack-Kante über einem straffen Tick-Raster.
S["sound_thrash_attack"] = [
    P("M14,52 L30,32 L46,52 L62,32 L78,52 L94,32 L106,44", 3.5),
    *[L(20 + i * 12, 72, 20 + i * 12, 88, 3.5) for i in range(7)],
]
# Death-Wand: massiver Block mit rau gesägter Oberkante.
S["sound_death_wall"] = [
    RECT(18, 56, 84, 36, filled=True),
    P(roughpath(18, 102, 50, 6, step=2.6, seed=83), 3),
]
# Black-Frost: dünne, aufsteigende raue Linien — sirrende Fläche, offener Raum.
S["sound_black_frost"] = [
    P(roughpath(14, 96, 78, 4, step=3.0, seed=91, env=lambda t: 0.5 + 0.5 * t), 1.8),
    P(roughpath(20, 102, 58, 4, step=3.0, seed=92, env=lambda t: 0.5 + 0.5 * t), 1.8),
    P(roughpath(26, 108, 38, 4, step=3.0, seed=93, env=lambda t: 0.5 + 0.5 * t), 1.8),
]
# Core-tight: dichte Chug-Blöcke, dazwischen vom Gate erzwungene absolute Stille.
S["sound_core_tight"] = [
    RECT(14, 48, 18, 24, filled=True),
    RECT(38, 48, 10, 24, filled=True),
    L(56, 40, 56, 80, 2),
    L(64, 40, 64, 80, 2),
    RECT(72, 48, 18, 24, filled=True),
    RECT(96, 48, 10, 24, filled=True),
]
# Pedalboard-Logik: Kettenglieder in Reihe, das letzte hängt im Loop-Bogen.
S["pedalboard_logik"] = [
    L(12, 66, 20, 66, 2),
    RECT(20, 56, 16, 20, filled=False),
    L(36, 66, 44, 66, 2),
    RECT(44, 56, 16, 20, filled=False),
    L(60, 66, 68, 66, 2),
    RECT(68, 56, 16, 20, filled=True),
    ARC(76, 44, 22, 20, 160, 2),
    C(96, 40, 4, 2.2),
]
# Modeler & Reamping: ein Signal teilt sich auf zwei Wege — Amp (gefüllt) und
# Modeler (Umriss), beide gültig.
S["modeler_reamping"] = [
    L(14, 60, 44, 60, 2.5),
    C(44, 60, 4, fill=True),
    P("M44,60 L66,40", 2.5),
    P("M44,60 L66,80", 2.5),
    RECT(66, 28, 26, 22, filled=True),
    RECT(66, 70, 26, 22, filled=False),
]
# Noise-Management: raues Signal läuft durch die Kette und kommt sauber heraus.
S["noise_management"] = [
    P(roughpath(12, 52, 60, 9, step=2.6, seed=97), 2.5),
    RECT(52, 44, 16, 32, filled=False),
    L(68, 60, 108, 60, 3),
]
# Tuning-Landkarte: vier Saitenlagen absteigender Höhe — die Genres wohnen
# auf verschiedenen Tiefen-Stufen.
S["tuning_landkarte"] = [
    L(14, 34, 62, 34, 2),
    L(38, 54, 86, 54, 3),
    L(58, 74, 106, 74, 4.5),
    L(14, 94, 106, 94, 6),
]
# Backline-Ausfallsicherheit: der Hauptweg läuft — darunter liegt der
# gestrichelte Ersatzweg bereit.
S["backline_ausfallsicherheit"] = [
    L(12, 48, 108, 48, 4),
    *[L(14 + i * 16, 78, 22 + i * 16, 78, 3) for i in range(6)],
    C(108, 48, 4, fill=True),
]

TRANCHE3_IDS = ["doom_sustain_feedback", "doom_bass_fuzz", "doom_drums_zeitdehnung",
                "doom_vocals_getragen", "doom_harmonik", "doom_dramaturgie",
                "doom_sound_gewicht", "doom_band_zeitgefuehl",
                "hardcore_groove_bounce", "hardcore_bass_motor", "hardcore_drums_energie",
                "hardcore_gangshouts", "hardcore_songwriting_direkt", "hardcore_buehne_community",
                "crust_dbeat_ausbau", "crust_sound_dreck", "crust_vocals_rau",
                "grind_riff_reduktion", "grind_vocals_wechsel", "grind_kompression",
                "pv_start_stopp", "pv_miniatur_dramaturgie", "pv_band_abrisskanten",
                "sludge_riffing_dreck", "sludge_drums_hinterm_beat", "sludge_vocals_verzweiflung",
                "grind_blast_uebergaenge", "grind_bass_verzahnung",
                "genrekunde_extreme_familie", "sludge_erstes_riff", "pv_stopp_spiel",
                "pv_vocals_ausbruch", "pv_gitarre_zustaende",
                "crust_gitarre_saege", "crust_bass_wand",
                "signalkette_grundlagen", "verzerrer_typen", "saiten_tunings_standards",
                "proberaum_pegel", "sound_thrash_attack", "sound_death_wall",
                "sound_black_frost", "sound_core_tight", "pedalboard_logik",
                "modeler_reamping", "noise_management", "backline_ausfallsicherheit", "tuning_landkarte"]
assert sorted(TRANCHE3_IDS) == sorted(S), sorted(set(TRANCHE3_IDS) ^ set(S))

for bid in TRANCHE3_IDS:
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

print(f"{len(TRANCHE3_IDS)} Genre-SVGs + {erzeugt} Fehlerbild-SVGs (Tranche 3) erzeugt, alle XML-wohlgeformt.")
