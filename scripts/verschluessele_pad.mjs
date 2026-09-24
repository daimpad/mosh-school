// Verschlüsselt die Pad-Adressen für #/intern und schreibt js/intern-schluessel.js.
//
//   PAD_EINBETTEN='https://cryptpad.fr/…/' \
//   PAD_OEFFNEN='https://cryptpad.fr/…/' \
//   PAD_PASSWORT='…' node scripts/verschluessele_pad.mjs
//
// Werte über Umgebungsvariablen, nicht als Argumente: Argumente stehen in der
// Prozessliste und landen leichter in einer Shell-Historie. Nötig ist das Skript
// nur, wenn sich Adresse oder Passwort ändern — danach CACHE in sw.js erhöhen,
// sonst behalten Offline-Nutzer die alte Datei (und das alte Passwort).
//
// PAD_EINBETTEN ist die Adresse fürs iframe. NICHT die /embed/-Variante nehmen:
// cryptpad.fr hat das Einbetten für Dokumente („doc") abgeschaltet und zeigt im
// Rahmen dann nur „Einbettung ist für diese CryptPad-Anwendung deaktiviert". Die
// normale Adresse lädt im iframe. Beide Variablen dürfen also gleich sein.
//
// Nutzt js/tresor.js — dasselbe Modul, mit dem die Seite entschlüsselt.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { entschluessele, verschluessele } from '../js/tresor.js';

const { PAD_EINBETTEN, PAD_OEFFNEN, PAD_PASSWORT } = process.env;
function brich(meldung) {
  console.error(meldung);
  process.exit(1);
}
if (!PAD_EINBETTEN || !PAD_OEFFNEN || !PAD_PASSWORT) {
  brich('PAD_EINBETTEN, PAD_OEFFNEN und PAD_PASSWORT müssen gesetzt sein.');
}
for (const adresse of [PAD_EINBETTEN, PAD_OEFFNEN]) {
  if (new URL(adresse).protocol !== 'https:') brich(`Keine https-Adresse: ${new URL(adresse).origin}`);
}
if (PAD_PASSWORT.trim().length < 16) {
  brich('Passwort zu kurz (mindestens 16 Zeichen). Die verschlüsselte Datei ist öffentlich — ein kurzes Passwort lässt sich offline erraten.');
}

const schloss = await verschluessele({ einbetten: PAD_EINBETTEN, oeffnen: PAD_OEFFNEN }, PAD_PASSWORT);

// Gegenprobe, bevor irgendetwas geschrieben wird.
const zurueck = await entschluessele(schloss, PAD_PASSWORT);
if (zurueck?.einbetten !== PAD_EINBETTEN || zurueck?.oeffnen !== PAD_OEFFNEN) brich('Gegenprobe fehlgeschlagen.');
if (await entschluessele(schloss, `${PAD_PASSWORT}x`)) brich('Falsches Passwort wurde angenommen.');

const ziel = fileURLToPath(new URL('../js/intern-schluessel.js', import.meta.url));
writeFileSync(ziel, `// GENERIERT von scripts/verschluessele_pad.mjs — nicht von Hand ändern.
//
// Die Adresse des Pads unter #/intern, VERSCHLÜSSELT (PBKDF2 + AES-GCM, siehe
// js/tresor.js). Sie steht hier, damit niemand sie auf jedem Gerät neu
// eintragen muss; im Klartext darf sie nie ins Repository, denn bei CryptPad ist
// die Adresse der Schlüssel zum Pad. Das Passwort steht nirgends im Quelltext.
export const PAD_SCHLOSS = ${JSON.stringify(schloss, null, 2)};
`);
console.log(`geschrieben: js/intern-schluessel.js (${schloss.iterationen} Runden). Jetzt CACHE in sw.js erhöhen.`);
