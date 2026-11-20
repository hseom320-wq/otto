// 한울아파트 — 한울냥 작은 창 (열품타 같은 다른 앱을 켜 둔 채로 공부할 때)
// 버튼을 누르면 한울냥이 있는 작은 떠 있는 창(유튜브 작은 화면 같은 것)이 생겨서 다른 앱 위에 계속 떠 있다.
// 작은 창에는 한울냥이 "지금 몇 분째인지"를 말해 주고, 시간이 지날 때마다 한마디씩 한다.
//  - 한울아파트 집중 타이머가 돌고 있으면 그 남은 시간을, 아니면 작은 창을 띄운 뒤로 몇 분째인지를 보여 준다.
//  - 작은 창 안에서는 누를 수 없고 보기만 된다 (안드로이드가 그렇게만 허락한다).
//  - 작은 창을 닫으면 그동안의 시간을 공부 기록에 넣을지 묻는다.
// 원리: 그림판(canvas)에 한울냥과 글씨를 그리고, 그걸 영상으로 바꿔서 크롬의 "작은 화면" 기능으로 띄운다.
'use strict';
(() => {
const W = 400, H = 300;
const POSES = ['sit', 'loaf', 'loaf2', 'look', 'sleep', 'jump'];
const img = {};
POSES.forEach(p => { const i = new Image(); i.src = `assets/ui/neko2/${p}.webp`; img[p] = i; });

// 한울냥 대사 ({n}: 몇 분째, {h}: 몇 시간, {s}: 과목)
const SAY = {
  start: ['같이 있을게. 시작이다냥!', '열품타 켰지냥? 나도 여기서 지켜본다냥', '오늘도 해 보자냥'],
  every10: ['{n}분째다냥. 잘하고 있다냥', '벌써 {n}분이다냥!', '{n}분째… 흐름 좋다냥', '{n}분. 딴짓 안 했지냥?'],
  m25: ['25분! 집중 잘 된다냥'],
  m50: ['50분 됐다냥. 10분 쉬어도 된다냥', '50분! 물 한 잔 마시고 와라냥'],
  hour: ['{h}시간 돌파다냥!! 대단하다냥', '{h}시간째… 진짜 열심히 한다냥'],
  idle: ['(꾸벅…)', '…냥.', '졸리다냥…', '열품타도 잘 돌아가지냥?', '조용히 있을게냥'],
  focusHalf: ['{s} 절반 왔다냥!'],
  focusEnd: ['{s} 끝났다냥! 수고했다냥', '타이머 끝! 잘했다냥'],
};
const pickT = (k, o) => pick(SAY[k]).replace(/\{(\w+)\}/g, (x, key) => (o && o[key] != null ? o[key] : x));

// ---------- 그림판 → 영상 ----------
const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
const g = cv.getContext('2d');
const vid = document.createElement('video');
vid.muted = true; vid.playsInline = true; vid.setAttribute('playsinline', '');
vid.style.cssText = 'position:fixed;left:-10px;top:-10px;width:2px;height:2px;opacity:0;pointer-events:none';
document.body.appendChild(vid);

let on = false, M = null;  // M: {start, last10, said:{}, line, lineAt, pose, poseAt, focusHalf, focusDone}
let drawT = 0;
const supported = () => !!(document.pictureInPictureEnabled && HTMLVideoElement.prototype.requestPictureInPicture && cv.captureStream);

function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(text, maxW) {
  // 띄어쓰기 단위로 줄을 나눈다 (한 낱말이 너무 길면 글자 단위로)
  const out = []; let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width <= maxW) { line = t; continue; }
    if (line) out.push(line);
    line = '';
    for (const ch of w) { if (g.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; } else line += ch; }
  }
  if (line) out.push(line);
  return out.slice(0, 2);
}
function state() {
  const now = Date.now(), f = window.focusState && focusState();
  const mins = Math.floor((now - M.start) / 60e3);
  return { now, f, mins };
}
function talk(t) { M.line = t; M.lineAt = Date.now(); M.pose = 'look'; M.poseAt = Date.now(); }
function think() {
  const { now, f, mins } = state();
  // 시간이 될 때마다 한마디
  if (mins > 0 && mins !== M.lastMin) {
    M.lastMin = mins;
    if (mins % 60 === 0) { talk(pickT('hour', { h: mins / 60 })); M.pose = 'jump'; }
    else if (mins === 50) talk(pickT('m50'));
    else if (mins === 25) talk(pickT('m25'));
    else if (mins % 10 === 0) talk(pickT('every10', { n: mins }));
  }
  if (f && !f.paused) {
    const left = f.end - now;
    if (!M.focusHalf && left <= f.len / 2 && left > 0) { M.focusHalf = true; talk(pickT('focusHalf', { s: f.subject })); }
    M.hadFocus = f.subject;
  } else if (M.hadFocus && !f) { talk(pickT('focusEnd', { s: M.hadFocus })); M.hadFocus = ''; M.pose = 'jump'; }
  // 오래 말이 없으면 가끔 혼잣말, 자세도 가끔 바꾼다
  if (now - M.lineAt > 25e3 && M.line) M.line = '';
  if (now - M.lineAt > 4 * 60e3 && Math.random() < .004) talk(pickT('idle'));
  if (now - M.poseAt > 9e3) {
    M.poseAt = now;
    const long = mins >= 90;
    M.pose = pick(long ? ['loaf', 'loaf', 'sleep', 'sit'] : ['sit', 'sit', 'loaf', 'loaf2', 'look']);
  }
}
function draw() {
  if (!M) return;
  think();
  const { now, f, mins } = state();
  // 바탕
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1a2033'); bg.addColorStop(1, '#0c0f18');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // 한울냥 (숨쉬듯 살짝)
  const p = img[M.pose] && img[M.pose].complete ? M.pose : 'sit', im = img[p];
  if (im && im.complete && im.naturalWidth) {
    const bob = Math.sin(now / 900) * 2, ch = p === 'sleep' || p.startsWith('loaf') ? 120 : 150;
    const cw = im.naturalWidth * ch / im.naturalHeight;
    g.drawImage(im, 92 - cw / 2, 200 - ch + bob, cw, ch);
  }
  // 시간
  g.textBaseline = 'alphabetic'; g.fillStyle = '#9fb6ff'; g.font = '600 22px system-ui, sans-serif';
  let big, label, small;
  if (f) {
    const left = f.paused ? f.paused : Math.max(0, f.end - now);
    big = `${Math.floor(left / 60e3)}:${String(Math.floor(left / 1e3) % 60).padStart(2, '0')}`;
    label = `${f.subject}${f.paused ? ' · 멈춤' : ''}`; small = '한울 타이머 남은 시간';
  } else {
    big = mins >= 60 ? `${Math.floor(mins / 60)}시간 ${mins % 60}분` : `${mins}분째`;
    label = '같이 공부 중'; small = `${new Date(M.start).toTimeString().slice(0, 5)} 시작`;
  }
  g.fillText(label.length > 9 ? label.slice(0, 9) + '…' : label, 180, 62);
  // 큰 글씨는 오른쪽 끝에 닿지 않게 줄인다
  let fs = 60; g.font = `800 ${fs}px system-ui, sans-serif`;
  while (fs > 30 && g.measureText(big).width > W - 192) { fs -= 2; g.font = `800 ${fs}px system-ui, sans-serif`; }
  g.fillStyle = '#ffffff'; g.fillText(big, 178, 128);
  g.fillStyle = 'rgba(220,226,240,.6)'; g.font = '500 20px system-ui, sans-serif'; g.fillText(small, 180, 160);
  // 말풍선
  if (M.line) {
    g.font = '600 24px system-ui, sans-serif';
    const lines = wrap(M.line, W - 56), bh = 22 + lines.length * 30;
    rr(14, H - bh - 12, W - 28, bh, 16); g.fillStyle = 'rgba(255,255,255,.95)'; g.fill();
    g.beginPath(); g.moveTo(80, H - bh - 12); g.lineTo(96, H - bh - 26); g.lineTo(104, H - bh - 12); g.fill();
    g.fillStyle = '#1b2033'; lines.forEach((l, i) => g.fillText(l, 28, H - bh - 12 + 36 + i * 30));
  } else {
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(14, H - 26, W - 28, 6);
    g.fillStyle = '#ff9db0'; g.fillRect(14, H - 26, (W - 28) * ((mins % 50) / 50), 6); // 50분 주기 막대
  }
}

// ---------- 켜기·끄기 ----------
async function open() {
  if (!supported()) { toast('이 기기·브라우저에서는 작은 창을 못 띄워요'); return; }
  if (document.pictureInPictureElement) { try { await document.exitPictureInPicture(); } catch (e) {} return; }
  const keep = S.mini && S.mini.start && Date.now() - S.mini.start < 6 * 3600e3; // 앱이 꺼졌다 켜진 경우 이어서 (6시간 넘은 건 버림)
  M = { start: keep ? S.mini.start : Date.now(), lastMin: -1, line: '', lineAt: 0, pose: 'sit', poseAt: Date.now(), focusHalf: false, hadFocus: '' };
  M.lastMin = Math.floor((Date.now() - M.start) / 60e3);
  S.mini = { start: M.start }; save();
  draw();
  try {
    if (!vid.srcObject) vid.srcObject = cv.captureStream(4);
    await vid.play();
    await vid.requestPictureInPicture();
  } catch (e) {
    toast('작은 창을 못 띄웠어요. 다시 한 번 눌러 주세요');
    return;
  }
  on = true; talk(pickT('start'));
  clearInterval(drawT); drawT = setInterval(draw, 250);
  updateButtons();
  toast('작은 창을 띄웠어요. 이제 열품타를 켜도 한울냥이 떠 있어요');
}
vid.addEventListener('leavepictureinpicture', () => {
  on = false; clearInterval(drawT); updateButtons();
  if (!M) return;
  const mins = Math.floor((Date.now() - M.start) / 60e3), had = window.focusState && focusState();
  M = null; S.mini = null; save();
  // 한울 타이머가 돌던 중이면 그쪽이 알아서 기록한다. 아니면 기록할지 묻는다
  if (!had && mins >= 1) askLog(mins);
});
window.miniOpen = open;
window.miniOn = () => on;

// ---------- 작은 창으로 공부한 시간 기록 ----------
function askLog(mins) {
  const box = document.createElement('div');
  box.className = 'mini-ask'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '공부 시간 기록');
  const subs = new Set((window.finalSubjects && finalSubjects()) || []);
  Object.values((S.tt && S.tt.cells) || {}).forEach(x => { if (x && !/창체|스포츠|음악|미술/.test(x)) subs.add(x); });
  let m = mins;
  box.innerHTML = `<img src="assets/ui/neko2/sit.webp" alt=""><p>한울냥이랑 <b class="m"></b> 같이 있었어요. 공부 기록에도 넣을까요?</p>
    <div class="adj"><button data-d="-10">−10</button><span class="m2"></span><button data-d="10">+10</button></div>
    <div class="subs">${[...subs].slice(0, 9).map(x => `<button data-sub="${esc(x)}">${esc(x)}</button>`).join('')}<button data-sub="자습">기타 공부</button></div>
    <button class="no">안 넣을래요 (열품타에만)</button>`;
  const upd = () => { const t = m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; box.querySelector('.m').textContent = t; box.querySelector('.m2').textContent = t; };
  upd();
  box.querySelectorAll('.adj button').forEach(b => b.onclick = () => { m = Math.max(1, Math.min(720, m + +b.dataset.d)); upd(); });
  box.querySelectorAll('.subs button').forEach(b => b.onclick = () => { if (window.addStudy) addStudy(b.dataset.sub, m); box.remove(); toast(`${b.dataset.sub} ${m}분 기록했어요`); });
  box.querySelector('.no').onclick = () => box.remove();
  document.getElementById('app').appendChild(box);
}

// ---------- 버튼 ----------
// 집중 타이머 화면에 "작은 창" 버튼
const keys = document.querySelector('.focus-keys');
let fb = null;
if (keys) { fb = document.createElement('button'); fb.className = 'pk mini-pk'; fb.textContent = '작은 창'; fb.onclick = open; keys.prepend(fb); }
function updateButtons() {
  if (fb) fb.textContent = on ? '작은 창 끄기' : '작은 창';
  document.querySelectorAll('.mini-open').forEach(b => { b.textContent = on ? '한울냥 작은 창 끄기' : '한울냥 작은 창 띄우기 · 열품타랑 같이'; });
}
window.miniButton = () => {
  const b = document.createElement('button'); b.className = 'btn ghost wide mini-open'; b.onclick = open;
  b.textContent = on ? '한울냥 작은 창 끄기' : '한울냥 작은 창 띄우기 · 열품타랑 같이';
  return b;
};
})();
