// 한울아파트 — 앱이 꺼져 있어도 수현 전화 (예비 알림)
// 계정 연동에 쓰는 GitHub 비공개 저장소에서 "정해진 시각에 저절로 도는 작업(GitHub Actions)"이 폰으로 푸시 알림을 보낸다.
//  - 앱이 완전히 닫혀 있어도, 폰을 껐다 켠 뒤에도 알림이 온다. 알림을 누르면 앱이 열리면서 수현 전화가 울린다.
//  - 전화 시각부터 5분마다 30분 동안, 그날 전화를 끝낼(받고 고를) 때까지 보낸다. GitHub 예약 작업은 몇 분 늦을 수 있다.
//  - 저장소에 넣는 것: push.json(이 기기 알림 주소·이 기기 전용 서명 키·전화 시각·시험 날·오늘 받았는지),
//    .github/hanul/send.mjs(보내는 코드), .github/workflows/hanul-call.yml(언제 돌지).
//    마지막 파일은 토큰에 "Workflows: Read and write" 권한이 있어야 쓸 수 있다(없으면 설정에서 안내).
// 앱이 살아 있으면 call.js 가 정확한 시각에 컬러링으로 울리고, 이건 앱이 죽어 있을 때를 위한 예비다.
'use strict';
(() => {
const LKEY = 'hanul-pushcall';  // 이 기기: {id, pub, d, on, lastCfg, lastWf, err}
const APP_URL = location.origin + location.pathname.replace(/index\.html$/, '');
const read = () => { try { return JSON.parse(localStorage.getItem(LKEY)) || {}; } catch (e) { return {}; } };
const keep = o => { try { localStorage.setItem(LKEY, JSON.stringify(o)); } catch (e) {} };
let L = read();
if (!L.id) { L.id = [...crypto.getRandomValues(new Uint8Array(9))].map(b => b.toString(16).padStart(2, '0')).join(''); keep(L); }
const device = () => /iPad|Tablet|SM-X|SM-T/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) >= 600) ? '태블릿' : '폰';
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));

// ---------- 저장소에 넣을 것 ----------
const KINDS = () => ({
  night: { on: S.ncall.on !== false, time: S.ncall.time || '23:30' },
  morning: { on: S.ncall.on !== false && S.ncall.morning !== false, time: S.ncall.mTime || '05:30' },
  exam: { on: S.ncall.on !== false && S.ncall.exam !== false, time: S.ncall.examTime || '06:40' },
});
const examDates = () => (window.examDays ? examDays().map(d => d.date) : []);
// 전화 시각부터 30분까지 5분마다 (한국 시각 → GitHub 예약은 UTC)
function cronLines() {
  const by = {};
  Object.values(KINDS()).forEach(c => {
    if (!c.on) return;
    const [h, m] = c.time.split(':').map(Number);
    for (let i = 0; i <= 30; i += 5) { const t = ((h * 60 + m + i - 540) % 1440 + 1440) % 1440; (by[Math.floor(t / 60)] = by[Math.floor(t / 60)] || new Set()).add(t % 60); }
  });
  return Object.entries(by).map(([h, ms]) => `    - cron: '${[...ms].sort((a, b) => a - b).join(',')} ${h} * * *'`);
}
function workflow() {
  return `# 한울아파트 수현 전화 (앱이 꺼져 있을 때 예비 알림) — 앱이 만들어 넣은 파일. 시각은 앱 설정에서 바꾸면 여기도 바뀐다.
name: 한울 전화
on:
  schedule:
${cronLines().join('\n')}
  workflow_dispatch:
    inputs:
      test:
        description: '지금 바로 테스트 알림 보내기'
        type: boolean
        default: true
permissions:
  contents: read
jobs:
  call:
    runs-on: ubuntu-latest
    timeout-minutes: 4
    steps:
      - uses: actions/checkout@v4
        with:
          sparse-checkout: |
            push.json
            .github/hanul
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install --no-save --no-audit --no-fund --silent web-push@3.6.7
        working-directory: .github/hanul
      - run: node .github/hanul/send.mjs
        env:
          HANUL_TEST: \${{ github.event.inputs.test }}
`;
}
const SENDER = `// 한울아파트 수현 전화 — 정한 시각이 됐고 오늘 그 전화를 아직 안 끝냈으면 폰으로 푸시를 보낸다 (앱이 만들어 넣은 파일)
import fs from 'node:fs';
import webpush from 'web-push';
const cfg = JSON.parse(fs.readFileSync('push.json', 'utf8'));
const kst = new Date(Date.now() + 9 * 3600e3);
const ymd = d => d.toISOString().slice(0, 10);
const now = kst.getUTCHours() * 60 + kst.getUTCMinutes();
let due = process.env.HANUL_TEST === 'true' ? 'test' : null; // Actions 화면의 Run workflow 로 돌리면 바로 테스트 알림
for (const [k, c] of due ? [] : Object.entries(cfg.calls || {})) {
  if (!c.on) continue;
  const [h, m] = c.time.split(':').map(Number);
  let diff = now - (h * 60 + m), day = ymd(kst);
  if (diff < -720) { diff += 1440; day = ymd(new Date(kst - 864e5)); } // 자정 넘어 도는 경우 (밤 전화)
  if (diff < -3 || diff > 45) continue;
  if (k === 'exam' && !(cfg.examDays || []).includes(day)) continue;
  const st = (cfg.state || {})[k];
  if (st && st.day === day && st.done) { console.log(k, '오늘은 이미 끝'); continue; }
  due = k; break;
}
if (!due) { console.log('보낼 전화 없음', ymd(kst), now); process.exit(0); }
const payload = JSON.stringify({ kind: 'ncall', call: due === 'test' ? 'night' : due, title: '📞 남수현', body: due === 'test' ? '테스트 전화예요. 눌러서 받아 보기' : due === 'exam' ? '오늘 시험이다. 전화 받아.' : '전화 왔어요. 눌러서 받기' });
for (const s of cfg.subs || []) {
  try {
    await webpush.sendNotification(s.sub, payload, { TTL: 900, urgency: 'high', vapidDetails: { subject: /^(https:|mailto:)/.test(cfg.app || '') ? cfg.app : 'https://github.com/', publicKey: s.pub, privateKey: s.d } });
    console.log('보냄', s.device, due);
  } catch (e) { console.log('실패', s.device, e.statusCode || e.message); }
}
`;

// ---------- 저장소 읽고 쓰기 ----------
async function readCfg() { const f = await hanulRepo.get('push.json'); let j = null; try { j = f && JSON.parse(f.text); } catch (e) {} return { j: j || { subs: [], calls: {}, state: {} }, sha: f && f.sha }; }
async function writeCfg(mut, msg) {
  for (let i = 0; i < 3; i++) {
    const { j, sha } = await readCfg();
    mut(j);
    try { await hanulRepo.put('push.json', JSON.stringify(j, null, 1), sha, msg); return j; }
    catch (e) { if (e.status !== 409 && e.status !== 422) throw e; } // 그 사이 다른 기기가 바꿨으면 다시
  }
  throw new Error('저장소가 바빠요');
}
async function putIfChanged(path, text, msg) {
  const f = await hanulRepo.get(path);
  if (f && f.text === text) return false;
  await hanulRepo.put(path, text, f && f.sha, msg); return true;
}
const baseCfg = j => { j.app = APP_URL; j.calls = KINDS(); j.examDays = examDates(); j.state = j.state || {}; j.subs = j.subs || []; };

// ---------- 켜기 ----------
async function enable() {
  if (!window.hanulRepo || !hanulRepo.linked()) { toast('먼저 설정 → 계정 연동을 연결해 주세요'); return false; }
  if (!('PushManager' in window) || !('serviceWorker' in navigator)) { toast('이 브라우저는 푸시 알림을 못 받아요'); return false; }
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') { toast('알림을 허용해야 해요 (폰 설정 → 앱 → 한울아파트 → 알림)'); return false; }
  const reg = await navigator.serviceWorker.ready;
  // 이 기기 전용 서명 키 (보내는 쪽이 "이 앱이 보낸 알림"임을 증명하는 데 쓴다)
  if (!L.pub || !L.d) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    L.pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
    L.d = (await crypto.subtle.exportKey('jwk', kp.privateKey)).d;
    keep(L);
  }
  let sub = await reg.pushManager.getSubscription();
  if (sub && b64u(sub.options.applicationServerKey || new ArrayBuffer(0)) !== L.pub) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(L.pub) });
  await writeCfg(j => { baseCfg(j); j.subs = j.subs.filter(x => x.id !== L.id); j.subs.push({ id: L.id, device: device(), sub: sub.toJSON(), pub: L.pub, d: L.d, at: Date.now() }); }, `${device()} 푸시 전화 켬`);
  await putIfChanged('.github/hanul/send.mjs', SENDER, '수현 전화 보내는 코드');
  L.on = true; L.err = ''; keep(L);
  await syncWorkflow(true);
  return true;
}
async function disable() {
  try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) {}
  try { await writeCfg(j => { j.subs = (j.subs || []).filter(x => x.id !== L.id); }, `${device()} 푸시 전화 끔`); } catch (e) {}
  L.on = false; keep(L);
}
// 전화 시각이 바뀌면 예약 시각도 바꾼다
async function syncWorkflow(loud) {
  const wf = workflow();
  if (L.lastWf === wf && !loud) return;
  try { await putIfChanged('.github/workflows/hanul-call.yml', wf, '수현 전화 예약 시각'); L.lastWf = wf; L.err = ''; }
  catch (e) { L.err = e.status === 403 || e.status === 404 || e.status === 422 ? 'workflow' : 'net'; }
  keep(L);
  if (loud) toast(L.err === 'workflow' ? '토큰에 Workflows 권한을 하나 더 켜 주세요 (설정 안내 참고)' : L.err ? '저장소에 쓰지 못했어요. 다시 해 주세요' : '켰어요. 이제 앱이 꺼져 있어도 알림이 와요');
}
// 하루에 한 번·설정이 바뀔 때 저장소의 시각·시험 날을 맞춘다
async function refreshCfg() {
  if (!L.on || !window.hanulRepo || !hanulRepo.linked()) return;
  const want = JSON.stringify({ c: KINDS(), e: examDates() });
  if (L.lastCfg === want) { syncWorkflow(false); return; }
  try { await writeCfg(baseCfg, '수현 전화 시각 맞춤'); L.lastCfg = want; keep(L); } catch (e) {}
  syncWorkflow(false);
}
// 전화를 끝내면(받고 고르면) 오늘은 더 안 보내게 알린다
let stT = 0, stQ = {};
window.pushCallState = (kind, st) => {
  if (!L.on || !window.hanulRepo || !hanulRepo.linked()) return;
  stQ[kind] = st; clearTimeout(stT);
  stT = setTimeout(() => { const q = stQ; stQ = {}; writeCfg(j => { j.state = j.state || {}; Object.assign(j.state, q); }, '수현 전화 받음').catch(() => {}); }, 1500);
};
setTimeout(refreshCfg, 6000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(refreshCfg, 3000); });

// ---------- 알림으로 열렸을 때 ----------
function fromPush(kind) { if (!kind) return; const go = () => { if (!window.ncallFromPush || typeof DATA === 'undefined' || !DATA) return setTimeout(go, 400); ncallFromPush(kind); }; go(); }
(function () {
  const u = new URLSearchParams(location.search), k = u.get('call');
  if (k) { history.replaceState(null, '', location.pathname); fromPush(k); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.call) fromPush(e.data.call); });
})();

// ---------- 설정 ----------
const baseSet = SHEETS.set.render;
SHEETS.set.render = function () {
  baseSet();
  const field = body().querySelector('.nc-field'); if (!field) return;
  const box = el('div', 'pc-box');
  const linked = window.hanulRepo && hanulRepo.linked();
  const stat = !linked ? '계정 연동을 먼저 연결해야 해요' : !L.on ? '꺼져 있음' : L.err === 'workflow' ? '⚠ 거의 다 됐어요. 토큰 권한 하나만 더 켜 주세요' : L.err ? '⚠ 저장소에 쓰지 못했어요' : '켜져 있음 · 앱이 꺼져 있어도 알림이 와요';
  box.innerHTML = `<b>앱이 꺼져 있어도 전화 받기</b><p class="pc-stat${L.err ? ' bad' : ''}">${stat}</p>`;
  const row = el('div', 'row');
  if (L.on) {
    const re = el('button', 'btn ghost sm', '다시 맞추기'), off = el('button', 'btn ghost sm', '끄기');
    re.onclick = async () => { re.disabled = true; try { await enable(); } catch (e) { toast('다시 해 주세요'); } re.disabled = false; refresh(); };
    off.onclick = async () => { await disable(); toast('껐어요'); refresh(); };
    row.append(re, off);
  } else {
    const on = el('button', 'btn sm', '켜기');
    on.disabled = !linked;
    on.onclick = async () => { on.disabled = true; on.textContent = '켜는 중…'; try { await enable(); } catch (e) { toast('켜지 못했어요: ' + (e.message || '')); } refresh(); };
    row.append(on);
  }
  box.append(row);
  if (L.err === 'workflow') box.append(el('p', 'hint', `GitHub → Settings → Developer settings → Fine-grained tokens → 한울 연동에 쓴 토큰 → <b>Edit</b> → Repository permissions → <b>Workflows: Read and write</b>를 켜고 저장한 뒤, 여기서 "다시 맞추기"를 눌러요. 토큰 문자열은 그대로라 앱에 다시 넣을 필요 없어요.`));
  box.append(el('p', 'hint', '앱이 살아 있으면 정한 시각에 컬러링으로 울리고, 앱이 완전히 꺼져 있으면 GitHub가 폰으로 알림을 보내요(몇 분 늦을 수 있고, 소리는 폰 알림음). 알림을 누르면 수현 전화가 울려요. 전화를 끝낼 때까지 5분마다 30분 동안 보내요.'));
  field.appendChild(box);
};
})();
