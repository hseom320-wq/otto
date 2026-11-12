// 한울아파트 — 표정 바꾸기 · 눈 깜빡임
// 장면 그림 위에 얼굴 조각(눈·눈썹·입만 다시 그린 그림)을 겹쳐서 표정을 바꾼다. 자세·옷·배경은 그대로.
// 조각 목록은 data/faces.json (tools/build_faces.py 가 만든다). 조각이 있는 그림에서만 동작한다.
// - 대사의 감정(AI가 정한 값, 없으면 글에서 짐작)에 맞춰 표정이 바뀌고, 한동안 말이 없으면 원래 얼굴로 돌아온다.
// - 원래 얼굴일 때 몇 초마다 눈을 깜빡인다. 건드리면 잠깐 놀라거나 부끄러워한다.
// app.js·voice.js·motion.js 뒤에 불러온다.
'use strict';
(() => {
let FACES = {};
const MOOD_FACE = { happy: 'smile', sparkle: 'smile', angry: 'angry', sweat: 'shy', confused: 'surprised', sleepy: 'sleepy' };
const HOLD = 9000; // 표정을 이만큼 유지하다가 원래 얼굴로

// 겹칠 자리: 무대(.actor) 안에 그림과 같은 방식(꽉 채우고 넘치는 쪽 자르기)으로 놓는다
const layer = document.createElement('img');
layer.className = 'face'; layer.alt = ''; layer.hidden = true; layer.decoding = 'async';
$('bg').after(layer);
let cur = null;      // 지금 그림의 표정 묶음 {w, h, faces}
let showing = '';    // 지금 보이는 표정 ('' = 원래 얼굴)
let holdT = 0, blinkT = 0;

function setFor() {
  const bg = $('bg'), src = bg.getAttribute('src') || '';
  const code = C && C.code;
  cur = (!bg.hidden && code && FACES[code] && FACES[code][src]) || null;
  if (!cur) { layer.hidden = true; showing = ''; return; }
  place();
  // 미리 받아 둔다 (바꿀 때 깜빡이지 않게)
  Object.values(cur.faces).forEach(f => { const i = new Image(); i.src = f.img; });
}
function place() {
  if (!cur || !showing) return;
  const f = cur.faces[showing]; if (!f) return;
  const bg = $('bg'), W = bg.clientWidth, H = bg.clientHeight;
  const k = Math.max(W / cur.w, H / cur.h);
  const pos = (bg.style.objectPosition || '50% 30%').split(' ').map(v => parseFloat(v) / 100);
  const ox = (W - cur.w * k) * (isNaN(pos[0]) ? .5 : pos[0]), oy = (H - cur.h * k) * (isNaN(pos[1]) ? .3 : pos[1]);
  Object.assign(layer.style, { left: ox + f.x * k + 'px', top: oy + f.y * k + 'px', width: f.w * k + 'px', height: f.h * k + 'px' });
}
function show(expr) {
  if (!cur) { setFor(); if (!cur) return; }
  const f = expr && cur.faces[expr];
  if (!f) { showing = ''; layer.hidden = true; return; }
  showing = expr;
  if (layer.getAttribute('src') !== f.img) layer.src = f.img;
  place(); layer.hidden = false;
}
// 감정 → 표정 (잠깐 보였다가 원래 얼굴로)
function feel(mood, ms) {
  const e = MOOD_FACE[mood];
  clearTimeout(holdT);
  if (!e) { show(''); return; }
  show(e);
  holdT = setTimeout(() => { if (showing === e) show(''); }, ms || HOLD);
}
// 눈 깜빡임: 원래 얼굴일 때만 (2.5~6초마다, 가끔 두 번)
function blinkLoop() {
  clearTimeout(blinkT);
  blinkT = setTimeout(async () => {
    if (cur && !showing && !document.hidden && cur.faces.blink) {
      const twice = Math.random() < .2;
      for (let i = 0; i < (twice ? 2 : 1); i++) { show('blink'); await sleep(120); if (showing === 'blink') show(''); if (twice) await sleep(140); }
    }
    blinkLoop();
  }, 2500 + Math.random() * 3500);
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
// 건드리면 잠깐 놀라거나 부끄러워한다
let pokes = [], lastPoke = 0;
$('tapHit').addEventListener('pointerdown', () => {
  const now = Date.now(); lastPoke = now; pokes = pokes.filter(t => now - t < 3000); pokes.push(now);
  feel(pokes.length >= 4 ? 'angry' : pick(['confused', 'sweat']), 1800);
});
// 그림이 바뀌거나(시간대·보상씬·비서 바꾸기) 화면 크기가 바뀌면 다시 맞춘다
new MutationObserver(rs => {
  if (rs.some(r => r.attributeName !== 'style')) { show(''); setFor(); } else place(); // 위치만 바뀌면 다시 놓기만
}).observe($('bg'), { attributes: true, attributeFilter: ['src', 'hidden', 'style'] });
addEventListener('resize', () => requestAnimationFrame(place));

fetch('data/faces.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).then(j => { FACES = j || {}; setFor(); blinkLoop(); }).catch(() => {});
})();
