// 한울아파트 — 표정 바꾸기
// 목록: data/faces.json (tools/build_faces.py 가 만든다). 표정이 있는 장면에서만 동작한다.
// - 장면이 반복 영상이면: 표정마다 "영상 첫 장면 + 표정"으로 만든 짧은 영상을 영상 위에 서서히 겹친다.
//   표정도 영상이라 폰이 같은 방식으로 그려서, 표정이 바뀔 때 화면 밝기·색이 튀지 않는다.
//   원래 얼굴로 돌아갈 때는 반복 영상을 처음 장면부터 다시 틀고 표정 영상을 걷어서 이음새가 없다.
// - 그림 장면이면: 그림 위에 얼굴 조각(눈·눈썹·입만 다시 그린 그림)을 겹친다.
// - 대사의 감정(AI가 정한 값, 없으면 글에서 짐작)에 맞춰 바뀌고, 한동안 말이 없으면 원래 얼굴로 돌아온다.
// - 건드리면 부끄러워하고, 여러 번 건드리면 짜증 낸다. 표정끼리는 서서히 겹쳐 바뀐다.
'use strict';
(() => {
let FACES = {};
const MOOD_FACE = { happy: 'smile', sparkle: 'smile', angry: 'angry', sweat: 'shy', sleepy: 'sleepy' };
const HOLD = 9000;

const mkImg = () => { const i = document.createElement('img'); i.className = 'face'; i.alt = ''; i.decoding = 'async'; return i; };
const mkVid = () => { const v = document.createElement('video'); v.className = 'bg exprv'; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); return v; };
const imgs = [mkImg(), mkImg()], vids = [mkVid(), mkVid()];
let front = 0;
$('bgv').after(...vids, ...imgs);

let cur = null;      // 지금 장면의 표정 묶음 {w, h, faces, video}
let base = '';       // 지금 장면의 원래 그림 경로
let video = false;   // 반복 영상 장면인지
let showing = '';
let holdT = 0;

function setFor() {
  const bg = $('bg'), v = $('bgv');
  video = !v.hidden;
  base = video ? (v.getAttribute('poster') || '') : (bg.hidden ? '' : bg.getAttribute('src') || '');
  $('home').classList.toggle('has-video', video);
  const code = C && C.code;
  cur = (base && code && FACES[code] && FACES[code][base]) || null;
  if (cur && video && !Object.values(cur.faces).some(f => f.vid)) cur = null; // 영상용 표정이 없으면 쓰지 않는다
  if (!cur) { hideAll(true); return; }
  // 미리 받아 둔다 (바꿀 때 기다리지 않게)
  Object.values(cur.faces).forEach(f => { if (video) fetch(f.vid).catch(() => {}); else { const i = new Image(); i.src = f.img; } });
}
function hideAll(now) {
  const was = !!showing && video;
  showing = '';
  imgs.forEach(l => l.classList.remove('on'));
  if (was && !now) {
    // 반복 영상을 첫 장면부터 다시 틀고(표정 영상과 같은 장면) 표정 영상을 걷는다
    const v = $('bgv');
    try { v.currentTime = 0; v.play().catch(() => {}); } catch (e) {}
  }
  vids.forEach(x => x.classList.remove('on'));
}
// 그림 장면: 조각을 그림과 같은 방식(꽉 채우고 넘치는 쪽 자르기)으로 놓는다
function placeImg(expr, layer) {
  const f = cur && cur.faces[expr]; if (!f) return;
  const bg = $('bg'), W = bg.clientWidth, H = bg.clientHeight;
  const k = Math.max(W / cur.w, H / cur.h);
  const pos = (bg.style.objectPosition || '50% 30%').split(' ').map(t => parseFloat(t) / 100);
  const ox = (W - cur.w * k) * (isNaN(pos[0]) ? .5 : pos[0]), oy = (H - cur.h * k) * (isNaN(pos[1]) ? .3 : pos[1]);
  Object.assign(layer.style, { left: ox + f.x * k + 'px', top: oy + f.y * k + 'px', width: f.w * k + 'px', height: f.h * k + 'px' });
}
function place() { if (!video && showing) placeImg(showing, imgs[front]); }
function show(expr) {
  if (!cur) { setFor(); if (!cur) return; }
  const f = expr && cur.faces[expr];
  if (!f) { hideAll(); return; }
  if (expr === showing) return;
  showing = expr;
  const next = 1 - front;
  if (video) {
    const nv = vids[next], ov = vids[front];
    nv.style.objectPosition = $('bgv').style.objectPosition;
    const go = () => { if (showing !== expr) return; try { nv.pause(); nv.currentTime = 0; } catch (e) {} nv.classList.add('on'); ov.classList.remove('on'); front = next; };
    if (nv.getAttribute('src') !== f.vid) { nv.src = f.vid; nv.addEventListener('loadeddata', go, { once: true }); nv.load(); }
    else if (nv.readyState >= 2) setTimeout(go, 0); else nv.addEventListener('loadeddata', go, { once: true });
  } else {
    const l = imgs[next], old = imgs[front];
    placeImg(expr, l);
    const swap = () => { if (showing !== expr) return; l.classList.add('on'); old.classList.remove('on'); front = next; };
    if (l.getAttribute('src') !== f.img) { l.src = f.img; (l.decode ? l.decode() : Promise.resolve()).then(swap, swap); }
    else setTimeout(swap, 0);
  }
}
function feel(mood, ms) {
  const e = MOOD_FACE[mood];
  clearTimeout(holdT);
  if (!e) { if (showing) show(''); return; }
  show(e);
  holdT = setTimeout(() => { if (showing === e) show(''); }, ms || HOLD);
}

// ---------- 다른 기능과 잇기 ----------
let pending = null;
const baseSay = say;
say = function (text, mood) { pending = mood || null; return baseSay.apply(this, arguments); };
const baseType = typeInto;
typeInto = function (el, text, id) {
  if (id === 'bub' && text) {
    const m = pending || (window.guessMood ? guessMood(text) : 'none'); pending = null;
    if (!(m === 'none' && Date.now() - lastPoke < 2400)) feel(m); // 건드린 직후의 평범한 대사는 표정을 덮지 않는다
  }
  return baseType.apply(this, arguments);
};
let pokes = [], lastPoke = 0;
$('tapHit').addEventListener('pointerdown', () => {
  const now = Date.now(); lastPoke = now; pokes = pokes.filter(t => now - t < 3000); pokes.push(now);
  feel(pokes.length >= 4 ? 'angry' : 'sweat', pokes.length >= 4 ? 2600 : 2200);
});
// 그림·영상이 바뀌면(시간대·보상씬·비서 바꾸기·화면 돌리기) 다시 맞춘다
const watch = new MutationObserver(rs => { if (rs.some(r => r.attributeName !== 'style')) { hideAll(true); setFor(); } else place(); });
watch.observe($('bg'), { attributes: true, attributeFilter: ['src', 'hidden', 'style'] });
watch.observe($('bgv'), { attributes: true, attributeFilter: ['src', 'hidden', 'poster', 'style'] });
addEventListener('resize', () => requestAnimationFrame(place));

fetch('data/faces.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).then(j => { FACES = j || {}; setFor(); }).catch(() => {});
})();
