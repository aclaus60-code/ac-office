/* AC Office – Service Worker: App startet auch ohne Netz.
   Es werden NUR Programmdateien zwischengespeichert – keine Kundendaten
   (die liegen ausschließlich im gewählten Datenordner auf dem Gerät).
   Strategie: sofort aus dem Speicher, im Hintergrund aktualisieren. */
const CACHE = 'ac-office-2026-11-27';
const FILES = ['./', 'AC-Office.html', 'css/app.css', 'manifest.webmanifest', 'favicon.png', 'icon-192.png', 'icon-512.png',
  'vendor/jspdf.umd.min.js', 'vendor/jspdf.plugin.autotable.min.js', 'vendor/qrcode.js', 'js/assets.js',
  ...['core', 'pdf', 'kunden', 'rechnungen', 'mahnwesen', 'schutzkonzept', 'vorlagen', 'angebote', 'lehrgaenge', 'unterlagen', 'ausgaben', 'outlook', 'termine', 'einstellungen', 'start', 'fragenbank-daten', 'unterricht', 'honorar', 'nachweise', 'schiessstand', 'lehrinhalte', 'lehrdauer'].map(n => `js/${n}.js`)];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
