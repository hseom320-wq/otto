// 한울아파트 — 앱을 닫아도 보이게
// 1) 앱 아이콘 배지: 오늘 남은 할 일(+기말 할 일) 개수를 아이콘에 표시한다.
// 2) 알림 서버(push-server/worker.js)에 "언제 무슨 알림을 보낼지" 목록을 보내 둔다. 앱이 꺼져 있어도 그 시각에 알림이 온다.
//    공부 타이머 끝 · 일정 10분 전 · 매주 일정 · 인터폰 모닝콜 · 저녁 9시 기말 할 일 · 시험 날 아침.
// 3) 앱이 뒤에 있을 때 타이머가 끝나면 바로 알린다.
// 알림은 설정의 "알림"을 켰을 때만. 서버 주소(PUSH_URL)가 비어 있으면 1·3번만 동작한다.
'use strict';
(() => {
const PUSH_URL = '';  // 알림 서버 주소 (Cloudflare Workers). 비어 있으면 앱이 켜져 있을 때만 알림
const PKEY = 'hanul-push';
const rid = () => [...crypto.getRandomValues(new Uint8Array(18))].map(b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[b & 63]).join('');
let P = (() => { try { return JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) { return {}; } })();
if (!P.id) { P.id = rid(); P.key = rid(); }
const keep = () => { try { localStorage.setItem(PKEY, JSON.stringify(P)); } catch (e) {} };
keep();
const canNotify = () => S.notify && 'Notification' in window && Notification.permission === 'granted';
const reg = () => ('serviceWorker' in navigator ? navigator.serviceWorker.getRegistration() : Promise.resolve(null));

// ---------- 1) 앱 아이콘 배지 ----------
function badge() {
  try {
    if (!('setAppBadge' in navigator)) return;
    let n = S.todos.filter(t => !t.done && (!t.due || t.due.slice(0, 10) <= calDay())).length;
    const fs = window.finalStatus && finalStatus(); if (fs && !fs.before && !fs.after) n += fs.left;
    n ? navigator.setAppBadge(n).catch(() => {}) : navigator.clearAppBadge().catch(() => {});
  } catch (e) {}
}
const calDay = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// ---------- 3) 앱이 뒤에 있을 때 타이머 끝 ----------
window.notifyFocusEnd = async (subject, mins) => {
  if (!canNotify()) return;
  const r = await reg(); if (!r) return;
  const c = C || who();
  r.showNotification(`${subject} ${mins}분 끝!`, { body: `${c.name}: ${fill(pick(c.app.alldone || ['수고했어.']))}`, tag: 'hanul-focus-end', icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './' } }).catch(() => {});
};

// ---------- 2) 알림 서버에 보낼 목록 ----------
const who = () => DATA.characters.find(x => x.code === (S.pick && S.pick.code)) || DATA.characters[0];
const line = (t, o = {}) => fill(String(t || '')).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
const at = (day, hm) => new Date(`${day}T${hm}:00`).getTime();
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
function items() {
  const c = who(), now = Date.now(), out = [];
  const push = (t, title, body, tag) => { if (t > now + 30e3 && t < now + 8 * 864e5) out.push({ at: t, title, body, tag }); };
  // 공부 타이머 끝
  const f = window.focusState && focusState();
  if (f && !f.paused) push(f.end, `${f.subject} ${Math.round(f.len / 60e3)}분 끝!`, `${c.name}: ${line(c.app.study_end)}`, 'focus-end');
  // 시간 있는 할 일: 10분 전
  S.todos.filter(t => !t.done && t.due).forEach(t => push(new Date(t.due).getTime() - 10 * 60e3, c.name, line(c.app.remind, { text: t.text, time: t.due.slice(11, 16) }), 'todo-' + t.id));
  // 매주 일정: 앞으로 7일, 10분 전
  for (let i = 0; i < 7; i++) {
    const day = addDays(i), wd = new Date(day + 'T12:00').getDay();
    S.reps.filter(r => r.days.includes(wd)).forEach(r => push(at(day, r.time) - 10 * 60e3, c.name, line(c.app.remind, { text: r.text, time: r.time }), `rep-${r.id}-${day}`));
    // 인터폰 모닝콜
    if (S.morning && S.morning.on) push(at(day, S.morning.time), '인터폰', `${c.name}: ${line(pick(c.app.call || ['일어나.']))}`, 'morning-' + day);
  }
  // 기말: 저녁 9시에 그날 남은 할 일, 시험 날 아침 7시에 시험 안내
  const fs = window.finalStatus && finalStatus();
  if (window.finalDays) finalDays().forEach(d => {
    if (d.left) push(at(d.date, '21:00'), `${c.name}`, `오늘 기말 할 일 ${d.left}개 남았어. ${d.first || ''}`.trim(), 'final-' + d.date);
    if (d.exams.length) push(at(d.date, '07:00'), '오늘 시험', d.exams.map(x => `${x.name} ${x.period}교시 ${x.start}`).join(', '), 'exam-' + d.date);
  });
  return out.sort((a, b) => a.at - b.at).slice(0, 300);
}

// 브라우저 푸시 구독 (서버 키로)
async function subscribe() {
  const r = await reg(); if (!r || !r.pushManager) throw new Error('이 브라우저는 푸시 알림을 못 받아요');
  let sub = await r.pushManager.getSubscription();
  if (!sub) {
    const k = (await (await fetch(PUSH_URL + '/vapid')).json()).key;
    const raw = Uint8Array.from(atob(k.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
    sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
  }
  // 서비스 워커가 깨어났을 때 알림 내용을 받으러 갈 곳 (서비스 워커는 이 앱의 저장소를 못 읽어서 캐시에 적어 둔다)
  const cache = await caches.open('hanul-push-cfg');
  await cache.put('push-cfg', new Response(JSON.stringify({ url: PUSH_URL, id: P.id, key: P.key })));
  return sub;
}
let last = '', syncing = false;
async function sync(force) {
  badge();
  if (!PUSH_URL || !canNotify() || syncing || !DATA) return;
  const list = items(), sig = JSON.stringify(list);
  if (!force && sig === last && Date.now() - (P.at || 0) < 6 * 3600e3) return;
  syncing = true;
  try {
    const sub = await subscribe();
    const r = await fetch(PUSH_URL + '/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: P.id, key: P.key, sub: sub.toJSON(), items: list }) });
    if (r.ok) { last = sig; P.at = Date.now(); P.ok = true; keep(); }
  } catch (e) { P.ok = false; P.err = String(e.message || e).slice(0, 80); keep(); }
  syncing = false;
}
window.pushSync = () => setTimeout(() => sync(true), 300);
window.pushTest = async () => {
  if (!PUSH_URL) return '알림 서버가 아직 연결되지 않았어요.';
  if (!canNotify()) return '먼저 위의 "알림"을 켜 주세요.';
  await sync(true);
  const c = who();
  const r = await fetch(PUSH_URL + '/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: P.id, key: P.key, title: c.name, body: `${line(pick(c.app.greet))} (알림 시험)` }) }).then(x => x.json()).catch(() => ({}));
  return r.ok ? '보냈어요. 몇 초 안에 알림이 와요. 앱을 닫아 둔 채로 받아 보세요.' : '보내지 못했어요. 잠시 뒤에 다시 해 주세요.';
};
window.pushInfo = () => ({ ready: !!PUSH_URL, ok: !!P.ok, at: P.at, err: P.err });

// 언제 다시 보낼지: 앱을 열 때, 다른 앱으로 나갈 때, 30초마다(바뀐 게 있을 때만)
const start = () => { sync(); setInterval(sync, 30e3); };
if (document.readyState === 'complete') setTimeout(start, 1500); else addEventListener('load', () => setTimeout(start, 1500));
document.addEventListener('visibilitychange', () => { if (document.hidden) sync(); else badge(); });

// 설정 > 알림 칸에 알림 서버 상태와 시험 버튼을 붙인다
const baseSet = SHEETS.set.render;
SHEETS.set.render = function () {
  baseSet();
  const box = document.getElementById('nfOn'); if (!box) return;
  const field = box.closest('.field');
  const st = el('p', 'hint push-st');
  const info = pushInfo();
  st.textContent = !info.ready ? '앱을 닫아도 알림 받기: 알림 서버 준비 중이에요. 지금은 앱이 켜져 있을 때만 와요.'
    : info.ok ? `앱을 닫아도 알림이 와요 (타이머 끝·일정 10분 전·모닝콜·저녁 9시 기말 할 일·시험 날 아침).` : '앱을 닫아도 알림 받기: 알림을 켜면 연결돼요.';
  const t = el('button', 'btn sm ghost', '알림 시험');
  t.onclick = async () => { t.disabled = true; st.textContent = await pushTest(); t.disabled = false; };
  field.append(st, t);
  box.addEventListener('change', () => setTimeout(() => sync(true), 500));
};
})();
