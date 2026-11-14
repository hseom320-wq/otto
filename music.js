// 한울아파트 — 음악 (스포티파이 리모컨)
// 내 스포티파이 계정을 연결해서 플레이리스트를 고르고 재생·일시정지·다음 곡을 누른다.
// 소리는 폰(또는 다른 기기)의 스포티파이 앱에서 나고, 이 앱은 리모컨 역할을 한다. 프리미엄 계정이 필요하다.
// 로그인은 스포티파이 공식 방식(PKCE)이라 비밀번호나 비밀 키를 이 앱이 갖지 않는다. 받은 출입증(토큰)은 이 폰에만 저장한다.
// app.js·features.js·study.js·plan.js 뒤에 불러온다.
'use strict';
(() => {
const CLIENT_ID = 'dfed72b88f194002a8fac1686e8accdf'; // 스포티파이 개발자 대시보드의 Client ID (공개돼도 되는 값)
const REDIRECT = location.origin + location.pathname.replace(/index\.html$/, ''); // 대시보드에 등록한 주소와 글자 하나까지 같아야 한다
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative';
const LS = 'hanul-spotify';
const API = 'https://api.spotify.com/v1', ACC = 'https://accounts.spotify.com';

// ---------- 저장 (이 폰에만) ----------
let M = Object.assign({ access: '', refresh: '', exp: 0, study: null }, (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } })());
const keep = () => { try { localStorage.setItem(LS, JSON.stringify(M)); } catch (e) {} };
const linked = () => !!M.refresh;

// ---------- 로그인 (PKCE) ----------
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = n => b64(crypto.getRandomValues(new Uint8Array(n)));
async function connect() {
  if (!crypto.subtle) { toast('이 주소에서는 연결할 수 없어요. 앱 주소(https)로 열어 주세요.'); return; }
  const verifier = rand(48), state = rand(12);
  const challenge = b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  try { localStorage.setItem(LS + '-pkce', JSON.stringify({ verifier, state, at: Date.now() })); } catch (e) {}
  location.href = `${ACC}/authorize?` + new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT, scope: SCOPES, state, code_challenge_method: 'S256', code_challenge: challenge });
}
async function tokenCall(params) {
  const r = await fetch(`${ACC}/api/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: CLIENT_ID, ...params }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) { const e = new Error(j.error_description || j.error || '연결에 실패했어요'); e.code = j.error; throw e; }
  M.access = j.access_token; M.exp = Date.now() + (j.expires_in || 3600) * 1000 - 60e3;
  if (j.refresh_token) M.refresh = j.refresh_token;
  keep();
}
// 스포티파이 로그인 화면에서 돌아왔을 때 (주소에 ?code=… 가 붙어 온다)
async function finishLogin() {
  const q = new URLSearchParams(location.search), code = q.get('code'), err = q.get('error'), state = q.get('state');
  if (!code && !err) return false;
  let saved = null; try { saved = JSON.parse(localStorage.getItem(LS + '-pkce')); } catch (e) {}
  if (!saved || saved.state !== state) return false; // 우리가 보낸 요청이 아니면 건드리지 않는다
  localStorage.removeItem(LS + '-pkce');
  history.replaceState(null, '', REDIRECT);
  if (err) { toast(err === 'access_denied' ? '스포티파이 연결을 취소했어요' : '스포티파이 연결에 실패했어요'); return true; }
  try { await tokenCall({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: saved.verifier }); toast('스포티파이를 연결했어요'); }
  catch (e) { toast('스포티파이 연결에 실패했어요. 다시 해 볼래요?'); }
  return true;
}
let refreshing = null;
async function token() {
  if (M.access && Date.now() < M.exp) return M.access;
  if (!M.refresh) throw Object.assign(new Error('스포티파이를 먼저 연결해 주세요'), { code: 'unlinked' });
  refreshing = refreshing || tokenCall({ grant_type: 'refresh_token', refresh_token: M.refresh }).catch(e => {
    if (e.code === 'invalid_grant') { M.access = ''; M.refresh = ''; M.exp = 0; keep(); throw Object.assign(new Error('스포티파이 연결이 풀렸어요. 다시 연결해 주세요.'), { code: 'unlinked' }); }
    throw new Error('인터넷 연결을 확인해 주세요.');
  }).finally(() => { refreshing = null; });
  await refreshing;
  return M.access;
}
function disconnect() { M = { access: '', refresh: '', exp: 0, study: null }; keep(); now = null; lists = null; devices = null; refreshMusic(); toast('스포티파이 연결을 끊었어요'); }

// ---------- 스포티파이에 묻기 ----------
async function api(method, path, body, again) {
  const t = await token();
  let r;
  try { r = await fetch(API + path, { method, headers: { Authorization: 'Bearer ' + t, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
  catch (e) { throw new Error('인터넷 연결을 확인해 주세요.'); }
  if (r.status === 401 && !again) { M.exp = 0; return api(method, path, body, true); }
  if (r.status === 204 || r.status === 202) return null;
  const text = await r.text(); let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) {}
  if (r.ok) return j;
  const reason = j && j.error && (j.error.reason || j.error.message) || '';
  const e = new Error(
    r.status === 403 && /PREMIUM/i.test(reason) ? '스포티파이 프리미엄 계정에서만 재생을 조종할 수 있어요.' :
    r.status === 404 && /NO_ACTIVE_DEVICE|Device not found/i.test(reason) ? '재생할 기기를 찾지 못했어요. 폰에서 스포티파이 앱을 한 번 열어 주세요.' :
    r.status === 403 ? '스포티파이가 이 동작을 막았어요. 스포티파이 앱에서 한 번 재생한 뒤 다시 해 보세요.' :
    r.status === 429 ? '요청이 너무 많았어요. 잠시 후에 다시.' : '스포티파이가 응답하지 않았어요. 다시 해 볼래요?');
  e.status = r.status; e.reason = reason; throw e;
}

// ---------- 상태 ----------
let now = null;      // 지금 재생 상태 {playing, title, artist, cover, device, uri}
let lists = null;    // 내 플레이리스트
let devices = null;  // 재생할 수 있는 기기
let busy = false;
async function loadNow() {
  if (!linked()) { now = null; return; }
  try {
    const j = await api('GET', '/me/player?additional_types=track,episode');
    const it = j && j.item;
    now = it ? {
      playing: !!j.is_playing, title: it.name || '', uri: it.uri, context: j.context && j.context.uri,
      artist: (it.artists || []).map(a => a.name).join(', ') || (it.show && it.show.name) || '',
      cover: ((it.album && it.album.images) || it.images || []).slice(-2)[0]?.url || '',
      device: j.device ? j.device.name : '',
      progress: j.progress_ms || 0, duration: it.duration_ms || 0, at: Date.now(),
    } : (j && j.device ? { playing: false, title: '', artist: '', cover: '', device: j.device.name } : null);
  } catch (e) { if (e.code === 'unlinked') now = null; }
  renderChip();
}
async function loadLists() {
  const out = []; let path = '/me/playlists?limit=50';
  for (let i = 0; i < 4 && path; i++) {
    const j = await api('GET', path);
    (j.items || []).forEach(p => { if (p) out.push({ uri: p.uri, name: p.name || '(이름 없음)', n: (p.items || p.tracks || {}).total, cover: (p.images || []).slice(-1)[0]?.url || '' }); });
    path = j.next ? j.next.replace(API, '') : null;
  }
  lists = out;
}
async function loadDevices() { const j = await api('GET', '/me/player/devices'); devices = (j && j.devices || []).filter(d => !d.is_restricted); return devices; }
// 재생할 기기 고르기: 지금 켜진 기기 > 폰 > 아무거나
async function pickDevice() {
  const ds = await loadDevices();
  if (!ds.length) throw Object.assign(new Error('재생할 기기를 찾지 못했어요. 폰에서 스포티파이 앱을 한 번 열어 주세요.'), { nodevice: true });
  return ds.find(d => d.is_active) || ds.find(d => /phone/i.test(d.type)) || ds[0];
}

// ---------- 조종 ----------
const LINES = { // 앱에서 노래를 틀었을 때 비서의 한마디 (말풍선에만)
  ns: ['오, 선곡 괜찮네.', '이 노래 뭐냐. …나쁘지 않다.'],
  ys: ['오… 브금 깔렸다아.', '이 노래… 작업할 때 좋겠다아.'],
  hr: ['어머, 노래 좋다~', '이거 들으면서 하자~'],
  sy: ['좋아, 집중용으로 딱이네.', '…이 노래 좋다. 볼륨은 적당히.'],
  tr: ['노래 취향 봐라. …나쁘진 않네.', '틀어. 대신 할 건 하고.'],
};
async function act(fn, quiet) {
  if (busy) return; busy = true;
  try { await fn(); await sleep(700); await loadNow(); }
  catch (e) { if (!quiet) toast(e.message || '스포티파이가 응답하지 않았어요'); if (e.nodevice) devices = []; }
  busy = false; refreshMusic();
}
const playList = (uri, quiet) => act(async () => {
  const d = await pickDevice();
  await api('PUT', `/me/player/play?device_id=${encodeURIComponent(d.id)}`, { context_uri: uri });
  if (!quiet && C && $('home').classList.contains('on') && LINES[C.code]) setBubble(pick(LINES[C.code]), true);
}, quiet);
const toggle = () => act(async () => {
  if (now && now.playing) { await api('PUT', '/me/player/pause'); return; }
  const d = await pickDevice();
  await api('PUT', `/me/player/play?device_id=${encodeURIComponent(d.id)}`);
});
const skip = dir => act(() => api('POST', `/me/player/${dir > 0 ? 'next' : 'previous'}`));

// ---------- CD 연출 ----------
// 재생 바 밑에서 CD가 돈다. CD 그림은 assets/ui/cd.webp (없으면 앨범 표지, 그것도 없으면 무늬만)
const CD_ART = 'assets/ui/cd.webp';
function cdHTML(size) {
  const spin = now && now.playing ? ' spin' : '';
  // 다시 그려도 도는 각도가 이어지게, 시계 기준으로 시작 위치를 맞춘다
  return `<span class="disc${spin}" style="--cd:${size}px;animation-delay:-${Date.now() % 4000}ms" aria-hidden="true"><span class="disc-art" style="background-image:url(${CD_ART})${now && now.cover ? `,url(${esc(now.cover)})` : ''}"></span><i class="disc-hole"></i></span>`;
}
// 재생 위치 (스포티파이가 알려 준 위치에서 시간이 흐른 만큼 더한다)
function pos() {
  if (!now || !now.duration) return null;
  const p = Math.min(now.duration, now.progress + (now.playing ? Date.now() - now.at : 0));
  return { p, d: now.duration, r: p / now.duration };
}
const mmss = ms => `${Math.floor(ms / 60000)}:${pad(Math.floor(ms / 1000) % 60)}`;
function tickBars() {
  const x = pos();
  document.querySelectorAll('.mbar i').forEach(i => { i.style.width = x ? (x.r * 100).toFixed(2) + '%' : '0'; });
  document.querySelectorAll('.mtime').forEach(t => { t.textContent = x ? `${mmss(x.p)} / ${mmss(x.d)}` : ''; });
  // 곡이 끝날 즈음엔 다음 곡 정보를 받아 온다
  if (x && now.playing && x.p >= x.d - 500 && !busy && Date.now() - now.at > 3000) loadNow().then(refreshMusic);
}
setInterval(() => { if (!document.hidden) tickBars(); }, 500);
window.musicNow = () => (now && now.playing && now.title ? { title: now.title, artist: now.artist } : null);

// ---------- 비서 화면: 음악 칩 (재생 중이면 제목·재생 바, 그 밑에 도는 CD) ----------
function renderChip() {
  const b = $('musicChip'); if (!b) return;
  const on = now && now.playing && now.title;
  b.className = 'music-chip' + (on ? ' on' : '');
  b.innerHTML = on
    ? `<span class="mc-top"><i>♪</i><span class="mc-title">${esc(now.title)}</span></span><span class="mbar"><i></i></span>${cdHTML(58)}`
    : '<span class="mc-top"><i>♪</i></span>';
  b.setAttribute('aria-label', on ? `음악 열기. 지금 ${now.title}, ${now.artist}` : '음악 열기');
  tickBars();
}

// ---------- 음악 시트 ----------
// 다시 그려도 보던 자리(스크롤)는 그대로 둔다
const refreshMusic = () => { if (sheetOpen === 'music') { const y = body().scrollTop; refresh(); body().scrollTop = y; } renderChip(); };
SHEETS.music = {
  title: () => '음악',
  sub: () => !linked() ? '스포티파이 계정을 연결하면 여기서 틀 수 있어요' : now && now.title ? `${now.playing ? '재생 중' : '멈춤'}${now.device ? ' · ' + now.device : ''}` : '스포티파이 연결됨',
  tall: true,
  render() {
    const b = body(), f = foot(); b.innerHTML = ''; f.innerHTML = '';
    if (!linked()) {
      const c = el('section', 'card');
      c.innerHTML = '<h3>스포티파이 연결</h3><p class="hint top">내 플레이리스트를 골라서 틀고, 멈추고, 다음 곡으로 넘길 수 있어요. 소리는 폰의 스포티파이 앱에서 나요.</p><p class="hint top">프리미엄 계정이 필요해요. 로그인은 스포티파이 화면에서 하고, 이 앱은 비밀번호를 보지 못해요.</p>';
      const go = el('button', 'btn wide', '스포티파이 연결하기'); go.onclick = connect;
      c.appendChild(go); b.appendChild(c);
      return;
    }
    // 지금 재생
    const np = el('section', 'card np');
    const cover = el('div', 'np-cover'); if (now && now.cover) cover.style.backgroundImage = `url(${now.cover})`; else cover.textContent = '♪';
    const meta = el('div', 'np-meta', now && now.title ? `<b>${esc(now.title)}</b><small>${esc(now.artist)}</small>` : '<b>재생 중인 곡이 없어요</b><small>아래에서 플레이리스트를 골라 주세요</small>');
    const keys = el('div', 'np-keys');
    [['‹‹', '이전 곡', () => skip(-1)], [now && now.playing ? '❚❚' : '▶', now && now.playing ? '일시정지' : '재생', toggle], ['››', '다음 곡', () => skip(1)]].forEach(([t, label, fn], i) => {
      const k = el('button', 'np-key' + (i === 1 ? ' main' : ''), t); k.setAttribute('aria-label', label); k.onclick = fn; keys.appendChild(k);
    });
    np.append(cover, meta, keys); b.appendChild(np);
    // 재생 바, 그 밑에 도는 CD
    if (now && now.title) {
      const deck = el('section', 'deck', `<div class="mbar big"><i></i></div><span class="mtime"></span>${cdHTML(172)}`);
      b.appendChild(deck);
    }
    if (devices && !devices.length) {
      const w = el('div', 'card');
      w.innerHTML = '<p class="hint top">재생할 기기를 찾지 못했어요. 폰에서 스포티파이 앱을 한 번 열어 둔 뒤 다시 눌러 주세요.</p>';
      const row = el('div', 'row'), a = el('a', 'btn ghost', '스포티파이 앱 열기'), again = el('button', 'btn', '다시 찾기');
      a.href = 'spotify:'; again.onclick = () => act(async () => { await loadDevices(); });
      row.append(a, again); w.appendChild(row); b.appendChild(w);
    }
    // 플레이리스트
    b.appendChild(el('h4', 'sub-h', '내 플레이리스트'));
    if (!lists) { b.appendChild(el('div', 'empty', '불러오는 중…')); }
    else if (!lists.length) b.appendChild(el('div', 'empty', '플레이리스트가 없어요. 스포티파이 앱에서 하나 만들어 주세요.'));
    else lists.forEach(p => {
      const r = el('div', 'item pl' + (now && now.context === p.uri ? ' cur' : ''));
      const ph = el('span', 'pl-cover'); if (p.cover) ph.style.backgroundImage = `url(${p.cover})`;
      const tx = el('button', 'tx pl-name', `${esc(p.name)}${p.n != null ? `<small>${p.n}곡</small>` : ''}`); tx.setAttribute('aria-label', `${p.name} 재생`);
      tx.onclick = () => playList(p.uri);
      const star = el('button', 'pl-star' + (M.study && M.study.uri === p.uri ? ' on' : ''), '공부용'); star.setAttribute('aria-pressed', String(!!(M.study && M.study.uri === p.uri)));
      star.setAttribute('aria-label', `${p.name}을(를) 공부용으로 ${M.study && M.study.uri === p.uri ? '해제' : '지정'}`);
      star.onclick = () => { M.study = M.study && M.study.uri === p.uri ? null : { uri: p.uri, name: p.name }; keep(); refresh(); toast(M.study ? `공부 타이머를 켜면 "${p.name}"을 틀어요` : '공부용 지정을 풀었어요'); };
      r.append(ph, tx, star); b.appendChild(r);
    });
    b.appendChild(el('p', 'hint', '"공부용"으로 정한 플레이리스트는 공부 타이머를 시작할 때 자동으로 틀어요.'));
    const out = el('button', 'btn ghost', '스포티파이 연결 끊기'); out.style.marginTop = '18px';
    out.onclick = () => { if (confirm('스포티파이 연결을 끊을까요? 다시 연결하면 돼요.')) disconnect(); };
    b.appendChild(out);
    // 처음 열 때 한 번 불러온다
    if (!lists && !loading) { loading = true; Promise.all([loadLists().catch(e => { lists = []; toast(e.message); }), loadNow(), loadDevices().catch(() => {})]).finally(() => { loading = false; refreshMusic(); }); }
  },
};
let loading = false;

// ---------- 공부 타이머가 켜지면 공부용 플레이리스트 재생 ----------
const focusEl = $('focus');
if (focusEl) new MutationObserver(() => {
  if (!focusEl.hidden && !focusEl.dataset.music) { focusEl.dataset.music = '1'; if (linked() && M.study && !(now && now.playing)) playList(M.study.uri, true); }
  if (focusEl.hidden) delete focusEl.dataset.music;
}).observe(focusEl, { attributes: true, attributeFilter: ['hidden'] });

// ---------- 대화(Gemini)에도 지금 듣는 노래를 알려 준다 ----------
const basePrompt = window.promptExtra;
window.promptExtra = function (c) {
  const base = basePrompt ? basePrompt(c) : '';
  return now && now.playing && now.title ? `${base}\n[지금 듣는 노래] ${now.title} - ${now.artist}` : base;
};

// ---------- 시작 ----------
$('musicChip').onclick = () => { openSheet('music'); if (linked()) loadNow().then(refreshMusic); };
renderChip();
finishLogin().then(back => { if (linked()) loadNow(); if (back && linked()) setTimeout(() => { if ($('home').classList.contains('on') && C) openSheet('music'); }, 1200); });
// 화면이 켜져 있는 동안만 가끔 확인한다 (음악 시트가 열려 있으면 더 자주)
let tickN = 0;
setInterval(() => { if (document.hidden || !linked() || busy) return; tickN++; if (sheetOpen === 'music' || tickN % 4 === 0) loadNow().then(refreshMusic); }, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && linked()) loadNow().then(refreshMusic); });
})();
