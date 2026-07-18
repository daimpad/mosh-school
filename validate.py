#!/usr/bin/env python3
"""
Validierungs-Suite fuer den Crossminton-Handbuch-Korpus.

Aufruf:  python3 validate.py [VERZEICHNIS]
         (Default: aktuelles Verzeichnis)

Prueft alle Inhaltsdateien und meldet Fehler (blockierend) und Warnungen.
Exit-Code 0 = alles gruen, 1 = mindestens ein Fehler.
"""
import json, glob, os, re, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
def path(p): return os.path.join(ROOT, p)

errors, warnings = [], []
def err(f, i, msg):  errors.append((f, i, msg))
def warn(f, i, msg): warnings.append((f, i, msg))

# ---------------------------------------------------------------- laden
def load(p):
    try:
        return json.load(open(p, encoding="utf-8"))
    except json.JSONDecodeError as e:
        err(os.path.basename(p), "-", f"UNGUELTIGES JSON: {e}")
        return None

baustein_files = sorted(glob.glob(path("bausteine.*.json")))
if not baustein_files:
    print("Keine bausteine.*.json gefunden in", os.path.abspath(ROOT)); sys.exit(1)

# kanonisches Vokabular
vok_src = load(path("bausteine.beginner-technik.json"))
V = (vok_src or {}).get("vokabulare", {})
def flat(d):
    out = set()
    for k, val in d.items():
        if isinstance(val, list): out |= set(val)
    return out
ALLOW = {
    "domaene": set(V.get("domaene", [])),
    "kompetenzstufe": set(V.get("kompetenzstufe", [])),
    "typ": set(V.get("baustein_typ", [])),
    "herkunft": set(V.get("transfer_herkunft", [])) | {"SP", "AT"},  # koordinierte Ergaenzungen
    "untergrund": set(V.get("untergrund", [])),
    "witterung": set(V.get("witterung", [])),
    "spielform": {"einzel", "doppel"},
    "spielziele": flat(V.get("spielziele", {})),
    "vermittlungsziele": flat(V.get("vermittlungsziele", {})),
}

# ---------------------------------------------------------------- sammeln
pool = {}          # baustein_id -> (datei, dict)
has_uebung = set() # ids mit uebungsteil
deltas = []        # (datei, dict)
for f in baustein_files:
    d = load(f)
    if not d: continue
    fn = os.path.basename(f)
    for b in d.get("bausteine", []):
        bid = b.get("id", "?")
        if bid in pool: err(fn, bid, f"doppelte Baustein-ID (auch in {pool[bid][0]})")
        pool[bid] = (fn, b)
        if "uebungsteil" in b: has_uebung.add(bid)
    for dd in d.get("delta_bausteine", []):
        deltas.append((fn, dd))

def texts(b):
    """alle DE-Textfelder eines Bausteins/Deltas."""
    out = []
    for k in ("erklaerteil", "reflexionsaufgabe"):
        if isinstance(b.get(k), dict) and "de" in b[k]: out.append(b[k]["de"])
    u = b.get("uebungsteil", {}).get("de") if isinstance(b.get("uebungsteil"), dict) else None
    if isinstance(u, dict):
        for k in ("ziel", "abschluss", "selbstkontrolle"): 
            if u.get(k): out.append(u[k])
        out += [s for s in u.get("schritte", []) if isinstance(s, str)]
    return out

# ---------------------------------------------------------------- checks
def check_baustein(fn, b):
    bid = b.get("id")
    if not bid: err(fn, "?", "Baustein ohne id"); return
    # Pflichtfelder
    for req in ("typ", "domaene", "kompetenzstufe", "erklaerteil"):
        if req not in b: err(fn, bid, f"Pflichtfeld fehlt: {req}")
    # Wertkonformitaet
    if b.get("domaene") not in ALLOW["domaene"]:
        err(fn, bid, f"unbekannte domaene: {b.get('domaene')}")
    if b.get("typ") not in ALLOW["typ"]:
        err(fn, bid, f"unbekannter typ: {b.get('typ')}")
    for s in b.get("kompetenzstufe", []):
        if s not in ALLOW["kompetenzstufe"]: err(fn, bid, f"unbekannte kompetenzstufe: {s}")
    for h in b.get("transfer_herkunft", []):
        if h not in ALLOW["herkunft"]: err(fn, bid, f"unbekannte transfer_herkunft: {h}")
    if "spielform" in b and b["spielform"] not in ALLOW["spielform"]:
        err(fn, bid, f"unbekannte spielform: {b['spielform']}")
    ug = b.get("untergrund")
    for u in ([ug] if isinstance(ug, str) else (ug or [])):
        if u not in ALLOW["untergrund"]: err(fn, bid, f"unbekannter untergrund: {u}")
    for w in b.get("witterung", []):
        if w not in ALLOW["witterung"]: err(fn, bid, f"unbekannte witterung: {w}")
    for z in b.get("spielziele", []):
        if z not in ALLOW["spielziele"]: err(fn, bid, f"unbekanntes spielziel: {z}")
    for z in b.get("vermittlungsziele", []):
        if z not in ALLOW["vermittlungsziele"]: err(fn, bid, f"unbekanntes vermittlungsziel: {z}")
    # innere Struktur: genau eines von uebungsteil/reflexionsaufgabe
    inner = [k for k in ("uebungsteil", "reflexionsaufgabe") if k in b]
    if len(inner) != 1:
        err(fn, bid, f"innere Struktur: genau 1 von uebungsteil/reflexionsaufgabe erwartet, gefunden {inner}")
    # Voraussetzungen aufloesbar
    for v in b.get("voraussetzungen", []):
        if v not in pool: err(fn, bid, f"Voraussetzung zeigt ins Leere: {v}")

def check_delta(fn, dd):
    did = dd.get("id", "?")
    basis = dd.get("basis_baustein")
    if basis not in pool:
        err(fn, did, f"Delta-Basis existiert nicht: {basis}")
    else:
        stufen = pool[basis][1].get("kompetenzstufe", [])
        if "experte" in stufen:
            err(fn, did, f"Delta auf Experten-Baustein '{basis}' (Experten-Stufe ist herkunftsneutral, 11.5)")
    if dd.get("eigener_uebungsteil", False) is not False:
        warn(fn, did, "Delta sollte eigener_uebungsteil: false tragen")
    if dd.get("ersetzt_bei_herkunft") not in ALLOW["herkunft"]:
        err(fn, did, f"unbekannte ersetzt_bei_herkunft: {dd.get('ersetzt_bei_herkunft')}")

def check_language(fn, b):
    bid = b.get("id", "?")
    for t in texts(b):
        if "Ein Bild:" in t:
            err(fn, bid, "Sprachregel: 'Ein Bild:'-Formel gefunden")
        if re.search(r"(?:nicht|kein[e]?)[ ,][^;:]{1,70}, sondern", t):
            err(fn, bid, "Sprachregel: 'nicht/kein …, sondern …'-Antithese gefunden")
        for bad, good in (("Tempo-Management", "Tempo-Steuerung"),
                          ("punktstandabhängig", "je nach Spielstand")):
            if bad in t: err(fn, bid, f"Glossar-Verstoss: '{bad}' -> '{good}'")
        if re.search(r"(?<!Auf)Bauschläge", t): err(fn, bid, "Glossar-Verstoss: 'Bauschläge' -> 'Aufbauschläge'")

# Bausteine + Deltas pruefen
for f in baustein_files:
    d = load(f); fn = os.path.basename(f)
    if not d: continue
    for b in d.get("bausteine", []):
        check_baustein(fn, b); check_language(fn, b)
    for dd in d.get("delta_bausteine", []):
        check_delta(fn, dd); check_language(fn, dd)

# Delta: keine doppelte (Basis, Herkunft)-Kante
seen = {}
for fn, dd in deltas:
    key = (dd.get("basis_baustein"), dd.get("ersetzt_bei_herkunft"))
    if key in seen: err(fn, dd.get("id", "?"), f"doppelte (Basis, Herkunft)-Kante {key} (auch {seen[key]})")
    else: seen[key] = dd.get("id", "?")

# Trainingseinheiten
te = load(path("trainingseinheiten.json"))
if te:
    for e in te.get("trainingseinheiten", []):
        eid = e.get("id", "?")
        phasen = e.get("phasen", {})
        for need in ("erwaermung", "hauptteil", "ausklang"):
            if need not in phasen: err("trainingseinheiten.json", eid, f"Phase fehlt: {need}")
        for ph, items in phasen.items():
            for it in items:
                ref = it.get("baustein")
                if ref not in pool: err("trainingseinheiten.json", eid, f"Referenz zeigt ins Leere: {ref}")
                elif ref not in has_uebung: err("trainingseinheiten.json", eid, f"Referenz '{ref}' hat keinen uebungsteil")

# reine JSON-Ladepruefung fuer restliche Dateien
for extra in ("regeln.json", "app-info.json"):
    if os.path.exists(path(extra)): load(path(extra))

# ---------------------------------------------------------------- report
print("=" * 64)
print(f"  Validierung: {len(pool)} Bausteine, {len(deltas)} Deltas, "
      f"{len(baustein_files)} Baustein-Dateien")
print("=" * 64)
for f, i, m in warnings: print(f"  ⚠  {f} [{i}] {m}")
for f, i, m in errors:   print(f"  ✗  {f} [{i}] {m}")
print("-" * 64)
if errors:
    print(f"  FEHLER: {len(errors)} | Warnungen: {len(warnings)}")
    sys.exit(1)
print(f"  ALLES GRUEN — 0 Fehler, {len(warnings)} Warnungen")
sys.exit(0)
