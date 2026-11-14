// 한울아파트 — 시청실
// 수현이 TV 뒤에서 빼꼼 내다보고, 한울냥이 TV 위에서 식빵 굽는 방. TV 화면의 버튼으로 유튜브·네이버 밴드·브레이브를 연다.
// 유튜브·밴드는 다른 앱 안에 화면을 띄우는 걸 막아 두어서, 버튼을 누르면 그 앱/사이트로 넘어갔다가 돌아온다.
// 돌아오면 다녀온 시간을 보여 주고 "공부였어? 놀았어?"를 묻는다: 공부면 과목을 골라 공부 시간에 더하고, 놀았으면 수현이 한마디 한다.
// 들어갈 때·TV 버튼을 누를 때는 엘리베이터처럼 화면이 서서히 다가가는 연출을 쓴다.
'use strict';
(() => {
// 그림 속 위치 (그림 크기에 대한 비율). screen: TV 화면, key: 꼭 보여야 하는 곳, eyes: 눈 반짝임, cat: 한울냥 자리(TV 윗변)
const ROOMS = {
  tall: { img: 'assets/tv/room.webp', w: 1520, h: 2688, screen: [212, 862, 1498, 1950], key: [0, 420, 1520, 2120],
          eyes: [[295, 690], [445, 655]], cat: [1180, 848] },
  wide: { img: 'assets/tv/room-wide.webp', w: 2048, h: 1360, screen: [477, 329, 1790, 1058], key: [180, 60, 1960, 1180],
          eyes: [[345, 285], [470, 235]], cat: [1440, 316] },
};
const SITES = {
  youtube: { name: '유튜브', url: 'https://m.youtube.com/', color: '#ff2b2b',
             icon: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4" fill="#ff2b2b"/><path d="M10 9l5 3-5 3z" fill="#fff"/></svg>' },
  band: { name: '네이버 밴드', url: 'https://band.us/', color: '#21c24c',
          icon: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="6" fill="#21c24c"/><path d="M8 7v10h4.5a3 3 0 0 0 0-6H8m0 0h3.6a2.2 2.2 0 0 0 0-4.4H8" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>' },
  brave: { name: '브레이브', url: 'https://search.brave.com/', color: '#fb542b', app: 'com.brave.browser',
           icon: '<svg viewBox="0 0 24 24"><path d="M12 2l7 3 1 6c0 6-4 9-8 11-4-2-8-5-8-11l1-6z" fill="#fb542b"/><path d="M9 9l3 1 3-1-1 6-2 2-2-2z" fill="#fff"/></svg>' },
};
const SCOLD = { // 놀았다고 하면 수현이 한마디 ({t}: 본 시간)
  ns: ['그니까, {t}이나 봤냐. …재밌었으면 됐고, 이제 하나만 해.', '{t}. 나랑 게임한 것도 아니면서.', '야, {t} 동안 뭐 봤는데. 나중에 나도 보여 줘. 대신 지금은 공부.'],
};
const PRAISE = ['오, 공부한 거였어? {t}, 기록해 뒀다.', '{t}이면 꽤 했네. 그니까, 이 기세로 하나 더.'];
const IDLE = ['뭐 볼 건데. 골라.', '…같이 볼래?', '나 TV 뒤에 숨은 거 아니다. 그냥 서 있는 거야.', '고양이 깨우지 마. 방금 잠들었어.'];

// ---------- 화면 ----------
const v = document.createElement('section');
v.id = 'tvroom'; v.className = 'tvroom'; v.hidden = true;
v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', '시청실');
v.innerHTML = `
  <img class="tv-blur" alt="">
  <div class="tv-cam">
    <img class="tv-room" alt="">
    <i class="tv-spark" aria-hidden="true"></i><i class="tv-spark" aria-hidden="true"></i>
    <button class="tv-cat" aria-label="한울냥 쓰다듬기"><img alt=""></button>
    <div class="tv-screen">
      <p class="tv-title">무엇을 볼까요</p>
      <div class="tv-btns">${Object.entries(SITES).map(([k, s]) => `<button data-site="${k}" style="--c:${s.color}">${s.icon}<span>${s.name}</span></button>`).join('')}</div>
      <p class="tv-today"></p>
    </div>
  </div>
  <div class="tv-top"><button class="tv-back">‹ 나가기</button><b>시청실</b></div>
  <div class="tv-say"><b>남수현</b><p></p></div>
  <div class="tv-ask" hidden></div>`;
document.getElementById('app').appendChild(v);
const q = s => v.querySelector(s);

// 그림을 화면에 맞추기: 보통은 꽉 채우되(cover), 수현과 TV(key)가 잘리면 그만큼 줄이고 빈 곳은 흐린 그림으로 채운다
let R = null, S0 = 1, OX = 0, OY = 0;
function layout() {
  R = innerWidth > innerHeight ? ROOMS.wide : ROOMS.tall;
  const W = v.clientWidth || innerWidth, H = v.clientHeight || innerHeight;
  const [kx0, ky0, kx1, ky1] = R.key;
  let s = Math.max(W / R.w, H / R.h);
  s = Math.min(s, W / (kx1 - kx0), H / (ky1 - ky0));
  const cx = (kx0 + kx1) / 2, cy = (ky0 + ky1) / 2;
  let ox = W / 2 - cx * s, oy = H / 2 - cy * s;
  // 그림이 화면보다 크면 빈 곳이 안 생기게 가장자리를 맞춘다
  if (R.w * s >= W) ox = Math.min(0, Math.max(W - R.w * s, ox)); else ox = (W - R.w * s) / 2;
  if (R.h * s >= H) oy = Math.min(0, Math.max(H - R.h * s, oy)); else oy = (H - R.h * s) / 2;
  S0 = s; OX = ox; OY = oy;
  const room = q('.tv-room'), blur = q('.tv-blur');
  if (room.getAttribute('src') !== R.img) { room.src = R.img; blur.src = R.img; }
  Object.assign(room.style, { left: ox + 'px', top: oy + 'px', width: R.w * s + 'px', height: R.h * s + 'px' });
  const P = (x, y) => [ox + x * s, oy + y * s];
  const [sx0, sy0] = P(R.screen[0], R.screen[1]), [sx1, sy1] = P(R.screen[2], R.screen[3]);
  Object.assign(q('.tv-screen').style, { left: sx0 + 'px', top: sy0 + 'px', width: sx1 - sx0 + 'px', height: sy1 - sy0 + 'px' });
  v.querySelectorAll('.tv-spark').forEach((e, i) => { const [x, y] = P(...R.eyes[i]); Object.assign(e.style, { left: x + 'px', top: y + 'px' }); });
  const cat = q('.tv-cat'), ch = Math.max(46, Math.min(96, (sx1 - sx0) * .17)), [catx, caty] = P(...R.cat);
  Object.assign(cat.style, { left: catx - ch * .55 + 'px', top: caty - ch + 4 + 'px', height: ch + 'px' });
  // TV 화면 중심 (다가가는 연출의 기준점)
  q('.tv-cam').style.transformOrigin = `${(sx0 + sx1) / 2}px ${(sy0 + sy1) / 2}px`;
  v.style.setProperty('--zoom', Math.min(W / (sx1 - sx0), H / (sy1 - sy0)) * 1.04);
}
addEventListener('resize', () => { if (!v.hidden) layout(); });

// ---------- 수현 한마디 ----------
function say(t) {
  q('.tv-say p').textContent = '';
  if (window.typeInto) { typeInto(q('.tv-say p'), t, 'tv'); } else q('.tv-say p').textContent = t;
}
const dur = m => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`);
const fillT = (t, o) => t.replace(/\{(\w+)\}/g, (x, k) => (o[k] != null ? o[k] : x));

// ---------- 오늘 본 것 ----------
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function todayLine() {
  const l = (S.tvlog && S.tvlog[dayKey()]) || [];
  const st = l.filter(x => x.kind === 'study').reduce((a, x) => a + x.mins, 0), pl = l.filter(x => x.kind === 'play').reduce((a, x) => a + x.mins, 0);
  q('.tv-today').textContent = l.length ? `오늘 시청실: 공부 ${dur(st)} · 놀기 ${dur(pl)}` : '돌아오면 본 시간을 공부나 놀기로 기록해요';
}

// ---------- 고양이 ----------
let catT = 0;
function catPose(open) { q('.tv-cat img').src = `assets/ui/neko2/${open ? 'loaf2' : 'loaf'}.webp`; }
function catLoop() { clearTimeout(catT); catT = setTimeout(() => { if (!v.hidden) { catPose(true); setTimeout(() => catPose(false), 1800); } catLoop(); }, 6000 + Math.random() * 6000); }
q('.tv-cat').onclick = () => { catPose(true); q('.tv-cat').classList.remove('purr'); void q('.tv-cat').offsetWidth; q('.tv-cat').classList.add('purr'); setTimeout(() => catPose(false), 2200); if (Math.random() < .4) say(pick(['…걔 건드리면 깬다.', '고양이도 같이 보고 싶대.'])); };

// ---------- 들어가기·나가기 (엘리베이터처럼 서서히) ----------
let opening = false;
async function open() {
  if (opening || !v.hidden) return; opening = true;
  if (window.closeSheet && sheetOpen) closeSheet();
  v.hidden = false; layout(); catPose(false); todayLine();
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  $('home').classList.add('to-tv');
  await sleep(700);
  opening = false; catLoop();
  if (!checkReturn()) say(pick(IDLE));
}
async function close() {
  v.classList.remove('enter'); v.classList.add('leave'); $('home').classList.remove('to-tv');
  await sleep(450); v.hidden = true; v.classList.remove('leave'); clearTimeout(catT);
}
q('.tv-back').onclick = close;

// ---------- TV 버튼: 화면 속으로 다가갔다가 그 앱으로 ----------
const isAndroid = /Android/i.test(navigator.userAgent);
v.querySelectorAll('.tv-btns button').forEach(b => b.onclick = async () => {
  const k = b.dataset.site, s = SITES[k];
  S.tv = { site: k, at: Date.now() }; save();
  b.blur(); v.classList.add('dive'); await sleep(650);
  let url = s.url;
  if (s.app && isAndroid) url = `intent://${s.url.replace(/^https:\/\//, '')}#Intent;scheme=https;package=${s.app};S.browser_fallback_url=${encodeURIComponent(s.url)};end`;
  // 새 창(또는 그 앱)으로 연다. 'noopener'를 넣으면 브라우저가 열렸는지 알려 주지 않아서 넣지 않고, 연 뒤에 끊는다
  if (s.app && isAndroid) { location.href = url; } // 브레이브 앱 열기 (앱이 없으면 브레이브 사이트)
  else { const w = window.open(url, '_blank'); if (w) { try { w.opener = null; } catch (e) {} } else location.href = url; }
  setTimeout(() => v.classList.remove('dive'), 1200);
});

// ---------- 돌아왔을 때: 공부였어? 놀았어? ----------
function checkReturn() {
  const t = S.tv; if (!t) return false;
  const mins = Math.round((Date.now() - t.at) / 60e3);
  if (mins < 1) { S.tv = null; save(); return false; }
  if (v.hidden) { open(); return true; }
  ask(t.site, Math.min(mins, 300));
  return true;
}
function subjects() {
  const set = new Set((window.finalSubjects && finalSubjects()) || []);
  Object.values((S.tt && S.tt.cells) || {}).forEach(x => { if (x && !/창체|스포츠|음악|미술/.test(x)) set.add(x); });
  return [...set].slice(0, 9);
}
function ask(site, mins) {
  v.scrollTop = 0; v.scrollLeft = 0;
  const box = q('.tv-ask'), s = SITES[site] || { name: '영상' };
  let m = mins;
  box.innerHTML = `<p><b>${s.name}</b>에 <span class="m"></span> 다녀왔어요.</p>
    <div class="adj"><button data-d="-10" aria-label="10분 빼기">−10</button><span class="m2"></span><button data-d="10" aria-label="10분 더하기">+10</button></div>
    <p class="sub">공부였으면 과목을 고르세요</p>
    <div class="subs">${subjects().map(x => `<button data-sub="${esc(x)}">${esc(x)}</button>`).join('')}<button data-sub="자습">기타 공부</button></div>
    <button class="play">놀았어</button>`;
  const upd = () => { box.querySelector('.m').textContent = dur(m); box.querySelector('.m2').textContent = dur(m); };
  upd();
  box.querySelectorAll('.adj button').forEach(b => b.onclick = () => { m = Math.max(1, Math.min(600, m + +b.dataset.d)); upd(); });
  const done = (kind, sub) => {
    S.tvlog = S.tvlog || {}; const d = dayKey(); (S.tvlog[d] = S.tvlog[d] || []).push({ site, mins: m, kind, sub: sub || null });
    S.tv = null;
    if (kind === 'study' && window.addStudy) addStudy(sub, m); else save();
    box.hidden = true; todayLine();
    say(fillT(pick(kind === 'study' ? PRAISE : SCOLD.ns), { t: dur(m) }));
  };
  box.querySelectorAll('.subs button').forEach(b => b.onclick = () => done('study', b.dataset.sub));
  box.querySelector('.play').onclick = () => done('play');
  box.hidden = false;
  say(m >= 60 ? `${dur(m)}이나? …뭐 봤는데.` : '다녀왔네. 뭐 봤어?');
}
// 앱으로 돌아오면 확인
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.tv) setTimeout(checkReturn, 400); });
addEventListener('pageshow', () => { if (S.tv) setTimeout(checkReturn, 800); });

// ---------- 메뉴 버튼 ----------
const dock = document.querySelector('.dock');
const btn = document.createElement('button');
btn.id = 'tvBtn';
btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M9 2.5l3 3 3-3"/></svg>시청실';
dock.insertBefore(btn, dock.querySelector('[data-open="mail"]'));
btn.onclick = open;
// 앱을 연 채로 시청실에 다녀왔으면 (앱이 새로 열린 경우)
setTimeout(() => { if (S.tv && DATA) checkReturn(); }, 2500);
})();
