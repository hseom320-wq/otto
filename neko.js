// 한울아파트 — 한울냥 (화면을 돌아다니는 하얀 아기 고양이 마스코트)
// 비서 화면을 아무 데나 뛰어다니다가 앉거나, 올려다보거나, 폴짝 뛰거나, 졸거나(밤엔 더 자주) 한다.
// 손가락으로 잡으면 목덜미를 잡힌 채 대롱대롱 매달리고, 휙 던지면 날아가서 벽에 튕기고 떨어진다. 세게 떨어지면 어지러워한다.
// 톡 치면 폴짝 뛰며 방울이 울린다. 그림: assets/ui/neko/*.webp (자세 8개). 설정에서 끌 수 있다.
// app.js 등 다른 파일 뒤에 불러온다.
'use strict';
(() => {
const NKEY = 'hanul-neko';
let on = (() => { try { return localStorage.getItem(NKEY) !== '0'; } catch (e) { return true; } })();
let SP = null; // 그림 크기 {자세: {w, h}}
const POSES = ['sit', 'run1', 'run2', 'look', 'held', 'dizzy', 'sleep', 'jump'];

// ---------- 화면에 놓기 ----------
const root = document.createElement('div'); root.className = 'neko'; root.setAttribute('aria-hidden', 'true');
const nb = document.createElement('div'); nb.className = 'neko-body';
const img = document.createElement('img'); img.alt = ''; img.draggable = false; img.decoding = 'async';
nb.appendChild(img); root.appendChild(nb);
const shadow = document.createElement('div'); shadow.className = 'neko-shadow';
$('home').append(shadow, root);
POSES.forEach(p => { const i = new Image(); i.src = `assets/ui/neko/${p}.webp`; });

const N = { x: 0, y: 0, vx: 0, vy: 0, mode: 'idle', pose: 'sit', dir: 1, until: 0, tx: 0, ty: 0, floor: 0, frame: 0, spin: 0, squash: 0, hop: 0 };
let H = 74;            // 앉은 모습 키(px)
let started = false;
const sit = () => (SP ? SP.sit.h : 230);

// 돌아다닐 수 있는 칸: 위쪽 정보 줄과 아래쪽 대사·메뉴를 피한다
function area() {
  const W = innerWidth, Hh = innerHeight, wide = W > Hh;
  const top = Math.min(Hh * .42, (wide ? 150 : 175));
  const bottom = Hh - (wide ? 210 : 250);
  return { l: 34, r: W - 34, t: top + H, b: Math.max(top + H + 40, bottom) };
}
function size() { H = Math.round(Math.max(62, Math.min(96, Math.min(innerWidth, innerHeight) * .19))); }

// ---------- 그리기 ----------
function draw() {
  if (!SP) return;
  const p = SP[N.pose] || SP.sit, k = H / sit();
  const w = p.w * k, h = p.h * k;
  if (img.dataset.p !== N.pose) { img.src = `assets/ui/neko/${N.pose}.webp`; img.dataset.p = N.pose; }
  img.style.width = w + 'px'; img.style.height = h + 'px';
  // 잡혔을 때는 목덜미(그림 위쪽 가운데)가 손가락 자리, 나머지는 발(아래쪽 가운데)이 자리
  const held = N.mode === 'held';
  const ox = N.x - w / 2, oy = held ? N.y - h * .04 : N.y - h - N.hop;
  const sq = N.squash, sx = 1 + sq * .22, sy = 1 - sq * .25;
  const flip = N.dir < 0 && !held ? -1 : 1;
  root.style.transform = `translate3d(${ox}px, ${oy}px, 0)`;
  nb.style.transformOrigin = held ? '50% 4%' : '50% 100%';
  nb.style.transform = `rotate(${N.spin}deg) scale(${sx * flip}, ${sy})`;
  // 그림자: 바닥 높이에, 높이 떠 있을수록 작고 옅게
  const lift = held ? Math.max(0, N.floor - N.y - h) : Math.max(0, N.floor - N.y) + N.hop;
  const sh = Math.max(.35, 1 - lift / 320);
  const showShadow = N.mode !== 'fly' || lift < 400;
  shadow.style.opacity = showShadow ? (.42 * sh).toFixed(2) : '0';
  shadow.style.transform = `translate3d(${N.x - w * .36}px, ${(held || N.mode === 'fly' ? N.floor : N.y) - 7}px, 0) scale(${sh})`;
  shadow.style.width = w * .72 + 'px';
}

// ---------- 하는 일 고르기 ----------
const rnd = (a, b) => a + Math.random() * (b - a);
let lastTouch = Date.now();
function next() {
  const a = area(), night = slot() === 'night', bored = Date.now() - lastTouch > 120e3;
  const r = Math.random();
  N.spin = 0;
  if ((night || bored) && r < (night ? .35 : .18)) { N.mode = 'sleep'; N.pose = 'sleep'; N.until = Date.now() + rnd(18e3, 45e3); return; }
  if (r < .62) {
    N.mode = 'walk'; N.tx = rnd(a.l, a.r); N.ty = rnd(a.t, a.b);
    if (Math.abs(N.tx - N.x) < 60) N.tx = N.x + (N.x < innerWidth / 2 ? 1 : -1) * rnd(90, 200);
    N.tx = Math.min(a.r, Math.max(a.l, N.tx));
    N.dir = N.tx >= N.x ? 1 : -1; return;
  }
  if (r < .78) { N.mode = 'pause'; N.pose = 'look'; N.until = Date.now() + rnd(1600, 3200); return; }
  if (r < .9) { hop(); return; }
  N.mode = 'pause'; N.pose = 'sit'; N.until = Date.now() + rnd(2000, 5000);
}
function hop() { N.mode = 'hop'; N.pose = 'jump'; N.until = Date.now() + 620; }

// ---------- 움직이기 ----------
let last = 0;
function tick(t) {
  requestAnimationFrame(tick);
  if (!on || !SP || document.hidden || !$('home').classList.contains('on')) { last = t; return; }
  const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
  const now = Date.now(), a = area();
  N.squash *= Math.pow(.0009, dt); // 찌그러진 게 서서히 돌아온다
  switch (N.mode) {
    case 'walk': {
      const dx = N.tx - N.x, dy = N.ty - N.y, d = Math.hypot(dx, dy), sp = H * 1.55;
      if (d < 4) { N.mode = 'pause'; N.pose = 'sit'; N.until = now + rnd(1500, 4500); N.hop = 0; break; }
      const st = Math.min(d, sp * dt); N.x += dx / d * st; N.y += dy / d * st; N.floor = N.y;
      N.frame += dt; N.pose = (N.frame * 7.5 | 0) % 2 ? 'run2' : 'run1';
      N.hop = Math.abs(Math.sin(N.frame * Math.PI * 7.5)) * H * .07; // 종종걸음 들썩
      break;
    }
    case 'hop': {
      const left = (N.until - now) / 620; // 1 → 0
      if (left <= 0) { N.hop = 0; N.squash = .5; N.mode = 'pause'; N.pose = 'sit'; N.until = now + rnd(900, 2000); break; }
      N.hop = Math.sin((1 - left) * Math.PI) * H * .55;
      break;
    }
    case 'pause': case 'sleep': case 'dizzy':
      N.hop = 0;
      if (now > N.until) next();
      break;
    case 'held': break;
    case 'fly': {
      const g = 2600;
      N.vy += g * dt; N.x += N.vx * dt; N.y += N.vy * dt;
      N.spin += N.vx * dt * .35;
      const half = (SP.dizzy.w * H / sit()) / 2;
      if (N.x < half) { N.x = half; N.vx = Math.abs(N.vx) * .6; bump(); }
      if (N.x > innerWidth - half) { N.x = innerWidth - half; N.vx = -Math.abs(N.vx) * .6; bump(); }
      if (N.y < H + 10) { N.y = H + 10; N.vy = Math.abs(N.vy) * .5; bump(); }
      if (N.y >= N.floor) {
        N.y = N.floor;
        if (N.vy > 1500 && N.bounces < 2) { N.vy = -N.vy * .38; N.vx *= .7; N.bounces++; N.squash = 1; bump(); break; } // 통 튀어 오름
        land(N.vy);
      }
      break;
    }
  }
  draw();
}
function bump() { if (Math.random() < .7) bell(.5); }
function land(v) {
  const hard = v > 1500 || throws.filter(t => Date.now() - t < 12e3).length >= 3;
  N.vx = N.vy = 0; N.spin = 0; N.squash = Math.min(1, v / 1600);
  if (hard) {
    N.mode = 'dizzy'; N.pose = 'dizzy'; N.until = Date.now() + 2600;
    if (window.popSticker && Math.random() < .5) popSticker('confused');
    react('dizzy');
  } else { N.mode = 'pause'; N.pose = 'sit'; N.until = Date.now() + rnd(700, 1600); }
}

// ---------- 손으로 가지고 놀기 ----------
let down = null, samples = [], throws = [];
root.addEventListener('pointerdown', e => {
  if (!on) return;
  e.preventDefault(); e.stopPropagation();
  root.setPointerCapture(e.pointerId);
  lastTouch = Date.now();
  down = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false, dx: N.x - e.clientX, dy: 0 };
  samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
});
root.addEventListener('pointermove', e => {
  if (!down) return;
  const d = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  if (!down.moved && d > 7) { down.moved = true; grab(); }
  if (!down.moved) return;
  const px = N.x;
  N.x = e.clientX; N.y = e.clientY;
  N.spin = Math.max(-28, Math.min(28, N.spin * .7 + (N.x - px) * .9)); // 끌려갈 때 대롱대롱
  samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  if (samples.length > 8) samples.shift();
  draw();
});
const up = e => {
  if (!down) return;
  const was = down; down = null;
  if (!was.moved) { // 톡 치기
    if (N.mode === 'sleep' || N.mode === 'dizzy') { N.mode = 'pause'; N.pose = 'look'; N.until = Date.now() + 1400; }
    else hop();
    bell(1); if (window.popSticker && Math.random() < .35) popSticker('happy');
    return;
  }
  // 놓기: 마지막 0.1초 동안의 손 움직임으로 던지는 세기를 정한다
  const now = performance.now(), recent = samples.filter(s => now - s.t < 110);
  const s0 = recent[0] || samples[0], s1 = samples[samples.length - 1];
  const dt = Math.max(.016, (s1.t - s0.t) / 1000);
  let vx = (s1.x - s0.x) / dt, vy = (s1.y - s0.y) / dt;
  const sp = Math.hypot(vx, vy), max = 3200;
  if (sp > max) { vx *= max / sp; vy *= max / sp; }
  release(vx, vy, sp > 500);
};
root.addEventListener('pointerup', up);
root.addEventListener('pointercancel', up);
function grab() {
  N.mode = 'held'; N.pose = 'held'; N.hop = 0; N.squash = 0;
  N.floor = Math.max(N.floor, area().t);
  bell(.6);
  if (Math.random() < .25) react('grab');
}
function release(vx, vy, thrown) {
  const a = area(), h = SP.held.h * H / sit();
  // 매달려 있던 자리(목덜미)에서 발 자리로 바꿔서 날린다
  N.y = N.y + h * .96;
  // 떨어질 바닥: 놓은 자리보다 조금 아래 (돌아다니는 칸 안에서), 이미 그보다 아래면 지금 자리
  N.floor = Math.min(innerHeight - 24, Math.max(N.y, Math.max(a.t, Math.min(a.b, N.y + (thrown ? 80 : 18)))));
  N.vx = vx; N.vy = vy; N.mode = 'fly'; N.pose = 'dizzy'; N.bounces = 0;
  if (thrown) { throws.push(Date.now()); throws = throws.filter(t => Date.now() - t < 20e3); }
  else { N.pose = 'jump'; N.spin = 0; }
}

// ---------- 방울 소리 ----------
function bell(v) {
  try {
    if (localStorage.getItem('hanul-voice') && JSON.parse(localStorage.getItem('hanul-voice')).on === false) return;
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state !== 'running') return;
    const t0 = AC.currentTime;
    [[2637, 0], [3136, .07]].forEach(([f, dt]) => {
      const o = AC.createOscillator(), g = AC.createGain(), at = t0 + dt;
      o.type = 'triangle'; o.frequency.value = f * (0.97 + Math.random() * .06);
      o.connect(g); g.connect(AC.destination);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(.05 * v, at + .005); g.gain.exponentialRampToValueAtTime(0.0001, at + .5);
      o.start(at); o.stop(at + .55);
    });
  } catch (e) {}
}

// ---------- 비서의 한마디 (말풍선만, 기록 안 함) ----------
const LINES = {
  ns: { dizzy: ['야, 고양이 던지지 마.', '…그니까, 걔 어지럽대잖아.'], grab: ['또 잡았냐.', '그 고양이 너 좋아하네.'] },
  ys: { dizzy: ['아… 냥이 어지러워어…', '던지면… 안 돼에…'], grab: ['냥이… 귀엽다아…', '나도… 만져 볼래애.'] },
  hr: { dizzy: ['어머, 살살 해~ 아기잖아~', '냥이 괜찮아~?'], grab: ['어머, 냥이 안았어~?', '조심조심~'] },
  sy: { dizzy: ['…던지는 건 하지 마. 어지러워하잖아.', '살살. 아직 아기야.'], grab: ['…귀엽네. 잠깐만 안아 봐도 돼?', '목덜미 잡으면 얌전해지더라.'] },
  tr: { dizzy: ['야, 고양이 던지면 너도 던진다.', '…괜찮냐, 꼬맹이.'], grab: ['그 꼬맹이 또 데리고 노냐.', '살살 잡아라.'] },
};
let reactAt = 0;
function react(kind) {
  if (!C || Date.now() - reactAt < 9000 || sheetOpen) return;
  const l = LINES[C.code] && LINES[C.code][kind]; if (!l) return;
  reactAt = Date.now(); setBubble(pick(l), true);
}

// ---------- 시작·설정 ----------
function place() {
  size();
  const a = area();
  if (!started) { N.x = rnd(a.l + 40, a.r - 40); N.y = a.b; N.floor = N.y; started = true; next(); }
  N.x = Math.min(innerWidth - 30, Math.max(30, N.x)); N.y = Math.min(a.b + 60, Math.max(a.t, N.y)); N.floor = Math.min(N.floor, a.b + 60);
  draw();
}
function apply() { root.hidden = shadow.hidden = !on; if (on) place(); }
addEventListener('resize', () => { if (on) place(); });
fetch('assets/ui/neko/sprites.json', { cache: 'no-cache' }).then(r => r.json()).then(j => { SP = j; apply(); requestAnimationFrame(tick); }).catch(() => { root.hidden = shadow.hidden = true; });

const baseSet = SHEETS.set.render;
SHEETS.set.render = function () {
  baseSet();
  const b = document.getElementById('sheetBody');
  const reset = b.querySelector('.reset-all') || b.lastElementChild;
  const f = el('div', 'field', '<b>한울냥</b>');
  const box = el('input'); box.type = 'checkbox'; box.id = 'nekoOn'; box.checked = on;
  const lab = el('label', 'sw', '화면에 아기 고양이 돌아다니게 하기'); lab.prepend(box);
  box.onchange = () => { on = box.checked; try { localStorage.setItem(NKEY, on ? '1' : '0'); } catch (e) {} apply(); };
  f.append(lab, el('p', 'hint', '손가락으로 잡아서 끌거나 휙 던질 수 있어요. 톡 치면 폴짝 뛰어요.'));
  b.insertBefore(f, reset);
};
})();
