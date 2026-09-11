// GitHub-Schreibzugriff für den Shows-Editor (themenneutral, DOM-frei).
//
// WARUM ÜBERHAUPT: ZERRER hat keinen Server. `zerrer.org` liefert statische
// Dateien aus, die netcup bei jedem Push auf `main` von GitHub zieht — es gibt
// nichts, was einen Upload entgegennehmen und eine Datei schreiben könnte. Wer
// aus dem Browser heraus Inhalte pflegen will, muss deshalb dorthin schreiben,
// wo der Inhalt wirklich liegt: ins Repository. Genau so arbeiten auch die
// üblichen Static-Site-CMS.
//
// FOLGE, die man aussprechen muss: Das Passwort vor dem Editor schützt nichts.
// Der Schlüssel ist der GitHub-Token. Er gehört fein granuliert und auf dieses
// eine Repository beschränkt (Contents: read and write), mit Ablaufdatum.
//
// EIN COMMIT, NICHT ZWEI. Die Contents-API könnte je Datei einen Commit
// schreiben; das ergäbe zwischendurch einen Stand mit Bild ohne Eintrag. Über
// die Git-Data-API (Blob → Tree → Commit → Ref) landen Bild und JSON in EINEM
// Commit. Umständlicher, aber es gibt keinen halben Zustand.
//
// Alle Fehler werden als lesbare Meldung geworfen, nie geschluckt: Ein Editor,
// der „gespeichert" sagt und nichts geschrieben hat, ist schlimmer als einer,
// der hakt.

const API = 'https://api.github.com';

// Zweignamen duerfen Schraegstriche tragen („shows/editor"), und die gehoeren
// im Pfad LITERAL stehen: `encodeURIComponent` macht daraus %2F, und GitHub
// findet den Ref dann nicht mehr. Deshalb je Segment kodieren, den Trenner
// aber lassen.
const refPfad = (zweig) => String(zweig).split('/').map(encodeURIComponent).join('/');

// UTF-8 → base64. `btoa` allein kippt bei jedem Umlaut („Köln") mit einer
// InvalidCharacterError um, weil es nur Latin-1-Codepunkte annimmt.
export function textZuBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let roh = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    roh += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(roh);
}

export async function blobZuBase64(blob) {
  const puffer = new Uint8Array(await blob.arrayBuffer());
  let roh = '';
  for (let i = 0; i < puffer.length; i += 8192) {
    roh += String.fromCharCode(...puffer.subarray(i, i + 8192));
  }
  return btoa(roh);
}

function base64ZuText(b64) {
  const roh = atob(String(b64).replace(/\s/g, ''));
  const bytes = Uint8Array.from(roh, (z) => z.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function githubClient({ token, owner, repo }) {
  async function anfrage(pfad, optionen = {}) {
    const antwort = await fetch(`${API}/repos/${owner}/${repo}${pfad}`, {
      ...optionen,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${token}`,
        ...(optionen.body ? { 'Content-Type': 'application/json' } : {}),
        ...optionen.headers,
      },
    });
    if (antwort.status === 404) return null;   // Aufrufer entscheidet, ob das ein Fehler ist
    if (!antwort.ok) {
      let grund = `HTTP ${antwort.status}`;
      try {
        const daten = await antwort.json();
        if (daten?.message) grund += ` — ${daten.message}`;
      } catch { /* keine JSON-Antwort, dann bleibt der Status die Begründung */ }
      // 401/403 sind die beiden Fälle, die in der Praxis auftreten: falscher
      // oder abgelaufener Token, oder ein Token ohne Contents-Schreibrecht.
      if (antwort.status === 401) grund += ' (Token ungültig oder abgelaufen?)';
      if (antwort.status === 403) grund += ' (Token ohne Schreibrecht auf dieses Repository?)';
      throw new Error(grund);
    }
    return antwort.status === 204 ? true : antwort.json();
  }

  const holeRef = (zweig) => anfrage(`/git/ref/heads/${refPfad(zweig)}`);

  // Liefert den Text einer Datei an einem Ref, oder null wenn es sie dort nicht
  // gibt. Der Editor liest damit den AKTUELLEN Stand von shows.json, statt den
  // beim Seitenaufruf geladenen zu benutzen — sonst überschriebe ein zweiter
  // Eintrag den ersten, sobald zwischendurch etwas gemergt wurde.
  async function holeDatei(pfad, ref) {
    const d = await anfrage(`/contents/${pfad}?ref=${encodeURIComponent(ref)}`);
    return d?.content ? base64ZuText(d.content) : null;
  }

  // 'ahead' | 'behind' | 'identical' | 'diverged' | null (Zweig gibt es nicht)
  async function vergleiche(basis, kopf) {
    const d = await anfrage(`/compare/${refPfad(basis)}...${refPfad(kopf)}`);
    return d?.status || null;
  }

  /**
   * Schreibt mehrere Dateien in EINEN Commit auf `zweig`.
   *
   * Der Commit sitzt auf dem Arbeitszweig, wenn der dem Basiszweig VORAUS ist
   * (dann sammeln sich mehrere Shows in einem Pull Request), sonst auf dem
   * Basiszweig. Das ist der Unterschied zwischen „drei Shows in einem PR" und
   * „der dritte PR macht die ersten beiden wieder rückgängig": Ein Zweig, der
   * nach dem Mergen zurückliegt, darf nicht weiterbenutzt werden.
   */
  async function commit({ zweig, basis = 'main', dateien, nachricht }) {
    const basisRef = await holeRef(basis);
    if (!basisRef) throw new Error(`Zweig "${basis}" nicht gefunden`);

    const zweigRef = await holeRef(zweig);
    const status = zweigRef ? await vergleiche(basis, zweig) : null;
    const weiterbauen = status === 'ahead';
    const elternSha = weiterbauen ? zweigRef.object.sha : basisRef.object.sha;

    const elternCommit = await anfrage(`/git/commits/${elternSha}`);
    const blobs = [];
    for (const datei of dateien) {
      // `sha: null` im Baum loescht den Pfad — der Weg, ein Bild im selben
      // Commit mitzunehmen, in dem sein Eintrag aus der JSON verschwindet.
      if (datei.loeschen) {
        blobs.push({ path: datei.pfad, mode: '100644', type: 'blob', sha: null });
        continue;
      }
      const blob = await anfrage('/git/blobs', {
        method: 'POST',
        body: JSON.stringify(
          datei.base64 != null
            ? { content: datei.base64, encoding: 'base64' }
            : { content: datei.inhalt, encoding: 'utf-8' },
        ),
      });
      blobs.push({ path: datei.pfad, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const baum = await anfrage('/git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: elternCommit.tree.sha, tree: blobs }),
    });
    const neuerCommit = await anfrage('/git/commits', {
      method: 'POST',
      body: JSON.stringify({ message: nachricht, tree: baum.sha, parents: [elternSha] }),
    });

    if (zweigRef) {
      await anfrage(`/git/refs/heads/${refPfad(zweig)}`, {
        method: 'PATCH',
        // force nur, wenn wir den Zweig neu von der Basis aus aufsetzen (er lag
        // zurück, weil sein PR gemergt wurde). Beim Weiterbauen ist der neue
        // Commit ohnehin ein Nachfahre.
        body: JSON.stringify({ sha: neuerCommit.sha, force: !weiterbauen }),
      });
    } else {
      await anfrage('/git/refs', {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${zweig}`, sha: neuerCommit.sha }),
      });
    }
    return { sha: neuerCommit.sha, zweig, weitergebaut: weiterbauen };
  }

  return { holeRef, holeDatei, vergleiche, commit };
}
