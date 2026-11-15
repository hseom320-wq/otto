// 한울아파트 — 계정 연동 (폰·태블릿이 같은 기록을 쓴다)
// 같은 GitHub 계정의 "비공개 저장소" 하나에 기록 파일(data.json)을 두고, 기기마다 그 저장소에 연결해 두면 저절로 맞춰진다.
//  - 연결: 설정 → 계정 연동에 "저장소 이름(아이디/저장소)"과 "토큰"을 넣는다. 토큰은 그 저장소 하나만 읽고 쓸 수 있게 만든다.
//  - 언제 맞추나: 앱을 열 때, 앱으로 돌아올 때, 무언가 바뀌고 20초 뒤, 앱을 내릴 때.
//  - 두 기기에서 따로 바꾼 것도 합친다: 지난번 맞춘 기록(바탕)과 비교해서 바뀐 쪽을 쓰고, 둘 다 바꾸면
//    공부 시간·호감도처럼 쌓이는 숫자는 두 기기에서 늘어난 만큼 더하고, 목록은 합치고, 나머지는 나중에 바꾼 기기 것을 쓴다.
//  - Gemini 키·유튜브 키·토큰·알림 설정·진행 중인 타이머처럼 기기마다 다른 것은 보내지 않는다.
'use strict';
(() => {
const APP_KEY = 'hanul-v1', PLAN_KEY = 'final-plan-2026-2';
const CFG_KEY = 'hanul-sync', BASE_KEY = 'hanul-sync-base';
const FILE = 'data.json';
const LOCAL_ONLY = ['key', 'ytKey', 'gModel', 'gModelKey', 'notify', 'wx', 'fired', 'tv', 'focus', 'mini'];
const COUNTER = /^app\.(slog|slogSub)(\.|$)|\.aff$/; // 두 기기에서 늘어난 만큼 더하는 숫자
const API = 'https://api.github.com';
const REPO_NAME = 'hanul-data';
const OWNER = (location.hostname.match(/^([\w-]+)\.github\.io$/) || [])[1] || 'hseom320-wq'; // 앱 주소에서 GitHub 아이디

const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
let cfg = read(CFG_KEY) || null; // {repo:'아이디/저장소', token, at, from}
const device = () => /iPad|Tablet|SM-X|SM-T/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) >= 600) ? '태블릿' : '폰';

// ---------- 비교·합치기 ----------
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
function canon(x) { // 키 순서와 상관없이 같은지 보려고
  if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
  if (isObj(x)) return '{' + Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
  return JSON.stringify(x === undefined ? null : x);
}
const eq = (a, b) => (a === undefined || b === undefined) ? a === b : canon(a) === canon(b);
function merge3(b, l, r, path, lNewer) {
  if (eq(l, r)) return l;
  if (eq(l, b)) return r;
  if (eq(r, b)) return l;
  if (l === undefined) return r;
  if (r === undefined) return l;
  if (isObj(l) && isObj(r)) {
    const out = {}, bb = isObj(b) ? b : {};
    new Set([...Object.keys(l), ...Object.keys(r)]).forEach(k => { const m = merge3(bb[k], l[k], r[k], path + '.' + k, lNewer); if (m !== undefined) out[k] = m; });
    return out;
  }
  if (Array.isArray(l) && Array.isArray(r)) return mergeArr(Array.isArray(b) ? b : [], l, r, path, lNewer);
  if (typeof l === 'number' && typeof r === 'number' && COUNTER.test(path)) { const bb = typeof b === 'number' ? b : 0; return bb + (l - bb) + (r - bb); }
  return lNewer ? l : r;
}
// 목록: id가 있으면 id로, 없으면 내용으로 짝을 맞춘다. 한쪽에서 지운 건(다른 쪽이 안 바꿨으면) 지운다.
function mergeArr(b, l, r, path, lNewer) {
  const key = x => (isObj(x) && x.id != null ? 'id:' + x.id : 'v:' + canon(x));
  const map = a => { const m = new Map(); a.forEach(x => { const k = key(x); if (!m.has(k)) m.set(k, x); }); return m; };
  const bm = map(b), lm = map(l), rm = map(r), out = [], seen = new Set();
  const take = x => {
    const k = key(x); if (seen.has(k)) return; seen.add(k);
    const inB = bm.has(k), inL = lm.has(k), inR = rm.has(k);
    if (inB && (!inL || !inR)) { const other = inL ? lm.get(k) : rm.get(k); if (eq(other, bm.get(k))) return; }
    const item = isObj(x) && x.id != null ? merge3(bm.get(k), lm.get(k), rm.get(k), path + '[]', lNewer) : x;
    if (item !== undefined) out.push(item);
  };
  (lNewer ? l : r).forEach(take); (lNewer ? r : l).forEach(take);
  return out;
}

// ---------- 이 기기 기록 ----------
function localDoc() {
  const app = JSON.parse(JSON.stringify(S));
  LOCAL_ONLY.forEach(k => delete app[k]);
  return { app, plan: read(PLAN_KEY) };
}
function applyLocal(doc) {
  const keep = {}; LOCAL_ONLY.forEach(k => { if (S[k] !== undefined) keep[k] = S[k]; });
  Object.keys(S).forEach(k => { if (!LOCAL_ONLY.includes(k) && !(k in doc.app)) delete S[k]; });
  Object.assign(S, JSON.parse(JSON.stringify(doc.app)), keep);
  applying = true; save(); applying = false;
  if (doc.plan) write(PLAN_KEY, doc.plan);
  // 화면 다시 그리기
  try { if (window.renderHome) renderHome(); } catch (e) {}
  try { if (window.refresh && typeof sheetOpen !== 'undefined' && sheetOpen) refresh(); } catch (e) {}
}

// ---------- GitHub ----------
const b64e = s => { const u = new TextEncoder().encode(s); let t = ''; for (let i = 0; i < u.length; i += 0x8000) t += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(t); };
const b64d = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
async function gh(path, opt = {}, c = cfg) {
  const r = await fetch(API + path, { ...opt, cache: 'no-store', headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opt.headers || {}) } });
  return r;
}
async function pull() {
  const r = await gh(`/repos/${cfg.repo}/contents/${FILE}`);
  if (r.status === 404) return { doc: null, sha: null };
  if (!r.ok) throw httpErr(r);
  const j = await r.json();
  let text = j.content ? b64d(j.content) : '';
  if (!text && j.size) { const raw = await gh(`/repos/${cfg.repo}/contents/${FILE}`, { headers: { Accept: 'application/vnd.github.raw+json' } }); text = await raw.text(); }
  let doc = null; try { doc = JSON.parse(text); } catch (e) {}
  return { doc: doc && doc.kind === 'hanul-sync' ? doc : null, sha: j.sha };
}
async function push(doc, sha) {
  const body = { message: `${device()}에서 연동 ${new Date().toLocaleString('ko-KR')}`, content: b64e(JSON.stringify(doc)) };
  if (sha) body.sha = sha;
  const r = await gh(`/repos/${cfg.repo}/contents/${FILE}`, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
  if (r.status === 409 || r.status === 422) return false; // 그 사이 다른 기기가 올렸다 → 다시
  if (!r.ok) throw httpErr(r);
  return true;
}
function httpErr(r) { const e = new Error('HTTP ' + r.status); e.status = r.status; return e; }
function errText(e) {
  if (!navigator.onLine) return '인터넷이 끊겨 있어요';
  if (e.status === 401) return '토큰이 틀렸거나 기간이 끝났어요';
  if (e.status === 403) return '토큰에 이 저장소 쓰기 권한이 없어요';
  if (e.status === 404) return '저장소를 못 찾았어요 (이름·토큰 권한 확인)';
  return '연동하지 못했어요';
}

// ---------- 맞추기 ----------
let busy = null, applying = false, lastErr = '', dirtyT = 0;
async function sync(opts = {}) {
  if (!cfg || !cfg.token) return;
  if (busy) return busy;
  busy = (async () => {
    for (let tries = 0; tries < 3; tries++) {
      const { doc: remote, sha } = await pull();
      const local = localDoc(), base = read(BASE_KEY);
      let merged;
      if (!remote) merged = local;
      else if (!base) {
        // 이 기기를 처음 연결: 어느 쪽 기록을 쓸지 묻는다
        const pickRemote = opts.first ? await chooseFirst(remote) : true;
        merged = pickRemote ? { app: remote.app, plan: remote.plan } : local;
      } else {
        const lNewer = (cfg.changed || 0) >= (remote.at || 0);
        merged = { app: merge3(base.app, local.app, remote.app, 'app', lNewer), plan: merge3(base.plan, local.plan, remote.plan, 'plan', lNewer) };
      }
      if (!eq(merged, local)) applyLocal(merged);
      if (!remote || !eq(merged.app, remote.app) || !eq(merged.plan, remote.plan)) {
        const ok = await push({ kind: 'hanul-sync', v: 2, at: Date.now(), from: device(), ...merged }, sha);
        if (!ok) continue;
      }
      write(BASE_KEY, merged);
      cfg.at = Date.now(); cfg.changed = 0; write(CFG_KEY, cfg);
      lastErr = ''; status();
      return true;
    }
    return false;
  })().catch(e => { lastErr = errText(e); status(); if (opts.loud) toast(lastErr); return false; }).finally(() => { busy = null; });
  return busy;
}
// 무언가 저장되면 표시해 두고 20초 뒤에 맞춘다
const baseSave = save;
save = function () {
  baseSave.apply(this, arguments);
  if (applying || !cfg) return;
  cfg.changed = Date.now(); write(CFG_KEY, cfg);
  clearTimeout(dirtyT); dirtyT = setTimeout(() => sync(), 20e3);
};
// 기말 체크(plan.html이 따로 저장)도 바뀌었는지 가끔 본다
let planSeen = localStorage.getItem(PLAN_KEY);
setInterval(() => { const p = localStorage.getItem(PLAN_KEY); if (p !== planSeen) { planSeen = p; if (cfg && !applying) { cfg.changed = Date.now(); write(CFG_KEY, cfg); sync(); } } }, 15e3);
document.addEventListener('visibilitychange', () => { if (!cfg) return; if (document.hidden) { if (cfg.changed) sync(); } else sync(); });
addEventListener('online', () => sync());
setTimeout(() => sync(), 1500);

// ---------- 처음 연결할 때 묻기 ----------
function chooseFirst(remote) {
  return new Promise(res => {
    const d = new Date(remote.at || 0), when = `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const box = document.createElement('div');
    box.className = 'sync-ask'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '어느 기록을 쓸까요');
    box.innerHTML = `<p><b>저장소에 이미 기록이 있어요.</b><br>${esc(remote.from || '다른 기기')}에서 ${when}에 올린 기록이에요. 이 기기에서는 어느 기록을 쓸까요?</p>
      <button class="btn wide use-remote">저장소 기록 쓰기 (추천)</button>
      <button class="btn ghost wide use-local">이 기기 기록으로 저장소를 덮기</button>`;
    box.querySelector('.use-remote').onclick = () => { box.remove(); res(true); };
    box.querySelector('.use-local').onclick = () => { if (confirm('저장소의 기록이 이 기기 기록으로 바뀌어요. 다른 기기에서 한 것이 사라질 수 있어요. 덮을까요?')) { box.remove(); res(false); } };
    document.getElementById('app').appendChild(box);
  });
}

// ---------- 설정 화면 ----------
let statusEl = null;
function status() {
  if (!statusEl || !statusEl.isConnected) return;
  if (!cfg) { statusEl.textContent = '연결 안 됨'; return; }
  const t = cfg.at ? new Date(cfg.at) : null;
  statusEl.textContent = lastErr ? `⚠ ${lastErr}` : `연결됨 · ${cfg.repo}${t ? ` · 마지막 연동 ${pad(t.getHours())}:${pad(t.getMinutes())}` : ''}`;
  statusEl.classList.toggle('bad', !!lastErr);
}
async function connect(repo, token) {
  repo = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  token = token.trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { toast('저장소는 "아이디/저장소이름" 모양으로 넣어 주세요'); return false; }
  if (!token) { toast('토큰을 넣어 주세요'); return false; }
  const c = { repo, token };
  let r;
  try { r = await gh(`/repos/${repo}`, {}, c); } catch (e) { toast('인터넷 연결을 확인해 주세요'); return false; }
  if (!r.ok) { toast(errText(httpErr(r))); return false; }
  const j = await r.json();
  if (!j.private) { toast('공개 저장소예요. 기록이 다 보이니까 비공개 저장소로 만들어 주세요'); return false; }
  if (j.permissions && !j.permissions.push) { toast('토큰에 쓰기 권한이 없어요 (Contents: Read and write)'); return false; }
  cfg = { repo, token, at: 0, changed: Date.now() };
  localStorage.removeItem(BASE_KEY);
  write(CFG_KEY, cfg);
  const ok = await sync({ first: true, loud: true });
  if (ok) toast('연결했어요. 이제 이 기기 기록이 저절로 맞춰져요');
  return ok;
}
function disconnect() {
  if (!confirm('이 기기의 연동을 끊을까요? 이 기기 기록은 그대로 남고, 저장소의 기록도 그대로예요.')) return;
  cfg = null; localStorage.removeItem(CFG_KEY); localStorage.removeItem(BASE_KEY); status();
}
const baseSet = SHEETS.set.render;
SHEETS.set.render = function () {
  baseSet();
  const b = body(), reset = b.querySelector('.reset-all') || b.lastElementChild;
  const f = el('div', 'field sync-field', '<b>계정 연동 (폰·태블릿 같은 기록)</b>');
  statusEl = el('p', 'sync-status'); f.appendChild(statusEl);
  if (cfg) {
    const row = el('div', 'row'), now = el('button', 'btn', '지금 맞추기'), off = el('button', 'btn ghost', '연결 끊기');
    now.onclick = async () => { now.disabled = true; const ok = await sync({ loud: true }); now.disabled = false; if (ok) toast('맞췄어요'); };
    off.onclick = () => { disconnect(); refresh(); };
    row.append(now, off); f.appendChild(row);
    // 다른 기기는 QR 하나로 연결
    const qrBtn = el('button', 'btn ghost wide', '다른 기기 연결하기 (QR)');
    qrBtn.onclick = () => showQR(f, qrBtn);
    f.appendChild(qrBtn);
  } else {
    // 1·2단계: GitHub 화면을 미리 채워서 연다. 3단계: 토큰만 붙여 넣으면 끝
    f.appendChild(el('p', 'hint', '처음 한 기기에서만 아래 3단계를 해요. 두 번째 기기는 첫 기기의 "다른 기기 연결하기 (QR)"를 카메라로 찍으면 끝이에요.'));
    const s1 = el('a', 'btn ghost wide sync-step', '① GitHub에 비공개 저장소 만들기');
    s1.href = `https://github.com/new?name=${REPO_NAME}&visibility=private&description=${encodeURIComponent('한울아파트 기록 보관 (비공개)')}`; s1.target = '_blank'; s1.rel = 'noopener';
    const s2 = el('a', 'btn ghost wide sync-step', '② 토큰 만들기');
    s2.href = `https://github.com/settings/personal-access-tokens/new?name=hanul-sync&description=${encodeURIComponent('한울아파트 기기 연동 (hanul-data 저장소 하나만)')}&target_name=${OWNER}&expires_in=366&contents=write`; s2.target = '_blank'; s2.rel = 'noopener';
    const tip = el('p', 'hint', '②에서는 <b>Repository access → Only select repositories → hanul-data</b>만 고르고, 맨 아래 <b>Generate token</b>을 누른 뒤 나온 토큰을 복사해요.');
    const tok = el('input', 'in'); tok.type = 'password'; tok.placeholder = '③ 복사한 토큰 붙여 넣기 (github_pat_…)'; tok.autocomplete = 'off'; tok.setAttribute('aria-label', '토큰');
    const more = el('details', 'sync-help', '<summary>저장소 이름을 바꿨으면</summary>');
    const repo = el('input', 'in'); repo.value = `${OWNER}/${REPO_NAME}`; repo.autocomplete = 'off'; repo.setAttribute('aria-label', '저장소');
    more.appendChild(repo);
    const go = el('button', 'btn wide', '연결하기');
    go.onclick = async () => { go.disabled = true; go.textContent = '확인 중…'; const ok = await connect(repo.value, tok.value); go.disabled = false; go.textContent = '연결하기'; if (ok) refresh(); };
    f.append(s1, s2, tip, tok, more, go,
      el('p', 'hint', '토큰은 이 기기에만 저장되고, 그 저장소 하나만 읽고 쓸 수 있어요. 남한테 보여 주지 마세요.'));
  }
  b.insertBefore(f, reset);
  status();
};
window.syncNow = () => sync({ loud: true });

// ---------- 다른 기기 연결: QR ----------
// QR에는 앱 주소 + #연결정보(저장소·토큰)가 들어간다. # 뒤는 인터넷으로 보내지지 않고 그 기기 안에서만 읽힌다.
// 화면에 띄운 QR을 다른 기기 카메라로 찍기만 하면 되고, 메신저로 보내지 않는다.
function loadQR() {
  if (window.qrcode) return Promise.resolve();
  return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'assets/vendor/qrcode.min.js'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
}
async function showQR(f, btn) {
  const old = f.querySelector('.sync-qr'); if (old) { old.remove(); btn.textContent = '다른 기기 연결하기 (QR)'; return; }
  try { await loadQR(); } catch (e) { toast('QR을 만들지 못했어요. 인터넷을 확인해 주세요'); return; }
  const link = location.origin + location.pathname + '#sync=' + encodeURIComponent(b64e(JSON.stringify({ r: cfg.repo, t: cfg.token })));
  const qr = qrcode(0, 'M'); qr.addData(link); qr.make();
  const box = el('div', 'sync-qr');
  box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true }) +
    '<p>다른 기기(태블릿)의 <b>카메라</b>로 이 QR을 찍고, 뜨는 링크를 열어요. 한울아파트가 열리면서 "연결할까요?"가 나와요.<br>이 QR에는 토큰이 들어 있어요. 캡처해서 남에게 보내지 마세요. 1분 뒤에 저절로 사라져요.</p>';
  f.insertBefore(box, btn.nextSibling); btn.textContent = 'QR 숨기기';
  setTimeout(() => { if (box.isConnected) { box.remove(); btn.textContent = '다른 기기 연결하기 (QR)'; } }, 60e3);
}
// QR로 열렸을 때
(function fromLink() {
  const m = location.hash.match(/#sync=([^&]+)/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search); // 주소에서 바로 지운다
  let d = null; try { d = JSON.parse(b64d(decodeURIComponent(m[1]))); } catch (e) {}
  if (!d || !d.r || !d.t) { setTimeout(() => toast('연결 QR이 올바르지 않아요'), 1500); return; }
  setTimeout(async () => {
    if (cfg && cfg.repo === d.r && cfg.token === d.t) { toast('이미 연결돼 있어요'); return; }
    if (!confirm(`${d.r} 저장소에 연결할까요?\n연결하면 폰·태블릿이 같은 기록을 써요.`)) return;
    await connect(d.r, d.t);
  }, 1800);
})();
// 설정 제목 아래 글도 연동 여부에 맞게
const baseSub = SHEETS.set.sub;
SHEETS.set.sub = () => (cfg ? `${cfg.repo.split('/')[1]} 저장소와 맞춰져요` : (baseSub ? baseSub() : ''));
})();
