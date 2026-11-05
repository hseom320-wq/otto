// 한울아파트 — 서비스 워커. 앱 파일을 바꿔서 올릴 때마다 V를 1 올린다.
const V = 'hanul-v2';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'data/characters.json', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('.mp4')) return; // 영상은 브라우저가 알아서 (부분 요청)
  // 그림: 한 번 받으면 캐시에서
  if (u.pathname.includes('/assets/')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(e.request, c)); } return res; })));
    return;
  }
  // 앱 파일: 인터넷이 되면 새 것, 안 되면 캐시
  e.respondWith(fetch(e.request).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(e.request, c)); } return res; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
