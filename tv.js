// 한울아파트 — 시청실
// 까만 방에 큰 TV가 있고, 수현이 TV 뒤에 서서 상반신만 TV 위로 내밀고, 한울냥이 TV 위에서 식빵을 굽는다.
// 모든 건 TV 화면 안에서 한다: 채널(유튜브·밴드·브레이브) 고르기, 유튜브 검색·목록 스크롤, 영상 보기.
//  - 유튜브 검색은 구글 키(YouTube Data API v3)가 있어야 된다. 키가 없어도 링크 붙여넣기·최근 영상·유튜브 앱의 "공유 → 한울아파트"는 된다.
//  - 밴드는 TV에 띄워 보고 안 되면 앱으로 연다. 브레이브는 다른 앱 안에 못 띄우게 막혀 있어서 브레이브로 넘어갔다가 돌아온다.
// "크게 보기"를 누르면 TV 화면이 서서히 커져서 화면 전체가 된다(엘리베이터처럼 TV 속으로).
// 영상을 끄거나 나가거나 다녀오면 본 시간을 보여 주고 "공부였어? 놀았어?"를 묻는다.
'use strict';
(() => {
// 장면 좌표 (TV 그림 원본 1526×1048 기준). 수현 그림(584×1400): 머리 가운데 x≈240, 눈 (205,200)·(278,170).
// 수현은 TV 뒤에 있어서 TV 윗변(y≈7) 위로 나온 곳만 보인다. 세로 화면은 위쪽 자리가 넉넉해서 가슴까지, 가로 화면은 얼굴까지.
const POSE = {
  wide: { k: 1.1, hx: 330, chin: 300, box: [0, -335, 1526, 960] },
  tall: { k: 1.25, hx: 330, chin: 420, box: [0, -515, 1526, 1048] },
};
const SC = { w: 1526, h: 1048, screen: [110, 19, 1415, 730], cat: [1180, 8], top: 7 };
function pose() {
  const o = POSE[innerWidth > innerHeight ? 'wide' : 'tall'];
  const x = o.hx - 240 * o.k, y = SC.top - o.chin * o.k;
  return { box: o.box, ns: { x, y, w: 584 * o.k, h: 1400 * o.k }, eyes: [[x + 205 * o.k, y + 200 * o.k], [x + 278 * o.k, y + 170 * o.k]] };
}
const SITES = {
  youtube: { name: '유튜브', url: 'https://m.youtube.com/', color: '#ff2b2b',
             icon: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4" fill="#ff2b2b"/><path d="M10 9l5 3-5 3z" fill="#fff"/></svg>' },
  band: { name: '밴드', url: 'https://band.us/', color: '#21c24c', app: 'com.nhn.android.band',
          icon: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="6" fill="#21c24c"/><path d="M8 7v10h4.5a3 3 0 0 0 0-6H8m0 0h3.6a2.2 2.2 0 0 0 0-4.4H8" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>' },
  brave: { name: '브레이브', url: 'https://search.brave.com/', color: '#fb542b', app: 'com.brave.browser',
           icon: '<svg viewBox="0 0 24 24"><path d="M12 2l7 3 1 6c0 6-4 9-8 11-4-2-8-5-8-11l1-6z" fill="#fb542b"/><path d="M9 9l3 1 3-1-1 6-2 2-2-2z" fill="#fff"/></svg>' },
};
const SCOLD = ['그니까, {t}이나 봤냐. …재밌었으면 됐고, 이제 하나만 해.', '{t}. 나랑 게임한 것도 아니면서.', '야, {t} 동안 뭐 봤는데. 나중에 나도 보여 줘. 대신 지금은 공부.'];
const PRAISE = ['오, 공부한 거였어? {t}, 기록해 뒀다.', '{t}이면 꽤 했네. 그니까, 이 기세로 하나 더.'];
const IDLE = ['뭐 볼 건데. 골라.', '…같이 볼래?', '나 TV 뒤에 숨은 거 아니다. 그냥 서 있는 거야.', '고양이 깨우지 마. 방금 잠들었어.'];
const PLAYING = ['오, 이거 보는구나.', '…나도 좀 보자.', '소리 너무 크게 하지 마.'];
const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  big: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  small: '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  off: '<svg viewBox="0 0 24 24"><path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0"/></svg>',
};

// ---------- 화면 ----------
const v = document.createElement('section');
v.id = 'tvroom'; v.className = 'tvroom'; v.hidden = true;
v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', '시청실');
v.innerHTML = `
  <div class="tv-top"><button class="tv-back">‹ 나가기</button><b>시청실</b></div>
  <div class="tv-stagebox"><div class="tv-cam"><div class="tv-scene">
    <img class="tv-ns" src="assets/tv/ns.webp" alt="">
    <i class="tv-spark" aria-hidden="true"></i><i class="tv-spark" aria-hidden="true"></i>
    <img class="tv-set" src="assets/tv/tv.webp" alt="">
    <button class="tv-cat" aria-label="한울냥 쓰다듬기"><img alt=""></button>
    <div class="tv-screen"><div class="tv-view"></div></div>
  </div></div></div>
  <div class="tv-say"><b>남수현</b><p></p></div>
  <div class="tv-bar">
    <button class="b-back" aria-label="뒤로">${ICON.back}<span>뒤로</span></button>
    <button class="b-big" aria-label="크게 보기">${ICON.big}<span>크게 보기</span></button>
    <button class="b-off" aria-label="끄기">${ICON.off}<span>끄기</span></button>
  </div>
  <div class="tv-ask" hidden></div>`;
document.getElementById('app').appendChild(v);
const q = s => v.querySelector(s);
const view = q('.tv-view');

// ---------- 장면을 화면에 맞추기 ----------
let K = 1, full = false;
function layout() {
  const box = q('.tv-stagebox'), W = box.clientWidth, H = box.clientHeight;
  const O = pose(), [x0, y0, x1, y1] = O.box;
  K = Math.min(W / (x1 - x0), H / (y1 - y0));
  const L = (W - (x1 - x0) * K) / 2 - x0 * K, T = (H - (y1 - y0) * K) / 2 - y0 * K;
  const sc = q('.tv-scene');
  Object.assign(sc.style, { width: SC.w * K + 'px', height: SC.h * K + 'px', left: L + 'px', top: T + 'px' });
  const P = (el, x, y, w, h) => Object.assign(el.style, { left: x * K + 'px', top: y * K + 'px', ...(w ? { width: w * K + 'px' } : {}), ...(h ? { height: h * K + 'px' } : {}) });
  P(q('.tv-ns'), O.ns.x, O.ns.y, O.ns.w, O.ns.h);
  // TV 뒤에 가려지는 몸은 아예 지운다 (TV와 TV장 사이 틈으로 비치지 않게)
  const f0 = ((SC.top + 330 - O.ns.y) / O.ns.h * 100).toFixed(1), f1 = ((SC.top + 400 - O.ns.y) / O.ns.h * 100).toFixed(1);
  q('.tv-ns').style.setProperty('--fade', `linear-gradient(to bottom, #000 ${f0}%, transparent ${f1}%)`);
  P(q('.tv-set'), 0, 0, SC.w, SC.h);
  v.querySelectorAll('.tv-spark').forEach((e, i) => P(e, ...O.eyes[i]));
  const [a, b, c, d] = SC.screen;
  const ch = Math.max(40, Math.min(110, (c - a) * K * .14)), cat = q('.tv-cat');
  Object.assign(cat.style, { left: SC.cat[0] * K - ch * .55 + 'px', top: SC.cat[1] * K - ch + 3 + 'px', height: ch + 'px' });
  placeScreen();
}
// TV 화면 자리: 보통은 TV 안, 크게 보기면 창 전체(아래 버튼 줄만 빼고)
function placeScreen() {
  const scr = q('.tv-screen'), [a, b, c, d] = SC.screen;
  if (!full) { Object.assign(scr.style, { left: a * K + 'px', top: b * K + 'px', width: (c - a) * K + 'px', height: (d - b) * K + 'px' }); return; }
  const r = q('.tv-scene').getBoundingClientRect(), vr = v.getBoundingClientRect(), bar = q('.tv-bar').offsetHeight;
  Object.assign(scr.style, { left: vr.left - r.left + 'px', top: vr.top - r.top + 'px', width: vr.width + 'px', height: vr.height - bar + 'px' });
}
addEventListener('resize', () => { if (!v.hidden) requestAnimationFrame(layout); });

// ---------- 수현 한마디 ----------
function say(t) {
  const p = q('.tv-say p'); p.textContent = '';
  if (window.typeInto) typeInto(p, t, 'tv'); else p.textContent = t;
}
const dur = m => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`);
const fillT = (t, o) => t.replace(/\{(\w+)\}/g, (x, k) => (o[k] != null ? o[k] : x));
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function todayText() {
  const l = (S.tvlog && S.tvlog[dayKey()]) || [];
  const st = l.filter(x => x.kind === 'study').reduce((a, x) => a + x.mins, 0), pl = l.filter(x => x.kind === 'play').reduce((a, x) => a + x.mins, 0);
  return l.length ? `오늘: 공부 ${dur(st)} · 놀기 ${dur(pl)}` : '';
}

// ---------- 고양이 ----------
let catT = 0;
function catPose(open) { q('.tv-cat img').src = `assets/ui/neko2/${open ? 'loaf2' : 'loaf'}.webp`; }
function catLoop() { clearTimeout(catT); catT = setTimeout(() => { if (!v.hidden) { catPose(true); setTimeout(() => catPose(false), 1800); } catLoop(); }, 6000 + Math.random() * 6000); }
q('.tv-cat').onclick = () => { catPose(true); const c = q('.tv-cat'); c.classList.remove('purr'); void c.offsetWidth; c.classList.add('purr'); setTimeout(() => catPose(false), 2200); if (Math.random() < .4) say(pick(['…걔 건드리면 깬다.', '고양이도 같이 보고 싶대.'])); };

// ---------- TV 화면 속 화면들 ----------
// page: 'home' 채널 고르기 | 'yt' 유튜브 목록 | 'play' 영상 | 'band' 밴드 | 'brave' 브레이브 검색
let page = 'home', results = null, lastQ = '', ytMsg = '', frame = null, watch = null;
function go(p) {
  if (page === 'play' || page === 'band') stopFrame();
  page = p; render();
}
function render() {
  v.dataset.page = page;
  q('.b-back').hidden = page === 'home';
  q('.b-off').hidden = !frame;
  if (page === 'home') {
    const t = todayText();
    view.innerHTML = `<div class="tv-home"><div class="tv-btns">${Object.entries(SITES).map(([k, s]) => `<button data-site="${k}" style="--c:${s.color}">${s.icon}<span>${s.name}</span></button>`).join('')}</div>${t ? `<p class="tv-today">${t}</p>` : ''}</div>`;
    view.querySelectorAll('.tv-btns button').forEach(b => b.onclick = () => go(b.dataset.site === 'youtube' ? 'yt' : b.dataset.site));
  } else if (page === 'yt') {
    const list = results || (S.tvRecent || []);
    view.innerHTML = `<div class="tv-yt">
      <form class="tv-search"><span class="logo">${SITES.youtube.icon}</span><input type="search" enterkeyhint="search" placeholder="검색 또는 링크 붙여넣기" aria-label="유튜브 검색 또는 링크"><button>찾기</button></form>
      <div class="tv-scroll">
        ${ytMsg ? `<p class="tv-msg">${ytMsg}</p>` : ''}
        ${list.length ? `<p class="tv-h">${results ? `"${esc(lastQ)}" 검색 결과` : '최근에 본 영상'}</p>` : ''}
        <div class="tv-list">${list.map(x => `<button data-id="${esc(x.id)}" data-title="${esc(x.title || '')}" data-thumb="${esc(x.thumb || '')}"><img src="${esc(x.thumb || `https://i.ytimg.com/vi/${x.id}/mqdefault.jpg`)}" alt="" loading="lazy"><span><b>${esc(x.title || '유튜브 영상')}</b>${x.ch ? `<small>${esc(x.ch)}</small>` : ''}</span></button>`).join('')}</div>
        ${!results && !ytMsg ? `<p class="tv-msg">${list.length ? '' : '아직 본 영상이 없어요. '}유튜브 앱에서 영상의 <b>공유 → 한울아파트</b>를 눌러도 여기서 나와요.</p>` : ''}
        <div class="tv-row"><button class="paste">복사한 링크 틀기</button><button class="out">유튜브 앱으로</button></div>
      </div></div>`;
    const inp = view.querySelector('input');
    if (results) inp.value = lastQ;
    view.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const t = inp.value.trim(); if (!t) return;
      const y = ytParse(t); if (y) { ytPlay(y); return; }
      inp.blur(); lastQ = t; ytMsg = '찾는 중…'; results = null; render();
      try { results = await ytSearch(t); ytMsg = results.length ? '' : '검색 결과가 없어요.'; }
      catch (err) { results = null; ytMsg = searchError(err); }
      if (page === 'yt') render();
    };
    view.querySelector('.paste').onclick = async () => {
      let t = '';
      try { t = await navigator.clipboard.readText(); } catch (e) {}
      const y = ytParse(t);
      if (y) ytPlay(y); else { ytMsg = t ? '복사한 글에 유튜브 링크가 없어요.' : '복사한 링크를 못 읽었어요. 검색 칸을 길게 눌러 붙여 넣어 주세요.'; render(); }
    };
    view.querySelector('.out').onclick = () => openOut('youtube');
    view.querySelectorAll('.tv-list button').forEach(b => b.onclick = () => ytPlay({ id: b.dataset.id }, b.dataset.title, b.dataset.thumb));
    const key = view.querySelector('.setkey');
    if (key) key.onclick = () => { const k = prompt('유튜브 검색용 구글 API 키 (이 기기에만 저장돼요)', S.ytKey || ''); if (k != null) { S.ytKey = k.trim(); save(); ytMsg = ''; render(); } };
  } else if (page === 'band') {
    if (!frame) {
      view.innerHTML = `<div class="tv-info">${SITES.band.icon}<p>밴드를 TV에 띄워 볼게요. "연결을 거부했다"는 화면이 나오면 밴드가 막은 거라, 그때는 앱으로 열어요.</p>
        <div class="tv-row"><button class="intv">TV에서 보기</button><button class="out">밴드 앱으로</button></div></div>`;
      view.querySelector('.intv').onclick = () => { showFrame('https://band.us/', { site: 'band', title: '밴드' }); say('밴드? …뭐 올라왔는데.'); };
      view.querySelector('.out').onclick = () => openOut('band');
    }
  } else if (page === 'brave') {
    view.innerHTML = `<div class="tv-info">${SITES.brave.icon}<p>브레이브는 다른 앱 안에 못 띄우게 막혀 있어서, 브레이브로 넘어갔다가 돌아와요.</p>
      <form class="tv-search"><input type="search" enterkeyhint="search" placeholder="브레이브로 검색" aria-label="브레이브 검색"><button>찾기</button></form></div>`;
    view.querySelector('form').onsubmit = e => {
      e.preventDefault(); const t = view.querySelector('input').value.trim();
      openOut('brave', t ? `https://search.brave.com/search?q=${encodeURIComponent(t)}` : SITES.brave.url);
    };
  }
}

// ---------- 영상 띄우기 / 끄기 ----------
function showFrame(src, info) {
  stopFrame(true);
  frame = document.createElement('iframe');
  frame.className = 'tv-frame';
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.title = info.title || SITES[info.site].name;
  frame.src = src;
  view.innerHTML = ''; view.appendChild(frame);
  v.classList.add('on');
  if (info.site === 'youtube') page = 'play';
  watch = { site: info.site, title: info.title || '', ms: 0, from: document.hidden ? 0 : Date.now() };
  v.dataset.page = page; q('.b-back').hidden = false; q('.b-off').hidden = false;
}
function stopFrame(quiet) {
  if (frame) { frame.remove(); frame = null; }
  v.classList.remove('on');
  q('.b-off').hidden = true;
  stopWatch(quiet);
}
// 본 시간 재기 (앱이 화면에 보일 때만)
function tick() { if (watch && watch.from) { watch.ms += Date.now() - watch.from; watch.from = 0; } }
document.addEventListener('visibilitychange', () => { if (!watch) return; if (document.hidden) tick(); else watch.from = Date.now(); });
function stopWatch(quiet) {
  if (!watch) return; tick();
  const w = watch; watch = null;
  const m = Math.round(w.ms / 60e3);
  if (m >= 1) ask(w.site, m, w.title);
  else if (!quiet) say(pick(IDLE));
}

// ---------- 유튜브 ----------
function ytParse(text) {
  const s = String(text || '');
  const m = s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/);
  const list = (s.match(/[?&]list=([\w-]{10,})/) || [])[1];
  const t = (s.match(/[?&](?:t|start)=(\d+)/) || [])[1];
  if (m) return { id: m[1], list, t };
  if (list) return { list };
  return /^[\w-]{11}$/.test(s.trim()) ? { id: s.trim() } : null;
}
function ytPlay(y, title, thumb) {
  const p = new URLSearchParams({ autoplay: '1', playsinline: '1', rel: '0' });
  if (y.t) p.set('start', y.t);
  if (y.list) p.set('list', y.list);
  const src = y.id ? `https://www.youtube.com/embed/${y.id}?${p}` : `https://www.youtube.com/embed/videoseries?${p}`;
  if (y.id) {
    S.tvRecent = [{ id: y.id, title: title || '', thumb: thumb || `https://i.ytimg.com/vi/${y.id}/mqdefault.jpg` }, ...(S.tvRecent || []).filter(x => x.id !== y.id)].slice(0, 20);
    save();
  }
  showFrame(src, { site: 'youtube', title });
  say(pick(PLAYING));
}
const ytKey = () => (S.ytKey || (/^AIza[\w-]{30,}$/.test(S.key || '') ? S.key : ''));
async function ytSearch(qs) {
  const key = ytKey();
  if (!key) throw new Error('nokey');
  const u = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=25&safeSearch=moderate&regionCode=KR&relevanceLanguage=ko&q=${encodeURIComponent(qs)}`;
  const r = await fetch(u, { headers: { 'x-goog-api-key': key } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || 'HTTP ' + r.status); e.status = r.status; throw e; }
  return (j.items || []).filter(x => x.id && x.id.videoId).map(x => ({
    id: x.id.videoId, title: decode(x.snippet.title), ch: decode(x.snippet.channelTitle),
    thumb: ((x.snippet.thumbnails && (x.snippet.thumbnails.medium || x.snippet.thumbnails.default)) || {}).url,
  }));
}
function decode(s) { const t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; }
function searchError(err) {
  const m = String(err.message || '');
  const btn = ' <button type="button" class="setkey">키 넣기</button>';
  if (m === 'nokey') return '검색하려면 구글 API 키가 필요해요. 링크 붙여넣기나 유튜브 앱의 공유는 키 없이 돼요.' + btn;
  if (/has not been used|is disabled|SERVICE_DISABLED|not been enabled/i.test(m)) return '이 키의 구글 클라우드 프로젝트에서 <b>YouTube Data API v3</b>를 켜야 검색이 돼요. 켜는 법은 나한테 물어봐요.' + btn;
  if (/quota/i.test(m)) return '오늘 검색 가능 횟수를 다 썼어요. 내일 다시 돼요. 링크 붙여넣기는 계속 돼요.';
  if (/API key not valid|invalid/i.test(m) || err.status === 400) return '키가 맞지 않아요.' + btn;
  if (err.status === 403) return '이 키로는 유튜브 검색이 막혀 있어요(키 제한 설정 확인).' + btn;
  return '검색이 안 됐어요. 인터넷 연결을 확인해 주세요.';
}

// ---------- 밖에서 여는 곳 (브레이브, 밴드 앱, 유튜브 앱) ----------
const isAndroid = /Android/i.test(navigator.userAgent);
async function openOut(k, url) {
  const s = SITES[k];
  url = url || s.url;
  S.tv = { site: k, at: Date.now() }; save();
  if (!full) { setFull(true); await sleep(650); }
  if (s.app && isAndroid) location.href = `intent://${url.replace(/^https:\/\//, '')}#Intent;scheme=https;package=${s.app};S.browser_fallback_url=${encodeURIComponent(url)};end`;
  else { const w = window.open(url, '_blank'); if (w) { try { w.opener = null; } catch (e) {} } else location.href = url; }
  setTimeout(() => setFull(false), 1200);
}

// ---------- 아래 버튼: 뒤로 / 크게 보기 / 끄기 ----------
function setFull(on) {
  full = on; v.classList.toggle('full', on);
  const b = q('.b-big'); b.innerHTML = on ? `${ICON.small}<span>작게 보기</span>` : `${ICON.big}<span>크게 보기</span>`;
  b.setAttribute('aria-label', on ? '작게 보기' : '크게 보기');
  placeScreen();
}
q('.b-big').onclick = () => setFull(!full);
q('.b-back').onclick = () => go(page === 'play' ? 'yt' : 'home');
q('.b-off').onclick = () => go(page === 'play' ? 'yt' : page);

// ---------- 들어가기·나가기 ----------
let opening = false;
async function open() {
  if (opening || !v.hidden) return; opening = true;
  if (window.closeSheet && typeof sheetOpen !== 'undefined' && sheetOpen) closeSheet();
  v.hidden = false; full = false; v.classList.remove('full'); layout(); catPose(false); if (!frame) { page = 'home'; render(); }
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  $('home').classList.add('to-tv');
  await sleep(700);
  opening = false; catLoop();
  if (!checkReturn() && !frame) say(pick(IDLE));
}
async function close() {
  if (frame) { stopFrame(); page = 'home'; render(); }
  if (!q('.tv-ask').hidden) return; // 공부/놀기 대답부터
  v.classList.remove('enter'); v.classList.add('leave'); $('home').classList.remove('to-tv');
  await sleep(450); v.hidden = true; v.classList.remove('leave'); setFull(false); clearTimeout(catT);
}
q('.tv-back').onclick = close;

// ---------- 다녀오면: 공부였어? 놀았어? ----------
function checkReturn() {
  const t = S.tv; if (!t) return false;
  const mins = Math.round((Date.now() - t.at) / 60e3);
  if (mins < 1) { S.tv = null; save(); return false; }
  if (v.hidden) { open(); return true; }
  S.tv = null; save();
  ask(t.site, Math.min(mins, 300));
  return true;
}
function subjects() {
  const set = new Set((window.finalSubjects && finalSubjects()) || []);
  Object.values((S.tt && S.tt.cells) || {}).forEach(x => { if (x && !/창체|스포츠|음악|미술/.test(x)) set.add(x); });
  return [...set].slice(0, 9);
}
function ask(site, mins, title) {
  if (full) setFull(false);
  const box = q('.tv-ask'), s = SITES[site] || { name: '영상' };
  let m = mins;
  box.innerHTML = `<p><b>${esc(title || s.name)}</b>, <span class="m"></span> 봤어요.</p>
    <div class="adj"><button data-d="-10" aria-label="10분 빼기">−10</button><span class="m2"></span><button data-d="10" aria-label="10분 더하기">+10</button></div>
    <p class="sub">공부였으면 과목을 고르세요</p>
    <div class="subs">${subjects().map(x => `<button data-sub="${esc(x)}">${esc(x)}</button>`).join('')}<button data-sub="자습">기타 공부</button></div>
    <button class="play">놀았어</button>`;
  const upd = () => { box.querySelector('.m').textContent = dur(m); box.querySelector('.m2').textContent = dur(m); };
  upd();
  box.querySelectorAll('.adj button').forEach(b => b.onclick = () => { m = Math.max(1, Math.min(600, m + +b.dataset.d)); upd(); });
  const done = (kind, sub) => {
    S.tvlog = S.tvlog || {}; const d = dayKey(); (S.tvlog[d] = S.tvlog[d] || []).push({ site, mins: m, kind, sub: sub || null });
    if (kind === 'study' && window.addStudy) addStudy(sub, m); else save();
    box.hidden = true; if (page === 'home') render();
    say(fillT(pick(kind === 'study' ? PRAISE : SCOLD), { t: dur(m) }));
  };
  box.querySelectorAll('.subs button').forEach(b => b.onclick = () => done('study', b.dataset.sub));
  box.querySelector('.play').onclick = () => done('play');
  box.hidden = false;
  say(m >= 60 ? `${dur(m)}이나? …뭐 봤는데.` : '다 봤어? 뭐였는데.');
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.tv) setTimeout(checkReturn, 400); });
addEventListener('pageshow', () => { if (S.tv) setTimeout(checkReturn, 800); });

// ---------- 메뉴 버튼 ----------
const dock = document.querySelector('.dock');
const btn = document.createElement('button');
btn.id = 'tvBtn';
btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M9 2.5l3 3 3-3"/></svg>시청실';
dock.insertBefore(btn, dock.querySelector('[data-open="mail"]'));
btn.onclick = open;

// ---------- 유튜브 앱에서 "공유 → 한울아파트"로 온 영상 ----------
(function fromShare() {
  const u = new URLSearchParams(location.search);
  const t = [u.get('url'), u.get('text'), u.get('title')].filter(Boolean).join(' ');
  if (!t) return;
  history.replaceState(null, '', location.pathname);
  const y = ytParse(t); if (!y) return;
  const title = (u.get('title') || '').trim();
  setTimeout(async () => { await open(); ytPlay(y, title); }, 900);
})();
// 앱을 연 채로 다녀왔으면 (앱이 새로 열린 경우)
setTimeout(() => { if (S.tv && typeof DATA !== 'undefined' && DATA) checkReturn(); }, 2500);
})();
