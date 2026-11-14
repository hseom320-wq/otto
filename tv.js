// 한울아파트 — 시청실
// 까만 방에 TV가 있고, 수현이 TV 뒤에서 빼꼼 내다보고, 한울냥이 TV 위에서 식빵을 굽는다.
// 유튜브는 TV 화면 안에서 바로 튼다: 리모컨에서 검색(유튜브 키가 있을 때)하거나, 링크를 붙여 넣거나,
// 유튜브 앱에서 "공유 → 한울아파트"로 보내면 된다. 밴드는 TV에 띄워 보고 안 되면 앱으로 연다.
// 브레이브는 다른 앱 안에 화면을 못 띄우게 막혀 있어서 브레이브로 넘어갔다가 돌아온다.
// 영상을 끄거나 돌아오면 본 시간을 보여 주고 "공부였어? 놀았어?"를 묻는다.
// "크게 보기"를 누르면 엘리베이터처럼 TV 화면 속으로 서서히 다가간다.
'use strict';
(() => {
// 장면 좌표 (TV 그림 원본 1526×1048 기준). 수현은 TV 뒤 왼쪽에 서서 머리가 TV 위로 나온다.
// 수현 그림(584×1400): 눈 (205,200)·(278,170). 세로 화면은 TV가 화면 폭을 거의 다 차지해서 수현을 더 크게, 더 위로 둔다.
const POSE = {
  wide: { k: 1.1, x: -150, y: -215, box: [-150, -215, 1526, 1048] },
  tall: { k: 1.4, x: -250, y: -330, box: [-130, -320, 1526, 1048] },
};
const SC = { w: 1526, h: 1048, screen: [110, 19, 1415, 730], cat: [1180, 8] }; // screen: TV 화면, cat: 한울냥 자리(TV 윗변)
function pose() {
  const o = POSE[innerWidth > innerHeight ? 'wide' : 'tall'];
  return { box: o.box, ns: { x: o.x, y: o.y, w: 584 * o.k, h: 1400 * o.k }, eyes: [[o.x + 205 * o.k, o.y + 200 * o.k], [o.x + 278 * o.k, o.y + 170 * o.k]] };
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

// ---------- 화면 ----------
const v = document.createElement('section');
v.id = 'tvroom'; v.className = 'tvroom'; v.hidden = true;
v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', '시청실');
const chBtns = Object.entries(SITES).map(([k, s]) => `<button data-site="${k}" style="--c:${s.color}">${s.icon}<span>${s.name}</span></button>`).join('');
v.innerHTML = `
  <div class="tv-top"><button class="tv-back">‹ 나가기</button><b>시청실</b></div>
  <div class="tv-stagebox"><div class="tv-cam"><div class="tv-scene">
    <img class="tv-ns" src="assets/tv/ns.webp" alt="">
    <i class="tv-spark" aria-hidden="true"></i><i class="tv-spark" aria-hidden="true"></i>
    <img class="tv-set" src="assets/tv/tv.webp" alt="">
    <div class="tv-screen">
      <div class="tv-menu"><div class="tv-btns">${chBtns}</div><p class="tv-today"></p></div>
    </div>
    <button class="tv-cat" aria-label="한울냥 쓰다듬기"><img alt=""></button>
  </div></div></div>
  <div class="tv-say"><b>남수현</b><p></p></div>
  <div class="tv-remote">
    <div class="tv-tabs">${chBtns}</div>
    <div class="tv-pane"></div>
  </div>
  <button class="tv-shrink" hidden>작게 보기</button>
  <div class="tv-ask" hidden></div>`;
document.getElementById('app').appendChild(v);
const q = s => v.querySelector(s);

// ---------- 장면을 화면에 맞추기 ----------
let K = 1;
function layout() {
  const box = q('.tv-stagebox'), W = box.clientWidth, H = box.clientHeight;
  const O = pose(), [x0, y0, x1, y1] = O.box;
  K = Math.min(W / (x1 - x0), H / (y1 - y0));
  const sw = (x1 - x0) * K, sh = (y1 - y0) * K;
  const sc = q('.tv-scene');
  const L = (W - sw) / 2 - x0 * K, T = (H - sh) / 2 - y0 * K;
  Object.assign(sc.style, { width: SC.w * K + 'px', height: SC.h * K + 'px', left: L + 'px', top: T + 'px' });
  const P = (el, x, y, w, h) => Object.assign(el.style, { left: x * K + 'px', top: y * K + 'px', ...(w ? { width: w * K + 'px' } : {}), ...(h ? { height: h * K + 'px' } : {}) });
  P(q('.tv-ns'), O.ns.x, O.ns.y, O.ns.w, O.ns.h);
  // 다리는 TV장 높이에서 까맣게 사라지게
  const f0 = ((780 - O.ns.y) / O.ns.h * 100).toFixed(1), f1 = ((1040 - O.ns.y) / O.ns.h * 100).toFixed(1);
  q('.tv-ns').style.setProperty('--fade', `linear-gradient(to bottom, #000 ${f0}%, transparent ${f1}%)`);
  P(q('.tv-set'), 0, 0, SC.w, SC.h);
  const [a, b, c, d] = SC.screen; P(q('.tv-screen'), a, b, c - a, d - b);
  v.querySelectorAll('.tv-spark').forEach((e, i) => P(e, ...O.eyes[i]));
  const ch = Math.max(40, Math.min(110, (c - a) * K * .15)), cat = q('.tv-cat');
  Object.assign(cat.style, { left: SC.cat[0] * K - ch * .55 + 'px', top: SC.cat[1] * K - ch + 3 + 'px', height: ch + 'px' });
  // 크게 보기: TV 화면 중심을 창 한가운데로 옮기면서 화면을 꽉 채울 만큼 다가간다
  const br = box.getBoundingClientRect();
  const cx = L + (a + c) / 2 * K, cy = T + (b + d) / 2 * K;
  const z = Math.min(innerWidth / ((c - a) * K), innerHeight / ((d - b) * K));
  q('.tv-cam').style.transformOrigin = `${cx}px ${cy}px`;
  v.style.setProperty('--zoom', z);
  v.style.setProperty('--zx', (innerWidth / 2 - (br.left + cx)) + 'px');
  v.style.setProperty('--zy', (innerHeight / 2 - (br.top + cy)) + 'px');
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
function todayLine() {
  const l = (S.tvlog && S.tvlog[dayKey()]) || [];
  const st = l.filter(x => x.kind === 'study').reduce((a, x) => a + x.mins, 0), pl = l.filter(x => x.kind === 'play').reduce((a, x) => a + x.mins, 0);
  q('.tv-today').textContent = l.length ? `오늘: 공부 ${dur(st)} · 놀기 ${dur(pl)}` : '리모컨에서 골라요';
}

// ---------- 고양이 ----------
let catT = 0;
function catPose(open) { q('.tv-cat img').src = `assets/ui/neko2/${open ? 'loaf2' : 'loaf'}.webp`; }
function catLoop() { clearTimeout(catT); catT = setTimeout(() => { if (!v.hidden) { catPose(true); setTimeout(() => catPose(false), 1800); } catLoop(); }, 6000 + Math.random() * 6000); }
q('.tv-cat').onclick = () => { catPose(true); const c = q('.tv-cat'); c.classList.remove('purr'); void c.offsetWidth; c.classList.add('purr'); setTimeout(() => catPose(false), 2200); if (Math.random() < .4) say(pick(['…걔 건드리면 깬다.', '고양이도 같이 보고 싶대.'])); };

// ---------- TV 화면: 메뉴 / 영상 ----------
let frame = null;     // 지금 TV에 띄운 iframe
let watch = null;     // 지금 TV로 보는 중 {site, title, ms, from}
function tvShow(src, info) {
  stopWatch(true);
  if (frame) frame.remove();
  frame = document.createElement('iframe');
  frame.className = 'tv-frame';
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.title = info.title || SITES[info.site].name;
  frame.src = src;
  q('.tv-screen').appendChild(frame);
  q('.tv-menu').hidden = true;
  v.classList.add('on');
  watch = { site: info.site, title: info.title || '', ms: 0, from: document.hidden ? 0 : Date.now() };
  remote();
}
function tvOff() {
  if (frame) { frame.remove(); frame = null; }
  q('.tv-menu').hidden = false;
  v.classList.remove('on');
  if (v.classList.contains('dive')) shrink();
  stopWatch();
  todayLine(); remote();
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
    S.tvRecent = [{ id: y.id, title: title || '', thumb: thumb || `https://i.ytimg.com/vi/${y.id}/mqdefault.jpg` }, ...(S.tvRecent || []).filter(x => x.id !== y.id)].slice(0, 12);
    save();
  }
  results = null; searchMsg = '';
  tvShow(src, { site: 'youtube', title });
  say(pick(PLAYING));
}
const ytKey = () => (S.ytKey || (/^AIza[\w-]{30,}$/.test(S.key || '') ? S.key : ''));
async function ytSearch(qs) {
  const key = ytKey();
  if (!key) throw new Error('nokey');
  const u = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&safeSearch=moderate&regionCode=KR&relevanceLanguage=ko&q=${encodeURIComponent(qs)}`;
  const r = await fetch(u, { headers: { 'x-goog-api-key': key } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || 'HTTP ' + r.status); e.status = r.status; throw e; }
  return (j.items || []).filter(x => x.id && x.id.videoId).map(x => ({
    id: x.id.videoId, title: decode(x.snippet.title), ch: decode(x.snippet.channelTitle),
    thumb: ((x.snippet.thumbnails && (x.snippet.thumbnails.medium || x.snippet.thumbnails.default)) || {}).url,
  }));
}
function decode(s) { const t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; }

// ---------- 밖에서 여는 곳 (브레이브, 밴드 앱, 유튜브 앱) ----------
const isAndroid = /Android/i.test(navigator.userAgent);
async function openOut(k, url) {
  const s = SITES[k];
  url = url || s.url;
  S.tv = { site: k, at: Date.now() }; save();
  if (k !== 'youtube') { v.classList.add('dive'); await sleep(600); }
  if (s.app && isAndroid) location.href = `intent://${url.replace(/^https:\/\//, '')}#Intent;scheme=https;package=${s.app};S.browser_fallback_url=${encodeURIComponent(url)};end`;
  else { const w = window.open(url, '_blank'); if (w) { try { w.opener = null; } catch (e) {} } else location.href = url; }
  setTimeout(() => v.classList.remove('dive'), 1200);
}

// ---------- 리모컨 ----------
let tab = 'youtube', results = null, searchMsg = '';
function remote() {
  v.querySelectorAll('.tv-tabs button').forEach(b => b.classList.toggle('sel', b.dataset.site === tab));
  const pane = q('.tv-pane');
  const ctl = frame ? `<div class="tv-ctl"><button class="big">크게 보기</button><button class="off">끄기</button></div>` : '';
  if (tab === 'youtube') {
    const list = results || (S.tvRecent || []).map(x => ({ ...x, ch: '' }));
    pane.innerHTML = `${ctl}
      <form class="tv-search"><input type="search" enterkeyhint="search" placeholder="유튜브 검색 또는 링크 붙여넣기" aria-label="유튜브 검색 또는 링크"><button>찾기</button></form>
      <div class="tv-row"><button class="paste">복사한 링크 틀기</button><button class="out">유튜브 앱에서 고르기</button></div>
      ${searchMsg ? `<p class="tv-msg">${searchMsg}</p>` : ''}
      ${list.length ? `<p class="tv-h">${results ? '검색 결과' : '최근에 본 영상'}</p>` : ''}
      <div class="tv-list">${list.map(x => `<button data-id="${esc(x.id)}" data-title="${esc(x.title || '')}" data-thumb="${esc(x.thumb || '')}"><img src="${esc(x.thumb || `https://i.ytimg.com/vi/${x.id}/mqdefault.jpg`)}" alt="" loading="lazy"><span><b>${esc(x.title || '유튜브 영상')}</b>${x.ch ? `<small>${esc(x.ch)}</small>` : ''}</span></button>`).join('')}</div>
      ${!list.length && !searchMsg ? '<p class="tv-msg">유튜브 앱에서 영상의 <b>공유 → 한울아파트</b>를 누르면 여기 TV에서 바로 나와요.</p>' : ''}`;
    const inp = pane.querySelector('input');
    pane.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const t = inp.value.trim(); if (!t) return;
      const y = ytParse(t); if (y) { inp.value = ''; ytPlay(y); return; }
      inp.blur(); searchMsg = '찾는 중…'; results = null; remote();
      try { results = await ytSearch(t); searchMsg = results.length ? '' : '검색 결과가 없어요.'; }
      catch (err) { results = null; searchMsg = searchError(err); }
      remote(); const i2 = q('.tv-search input'); if (i2) i2.value = t;
    };
    pane.querySelector('.paste').onclick = async () => {
      let t = '';
      try { t = await navigator.clipboard.readText(); } catch (e) {}
      const y = ytParse(t);
      if (y) ytPlay(y); else { searchMsg = t ? '복사한 글에 유튜브 링크가 없어요.' : '복사한 링크를 못 읽었어요. 위 칸을 길게 눌러 붙여 넣어 주세요.'; remote(); }
    };
    pane.querySelector('.out').onclick = () => openOut('youtube');
    pane.querySelectorAll('.tv-list button').forEach(b => b.onclick = () => ytPlay({ id: b.dataset.id }, b.dataset.title, b.dataset.thumb));
    const key = pane.querySelector('.setkey');
    if (key) key.onclick = () => { const k = prompt('유튜브 검색용 구글 API 키 (이 기기에만 저장돼요)', S.ytKey || ''); if (k != null) { S.ytKey = k.trim(); save(); searchMsg = ''; remote(); } };
  } else if (tab === 'band') {
    pane.innerHTML = `${ctl}
      <div class="tv-row"><button class="intv">TV에서 보기</button><button class="out">밴드 앱으로 열기</button></div>
      <p class="tv-msg">TV에 밴드 대신 "연결을 거부했다"는 화면이 나오면, 밴드가 다른 앱 안에 띄우는 걸 막은 거예요. 그때는 <b>밴드 앱으로 열기</b>를 눌러요. 다녀오면 본 시간을 물어볼게요.</p>`;
    pane.querySelector('.intv').onclick = () => { tvShow('https://band.us/', { site: 'band', title: '밴드' }); say('밴드? …뭐 올라왔는데.'); };
    pane.querySelector('.out').onclick = () => openOut('band');
  } else {
    pane.innerHTML = `${ctl}
      <form class="tv-search"><input type="search" enterkeyhint="search" placeholder="브레이브로 검색" aria-label="브레이브 검색"><button>찾기</button></form>
      <p class="tv-msg">브레이브는 다른 앱 안에 화면을 띄우지 못하게 막혀 있어서, 브레이브로 넘어갔다가 돌아와요. 돌아오면 다녀온 시간을 물어볼게요.</p>`;
    pane.querySelector('form').onsubmit = e => {
      e.preventDefault(); const t = pane.querySelector('input').value.trim();
      openOut('brave', t ? `https://search.brave.com/search?q=${encodeURIComponent(t)}` : SITES.brave.url);
    };
  }
  if (frame) { pane.querySelector('.big').onclick = dive; pane.querySelector('.off').onclick = tvOff; }
}
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
v.querySelectorAll('.tv-tabs button, .tv-btns button').forEach(b => b.onclick = () => {
  tab = b.dataset.site; results = null; searchMsg = ''; remote();
  if (b.closest('.tv-btns')) { const i = q('.tv-search input'); if (i) i.focus(); }
});

// ---------- 크게 보기 (TV 화면 속으로) ----------
function dive() { layout(); v.classList.add('dive'); q('.tv-shrink').hidden = false; }
function shrink() { v.classList.remove('dive'); q('.tv-shrink').hidden = true; }
q('.tv-shrink').onclick = shrink;

// ---------- 들어가기·나가기 ----------
let opening = false;
async function open() {
  if (opening || !v.hidden) return; opening = true;
  if (window.closeSheet && typeof sheetOpen !== 'undefined' && sheetOpen) closeSheet();
  v.hidden = false; layout(); catPose(false); todayLine(); remote();
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  $('home').classList.add('to-tv');
  await sleep(700);
  opening = false; catLoop();
  if (!checkReturn() && !frame) say(pick(IDLE));
}
async function close() {
  if (frame) tvOff();
  if (!q('.tv-ask').hidden) return; // 공부/놀기 대답부터
  v.classList.remove('enter'); v.classList.add('leave'); $('home').classList.remove('to-tv');
  await sleep(450); v.hidden = true; v.classList.remove('leave', 'dive'); q('.tv-shrink').hidden = true; clearTimeout(catT);
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
    box.hidden = true; todayLine();
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
