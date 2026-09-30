#!/usr/bin/env python3
"""Prüft die UI-Labels (data/labels/de.json → `ui`) gegen ihre Verwendung im Code.

WARUM ES DAS GIBT: `t('schluessel')` mit einem Schlüssel, den es nicht gibt, wirft
KEINEN Fehler — die App zeigt dann den rohen Schlüssel ("wz_pb_kopieren") als
Beschriftung, und keine Konsole meldet es. Umgekehrt bleiben Labels stehen, wenn
eine Funktion entfernt wird, und wandern als Ballast in jede Installation (der
Service Worker cacht die Datei). Beides fällt sonst nur durch Hinsehen auf.

FEHLER (Exit 1):
  1. Ein Aufruf mit Literal (`t('key')`, `uitext("key")`, `data-haltung="key"`
     → `haltung_key`) nennt einen Schlüssel, der in `ui` fehlt.
  2. Ein `ui`-Wert ist leer (die App fällt dann auf den rohen Schlüssel zurück).
  3. Platzhalter passen nicht zusammen: `t('key', { a: … })` übergibt einen
     Schlüssel, den das Label nicht als `{a}` enthält — oder das Label verlangt
     ein `{x}`, das der Aufruf nicht liefert.
  4. Ein dynamischer Aufruf (`` t(`pfx_${x}`) ``, `t('pfx_' + x)`) hat ein Muster,
     zu dem KEIN einziger `ui`-Schlüssel passt (Präfix umbenannt oder Labels
     gelöscht).

WARNUNG (Exit 0): Tote Schlüssel — nirgends als String im Quelltext genannt und
von keinem dynamischen Muster gedeckt. Nur Warnung, weil ein Schlüssel auch
absichtlich vorgehalten sein kann (Stimme schon verdrahtet, Label noch nicht
sichtbar); wer ihn löscht, prüft vorher mit grep.

BEWUSST NICHT AUFGELÖST: Welche Werte `x` in einem dynamischen Aufruf annimmt
(`t(`box_${b.id}`)` — welche Boxen gibt es?). Das ließe sich nur mit einem
Resolver je Aufrufstelle prüfen, und der bricht bei jeder Umbenennung im Code:
eine Prüfung, die im Normalbetrieb rot ist, wird weggeklickt. Geprüft wird nur,
dass das MUSTER noch etwas trifft.

Nur Python-Standardbibliothek, wie alle Prüfungen in scripts/.
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LABELS = os.path.join(ROOT, 'data', 'labels', 'de.json')

# Wo Schlüssel verwendet werden können.
QUELL_ENDUNGEN = ('.js', '.html', '.py', '.mjs')
QUELL_ORDNER = ('js', 'scripts')
QUELL_DATEIEN = ('index.html',)
# Die Prüfung selbst nennt Schlüssel in Beispielen — sie zählt nicht als Verwendung.
AUSGENOMMEN = ('scripts/pruefe_labels.py',)


def lies(pfad):
    with open(os.path.join(ROOT, pfad), encoding='utf-8') as f:
        return f.read()


def quelldateien():
    ergebnis = list(QUELL_DATEIEN)
    for ordner in QUELL_ORDNER:
        for wurzel, _, namen in os.walk(os.path.join(ROOT, ordner)):
            for name in sorted(namen):
                if name.endswith(QUELL_ENDUNGEN):
                    rel = os.path.relpath(os.path.join(wurzel, name), ROOT)
                    if rel not in AUSGENOMMEN:
                        ergebnis.append(rel)
    return ergebnis


# ---------------------------------------------------------------------------
# t()-Aufrufe finden: Klammern balanciert, Strings und Templates beachtet
# ---------------------------------------------------------------------------

T_START = re.compile(r'(?<![A-Za-z0-9_.$])t\(')
# Nur wenn das Literal das GANZE Argument ist: uitext("haltung_" + x) ist ein Präfix.
UITEXT = re.compile(r'(?<![A-Za-z0-9_])uitext\(\s*(["\'])([a-z0-9_]+)\1\s*[,)]')
DATA_ATTR = re.compile(r'data-(haltung(?:-aria)?)="([a-z0-9_]+)"')


def teile_oben(text):
    """Teilt an Kommas der obersten Ebene (nicht in Klammern oder Strings)."""
    teile, tiefe, puffer, quote, i = [], 0, '', None, 0
    while i < len(text):
        c = text[i]
        if quote:
            puffer += c
            if c == '\\' and i + 1 < len(text):
                puffer += text[i + 1]
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in '\'"`':
            quote = c
            puffer += c
        elif c in '([{':
            tiefe += 1
            puffer += c
        elif c in ')]}':
            tiefe -= 1
            puffer += c
        elif c == ',' and tiefe == 0:
            teile.append(puffer)
            puffer = ''
        else:
            puffer += c
        i += 1
    if puffer.strip():
        teile.append(puffer)
    return teile


def t_aufrufe(quelle):
    """Liefert [(zeile, erstes_argument, zweites_argument|None)] je t(...)-Aufruf."""
    aufrufe = []
    for treffer in T_START.finditer(quelle):
        zeilenanfang = quelle.rfind('\n', 0, treffer.start()) + 1
        if quelle[zeilenanfang:treffer.start()].lstrip().startswith(('//', '*', '#')):
            continue
        i, tiefe, quote = treffer.end(), 1, None
        while i < len(quelle) and tiefe > 0:
            c = quelle[i]
            if quote:
                if c == '\\':
                    i += 2
                    continue
                if c == quote:
                    quote = None
                elif quote == '`' and c == '$' and quelle[i + 1:i + 2] == '{':
                    d, i = 1, i + 2
                    while i < len(quelle) and d > 0:
                        d += {'{': 1, '}': -1}.get(quelle[i], 0)
                        i += 1
                    continue
            elif c in '\'"`':
                quote = c
            elif c == '(':
                tiefe += 1
            elif c == ')':
                tiefe -= 1
            i += 1
        teile = teile_oben(quelle[treffer.end():i - 1])
        if teile:
            zeile = quelle.count('\n', 0, treffer.start()) + 1
            aufrufe.append((zeile, teile[0].strip(), teile[1].strip() if len(teile) > 1 else None))
    return aufrufe


def objekt_schluessel(arg):
    """{ a: 1, b, 'c': x } → {'a', 'b', 'c'}; None, wenn kein Objektliteral."""
    if not arg or not arg.startswith('{') or not arg.endswith('}'):
        return None
    schluessel = set()
    for teil in teile_oben(arg[1:-1]):
        teil = teil.strip()
        if not teil or teil.startswith('...'):
            return None  # Spread: nicht entscheidbar
        m = re.match(r"^(?:['\"]([A-Za-z0-9_]+)['\"]|([A-Za-z_][A-Za-z0-9_]*))\s*(?::|$|\()", teil)
        if not m:
            return None
        schluessel.add(m.group(1) or m.group(2))
    return schluessel


def dynamisches_muster(arg):
    """`pfx_${x}_sfx` oder 'pfx_' + x + '_sfx' → Regex; None für reine Variablen."""
    if arg.startswith('`') and arg.endswith('`') and '${' in arg:
        teile = re.split(r'\$\{[^}]*\}', arg[1:-1])
        if any(re.search(r'[^a-z0-9_]', t) for t in teile):
            return None
        return '^' + '[a-z0-9_]+'.join(re.escape(t) for t in teile) + '$'
    if '+' in arg and re.match(r"^['\"]", arg):
        muster = ''
        for teil in (p.strip() for p in arg.split('+')):
            m = re.match(r"^(['\"])([a-z0-9_]*)\1$", teil)
            muster += re.escape(m.group(2)) if m else '[a-z0-9_]+'
        if muster.count('[a-z0-9_]+') == 0:
            return None
        return '^' + muster + '$'
    return None


def platzhalter(text):
    return set(re.findall(r'\{([A-Za-z_][A-Za-z0-9_]*)\}', text))


def main():
    with open(LABELS, encoding='utf-8') as f:
        ui = json.load(f)['ui']
    fehler, warnungen = [], []
    literal = {}      # schluessel -> [(datei, zeile, objekt_schluessel|None)]
    muster = []       # (regex, datei, zeile)
    quelltext = ''

    for rel in quelldateien():
        text = lies(rel)
        quelltext += '\n' + text
        if rel.endswith(('.js', '.mjs')):
            for zeile, a1, a2 in t_aufrufe(text):
                m = re.match(r'^([\'"])([a-z0-9_]+)\1$', a1)
                if m:
                    literal.setdefault(m.group(2), []).append((rel, zeile, objekt_schluessel(a2), a2 is not None))
                else:
                    pm = dynamisches_muster(a1)
                    if pm:
                        muster.append((pm, rel, zeile))
        if rel.endswith('.py') or rel == 'scripts/build_seiten.py':
            for m in UITEXT.finditer(text):
                # hat_arg=True: build_seiten.py setzt Platzhalter selbst per .replace() — dort
                # gibt es keinen Ersetzungs-Parameter, den man vergleichen könnte.
                literal.setdefault(m.group(2), []).append((rel, text.count('\n', 0, m.start()) + 1, None, True))
        if rel.endswith('.html'):
            for art, wert in DATA_ATTR.findall(text):
                literal.setdefault('haltung_' + wert, []).append((rel, 0, None, False))
    # data-haltung wird in app.js als t('haltung_' + dataset.haltung) gelesen — das
    # Präfix-Muster oben trifft es; die konkreten Werte stehen in index.html.

    # 1) fehlende Schlüssel, 3) Platzhalter
    for schluessel, stellen in sorted(literal.items()):
        if schluessel not in ui:
            for rel, zeile, _, _ in stellen[:3]:
                fehler.append(f'{rel}:{zeile}: Label "{schluessel}" fehlt in data/labels/de.json → ui')
            continue
        wert = ui[schluessel]
        im_label = platzhalter(wert) if isinstance(wert, str) else set()
        for rel, zeile, uebergeben, hat_arg in stellen:
            if uebergeben is None:
                if not hat_arg and im_label:
                    fehler.append(
                        f'{rel}:{zeile}: Label "{schluessel}" enthält {sorted(im_label)}, '
                        f'der Aufruf übergibt nichts — es stünde roh im Text')
                continue
            fehlend = im_label - uebergeben
            ueberzaehlig = uebergeben - im_label
            if fehlend:
                fehler.append(f'{rel}:{zeile}: Label "{schluessel}" verlangt {sorted(fehlend)}, der Aufruf übergibt es nicht')
            if ueberzaehlig:
                fehler.append(f'{rel}:{zeile}: Aufruf übergibt {sorted(ueberzaehlig)} an "{schluessel}", das Label enthält es nicht')

    # 2) leere Werte
    for schluessel, wert in ui.items():
        if isinstance(wert, str) and not wert.strip():
            fehler.append(f'data/labels/de.json: ui.{schluessel} ist leer (die App zeigte den rohen Schlüssel)')

    # 4) dynamische Muster ohne Treffer
    regexe = []
    for pm, rel, zeile in muster:
        r = re.compile(pm)
        regexe.append(r)
        if not any(r.match(k) for k in ui):
            fehler.append(f'{rel}:{zeile}: dynamischer Aufruf mit Muster {pm} trifft keinen ui-Schlüssel')

    # Warnung: tote Schlüssel
    for schluessel in ui:
        genannt = re.search(r'[\'"`]' + re.escape(schluessel) + r'[\'"`]', quelltext)
        if genannt or schluessel in literal or any(r.match(schluessel) for r in regexe):
            continue
        warnungen.append(schluessel)

    print(f'{len(ui)} ui-Labels, {len(literal)} Schlüssel per Literal, {len(muster)} dynamische Aufrufe.')
    if warnungen:
        print(f'\nWARNUNG — {len(warnungen)} Schlüssel ohne erkennbare Verwendung (vorgehalten oder tot? '
              f'vor dem Löschen mit grep prüfen):')
        for k in warnungen[:40]:
            print(f'  {k}')
        if len(warnungen) > 40:
            print(f'  … und {len(warnungen) - 40} weitere')
    if fehler:
        print(f'\nFEHLER ({len(fehler)}):')
        for f in fehler:
            print(f'  {f}')
        sys.exit(1)
    print('\nOK — alle genutzten Labels vorhanden, Platzhalter passen.')


if __name__ == '__main__':
    main()
