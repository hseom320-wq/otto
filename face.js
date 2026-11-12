// 한울아파트 — 표정 바꾸기
// 장면 그림 위에 얼굴 조각(눈·눈썹·입만 다시 그린 그림)을 겹쳐서 표정을 바꾼다. 자세·옷·배경은 그대로.
// 조각 목록은 data/faces.json (tools/build_faces.py 가 만든다). 조각이 있는 그림에서만 동작한다.
// - 대사의 감정(AI가 정한 값, 없으면 글에서 짐작)에 맞춰 표정이 바뀌고, 한동안 말이 없으면 원래 얼굴로 돌아온다.
// - 장면이 영상(숨쉬기·눈 깜빡임이 든 반복 영상)이면, 표정이 필요할 때만 원래 그림으로 부드럽게 바꿔 표정을 보여 주고 다시 영상으로 돌아간다.
// - 표정끼리는 서서히 겹쳐 바뀐다(두 겹을 번갈아 쓴다). 건드리면 놀랐다가 → 부끄러워하다가 → 원래 얼굴로 이어진다.
// app.js·voice.js·motion.js 뒤에 불러온다.
'use strict';
(() => {
let FACES = {};
const MOOD_FACE = { happy: 'smile', sparkle: 'smile', angry: 'angry', sweat: 'shy', confused: 'surprised', sleepy: 'sleepy' };
const HOLD = 9000; // 표정을 이만큼 유지하다가 원래 얼굴로

// 영상 위에 잠깐 덮을 원래 그림 + 얼굴 조각. 무대(.actor) 안에서 그림과 같은 방식(꽉 채우고 넘치는 쪽 자르기)으로 놓는다
const still = document.createElement('img');
still.className = 'bg still'; still.alt = ''; still.decoding = 'async';
// 표정 조각 두 겹: 새 표정은 안 쓰는 겹에 올려 서서히 나타나게 하고, 쓰던 겹은 서서히 사라지게 한다
const mk = () => { const i = document.createElement('img'); i.className = 'face'; i.alt = ''; i.decoding = 'async'; return i; };
const layers = [mk(), mk()];
let front = 0; // 지금 보이는 겹
$('bgv').after(still, ...layers);
let cur = null;      // 지금 그림의 표정 묶음 {w, h, faces}
let base = '';       // 지금 장면의 원래 그림 경로
let video = false;   // 영상 장면인지
let showing = '';    // 지금 보이는 표정 ('' = 원래 얼굴)
let holdT = 0;

function setFor() {
  const bg = $('bg'), v = $('bgv');
  video = !v.hidden;
  base = video ? (v.getAttribute('poster') || '') : (bg.hidden ? '' : bg.getAttribute('src') || '');
  $('home').classList.toggle('has-video', video);
  const code = C && C.code;
  cur = (base && code && FACES[code] && FACES[code][base]) || null;
  if (!cur) { hideAll(); return; }
  // 미리 받아 둔다 (바꿀 때 깜빡이지 않게)
  Object.values(cur.faces).forEach(f => { const i = new Image(); i.src = f.img; });
  if (video) { const i = new Image(); i.src = base; }
}
function hideAll() {
  const was = showing && video && still.classList.contains('on');
  showing = ''; layers.forEach(l => l.classList.remove('on'));
  // 영상의 첫 장면이 원래 그림과 같으니, 처음부터 다시 틀고 덮개를 걷으면 이음새 없이 돌아온다
  if (was) { const v = $('bgv'); try { v.currentTime = 0; v.play().catch(() => {}); } catch (e) {} }
  still.classList.remove('on');
}
function place(expr, layer) {
  expr = expr || showing; layer = layer || layers[front];
  if (!cur || !expr) return;
  const f = cur.faces[expr]; if (!f) return;
  let map; // 원래 그림 좌표 (x, y) → 화면 좌표
  const v = $('bgv');
  if (video && v.videoWidth) {
    // 영상은 원래 그림을 꽉 채워 가운데를 잘라 만든 것이라, 그 잘린 만큼까지 맞춰서 원래 그림을 영상과 똑같은 자리에 놓는다
    const W = v.clientWidth, H = v.clientHeight, vw = v.videoWidth, vh = v.videoHeight;
    const s = Math.max(vw / cur.w, vh / cur.h), cx = (cur.w * s - vw) / 2, cy = (cur.h * s - vh) / 2;
    const K = Math.max(W / vw, H / vh);
    const pos = (v.style.objectPosition || '50% 30%').split(' ').map(t => parseFloat(t) / 100);
    const ox = (W - vw * K) * (isNaN(pos[0]) ? .5 : pos[0]) - cx * K, oy = (H - vh * K) * (isNaN(pos[1]) ? .3 : pos[1]) - cy * K;
    map = { k: s * K, ox, oy };
    Object.assign(still.style, { left: ox + 'px', top: oy + 'px', width: cur.w * s * K + 'px', height: cur.h * s * K + 'px', right: 'auto', bottom: 'auto', objectFit: 'fill' });
  } else {
    const ref = video ? still : $('bg'), W = ref.clientWidth, H = ref.clientHeight;
    const k = Math.max(W / cur.w, H / cur.h);
    const pos = ((video ? v : $('bg')).style.objectPosition || '50% 30%').split(' ').map(t => parseFloat(t) / 100);
    map = { k, ox: (W - cur.w * k) * (isNaN(pos[0]) ? .5 : pos[0]), oy: (H - cur.h * k) * (isNaN(pos[1]) ? .3 : pos[1]) };
  }
  Object.assign(layer.style, { left: map.ox + f.x * map.k + 'px', top: map.oy + f.y * map.k + 'px', width: f.w * map.k + 'px', height: f.h * map.k + 'px' });
}
let showT = 0;
function show(expr) {
  if (!cur) { setFor(); if (!cur) return; }
  const f = expr && cur.faces[expr];
  if (!f) { hideAll(); return; }
  if (expr === showing) return;
  showing = expr;
  if (video) {
    if (still.getAttribute('src') !== base) still.src = base;
    still.style.objectPosition = $('bgv').style.objectPosition;
    still.classList.add('on');
  }
  // 안 쓰던 겹에 새 표정을 올리고, 그림이 준비되면 겹을 맞바꾼다 (서서히 겹쳐 바뀜)
  const next = 1 - front, l = layers[next], old = layers[front];
  place(expr, l);
  const swap = () => { if (showing !== expr) return; l.classList.add('on'); old.classList.remove('on'); front = next; };
  clearTimeout(showT);
  if (l.getAttribute('src') !== f.img) { l.src = f.img; (l.decode ? l.decode() : Promise.resolve()).then(swap, swap); }
  else showT = setTimeout(swap, 0);
}
// 감정 → 표정 (잠깐 보였다가 원래 얼굴로)
function feel(mood, ms) {
  const e = MOOD_FACE[mood];
  clearTimeout(holdT);
  if (!e) { show(''); return; }
  show(e);
  holdT = setTimeout(() => { if (showing === e) show(''); }, ms || HOLD);
}

// ---------- 다른 기능과 잇기 ----------
// 대사: AI가 정한 감정을 먼저, 없으면 글에서 짐작
let pending = null;
const baseSay = say;
say = function (text, mood) { pending = mood || null; return baseSay.apply(this, arguments); };
const baseType = typeInto;
typeInto = function (el, text, id) {
  if (id === 'bub' && text) {
    const m = pending || (window.guessMood ? guessMood(text) : 'none'); pending = null;
    // 건드린 직후의 평범한 대사는 움찔한 표정을 덮지 않는다
    if (!(m === 'none' && Date.now() - lastPoke < 1600)) feel(m);
  }
  return baseType.apply(this, arguments);
};
// 건드리면: 흠칫 놀랐다가 → 부끄러워하다가 → 원래 얼굴로 (여러 번 건드리면 짜증)
let pokes = [], lastPoke = 0, pokeT = [];
function sequence(steps) {
  pokeT.forEach(clearTimeout); pokeT = []; clearTimeout(holdT);
  let at = 0;
  steps.forEach(([expr, ms]) => { pokeT.push(setTimeout(() => show(expr), at)); at += ms; });
  pokeT.push(setTimeout(() => { if (Date.now() - lastPoke >= at - 50) show(''); }, at));
}
$('tapHit').addEventListener('pointerdown', () => {
  const now = Date.now(); lastPoke = now; pokes = pokes.filter(t => now - t < 3000); pokes.push(now);
  if (pokes.length >= 4) sequence([['angry', 2600]]);
  else if (pokes.length >= 2) sequence([['shy', 2200]]);
  else sequence([['surprised', 650], ['shy', 1900]]);
});
// 그림이 바뀌거나(시간대·보상씬·비서 바꾸기) 화면 크기가 바뀌면 다시 맞춘다
const watch = new MutationObserver(rs => {
  if (rs.some(r => r.attributeName !== 'style')) { show(''); setFor(); } else place(); // 위치만 바뀌면 다시 놓기만
});
watch.observe($('bg'), { attributes: true, attributeFilter: ['src', 'hidden', 'style'] });
watch.observe($('bgv'), { attributes: true, attributeFilter: ['src', 'hidden', 'poster', 'style'] });
addEventListener('resize', () => requestAnimationFrame(() => place()));

fetch('data/faces.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).then(j => { FACES = j || {}; setFor(); }).catch(() => {});
})();
