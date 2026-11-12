// 한울아파트 — 대사 타이핑 소리 (비주얼 노벨처럼)
// 대사가 한 글자씩 나올 때마다 짧은 "탁" 소리가 난다. 비서마다 음색이 다르고, 감정에 따라 소리 크기가 달라진다.
// 소리는 파일 없이 브라우저가 직접 만든다 (Web Audio). 설정에서 끄거나 크기를 바꿀 수 있다.
// app.js 등 다른 파일 뒤에 불러온다. app.js 의 typeInto·say 를 감싼다.
'use strict';
(() => {
const VKEY = 'hanul-voice';
let V = { on: true, vol: 70 };
try { Object.assign(V, JSON.parse(localStorage.getItem(VKEY)) || {}); } catch (e) {}
const keepV = () => { try { localStorage.setItem(VKEY, JSON.stringify(V)); } catch (e) {} };

// 비서별 음색: f 높이(Hz), w 파형, d 길이(초), every 몇 글자마다 한 번, g 기본 크기
const VOICES = {
  ns: { f: 540, w: 'square', d: .032, every: 1, g: .55 },   // 짧게 툭툭 끊어 던지는 말투
  ys: { f: 360, w: 'sine', d: .055, every: 2, g: 1 },       // 느릿하고 웅얼웅얼
  hr: { f: 430, w: 'triangle', d: .048, every: 1, g: .9 },  // 나긋나긋 둥근 소리
  sy: { f: 640, w: 'triangle', d: .028, every: 1, g: .85 }, // 또박또박 빠르게
  tr: { f: 260, w: 'square', d: .04, every: 1, g: .6 },     // 낮고 거친 소리
  narr: { f: 760, w: 'sine', d: .022, every: 2, g: .55 },   // 엘리베이터 안내 같은 서술
};
// 감정 → 소리 크기 (1이 가장 큼)
const MOOD_VOL = { angry: 1, sparkle: .85, happy: .75, none: .6, confused: .5, sweat: .5, sleepy: .32 };
// 감정이 따로 안 오면 글에서 짐작한다
function guess(text) {
  const t = String(text);
  if (/닥쳐|꺼져|죽는다|가만 안 둔다|새끼|짜증|화났|미쳤냐/.test(t)) return 'angry';
  if (/[!！]/.test(t)) return 'sparkle';
  if ((t.match(/…|\.\.\./g) || []).length >= 2 || /졸려|잘래|하암|zzz/i.test(t)) return 'sleepy';
  if (/[~♪]|ㅎㅎ|ㅋㅋ|좋다|잘했/.test(t)) return 'happy';
  if (/\?|어, 어|그, 그|아, 아니/.test(t)) return 'confused';
  return 'none';
}

// ---------- 소리 만들기 ----------
function ctx() {
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  if (AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}
// 폰은 화면을 한 번 만져야 소리를 낼 수 있어서, 처음 만질 때 소리 장치를 깨워 둔다
['pointerdown', 'keydown', 'touchend'].forEach(e => addEventListener(e, () => { if (V.on) ctx(); }, { capture: true, passive: true }));

function blip(v, loud) {
  if (!V.on || V.vol <= 0 || document.hidden) return;
  const a = ctx(); if (!a || a.state !== 'running') return;
  const at = a.currentTime, o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
  o.type = v.w; o.frequency.setValueAtTime(v.f * (0.94 + Math.random() * 0.12), at);
  o.frequency.exponentialRampToValueAtTime(v.f * 0.82, at + v.d);
  f.type = 'lowpass'; f.frequency.value = 2600; // 귀에 거슬리는 높은 소리를 깎는다
  const peak = 0.16 * v.g * loud * (V.vol / 100);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + v.d);
  o.connect(f); f.connect(g); g.connect(a.destination);
  o.start(at); o.stop(at + v.d + 0.02);
}

// ---------- 누가 말하는지 · 감정 ----------
let nextMood = null;
const baseSay = say;
say = function (text, mood) { nextMood = mood && mood !== 'none' ? mood : null; return baseSay(text, mood); };
function speaker(id) {
  if (id === 'lift') return 'narr';
  if (id === 'call') { const who = ($('callWho') && $('callWho').textContent) || ''; const c = DATA && DATA.characters.find(x => who.includes(x.name)); return c ? c.code : 'narr'; }
  return C ? C.code : 'narr';
}
const SILENT = /[\s.,…~!?！？·\-—()'"“”‘’「」『』:;/]/; // 이런 글자에는 소리를 안 낸다 (쉼처럼 들리게)

// ---------- 한 글자씩 나오는 대사 + 소리 ----------
typeInto = function (el, text, id = 'x') {
  clearInterval(typeT[id]); el.textContent = '';
  const ch = [...String(text)]; let i = 0, n = 0, lastAt = 0;
  const v = VOICES[speaker(id)] || VOICES.narr;
  const mood = id === 'lift' ? 'none' : (nextMood || guess(text));
  if (id === 'bub') nextMood = null;
  const loud = MOOD_VOL[mood] != null ? MOOD_VOL[mood] : .6;
  typeT[id] = setInterval(() => {
    const c = ch[i++] || '';
    el.textContent += c;
    if (c && !SILENT.test(c)) {
      n++;
      const t = performance.now();
      if (n % v.every === 0 && t - lastAt >= 42) { lastAt = t; blip(v, loud); } // 너무 촘촘하면 기계음 같아서 간격을 둔다
    }
    if (i >= ch.length) clearInterval(typeT[id]);
  }, 28);
};

// ---------- 설정 화면에 더하기 ----------
const baseSet = SHEETS.set.render;
SHEETS.set.render = function () {
  baseSet();
  const b = body(), reset = b.querySelector('.reset-all') || b.lastElementChild;
  const fv = el('div', 'field', '<b>대사 소리</b>');
  const on = el('input'); on.type = 'checkbox'; on.id = 'voiceOn'; on.checked = V.on;
  const lab = el('label', 'sw', '대사가 나올 때 타닥타닥 소리 내기'); lab.prepend(on);
  const row = el('div', 'row vol-row'), rg = el('input'), num = el('span', 'vol-num', `${V.vol}`);
  rg.type = 'range'; rg.min = 0; rg.max = 100; rg.step = 5; rg.value = V.vol; rg.id = 'voiceVol'; rg.setAttribute('aria-label', '대사 소리 크기');
  rg.disabled = !V.on;
  const test = el('button', 'btn sm ghost', '들어 보기');
  on.onchange = () => { V.on = on.checked; rg.disabled = !V.on; keepV(); if (V.on) ctx(); };
  rg.oninput = () => { V.vol = +rg.value; num.textContent = rg.value; keepV(); };
  test.onclick = () => { ctx(); const v = VOICES[C ? C.code : 'narr'] || VOICES.narr; let k = 0; const t = setInterval(() => { blip(v, MOOD_VOL.none); if (++k >= 7) clearInterval(t); }, 60); };
  row.append(rg, num, test);
  fv.append(lab, row, el('p', 'hint', '비서마다 소리가 다르고, 화나거나 신나면 크게, 졸리거나 머뭇거리면 작게 나요. 폰은 화면을 한 번 만진 뒤부터 소리가 나요.'));
  b.insertBefore(fv, reset);
};
})();
