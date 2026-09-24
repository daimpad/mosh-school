#!/usr/bin/env python3
"""Prüft: Die Versionsnummer ist die Nummer des Pull Requests.

Die Fußzeile zeigt „Version N" aus dem CACHE-Namen in sw.js (`zerrer-vN`). N
soll die Nummer des PRs sein, mit dem der Stand ausgeliefert wurde — dann kann
man an der Seite ablesen, ob PR #N schon angekommen ist. Das hält nur, wenn es
geprüft wird; sonst stimmt die Nummer nach dem dritten vergessenen Mal nicht
mehr, und eine falsche Nummer ist schlimmer als keine.

Die Regel:
  • Ändert der PR etwas, das ausgeliefert wird (eine Datei aus SHELL in sw.js),
    MUSS CACHE auf `zerrer-v<PR-Nummer>` stehen.
  • Ändert er nichts Ausgeliefertes (nur Doku, Skripte, Workflows), darf CACHE
    bleiben — setzt er ihn doch um, dann ebenfalls auf die PR-Nummer.
  • AUSNAHME: data/shows.json. Neue Shows kommen über den Shows-Editor auf dem
    Zweig shows/editor; der PR dazu entsteht erst danach, der Editor kann seine
    Nummer also gar nicht kennen. Eine neue Show ändert die Nummer deshalb nicht.

Aufruf (in verify.yml bei pull_request):
  python3 scripts/pruefe_version.py <pr-nummer> [<basis-ref>]
Basis ist standardmäßig HEAD^1 — bei pull_request checkt actions/checkout den
Merge-Commit aus, dessen erster Elter die Basis ist. Lokal geht z. B.
  python3 scripts/pruefe_version.py 219 origin/main
"""

import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUSNAHMEN = {'data/shows.json'}


def git(*argumente):
    return subprocess.run(['git', *argumente], cwd=ROOT, check=True,
                          capture_output=True, text=True).stdout


def cache_nummer(text):
    treffer = re.search(r"^const CACHE = '[a-z]+-v(\d+)';", text, re.MULTILINE)
    if not treffer:
        sys.exit('FEHLER: CACHE-Zeile in sw.js nicht gefunden (Format geändert?).')
    return int(treffer.group(1))


def shell_liste(text):
    block = re.search(r'const SHELL = \[(.*?)\];', text, re.DOTALL)
    if not block:
        sys.exit('FEHLER: SHELL-Liste in sw.js nicht gefunden (Format geändert?).')
    pfade = set()
    for pfad in re.findall(r"'([^']*)'", block.group(1)):
        # './' ist die Startseite; sonst nur ein führendes './' abschneiden —
        # lstrip('./') striche ZEICHEN und machte aus '.htaccess' 'htaccess'.
        if pfad in ('./', '.', ''):
            pfade.add('index.html')
        else:
            pfade.add(pfad[2:] if pfad.startswith('./') else pfad)
    return pfade


def main():
    if len(sys.argv) < 2 or not sys.argv[1].isdigit():
        sys.exit(__doc__)
    pr = int(sys.argv[1])
    basis = sys.argv[2] if len(sys.argv) > 2 else 'HEAD^1'

    with open(os.path.join(ROOT, 'sw.js'), encoding='utf-8') as f:
        kopf_sw = f.read()
    kopf = cache_nummer(kopf_sw)
    alt = cache_nummer(git('show', f'{basis}:sw.js'))
    geaendert = {p for p in git('diff', '--name-only', basis, 'HEAD').splitlines() if p}
    ausgeliefert = sorted((geaendert & (shell_liste(kopf_sw) | {'sw.js'})) - AUSNAHMEN)

    soll = f"zerrer-v{pr}"
    if ausgeliefert and kopf != pr:
        sys.exit(
            f'FEHLER: Dieser PR ändert Ausgeliefertes ({", ".join(ausgeliefert[:5])}'
            f'{" …" if len(ausgeliefert) > 5 else ""}), aber CACHE steht auf v{kopf}.\n'
            f"  In sw.js setzen: const CACHE = '{soll}';\n"
            f'  Die Nummer ist die sichtbare Version in der Fußzeile und soll die PR-Nummer sein.')
    if kopf != alt and kopf != pr:
        sys.exit(f"FEHLER: CACHE wurde auf v{kopf} geändert — die Version muss die PR-Nummer sein: "
                 f"const CACHE = '{soll}';")
    if ausgeliefert:
        print(f'OK — Version {kopf} = PR #{pr} ({len(ausgeliefert)} ausgelieferte Datei(en) geändert).')
    else:
        print(f'OK — nichts Ausgeliefertes geändert, Version bleibt v{kopf}.')


if __name__ == '__main__':
    main()
