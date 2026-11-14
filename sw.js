// 한울아파트 — 서비스 워커. 앱 파일을 바꿔서 올릴 때마다 V를 1 올린다.
const V = 'hanul-v33';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'features.js', 'study.js', 'plan.js', 'music.js', 'device.js', 'idle.js', 'voice.js', 'motion.js', 'neko.js', 'push.js', 'assets/ui/neko2/sprites.json', 'plan.html', 'plan.json', 'data/characters.json', 'manifest.json', 'icon-192.png', 'icon-512.png', 'assets/ui/elevator.webp', 'assets/ui/elevator-wide.webp'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('.mp4')) return; // 영상은 브라우저가 알아서 (부분 요청)
  // 그림: 한 번 받으면 캐시에서
  if (u.pathname.includes('/assets/')) {
    // 처음 받을 때는 브라우저 임시 저장을 건너뛰고 서버에 확인한다 (고친 그림이 옛것으로 남지 않게)
    e.respondWith(caches.match(e.request).then(r => r || fetch(u.href, { cache: 'no-cache', credentials: 'same-origin' }).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(e.request, c)); } return res; })));
    return;
  }
  // 앱 파일: 인터넷이 되면 새 것(브라우저 임시 저장도 건너뛰고 서버에 확인), 안 되면 캐시
  e.respondWith(fetch(u.href, { cache: 'no-cache', credentials: 'same-origin' }).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(e.request, c)); } return res; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

// ---------- 앱이 꺼져 있을 때 알림 (push.js · push-server) ----------
// 알림 서버가 내용 없는 푸시로 깨우면, 보낼 알림을 받아 와서 띄운다
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let items = [];
    try {
      const cfg = await (await caches.open('hanul-push-cfg')).match('push-cfg');
      const c = cfg && await cfg.json();
      if (c && c.url) items = (await (await fetch(`${c.url}/pending?id=${encodeURIComponent(c.id)}&key=${encodeURIComponent(c.key)}`)).json()).items || [];
    } catch (err) {}
    if (!items.length) items = [{ title: '한울아파트', body: '확인할 게 있어요.', tag: 'hanul' }];
    await Promise.all(items.slice(-5).map(i => self.registration.showNotification(i.title || '한울아파트', { body: i.body || '', tag: i.tag || undefined, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './' } })));
  })());
});
// 알림을 누르면 앱을 연다 (이미 열려 있으면 그 창으로)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = all.find(c => c.url.startsWith(self.registration.scope));
    if (w) return w.focus();
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  })());
});
