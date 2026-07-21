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

# ================= DRUMS-GEAR-KAPITEL (schlagzeug+ausruestung) =================
# Kreise = Trommeln/Becken · Radiallinien = Stimmschrauben · Bögen = Ausklang.

# Kit-Ergonomie: drei Trommeln bequem um den Spielpunkt gruppiert.
S["kit_ergonomie"] = [
    C(60, 78, 12, 3),
    C(34, 50, 10, 2.5),
    C(86, 50, 10, 2.5),
    C(60, 78, 3, fill=True),
]
# Felle: Trommel im Querschnitt — Schlagfell oben, Resonanzfell unten (dünner).
S["felle_grundlagen"] = [
    L(24, 40, 96, 40, 5),
    L(24, 80, 96, 80, 2.5),
    L(24, 40, 24, 80, 2),
    L(96, 40, 96, 80, 2),
]
# Stimmen: Trommel von oben mit Stimmschrauben im Kreis — über Kreuz gespannt.
S["drum_stimmen_basis"] = [
    C(60, 60, 30, 3),
    *[C(60 + 30 * math.cos(math.radians(a)), 60 - 30 * math.sin(math.radians(a)), 4, fill=True)
      for a in range(0, 360, 45)],
]
# Beckentypen: drei Becken verschiedener Größe (Hi-Hat-Paar, Crash, Ride) auf
# der Ständer-Linie.
S["becken_typen"] = [
    L(12, 92, 108, 92, 2),
    ARC(30, 60, 16, 200, 340, 3), ARC(30, 66, 16, 200, 340, 2),
    L(30, 66, 30, 92, 2.5),
    ARC(66, 54, 12, 200, 340, 3), L(66, 60, 66, 92, 2.5),
    ARC(96, 58, 20, 200, 340, 3.5), L(96, 66, 96, 92, 2.5),
]
# Fellwahl nach Genre: dieselbe Trommel zweimal — kurzer Attack (Punkt) gegen
# langen Ausklang (Bogen).
S["felle_sound_genre"] = [
    C(34, 60, 16, 2.5), C(34, 60, 4, fill=True),
    C(84, 60, 16, 2.5),
    ARC(84, 60, 24, 300, 60, 2),
    ARC(84, 60, 30, 310, 50, 1.5),
]
# Dämpfung & Definition: Trommelkreis mit Dämpf-Punkt am Rand — der wilde
# Oberton (raue Kurve) wird gezähmt.
S["daempfung_definition"] = [
    C(60, 60, 28, 3),
    RECT(78, 44, 8, 8, filled=True),
    P(roughpath(40, 80, 60, 5, step=3.0, seed=111), 1.8),
]
# Fußmaschinen: Trittbrett, Feder (Zickzack) und Schlägel am Drehpunkt.
S["fussmaschinen"] = [
    L(20, 88, 60, 80, 5),
    C(60, 80, 4, fill=True),
    P("M60,80 L74,44", 3.5),
    C(74, 40, 6, fill=True),
    P("M84,84 L88,74 L84,66 L88,58 L84,50", 2),
]
# Hardware & Stabilität: breit gespreiztes Dreibein — steht bombenfest.
S["hardware_stabilitaet"] = [
    L(60, 20, 60, 68, 4),
    L(60, 68, 30, 100, 3.5),
    L(60, 68, 90, 100, 3.5),
    L(60, 68, 60, 100, 3.5),
    L(48, 84, 72, 84, 2),
]
# Trigger & E-Drums: Trommel mit Sensor am Rand, aus dem ein Signal-Impuls
# (Rechteck-Welle) austritt.
S["trigger_edrums"] = [
    C(44, 60, 24, 2.5),
    RECT(62, 54, 8, 12, filled=True),
    P("M70,60 L78,60 L78,46 L86,46 L86,60 L94,60 L94,46 L102,46", 2.5),
]
# Wartung & Ausfallsicherheit: das Set steht — daneben liegt das Ersatzteil
# (Stick-Paar) griffbereit.
S["drums_wartung_backup"] = [
    C(46, 62, 22, 3),
    C(46, 62, 3, fill=True),
    L(84, 40, 96, 92, 4),
    L(94, 40, 106, 92, 4),
]

# ================= DEATHCORE-ACHSE (stil-deathcore, fortgeschritten) =================
# Deathcore: maximaler Kontrast — Chaos (dicht) stürzt in den Breakdown (schwer, leer).

# Breakdown als Waffe: dichtes Chaos links, harte Abrisskante, dann synkopierte
# schwere Einschläge mit viel Stille.
S["deathcore_breakdown_wucht"] = [
    P(wavepath(14, 48, 60, 9, 5, step=1.4), 2),
    L(52, 34, 52, 86, 4),
    RECT(60, 46, 10, 28, filled=True),
    RECT(82, 54, 10, 28, filled=True),
    RECT(98, 46, 8, 28, filled=True),
]
# Tiefes Fundament: eine sehr schwere Grundlinie, darüber synkopierte
# Akzent-Blöcke, die exakt darauf sitzen.
S["deathcore_bass_fundament"] = [
    L(14, 88, 106, 88, 7),
    RECT(22, 52, 12, 24, filled=True),
    RECT(52, 52, 12, 24, filled=True),
    RECT(84, 52, 12, 24, filled=True),
    L(28, 88, 28, 76, 2), L(58, 88, 58, 76, 2), L(90, 88, 90, 76, 2),
]
# Gravity-Blast & Breakdown: extrem dichtes Blast-Raster kippt in wenige
# schwere Einschläge.
S["deathcore_gravity_blast"] = [
    L(12, 60, 54, 60, 2),
    *[L(14 + i * 5, 60, 14 + i * 5, 44, 2) for i in range(8)],
    *[L(14 + i * 5, 60, 14 + i * 5, 76, 2) for i in range(8)],
    L(58, 36, 58, 84, 3.5),
    L(74, 44, 74, 76, 6), L(92, 44, 92, 76, 6),
]
# Gutturals, Highs & Squeals: extreme Bandbreite — tiefe schwere Welle, hohe
# raue Spitze, dazwischen der quiekende Squeal (kleiner Kringel).
S["deathcore_gutturals_squeals"] = [
    P(wavepath(14, 106, 90, 8, 1.5, step=2.0), 5),
    P(roughpath(16, 70, 34, 6, step=2.4, seed=131), 2.2),
    C(90, 30, 5, 2), ARC(90, 30, 9, 20, 200, 1.5),
]
# Riff-Dissonanz & Slam: enge Cluster-Reibung (raue Doppellinie) über einem
# schweren Slam-Block.
S["deathcore_riff_dissonanz"] = [
    P(roughpath(16, 104, 42, 5, step=2.6, seed=137), 2.5),
    P(roughpath(16, 104, 52, 5, step=2.6, seed=138), 2.5),
    RECT(30, 66, 60, 24, filled=True),
]
# Chaos & Entladung: eine Spannungskurve steigt dicht an und entlädt sich in
# einen schweren Abfall-Block.
S["deathcore_dynamik_dramaturgie"] = [
    P(roughpath(14, 74, 60, 9, step=2.4, seed=143, env=lambda t: 0.4 + 0.6 * t), 2.2),
    L(74, 30, 74, 90, 3),
    RECT(80, 66, 26, 24, filled=True),
]
# Sound: Tiefe, Gate & Definition — schweres Fundament, ein schwerer Ton, harte
# Gate-Kante in die Stille, dahinter der clicky, definierte Impuls.
S["deathcore_sound_gear"] = [
    L(14, 92, 106, 92, 6),
    RECT(20, 54, 16, 30, filled=True),
    L(44, 38, 44, 92, 3.5),
    L(70, 66, 70, 48, 3.5), C(70, 44, 3, fill=True),
    P(roughpath(80, 104, 60, 3, step=2.4, seed=501), 1.6),
]
# Körper: Intensität ohne Verschleiß — dichte, intensive Belastung unter einem
# schützenden Bogen (Aufwärmen/Schonung), ein Ruhe-/Stopp-Punkt.
S["deathcore_koerper_intensitaet"] = [
    P(roughpath(16, 104, 68, 10, step=2.0, seed=507), 2.2),
    ARC(60, 68, 42, 20, 160, 3),
    C(60, 92, 4, fill=True),
]

# ================= DJENT-ACHSE (stil-djent, fortgeschritten) =================
# Djent / Prog-Metalcore: gerader Puls unten, verschobene Gruppierung oben —
# perkussive Chugs (gefüllte Blöcke), ungerade Pakete (5+3), Kontrast Dichte↔Raum.

# Pocket, Chug & Polymetrik: gleichmäßiger Puls (Ticks) unten, darüber verschobene
# Chug-Pakete (5er + 3er) als kurze schwere Blöcke.
S["djent_gitarre_pocket"] = [
    L(12, 92, 108, 92, 2),
    *[L(16 + i * 12, 92, 16 + i * 12, 86, 2) for i in range(8)],
    *[RECT(16 + i * 9, 44, 5, 26, filled=True) for i in range(5)],
    *[RECT(74 + i * 9, 44, 5, 26, filled=True) for i in range(3)],
]
# Lock, Tiefe & Groove: schweres tiefes Fundament, darauf exakt verzahnte
# Akzent-Blöcke in ungerader Verteilung (Lock-Marker zur Grundlinie).
S["djent_bass_lock"] = [
    L(12, 90, 108, 90, 7),
    RECT(20, 52, 10, 30, filled=True), RECT(46, 52, 10, 30, filled=True),
    RECT(64, 52, 10, 30, filled=True), RECT(90, 52, 10, 30, filled=True),
    L(25, 90, 25, 82, 2), L(51, 90, 51, 82, 2), L(69, 90, 69, 82, 2), L(95, 90, 95, 82, 2),
]
# Polymetrik, Pocket & Ghost Notes: oben gerader Hi-Hat-Puls, unten verschobene
# Kick (Punkte, 5+3), dazwischen Ghost Notes (Hohlkreise).
S["djent_drums_polymetrik"] = [
    L(12, 34, 108, 34, 2),
    *[L(16 + i * 12, 34, 16 + i * 12, 26, 2.5) for i in range(8)],
    L(12, 92, 108, 92, 2),
    *[C(16 + i * 9, 92, 3, fill=True) for i in range(5)],
    *[C(74 + i * 9, 92, 3, fill=True) for i in range(3)],
    C(40, 63, 4, 2), C(82, 63, 4, 2),
]
# Clean, Harsh & Phrasierung: ruhiger langer Clean-Bogen oben, raue Harsh-Linie
# unten, dazwischen der Atembogen.
S["djent_vocals_dynamik"] = [
    P(wavepath(14, 106, 44, 12, 1.0, step=2.0), 3),
    ARC(60, 64, 30, 200, 340, 1.8),
    P(roughpath(14, 106, 86, 8, step=2.4, seed=211), 2.5),
]
# Polymetrik & Gruppierung: gleichmäßiges Puls-Raster (16 Ticks), darüber die
# Gruppierungs-Bögen 5+5+3+3 — ungerade Betonung über geradem Boden.
S["djent_theorie_polymetrik"] = [
    L(12, 84, 108, 84, 2),
    *[L(14 + i * 6, 84, 14 + i * 6, 74, 2) for i in range(16)],
    ARC(26, 72, 13, 20, 160, 2), ARC(56, 72, 13, 20, 160, 2),
    ARC(80, 72, 7, 20, 160, 2), ARC(98, 72, 7, 20, 160, 2),
]
# Härte & Raum: links dichter, harter Chug-Cluster, rechts offener Raum mit einer
# einzelnen klingenden Welle — der Kontrast trägt die Musik.
S["djent_dramaturgie_raum"] = [
    *[RECT(16 + i * 8, 46, 5, 34, filled=True) for i in range(5)],
    L(64, 32, 64, 92, 2.5),
    P(wavepath(72, 106, 62, 12, 1.0, step=2.0), 3),
]
# Sound: Attack, Definition & Tightness — definierter Boden, scharfe Transienten
# (Attack-Spikes), Gate-Kante, dahinter tighte trockene Chug-Blöcke.
S["djent_sound_gear"] = [
    L(14, 92, 106, 92, 5),
    L(24, 92, 24, 48, 3.5), C(24, 44, 2.5, fill=True),
    L(42, 92, 42, 60, 3), C(42, 56, 2, fill=True),
    L(58, 38, 58, 92, 3),
    *[RECT(68 + i * 11, 62, 6, 24, filled=True) for i in range(3)],
]
# Körper: Präzision aus Lockerheit — ein präzises, tightes Raster unter einem
# schützenden Bogen (Lockerheit/Schonung), ein Ruhe-/Stopp-Punkt.
S["djent_koerper_praezision"] = [
    L(14, 88, 106, 88, 2),
    *[L(20 + i * 11, 88, 20 + i * 11, 74, 2.5) for i in range(8)],
    ARC(60, 74, 40, 20, 160, 3),
    C(60, 96, 4, fill=True),
]

# ================= STONER / POST-METAL-ACHSE (stil-stoner_post, fortgeschritten) =====
# Stoner: fuzziger Groove, Riff-Ökonomie, Bluesfarbe (Rauigkeit + Punkte + Bögen).
# Post-Metal: Dynamik & Langform — anschwellende Hüllkurven von der Stille zur Wand.

# Fuzz, Groove & Riff: gefuzzte Textur über wenigen schweren Chugs mit einer
# bewussten Lücke, abgeschlossen von einem Blues-Bending-Bogen.
S["stoner_riff_fuzz"] = [
    P(roughpath(16, 92, 42, 5, step=2.6, seed=311), 2.2),
    RECT(20, 58, 12, 24, filled=True), RECT(40, 58, 12, 24, filled=True),
    RECT(78, 58, 12, 24, filled=True),
    ARC(70, 70, 12, 30, 150, 2.5),
]
# Fuzz-Bass: schweres warmes Fundament, darüber eine bewegte, gefuzzte Linie,
# darauf der Groove-Puls (Punkte).
S["stoner_bass_fuzz_groove"] = [
    L(14, 84, 106, 84, 6),
    P(roughpath(16, 104, 56, 8, step=3.0, seed=317), 2.5),
    C(30, 84, 3, fill=True), C(60, 84, 3, fill=True), C(90, 84, 3, fill=True),
]
# Groove, Dynamik & Aufbau: anschwellende Ticks (leise → laut, Crescendo),
# früh ein paar leise Ghost Notes (Hohlkreise).
S["postmetal_drums_crescendo"] = [
    L(12, 90, 108, 90, 2),
    *[L(16 + i * 8, 90, 16 + i * 8, 90 - (6 + i * 4.5), 2 + i * 0.35) for i in range(12)],
    C(24, 80, 3, 1.5), C(40, 76, 3, 1.5),
]
# Atmosphäre & Klimax: ruhige Clean-Welle links, ein einzelner rauer
# Klimax-Ausbruch rechts, darüber ein weiter Atembogen.
S["postmetal_vocals_dynamik"] = [
    P(wavepath(14, 80, 62, 8, 1.5, step=2.0), 2.5),
    ARC(48, 44, 30, 200, 340, 1.6),
    P(roughpath(86, 106, 60, 20, step=2.2, seed=331), 3),
]
# Riff-Ökonomie & Bluesfarbe: wenige Töne (Punkte) auf einer Linie, dazwischen
# ein Bending-Bogen in die Blue Note.
S["stoner_riff_harmonik"] = [
    L(14, 78, 106, 78, 2),
    C(24, 78, 5, fill=True), C(52, 78, 5, fill=True), C(88, 78, 5, fill=True),
    ARC(70, 78, 18, 20, 160, 2.5),
    ARC(24, 64, 8, 30, 150, 1.8),
]
# Langform & Geduld: eine lange, geduldig anschwellende Welle von der Stille bis
# zur Wand (gefülltem Block) am Ende.
S["postmetal_langform_geduld"] = [
    P(wavepath(14, 100, 62, 30, 3, step=1.6, env=lambda t: 0.1 + 0.9 * t), 2.5),
    RECT(96, 40, 10, 44, filled=True),
]
# Sound: Fuzz, Wärme & Flächen — warmer, rauer Fuzz-Ton über mittigem Fundament,
# rechts die abklingenden Delay/Reverb-Echos (Flächen).
S["stoner_sound_gear"] = [
    P(roughpath(14, 68, 54, 8, step=2.6, seed=521), 2.5),
    L(14, 90, 68, 90, 5),
    *[C(78 + i * 9, 58, 5.5 - i, 2) for i in range(4)],
]
# Körper: Ausdauer über die Langform — eine lange, langsam anschwellende Linie
# unter einem schützenden Bogen, ein Stopp-/Ruhepunkt.
S["postmetal_koerper_ausdauer"] = [
    P(wavepath(14, 106, 66, 7, 2.5, step=2.0, env=lambda t: 0.45 + 0.55 * t), 2.5),
    ARC(60, 66, 42, 20, 160, 3),
    C(60, 92, 4, fill=True),
]

# ================= GENRE-ÜBERGREIFEND (genreuebergreifend, gemischt) =================
# Meta-Ebene quer zu den Genres: hören/unterscheiden, verschmelzen, dieselbe Idee
# (Riff, Groove, Rolle, Register) in mehreren Genre-Farben, Set-Bogen über Genres.

# Genres am Klang erkennen: ein lauschender Bogen links, rechts drei klar
# unterscheidbare Signaturen (klingend, rau, gepulst).
S["genre_hoeren_erkennen"] = [
    ARC(34, 60, 18, 60, 300, 4), C(34, 60, 5, fill=True),
    P(wavepath(56, 106, 40, 7, 2.5, step=2.0), 2),
    P(roughpath(56, 106, 62, 7, step=2.4, seed=401), 2),
    *[L(58 + i * 8, 86, 58 + i * 8, 76, 3) for i in range(7)],
]
# Crossover & Fusion: zwei Linien laufen zusammen und verschmelzen zu einer
# schwereren.
S["genre_fusion_crossover"] = [
    P("M12,40 L56,60", 3),
    P("M12,80 L56,60", 3),
    C(56, 60, 5, fill=True),
    P("M56,60 L108,60", 5),
]
# Ein Riff, mehrere Genres: dasselbe Drei-Ton-Motiv in drei Behandlungen
# (tight, schwer/weit, dreckig).
S["transfer_riff_genrefarbe"] = [
    *[RECT(16 + i * 7, 28, 4, 14, filled=True) for i in range(3)],
    *[RECT(16 + i * 16, 52, 8, 20, filled=True) for i in range(3)],
    *[RECT(16 + i * 10, 88, 5, 14, filled=True) for i in range(3)],
    P(roughpath(14, 44, 84, 4, step=2.2, seed=411), 1.6),
]
# Einen Groove umfärben: dieselbe Zeitachse, drei Verteilungen — gleichmäßig,
# sparsam (Halftime), dicht (Blast).
S["transfer_groove_genrefarbe"] = [
    L(14, 34, 106, 34, 1.5), *[C(20 + i * 12, 34, 2.5, fill=True) for i in range(8)],
    L(14, 62, 106, 62, 1.5), C(22, 62, 3, fill=True), C(60, 62, 3, fill=True), C(98, 62, 3, fill=True),
    L(14, 90, 106, 90, 1.5), *[C(18 + i * 6, 90, 2, fill=True) for i in range(16)],
]
# Die Rolle wechseln: durchgehendes Fundament, darüber drei Rollen-Marker —
# Gewicht (Block), Skelett (Punkte), bewegliche Stimme (raue Linie).
S["transfer_bass_rollen"] = [
    L(14, 88, 106, 88, 6),
    RECT(16, 40, 22, 20, filled=True),
    *[C(48 + i * 5, 50, 2.5, fill=True) for i in range(7)],
    P(roughpath(84, 106, 50, 7, step=2.4, seed=421), 2.2),
]
# Register nach Genre: drei Stimmfarben — tief/getragen (schwere Welle), hohe
# Screams (Spitzen), rauer Shout (raue Linie).
S["transfer_vocals_genrefarbe"] = [
    P(wavepath(14, 106, 40, 6, 1.2, step=2.0), 4),
    *[L(20 + i * 12, 66, 26 + i * 12, 54, 2.5) for i in range(7)],
    P(roughpath(14, 106, 88, 7, step=2.2, seed=431), 2.2),
]
# Ein Set über Genres: eine Energiekurve über die Zeit, darunter kontrastierende
# Genre-Blöcke unterschiedlicher Dichte.
S["set_ueber_genres"] = [
    P("M12,88 L30,50 L48,70 L70,32 L92,60 L108,44", 2.5),
    *[L(16 + i * 3, 100, 16 + i * 3, 92, 2) for i in range(6)],
    RECT(52, 92, 14, 8, filled=True),
    *[C(80 + i * 6, 96, 2, fill=True) for i in range(4)],
]

# ================= EXPERTE-VERTIEFUNG (experte, mehrere Domänen) =================
# Fortgeschrittene Technik & Komposition: fließende Linien, Schichten, Bögen.

# Tapping & Legato: eine durchgehende, fließende Linie mit getappten Punkten darauf.
S["gitarre_tapping_legato"] = [
    P(wavepath(14, 106, 60, 16, 2.5, step=2.0), 2.5),
    C(30, 52, 3, fill=True), C(60, 68, 3, fill=True), C(90, 52, 3, fill=True),
]
# Pinch-/Kunstharmonics: ein Ton spitzt in einen hohen Oberton — Stiel, Kringel,
# ausstrahlende Schärfe.
S["gitarre_kunstharmonics"] = [
    L(40, 94, 40, 50, 4),
    C(40, 42, 6, 2.5), C(40, 42, 2.5, fill=True),
    L(52, 34, 62, 28, 2), L(54, 46, 66, 44, 2), L(50, 24, 56, 16, 2),
    P(roughpath(70, 106, 60, 4, step=2.4, seed=601), 1.8),
]
# Lead-Bass: schweres tiefes Fundament tritt nach oben in eine melodische Welle.
S["bass_lead_melodisch"] = [
    L(14, 92, 54, 92, 6),
    P("M54,92 L64,64", 3),
    P(wavepath(64, 106, 52, 12, 1.5, step=2.0), 2.5),
]
# Lineares Spiel: eine einzige Linie zickzackt zwischen zwei Ebenen (Hand/Fuß),
# nie gleichzeitig — dazu Ghost Notes (Hohlkreise).
S["drums_lineares_spiel"] = [
    P("M14,48 L26,84 L38,48 L50,84 L62,48 L74,84 L86,48 L98,84 L108,48", 2.5),
    C(32, 66, 3, 1.8), C(68, 66, 3, 1.8),
]
# Nahtlose Register-Übergänge: eine glatte Welle geht bruchlos in eine raue über.
S["harsh_uebergaenge_nahtlos"] = [
    P(wavepath(14, 60, 60, 12, 2.0, step=2.0), 2.8),
    P(roughpath(60, 106, 60, 12, step=2.2, seed=607), 2.8),
    C(60, 60, 3, fill=True),
]
# Schichten arrangieren: eine tragende Hauptlinie (dick) plus dünnere Schichten
# darüber und darunter.
S["harsh_arrangement_schichten"] = [
    L(14, 60, 106, 60, 6),
    L(14, 44, 106, 44, 2),
    L(14, 76, 106, 76, 2.5),
    L(14, 32, 106, 32, 1.5),
]
# Langform & Arrangement: ein großer Bogen über die ganze Form, darunter die
# Teile als Blöcke unterschiedlicher Länge, ein wiederkehrendes Motiv (Punkt).
S["komposition_langform"] = [
    ARC(60, 84, 46, 20, 160, 2.5),
    RECT(14, 88, 20, 10, filled=True), RECT(40, 88, 30, 10, filled=True),
    RECT(76, 88, 14, 10, filled=True), RECT(96, 88, 10, 10, filled=True),
    C(24, 70, 3, fill=True), C(90, 70, 3, fill=True),
]
# Improvisation: ein kleines Motiv, variiert wiederholt, mit einer Pause (Lücke).
S["gitarre_improvisation"] = [
    P("M14,70 L20,54 L26,62", 2.5),
    P("M40,70 L46,50 L52,60", 2.5),
    P("M88,70 L94,58 L100,64", 2.5),
    L(66, 66, 78, 66, 2),
]

# ================= KÖRPER & MENTALES (Querschnitts-Vertiefung) =================
# Gesundheit und Kopf: Gehör, Haltung, Warnung, Puls; Fokus, Nerven, Stufen, Plateau.

# Gehörschutz: lauschendes Ohr, laute raue Welle wird zur gedämpften kleinen,
# dazu der Schutz-Ring (Stöpsel).
S["gehoerschutz_tinnitus"] = [
    ARC(30, 60, 16, 60, 300, 4), C(30, 60, 4, fill=True),
    P(roughpath(50, 78, 48, 12, step=2.2, seed=701), 2.2),
    P(wavepath(86, 108, 60, 4, 2, step=2.0), 2),
    C(72, 40, 7, 2.5),
]
# Haltung & Ergonomie: neutrale, ausgerichtete Achse — Kopf, waagrechte Schultern
# und Hüfte, gerade Wirbelsäule.
S["koerperhaltung_ergonomie"] = [
    C(60, 24, 8, 3),
    L(60, 32, 60, 84, 3),
    L(42, 44, 78, 44, 3),
    L(48, 72, 72, 72, 3),
    L(42, 44, 38, 66, 2), L(78, 44, 82, 66, 2),
]
# Überlastung vermeiden: Warndreieck mit Ausrufezeichen.
S["ueberlastung_praevention"] = [
    P("M60,24 L102,94 L18,94 Z", 3),
    L(60, 50, 60, 74, 4.5),
    C(60, 84, 3, fill=True),
]
# Athletik als Basis: eine Herzschlag-/Ausdauer-Linie.
S["athletik_grundlage"] = [
    L(12, 64, 42, 64, 2),
    P("M42,64 L50,64 L56,38 L64,92 L72,64 L80,64", 2.8),
    L(80, 64, 108, 64, 2),
]
# Lampenfieber: nervöses Zittern links, ruhige Atembögen rechts.
S["lampenfieber"] = [
    P(roughpath(14, 54, 52, 14, step=1.8, seed=711), 2.2),
    ARC(80, 64, 24, 200, 340, 2.5),
    ARC(80, 64, 33, 210, 330, 1.8),
]
# Fokus & Konzentration: eine Zielscheibe.
S["fokus_konzentration"] = [
    C(60, 60, 30, 2), C(60, 60, 18, 2.5), C(60, 60, 6, fill=True),
]
# Motivation & Disziplin: eine gleichmäßig ansteigende Treppe (Gewohnheit).
S["motivation_disziplin"] = [
    P("M14,96 L34,96 L34,78 L54,78 L54,60 L74,60 L74,42 L94,42 L94,24 L108,24", 2.5),
]
# Plateau überwinden: Anstieg, langes Plateau, dann Durchbruch nach oben (Pfeil).
S["plateau_ueberwinden"] = [
    P("M14,88 L36,56 L84,54 L98,52 L108,24", 2.5),
    L(108, 24, 100, 28, 2), L(108, 24, 103, 33, 2),
]

# ================= KONTEXT (umgewidmete Umgebungs-Achse) =================
# Spielsituationen: Proberaum, Bühne, Aufnahme, Solo.

# Proberaum-Effizienz: eine Uhr — die Zeit gezielt nutzen.
S["kontext_proberaum_effizienz"] = [
    C(60, 60, 34, 3),
    L(60, 60, 60, 36, 3),
    L(60, 60, 80, 68, 2.5),
    C(60, 60, 3, fill=True),
]
# Zusammenspiel: zwei einander zugewandte Ohren/Bögen mit gemeinsamem Punkt.
S["kontext_proberaum_zusammenspiel"] = [
    ARC(38, 60, 20, 300, 60, 3.5),
    ARC(82, 60, 20, 120, 240, 3.5),
    C(60, 60, 4, fill=True),
    C(60, 60, 12, 1.5), C(60, 60, 18, 1.5),
]
# Bühnenpräsenz: eine Figur mit Ausstrahlung auf der Bühne.
S["kontext_buehne_praesenz"] = [
    L(20, 96, 100, 96, 3),
    C(60, 40, 8, 3),
    L(60, 48, 60, 78, 3),
    L(60, 56, 44, 66, 2.5), L(60, 56, 76, 66, 2.5),
    L(60, 78, 48, 96, 2.5), L(60, 78, 72, 96, 2.5),
    L(42, 30, 36, 22, 2), L(78, 30, 84, 22, 2), L(60, 24, 60, 14, 2),
]
# Soundcheck & Ablauf: eine Signalkette aus Blöcken und Pfeilen.
S["kontext_buehne_ablauf"] = [
    RECT(14, 52, 18, 16, filled=False),
    P("M33,60 L44,60", 2.5), L(44, 60, 40, 57, 2), L(44, 60, 40, 63, 2),
    RECT(46, 52, 18, 16, filled=False),
    P("M65,60 L76,60", 2.5), L(76, 60, 72, 57, 2), L(76, 60, 72, 63, 2),
    RECT(78, 52, 18, 16, filled=False),
]
# Aufnahme-Tightness: Töne exakt auf dem Raster.
S["kontext_aufnahme_tightness"] = [
    *[L(20 + i * 18, 32, 20 + i * 18, 88, 1.5) for i in range(5)],
    L(14, 60, 106, 60, 2),
    *[C(20 + i * 18, 60, 3.5, fill=True) for i in range(5)],
]
# Vorbereitung: eine Checkliste (Häkchen vor Zeilen).
S["kontext_aufnahme_vorbereitung"] = [
    *[L(42, 36 + i * 20, 100, 36 + i * 20, 2.5) for i in range(3)],
    *[P(f"M20,{36 + i * 20} L27,{42 + i * 20} L36,{28 + i * 20}", 2.5) for i in range(3)],
]
# Solo-Struktur: eine Figur plus geordnete Plan-Blöcke.
S["kontext_solo_struktur"] = [
    C(30, 40, 8, 3), L(30, 48, 30, 76, 3),
    L(30, 56, 22, 66, 2.5), L(30, 56, 38, 66, 2.5),
    RECT(52, 78, 12, 12, filled=True), RECT(70, 66, 12, 24, filled=True), RECT(88, 54, 12, 36, filled=True),
]
# Solo ohne Band: ein Metronom (Pendel).
S["kontext_solo_ohne_band"] = [
    P("M46,96 L60,28 L74,96 Z", 3),
    L(60, 92, 78, 44, 3),
    C(78, 44, 4, fill=True),
]

# ================= CLEAN-GESANG-VERTIEFUNG =================
# Vokabular: Wellen = klingender Ton, Bögen = Atem/Resonanz/Stütze, Rauigkeit =
# Störung/Druck, Punkte = Zielton, parallele Wellen = Mehrstimmigkeit.
S["clean_kopfstimme"] = [
    P(wavepath(16, 104, 44, 9, 2.5, step=2.0), 3),
    ARC(60, 86, 34, 30, 150, 2.5),
]
S["clean_intonation_druck"] = [
    L(16, 50, 104, 50, 4), C(96, 50, 5, fill=True),
    P(wavepath(16, 92, 50, 10, 2.5, step=2.0), 3),
    P(roughpath(16, 104, 88, 6, step=3.0, seed=41), 2),
]
S["clean_vibrato"] = [
    P(wavepath(14, 106, 58, 10, 6, step=2.0), 3.5),
    L(14, 86, 106, 86, 2),
]
S["clean_refrain_hook"] = [
    P(wavepath(16, 104, 66, 20, 1.5, step=2.0, env=lambda t: math.sin(math.pi * t)), 4.5),
    C(60, 44, 4, fill=True),
]
S["clean_belting"] = [
    P(wavepath(20, 100, 46, 15, 2.0, step=2.0), 5),
    ARC(60, 98, 44, 25, 155, 4), ARC(60, 98, 30, 30, 150, 2),
]
S["clean_harmonien"] = [
    P(wavepath(16, 104, 44, 10, 2.0, step=2.0), 3.5),
    P(wavepath(16, 104, 74, 10, 2.0, step=2.0), 3.5),
]

# ================= GENRE-VERTIEFUNG 1 (PV / Crust / Sludge) =================
# PV = Chaos/Bursts (raue Ticks, harte Stops), Crust = D-Beat/Dreck/Haltung
# (Blöcke, Säge), Sludge = zäh/schwer/Fuzz (dicke raue Wellen, Langform).
S["pv_bass_chaos"] = [L(12, 92, 108, 92, 2)]
for x in (18, 27, 36, 45, 54):
    S["pv_bass_chaos"].append(P(roughline(x, 44, x, 88, 3.0, step=6.0, seed=x), 3))
S["pv_bass_chaos"] += [L(92, 40, 92, 92, 7), C(92, 92, 5, fill=True)]
S["pv_koerper_explosivitaet"] = [C(38, 62, 4, fill=True)]
for a in range(0, 360, 45):
    dx = 26 * math.cos(math.radians(a)); dy = 26 * math.sin(math.radians(a))
    S["pv_koerper_explosivitaet"].append(L(38, 62, 38 + dx, 62 - dy, 3))
S["pv_koerper_explosivitaet"].append(L(74, 62, 108, 62, 3))
S["pv_sound_roh"] = [P(roughpath(14, 106, 60, 17, step=3.0, seed=7), 3)]
S["crust_ethos_haltung"] = [
    RECT(42, 58, 36, 34, filled=True),
    L(60, 58, 60, 26, 6), TRI([(52, 30), (68, 30), (60, 18)]),
]
S["crust_songwriting_struktur"] = [L(12, 84, 108, 84, 2)]
for x in (18, 30, 42, 54):
    S["crust_songwriting_struktur"].append(RECT(x, 66, 8, 18, filled=True))
S["crust_songwriting_struktur"].append(RECT(72, 50, 26, 34, filled=True))
S["crust_koerper_ausdauer"] = [L(12, 40, 108, 40, 2)]
S["crust_koerper_ausdauer"].append(P(wavepath(16, 104, 68, 16, 7, step=2.0), 3))
for x in (16, 44, 72, 100):
    S["crust_koerper_ausdauer"].append(L(x, 38, x, 44, 2))
S["sludge_bass_wand"] = [
    P(roughpath(14, 106, 62, 7, step=4.0, seed=3), 8),
    L(14, 88, 106, 88, 4),
]
S["sludge_sound_gear"] = [
    P(roughpath(16, 104, 46, 12, step=3.0, seed=19), 3),
    P(wavepath(16, 104, 84, 12, 1.5, step=2.0), 5),
]
S["sludge_langform"] = [
    P(wavepath(14, 106, 62, 20, 1.0, step=2.0, env=lambda t: 0.4 + 0.6 * t), 5),
    L(14, 92, 106, 92, 2),
]

# ============ GENRE-VERTIEFUNG RUNDE 2 (grind/deathcore/djent/stoner-post) ============
# Grind-Sound „Kreissäge": zwei sehr dichte, raue Linien — maximale Verzerrung/Harsh.
S["grind_sound_buzzsaw"] = [
    P(roughpath(14, 106, 60, 20, step=2.0, seed=113), 3),
    P(roughpath(14, 106, 60, 10, step=2.0, seed=57), 2),
]
# Grind-Haltung: scharfer Schrägschlag (Ansage), kleines X (Anti-Konvention),
# Hohlkreis (die absurde/groteske Seite).
S["grind_ethos_humor"] = [
    L(24, 86, 96, 34, 7),
    L(30, 30, 44, 44, 3), L(44, 30, 30, 44, 3),
    C(90, 82, 7, 2.5),
]
# Grind-Extrem-Vocals: tiefer, schwerer rauer Guttural unten gegen dünnen,
# schnellen Pig-Squeal-Zickzack oben.
S["grind_vocals_extrem"] = [
    P(roughpath(14, 60, 88, 8, step=2.5, seed=41), 6),
    P(wavepath(64, 106, 40, 6, 6, step=1.5), 2),
]
# Deathcore-Downtempo: ein einzelner, riesig schwerer Amboss-Chug, viel schwarzer
# Raum, dann ein zweiter — Wucht aus Leere.
S["deathcore_downtempo"] = [
    L(12, 84, 108, 84, 2.5),
    L(34, 84, 34, 34, 11),
    L(92, 84, 92, 52, 9),
]
# Deathcore-Intro: ruhige, weite Atmosphäre-Welle links, Trennlinie, dann rauhes
# Chaos rechts — Kontrast als Dramaturgie.
S["deathcore_intro_atmosphaere"] = [
    P(wavepath(14, 58, 60, 10, 1.0, step=2.0), 2),
    L(60, 30, 60, 90, 2),
    P(roughpath(64, 106, 60, 18, step=2.0, seed=88), 4),
]
# Deathcore-Ausdauer: gleichmäßige Stimm-Welle über eine Zeitlinie mit Ticks —
# Ökonomie/Durchhalten statt Maximaldruck.
S["deathcore_gesang_ausdauer"] = [
    L(12, 92, 108, 92, 2),
    P(wavepath(14, 106, 58, 12, 5, step=2.0), 3.5),
]
for x in (20, 42, 64, 86, 108):
    S["deathcore_gesang_ausdauer"].append(L(x, 92, x, 88, 2))
# Djent-Ambient: ein angeschlagener Ton (Punkt) mit abklingenden Resonanz-/Delay-
# Bögen nach außen — weite cleane Fläche.
S["djent_gitarre_ambient"] = [C(24, 60, 4, fill=True)]
for i, r in enumerate((14, 22, 30, 38)):
    S["djent_gitarre_ambient"].append(ARC(24, 60, r, 300, 60, 3 - i * 0.6))
# Djent-Lead: singende, melodische Lead-Welle über einer tighten, dichten Chug-
# Pocket unten.
S["djent_solo_lead"] = [
    P(wavepath(16, 104, 42, 15, 1.5, step=2.5), 3),
    L(12, 86, 108, 86, 2),
]
for x in range(18, 107, 11):
    S["djent_solo_lead"].append(L(x, 86, x, 74, 5))
# Djent-Produktion: Doubletracking — zwei identische, gespiegelte Tick-Reihen um
# eine Mittellinie (präzises Editing/Layering).
S["djent_studio_produktion"] = [L(12, 60, 108, 60, 1.5)]
for x in range(20, 105, 12):
    S["djent_studio_produktion"].append(L(x, 40, x, 57, 4))
    S["djent_studio_produktion"].append(L(x, 63, x, 80, 4))
# Stoner-Swing: geschwungene (long-short) Hi-Hat-Ticks über der Zeitlinie, dazu
# Ghost-Notes als Hohlkreise — rollendes, wippendes Feel.
S["stoner_groove_swing"] = [L(12, 74, 108, 74, 2)]
for x in (20, 38, 48, 66, 76, 94):
    S["stoner_groove_swing"].append(L(x, 74, x, 52, 4))
for x in (30, 58, 86):
    S["stoner_groove_swing"].append(C(x, 88, 5, 2))
# Stoner-Jam: ein Seed-Riff (Punkt), aus dem mehrere überlagerte, wandernde Wellen
# hervorgehen — gemeinsames Improvisieren.
S["stoner_jam"] = [
    C(22, 60, 4, fill=True),
    P(wavepath(26, 106, 60, 8, 2.0, step=2.5, phase=0.0), 2.5),
    P(wavepath(26, 106, 60, 14, 1.5, step=2.5, phase=1.6), 2),
    P(wavepath(26, 106, 60, 20, 1.0, step=2.5, phase=3.1), 1.5),
]
# Post-Metal-Texturen: schweres Fundament, darüber anwachsende Klangschichten
# (Hüllkurve steigt), gekrönt von einem Resonanz-/Feedback-Bogen — Aufbau zur Klimax.
S["postmetal_textur_schichten"] = [
    L(14, 98, 106, 98, 6),
    P(wavepath(14, 106, 76, 8, 1.5, step=2.0, env=lambda t: 0.3 + 0.7 * t), 3),
    P(wavepath(14, 106, 54, 10, 2.0, step=2.0, env=lambda t: 0.2 + 0.8 * t), 2.5),
    ARC(60, 42, 30, 20, 160, 2),
]

# ==================== KÖRPER / ATHLETIK-VERTIEFUNG ====================
# Schlaf: aktive Welle klingt aus (Hüllkurve fällt) und geht in eine ruhige
# flache Linie über — Herunterfahren zur Erholung.
S["schlaf_regeneration"] = [
    P(wavepath(14, 70, 60, 16, 2.0, step=2.0, env=lambda t: 1.0 - 0.8 * t), 3),
    L(72, 60, 106, 60, 3),
]
# Ernährung/Hydration: ein Tropfen mit innerer Wasserlinie — Flüssigkeit/Brennstoff.
S["ernaehrung_hydration"] = [
    P("M60,30 C78,54 75,72 60,80 C45,72 42,54 60,30 Z", 3),
    P(wavepath(48, 72, 62, 3, 1.5, step=2.0), 2),
]
# Rumpfkraft: eine tragende, gefüllte Säule (Rumpf) mit Kopfmarker auf breiter,
# stabiler Basis.
S["rumpf_kraft_stabilitaet"] = [
    RECT(52, 32, 16, 54, filled=True),
    L(60, 32, 60, 22, 3), C(60, 17, 5, 2.5),
    L(28, 92, 92, 92, 5),
]
# Mobilität: ein Gelenk (Kreis) mit umlaufenden Rotationsbögen und Pfeilspitze —
# kontrollierte Beweglichkeit.
S["mobilitaet_routine"] = [
    C(60, 60, 8, 3),
    ARC(60, 60, 22, 20, 160, 2.5),
    ARC(60, 60, 22, 200, 340, 2.5),
    TRI([(82, 57), (82, 69), (91, 63)]),
]
# Headbangen: Pendel aus einem Nacken-Drehpunkt, zwei Kopf-Positionen und ein
# Schwungbogen unten — Bewegung aus dem Schwung, nicht aus dem Ruck.
S["headbangen_nacken"] = [
    C(60, 28, 4, fill=True),
    L(60, 28, 40, 72, 3), L(60, 28, 80, 72, 3),
    C(40, 78, 6, 3), C(80, 78, 6, 3),
    ARC(60, 28, 50, 233, 307, 2),
]
# Verletzungs-Reha: Kurve fällt in eine Ruhe-Plateau-Senke (Verletzung/Pause)
# und steigt dann dosiert wieder an — Rückkehr in Schritten.
S["verletzung_reha_rueckkehr"] = [
    P("M14,46 L40,46 L52,86 L72,86 L92,58 L106,52", 3),
    C(62, 86, 3, fill=True),
]
# Deload/Periodisierung: gefüllte Last-Balken steigen an, brechen zum Deload ein
# und bauen wieder auf — gesteuerte Belastung über Wochen.
S["deload_periodisierung"] = [L(12, 92, 108, 92, 2)]
for x, h in zip((20, 32, 44, 56, 68, 80, 92), (22, 32, 44, 54, 18, 32, 44)):
    S["deload_periodisierung"].append(RECT(x - 4, 92 - h, 8, h, filled=True))
# Abwärmen: aktive Welle klingt in eine flache Ruhelinie aus, darunter ein
# ruhiger Atembogen — bewusstes Herunterfahren.
S["abwaermen_koerper"] = [
    P(wavepath(14, 76, 54, 15, 3.0, step=2.0, env=lambda t: 1.0 - 0.7 * t), 3),
    L(78, 54, 106, 54, 3),
    ARC(60, 82, 30, 200, 340, 2),
]

# ==================== WERKZEUGE (Ausrüstung, self-contained) ====================
# Pedalboard: eine Signallinie, darauf drei Pedale (Gehäuse-Rechtecke) mit je zwei
# Reglerpunkten und einem Fußschalter-Kreis — die Kette ist der Sound.
S["pedalboard_grundlagen"] = [L(10, 86, 110, 86, 2)]
for x in (26, 60, 94):
    S["pedalboard_grundlagen"] += [
        RECT(x - 11, 40, 22, 44, filled=False),
        C(x - 5, 50, 2.5, fill=True), C(x + 5, 50, 2.5, fill=True),
        C(x, 70, 5, 2.5),
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
                "modeler_reamping", "noise_management", "backline_ausfallsicherheit", "tuning_landkarte",
                "kit_ergonomie", "felle_grundlagen", "drum_stimmen_basis", "becken_typen",
                "felle_sound_genre", "daempfung_definition", "fussmaschinen", "hardware_stabilitaet",
                "trigger_edrums", "drums_wartung_backup",
                "deathcore_breakdown_wucht", "deathcore_bass_fundament", "deathcore_gravity_blast",
                "deathcore_gutturals_squeals", "deathcore_riff_dissonanz", "deathcore_dynamik_dramaturgie",
                "deathcore_sound_gear", "deathcore_koerper_intensitaet",
                "djent_gitarre_pocket", "djent_bass_lock", "djent_drums_polymetrik",
                "djent_vocals_dynamik", "djent_theorie_polymetrik", "djent_dramaturgie_raum",
                "djent_sound_gear", "djent_koerper_praezision",
                "stoner_riff_fuzz", "stoner_bass_fuzz_groove", "postmetal_drums_crescendo",
                "postmetal_vocals_dynamik", "stoner_riff_harmonik", "postmetal_langform_geduld",
                "stoner_sound_gear", "postmetal_koerper_ausdauer",
                "genre_hoeren_erkennen", "genre_fusion_crossover", "transfer_riff_genrefarbe",
                "transfer_groove_genrefarbe", "transfer_bass_rollen", "transfer_vocals_genrefarbe",
                "set_ueber_genres",
                "gitarre_tapping_legato", "gitarre_kunstharmonics", "bass_lead_melodisch",
                "drums_lineares_spiel", "harsh_uebergaenge_nahtlos", "harsh_arrangement_schichten",
                "komposition_langform", "gitarre_improvisation",
                "gehoerschutz_tinnitus", "koerperhaltung_ergonomie", "ueberlastung_praevention",
                "athletik_grundlage", "lampenfieber", "fokus_konzentration",
                "motivation_disziplin", "plateau_ueberwinden",
                "kontext_proberaum_effizienz", "kontext_proberaum_zusammenspiel",
                "kontext_buehne_praesenz", "kontext_buehne_ablauf",
                "kontext_aufnahme_tightness", "kontext_aufnahme_vorbereitung",
                "kontext_solo_struktur", "kontext_solo_ohne_band",
                "clean_kopfstimme", "clean_intonation_druck", "clean_vibrato",
                "clean_refrain_hook", "clean_belting", "clean_harmonien",
                "pv_bass_chaos", "pv_koerper_explosivitaet", "pv_sound_roh",
                "crust_ethos_haltung", "crust_songwriting_struktur", "crust_koerper_ausdauer",
                "sludge_bass_wand", "sludge_sound_gear", "sludge_langform",
                "grind_sound_buzzsaw", "grind_ethos_humor", "grind_vocals_extrem",
                "deathcore_downtempo", "deathcore_intro_atmosphaere", "deathcore_gesang_ausdauer",
                "djent_gitarre_ambient", "djent_solo_lead", "djent_studio_produktion",
                "stoner_groove_swing", "stoner_jam", "postmetal_textur_schichten",
                "schlaf_regeneration", "ernaehrung_hydration", "rumpf_kraft_stabilitaet",
                "mobilitaet_routine", "headbangen_nacken", "verletzung_reha_rueckkehr",
                "deload_periodisierung", "abwaermen_koerper",
                "pedalboard_grundlagen"]
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
