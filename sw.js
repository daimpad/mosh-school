// Service Worker — macht das Handbuch offline-fähig. Buildfrei und rein statisch:
// ein klassisches SW-Skript (kein Modul, kein Bundler), das den App-Kern beim
// ersten Besuch vorlädt und danach aus dem Cache bedient.
//
// Zwei Strategien:
//   • Navigationen (das HTML-Dokument): erst Netz, bei Ausfall die gecachte
//     index.html — so bekommt man online stets die frische Hülle, offline die
//     zuletzt gesehene. Deep-Links (…/#/baustein/x) laden dasselbe Dokument.
//   • Alles andere (JS, CSS, JSON, Schriften, Grafiken): stale-while-revalidate —
//     sofort aus dem Cache, parallel im Hintergrund aktualisiert. Nicht
//     vorgeladene Dateien (Baustein-Grafiken) landen dabei beim ersten Abruf
//     im Cache und sind danach offline verfügbar.
//
// Alle Pfade sind RELATIV zum SW-Standort (Wurzel des Deployments), damit das
// Skript sowohl unter „/" (lokaler Server) als auch unter „/mosh-school/"
// (GitHub Pages) ohne <base>-Tag funktioniert. Bei inhaltlicher Änderung an
// Kern-Dateien den CACHE-Namen erhöhen — dann lädt der neue SW die Hülle frisch
// und räumt die alten Caches weg.

const CACHE = 'mosh-v97';

// App-Hülle: alles, was für den ersten Start ohne Netz nötig ist. Die
// Baustein-Grafiken (images/G-XXX.png) sind bewusst NICHT dabei — sie sind viele
// und werden beim Ansehen lazy nachgecacht.
const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'assets/images/logo.svg',
  'css/app.css',
  'css/feedback.css',
  'css/schriften.css',
  'js/aktionen.js',
  'js/app.js',
  'js/daten.js',
  'js/feedback.js',
  'js/fortschritt.js',
  'js/graph.js',
  'js/i18n.js',
  'js/oberflaeche.js',
  'js/pfade.js',
  'js/plan.js',
  'js/suche.js',
  'js/zustand.js',
  'js/genre-inszenierung.js',
  'js/genre-mix.js',
  'js/genre-namen.js',
  'js/mastery.js',
  'js/werkzeug-links.js',
  'js/werkzeug-speicher.js',
  'js/geraete-grafik.js',
  'js/audio/kontext.js',
  'js/audio/scheduler.js',
  'js/audio/stimmen.js',
  'js/audio/wav.js',
  'js/audio/tonhoehe.js',
  'js/audio/mikro.js',
  'js/audio/riff-db.js',
  'js/audio/spuren-db.js',
  'js/ansichten/baustein.js',
  'js/ansichten/demonstration.js',
  'js/ansichten/heim.js',
  'js/ansichten/info.js',
  'js/ansichten/onboarding.js',
  'js/ansichten/pfad.js',
  'js/ansichten/plan.js',
  'js/ansichten/profil.js',
  'js/ansichten/stimmungen.js',
  'js/ansichten/patterns.js',
  'js/ansichten/songs.js',
  'js/ansichten/werkzeuge.js',
  'js/ansichten/werkzeug-metronom.js',
  'js/ansichten/werkzeug-loops.js',
  'js/ansichten/werkzeug-stimmgeraet.js',
  'js/ansichten/werkzeug-pedalboard.js',
  'js/ansichten/werkzeug-ampbox.js',
  'js/ansichten/werkzeug-struktur.js',
  'js/ansichten/werkzeug-recorder.js',
  'js/ansichten/werkzeug-mehrspur.js',
  'js/ansichten/werkzeug-explorer.js',
  'js/ansichten/werkzeug-landkarte.js',
  'js/ansichten/werkzeug-genremix.js',
  'js/ansichten/koennenscheck.js',
  'js/ansichten/suche.js',
  'js/ansichten/training.js',
  'js/ansichten/willkommen.js',
  'js/ansichten/zielwahl.js',
  'data/app-info.json',
  'data/bausteine.einsteiger-gitarre.json',
  'data/bausteine.fortgeschritten-gitarre.json',
  'data/bausteine.experte-gitarre.json',
  'data/bausteine.einsteiger-bass.json',
  'data/bausteine.fortgeschritten-bass.json',
  'data/bausteine.experte-bass.json',
  'data/bausteine.einsteiger-schlagzeug.json',
  'data/bausteine.fortgeschritten-schlagzeug.json',
  'data/bausteine.experte-schlagzeug.json',
  'data/bausteine.einsteiger-gesang.json',
  'data/bausteine.fortgeschritten-gesang.json',
  'data/bausteine.experte-gesang.json',
  'data/bausteine.einsteiger-theorie.json',
  'data/bausteine.fortgeschritten-theorie.json',
  'data/bausteine.experte-theorie.json',
  'data/bausteine.stil-doom.json',
  'data/bausteine.stil-hardcore.json',
  'data/bausteine.stil-punk-extrem.json',
  'data/bausteine.stil-sludge.json',
  'data/bausteine.stil-einsteiger.json',
  'data/bausteine.sound-gear.json',
  'data/bausteine.drums-gear.json',
  'data/bausteine.stil-deathcore.json',
  'data/bausteine.stil-djent.json',
  'data/bausteine.stil-stoner-post.json',
  'data/bausteine.genreuebergreifend.json',
  'data/bausteine.experte-vertiefung.json',
  'data/bausteine.koerper-mentales.json',
  'data/bausteine.kontext.json',
  'data/bausteine.ensemble-paare.json',
  'data/bausteine.band-proberaum.json',
  'data/bausteine.ensemble-gross.json',
  'data/bausteine.demo-recording.json',
  'data/bausteine.auftritt-live.json',
  'data/bausteine.songwriting.json',
  'data/bausteine.uebe-methodik.json',
  'data/bausteine.unterricht.json',
  'data/bausteine.gesang-clean.json',
  'data/bausteine.stil-vertiefung-1.json',
  'data/bausteine.stil-vertiefung-2.json',
  'data/bausteine.koerper-athletik.json',
  'data/bausteine.pedalboard-gear.json',
  'data/bausteine.amp-box-gear.json',
  'data/bausteine.instrument-technik.json',
  'data/bausteine.gear-schlagzeug-gesang.json',
  'data/bausteine.grenzgaenger.json',
  'data/fehlerbilder.json',
  'data/grafiken.json',
  'data/lehrgrafiken.json',
  'data/index.json',
  'data/genres.json',
  'data/gefuehlslandkarte.json',
  'data/patterns.json',
  'data/tunings.json',
  'data/pedale.json',
  'data/ampbox.json',
  'data/songs.hardcore.json',
  'data/songs.metalcore.json',
  'data/songs.thrash.json',
  'data/songs.death-metal.json',
  'data/songs.black-metal.json',
  'data/songs.doom.json',
  'data/songs.crust.json',
  'data/songs.grindcore.json',
  'data/songs.powerviolence.json',
  'data/songs.stoner.json',
  'data/songs.post-metal.json',
  'data/songs.deathcore.json',
  'data/songs.sludge.json',
  'data/songs.grenzgaenger.json',
  'data/trainingseinheiten.json',
  'data/turnierregeln.json',
  'data/labels/de.json',
  'data/labels/en.json',
  'data/labels/fr.json',
  'data/labels/pl.json',
  'assets/fonts/special-elite-latin-400-normal.woff2',
  'assets/fonts/special-elite-latin-ext-400-normal.woff2',
  'assets/fonts/rubik-latin-400-normal.woff2',
  'assets/fonts/rubik-latin-500-normal.woff2',
  'assets/fonts/rubik-latin-700-normal.woff2',
  'assets/fonts/rubik-latin-ext-400-normal.woff2',
  'assets/fonts/rubik-latin-ext-500-normal.woff2',
  'assets/fonts/rubik-latin-ext-700-normal.woff2',
];

// Installation: Hülle vorladen. addAll ist atomar — fehlt EINE Datei, schlägt
// die Installation fehl und der alte SW bleibt aktiv (die App bleibt nutzbar).
self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

// Aktivierung: alte Cache-Versionen wegräumen, dann sofort die Kontrolle über
// offene Seiten übernehmen (clients.claim), damit der neue SW ohne Reload greift.
self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Navigationsanfragen: erst Netz (frische Hülle), bei Ausfall gecachte index.html.
function bedieneNavigation(anfrage) {
  return fetch(anfrage).catch(() =>
    caches.match('index.html').then((treffer) => treffer || caches.match('./')),
  );
}

// Übrige Anfragen: stale-while-revalidate. Cache-Treffer sofort ausliefern,
// parallel frisch holen und den Cache aktualisieren; ohne Treffer aufs Netz warten.
function bedieneRest(anfrage) {
  return caches.open(CACHE).then((cache) =>
    cache.match(anfrage).then((gecacht) => {
      const ausNetz = fetch(anfrage)
        .then((antwort) => {
          // Nur vollständige, gleiche-Herkunft-Antworten cachen (keine Fehler/opaque).
          if (antwort && antwort.status === 200 && antwort.type === 'basic') {
            cache.put(anfrage, antwort.clone());
          }
          return antwort;
        })
        .catch(() => gecacht);
      return gecacht || ausNetz;
    }),
  );
}

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  // Nur GET und nur gleiche Herkunft — POST/andere Domains laufen unangetastet
  // durchs Netz (z. B. der optionale Feedback-Export).
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;

  if (anfrage.mode === 'navigate') {
    ereignis.respondWith(bedieneNavigation(anfrage));
    return;
  }
  ereignis.respondWith(bedieneRest(anfrage));
});
