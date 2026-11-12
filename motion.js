// 한울아파트 — 캐릭터 움직임 (비주얼 노벨처럼)
// 그림 한 장으로: 숨쉬듯 아주 조금 움직이고 좌우로 살짝 흔들린다. 건드리면 움찔하고, 말을 시작할 때 살짝 들썩인다.
// 설정에서 끌 수 있다 ("동작 줄이기"를 켠 기기는 처음부터 꺼 둔다). app.js·voice.js 뒤에 불러온다.
'use strict';
(() => {
const MKEY = 'hanul-motion';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let on = (() => { try { const v = localStorage.getItem(MKEY); return v == null ? !reduce : v === '1'; } catch (e) { return !reduce; } })();
const apply = () => document.body.classList.toggle('moving', on);
apply();

// 한 번 재생할 동작 (같은 동작을 연달아 눌러도 처음부터 다시)
let playT = 0;
function play(cls, ms) {
  if (!on) return;
  const s = $('stage'); if (!s) return;
  s.classList.remove('flinch-l', 'flinch-r', 'jolt', 'talk');
  void s.offsetWidth; // 다시 시작하게
  s.classList.add(cls);
  clearTimeout(playT); playT = setTimeout(() => s.classList.remove(cls), ms);
}
// 건드리면 움찔: 누른 쪽 반대로 살짝 피한다. 짧은 시간에 여러 번 건드리면 크게 움찔
let taps = [];
$('tapHit').addEventListener('pointerdown', e => {
  const now = Date.now(); taps = taps.filter(t => now - t < 3000); taps.push(now);
  if (taps.length >= 4) play('jolt', 520);
  else play(e.clientX > innerWidth / 2 ? 'flinch-l' : 'flinch-r', 480);
});
// 말을 시작할 때 살짝 들썩 (말풍선 대사만)
const baseType = typeInto;
typeInto = function (el, text, id) {
  if (id === 'bub' && text && !$('stage').classList.contains('jolt') && !/flinch/.test($('stage').className)) play('talk', 400);
  return baseType.apply(this, arguments);
};

// 설정 화면에 더하기
const baseSet = SHEETS.set.render;
SHEETS.set.render = function () {
  baseSet();
  const b = body(), reset = b.querySelector('.reset-all') || b.lastElementChild;
  const f = el('div', 'field', '<b>캐릭터 움직임</b>');
  const box = el('input'); box.type = 'checkbox'; box.id = 'motionOn'; box.checked = on;
  const lab = el('label', 'sw', '숨쉬듯 움직이고, 건드리면 움찔하기'); lab.prepend(box);
  box.onchange = () => { on = box.checked; try { localStorage.setItem(MKEY, on ? '1' : '0'); } catch (e) {} apply(); };
  f.append(lab, el('p', 'hint', '어지럽거나 배터리를 아끼고 싶으면 꺼 두세요.'));
  b.insertBefore(f, reset);
};
})();
