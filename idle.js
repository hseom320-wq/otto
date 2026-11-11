// 한울아파트 — 혼잣말
// 비서 화면을 한동안 그냥 켜 두면 비서가 혼잣말이나 말을 건다 (횟수 제한 없음). 화면을 만지면 다시 기다린다.
// 말풍선에만 나오고 대화 기록에는 남기지 않는다. app.js 등 다른 파일 뒤에 불러온다.
'use strict';
(() => {
const FIRST = 60e3;          // 처음 말 걸기까지 (1분)
const GAP = [100e3, 200e3];  // 그다음부터 간격 (1분 40초~3분 20초)
const LINES = {
  ns: {
    any: ['…심심하네.', '야, 자냐?', '그니까, 폰만 보고 있지 말고.', '아, 갑자기 라면 땡긴다.', '…아까 그거 생각하니까 또 웃기네.', '너 지금 딴생각하지.', '이 시간에 게임 한 판 하면 딱인데.', '…뭐. 그냥 불러 봤다.'],
    morning: ['아침은 먹었냐. 굶지 마.', '졸리면 세수라도 해.'],
    day: ['점심 뭐 먹었냐.', '오후엔 집중 안 되지. 나도.'],
    evening: ['저녁 뭐 먹을 건데.', '오늘 하루 금방 갔네.'],
    night: ['…야, 늦었다. 자.', '밤새지 마. 내일 후회한다.'],
    todo: '할 거 {n}개 남은 거 안 잊었지?',
    dday: '{subject} D-{n}이다. 그니까, 조금이라도 해.',
    song: '이 노래, 나쁘지 않네.',
  },
  ys: {
    any: ['…으음. 원고… 안 써진다아.', '저기… 아직 있어어?', '방금… 좋은 장면 떠올랐어어.', '배… 고프다아.', '…이렇게 같이 있는 것도… 좋다아.', '컵라면… 하나 더 먹을까아.', '…졸려어.', '이거 럽코였으면… 지금 고백 타이밍인데에.'],
    morning: ['아침… 벌써어? 나 아직 안 잤는데에.', '햇빛… 너무 밝아아.'],
    day: ['낮에는… 집중이 안 돼애.', '택배… 언제 오지이.'],
    evening: ['저녁… 같이 먹을래애?', '노을… 배경으로 쓰고 싶다아.'],
    night: ['밤이 제일… 잘 써져어.', '…자야 하는데에.'],
    todo: '할 거… {n}개 남았어어. 나도 같이 할게에.',
    dday: '{subject}… D-{n}이래애. 조금만 하자아.',
    song: '이 노래… 작업할 때 좋다아.',
  },
  hr: {
    any: ['{user} 씨~ 물 마셨어~?', '어깨 좀 펴~ 구부정하다~', '오늘 반찬 뭐 할까~', '…조용하네~ 좋다~', '쉬엄쉬엄 해~ 몸이 먼저야~', '간식 갖다줄까~?', '{user} 씨는 요즘 뭐가 제일 재밌어~?', '나도 옛날엔 시험 공부 많이 했는데~'],
    morning: ['아침 꼭 먹어야 돼~', '오늘 날씨 어떨까~'],
    day: ['점심은 먹었지~?', '낮잠 잠깐 자도 돼~'],
    evening: ['저녁 먹고 하자~ 배고프면 집중 안 돼~', '오늘 고생 많았지~'],
    night: ['너무 늦게 자면 안 돼~', '따뜻한 우유 한 잔 할래~?'],
    todo: '{user} 씨~ 할 거 {n}개 남았어~ 하나만 더 하자~',
    dday: '{subject} 시험 D-{n}이야~ 밥 잘 챙겨 먹고 하자~',
    song: '어머, 이 노래 좋다~',
  },
  sy: {
    any: ['…잠깐 눈 좀 감을게.', '물 한 잔 마셔. 집중력 떨어졌어.', '우선순위 하나만 다시 보자.', '…오늘 메일 몇 개 왔더라.', '스트레칭 한 번 해.', '…쉬어도 돼. 진짜로.', '나도 회사 생각하기 싫다아…', '좋아. 지금 페이스 괜찮아.'],
    morning: ['출근 전에 커피…', '아침엔 머리 맑을 때 어려운 거부터.'],
    day: ['오후 세 시가 제일 졸려.', '점심 먹고 15분만 걷자.'],
    evening: ['정시 퇴근… 하고 싶다아.', '오늘 한 거 정리하고 끝내자.'],
    night: ['이 시간까지 하는 거 아니야. 자.', '…나 오늘 방전이야아.'],
    todo: '남은 거 {n}개. 제일 작은 것부터.',
    dday: '{subject} D-{n}. 오늘 분량만 하면 충분해.',
    song: '…이 노래 좋다. 집중용으로 딱이네.',
  },
  tr: {
    any: ['…심심하다.', '야. 졸지 마.', '담배… 아니, 안 핀다. 끊는 중이다.', '오토바이 기름 넣어야 되는데.', '뭘 봐.', '…밥은 먹었냐.', '장부 정리나 해야겠다.', '조용하니까 이상하네.'],
    morning: ['아침부터 졸고 있냐.', '일어났으면 물부터 마셔.'],
    day: ['낮에 할 거 미루면 밤에 고생한다.', '국밥 땡기네.'],
    evening: ['저녁 먹었냐. 안 먹었으면 나와.', '해 졌다. 오늘 거 끝내.'],
    night: ['야, 늦었다. 자라. 명령이다.', '…이 시간엔 좀 조용하네.'],
    todo: '남은 거 {n}개. 장부 보고 있다.',
    dday: '{subject} D-{n}. 망치면 알지?',
    song: '노래 취향 봐라. …괜찮네.',
  },
};
let last = Date.now(), n = 0, nextAt = 0, prev = '';
const touch = () => { last = Date.now(); n = 0; nextAt = 0; };
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(e => addEventListener(e, touch, { passive: true, capture: true }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) touch(); });

// 지금 말 걸어도 되는 상황인지 (다른 창이 열려 있거나 공부 타이머 중이면 조용히)
function quiet() {
  if (document.hidden || !C || !$('home').classList.contains('on')) return true;
  if (sheetOpen || $('reward').classList.contains('on') || !$('focus').hidden || !$('call').hidden) return true;
  const pv = $('planView'); if (pv && !pv.hidden) return true;
  return false;
}
function lineFor(c) {
  const L = LINES[c.code]; if (!L) return '';
  const pool = [...L.any, ...(L[slot()] || [])];
  // 가끔은 지금 상황(남은 할 일·시험·노래)에 맞춰 말한다
  const extra = [];
  const left = S.todos.filter(t => !t.done).length;
  if (left && L.todo) extra.push(L.todo.replace('{n}', left));
  const ex = window.nextExamInfo && nextExamInfo();
  if (ex && ex.n > 0 && ex.n <= 30 && L.dday) extra.push(L.dday.replace('{subject}', ex.subject).replace('{n}', ex.n));
  if (window.musicNow && musicNow() && L.song) extra.push(L.song);
  const list = extra.length && Math.random() < .35 ? extra : pool;
  let t = pick(list); for (let i = 0; i < 4 && t === prev && list.length > 1; i++) t = pick(list);
  prev = t;
  return fill(t);
}
setInterval(() => {
  if (quiet()) return;
  const now = Date.now();
  if (!nextAt) nextAt = last + FIRST;
  if (now < nextAt) return;
  const t = lineFor(C); if (!t) return;
  setBubble(t, true);
  if (window.popSticker && Math.random() < .3) popSticker(pick(['sleepy', 'confused', 'happy']));
  n++; nextAt = now + GAP[0] + Math.random() * (GAP[1] - GAP[0]);
}, 5000);
})();
