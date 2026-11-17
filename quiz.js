// 한울아파트 — 수현 쪽지 시험 · 시험 기간 모드 설정
// 쪽지 시험: 교과서·필기 사진(여러 장)이나 글을 넣으면 Gemini가 그 내용만으로 4지선다 문제를 만든다.
//   수현이 한 문제씩 내고, 맞히면 칭찬·틀리면 놀리면서 해설을 보여 준다.
//   틀린 문제는 오답 목록(S.wrong)에 쌓이고, 1일·3일·7일 뒤에 다시 나온다(세 번 연달아 맞히면 빠진다).
//   푼 시간은 그 과목 공부 시간에 더한다.
// 시험 기간 모드: 설정에서 켜고 끄고, 끝나는 날을 정한다(app.js 의 examAuto 가 매일 수현으로 바로 들어가게 한다).
'use strict';
(() => {
if (!Array.isArray(S.wrong)) S.wrong = [];
const SAY = {
  start: ['쪽지 시험이다. 틀리면 놀린다.', '자, 낸다. 집중해.', '그니까, 아는 것만 골라. 찍지 말고.'],
  making: ['…문제 만드는 중. 기다려.', '잠깐. 어려운 걸로 골라 볼게.'],
  ok: ['오, 맞았네.', '그니까, 알잖아.', '정답. 계속 가.', '…쉬웠냐?', '오케이. 다음.'],
  no: ['땡. 이거 아까 본 거잖아.', '틀렸다. 해설 봐.', '야, 이건 외워.', '…다시 보자. 이거 시험에 나온다.', '아깝네. 근데 틀린 건 틀린 거다.'],
  r90: '…다 맞을 뻔했네. 오늘은 인정.',
  r70: '나쁘지 않아. 틀린 건 내일 또 낸다.',
  r40: '반타작이네. 틀린 거 다시 풀어.',
  r0: '야. 처음부터 다시 보자. 나도 옆에 있을게.',
  review: ['오답이다. 이번엔 맞혀.', '저번에 틀린 거. 기억나지?'],
  none: '오늘 다시 볼 오답은 없어. …잘했네.',
};
const pickS = k => (Array.isArray(SAY[k]) ? pick(SAY[k]) : SAY[k]);
const dayK = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return dayK(d); };
const dueWrong = () => S.wrong.filter(w => !w.due || w.due <= dayK());

// ---------- 화면 ----------
const v = document.createElement('section');
v.id = 'quiz'; v.className = 'qzv'; v.hidden = true;
v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', '쪽지 시험');
v.innerHTML = `
  <div class="qz-top"><button class="qz-x">‹ 나가기</button><b>수현 쪽지 시험</b><span class="qz-prog"></span></div>
  <div class="qz-who"><img alt="" src="assets/ns/scene/night.webp"><p class="qz-say"></p></div>
  <div class="qz-body"></div>`;
document.getElementById('app').appendChild(v);
const q = s => v.querySelector(s);
const bodyQ = q('.qz-body');
function say(t) { const p = q('.qz-say'); p.textContent = ''; if (window.typeInto) typeInto(p, t, 'quiz'); else p.textContent = t; }
q('.qz-x').onclick = () => { if (run && run.i < run.items.length && run.i > 0 && !confirm('그만할까요? 지금까지 푼 건 기록돼요.')) return; finishRun(true); close(); };
function open() { if (window.closeSheet && typeof sheetOpen !== 'undefined' && sheetOpen) closeSheet(); v.hidden = false; setup(); }
function close() { v.hidden = true; run = null; q('.qz-prog').textContent = ''; }

// ---------- 1. 준비 ----------
let pics = [], subj = '';
function subjects() {
  const set = new Set((window.finalSubjects && finalSubjects()) || []);
  Object.values((S.tt && S.tt.cells) || {}).forEach(x => { if (x && !/창체|스포츠|음악|미술|자율|동아리/.test(x)) set.add(x); });
  return [...set].slice(0, 12);
}
function setup() {
  run = null; q('.qz-prog').textContent = '';
  const subs = subjects(); if (!subj) subj = subs[0] || '';
  const due = dueWrong().length;
  bodyQ.innerHTML = `
    <p class="qz-h">과목</p>
    <div class="qz-chips">${subs.map(x => `<button data-s="${esc(x)}"${x === subj ? ' class="on"' : ''}>${esc(x)}</button>`).join('')}<input class="in qz-sub" placeholder="직접 쓰기" value="${subs.includes(subj) ? '' : esc(subj)}" aria-label="과목 직접 쓰기"></div>
    ${window.examRange && examRange(subj) ? `<p class="qz-range">시험 범위: ${esc(examRange(subj))}</p>` : ''}
    <p class="qz-h">무엇으로 낼까요</p>
    <div class="qz-pics">${pics.map((p, i) => `<span><img src="${p.url}" alt=""><button data-del="${i}" aria-label="사진 빼기">×</button></span>`).join('')}<label class="qz-add">＋ 사진<input type="file" accept="image/*" multiple hidden></label></div>
    <textarea class="in qz-text" rows="4" placeholder="또는 필기·교과서 내용을 붙여 넣기 (사진과 같이 써도 돼요)"></textarea>
    <p class="qz-h">문제 수</p>
    <div class="qz-chips qz-n">${[5, 10, 15].map(n => `<button data-n="${n}"${n === (S.quizN || 10) ? ' class="on"' : ''}>${n}문제</button>`).join('')}</div>
    <button class="btn wide qz-go">문제 만들기</button>
    ${S.wrong.length ? `<button class="btn ghost wide qz-rev">오답 다시 풀기 (오늘 ${due}개 · 전체 ${S.wrong.length}개)</button>` : ''}
    ${hasAI() ? '' : '<p class="hint">문제를 만들려면 설정에 Gemini 키가 있어야 해요. 오답 다시 풀기는 키 없이도 돼요.</p>'}`;
  say(pickS('start'));
  bodyQ.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { subj = b.dataset.s; keepText(); setup(); });
  bodyQ.querySelector('.qz-sub').oninput = e => { subj = e.target.value.trim(); bodyQ.querySelectorAll('[data-s]').forEach(x => x.classList.remove('on')); };
  bodyQ.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { S.quizN = +b.dataset.n; save(); bodyQ.querySelectorAll('[data-n]').forEach(x => x.classList.toggle('on', x === b)); });
  bodyQ.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { URL.revokeObjectURL(pics[+b.dataset.del].url); pics.splice(+b.dataset.del, 1); keepText(); setup(); });
  const fi = bodyQ.querySelector('.qz-add input');
  fi.onchange = async () => { keepText(); for (const f of fi.files) { if (pics.length >= 6) { toast('사진은 6장까지'); break; } pics.push({ file: f, url: URL.createObjectURL(f) }); } setup(); };
  const ta = bodyQ.querySelector('.qz-text'); ta.value = draft;
  bodyQ.querySelector('.qz-go').onclick = make;
  const rv = bodyQ.querySelector('.qz-rev'); if (rv) rv.onclick = review;
}
let draft = '';
const keepText = () => { const t = bodyQ.querySelector('.qz-text'); if (t) draft = t.value; };

// 사진을 줄여서 보낸다 (긴 변 1600px JPEG)
async function shrink(file) {
  const bm = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bm.width, bm.height));
  const c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
  c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .85).split(',')[1];
}
const SCHEMA = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { type: 'object', properties: {
      q: { type: 'string' }, choices: { type: 'array', items: { type: 'string' } }, answer: { type: 'integer' }, explain: { type: 'string' },
    }, required: ['q', 'choices', 'answer', 'explain'] } },
  },
  required: ['items'],
};
async function make() {
  keepText();
  const text = draft.trim(), n = S.quizN || 10;
  if (!subj) { toast('과목을 골라 주세요'); return; }
  if (!pics.length && text.length < 30) { toast('사진을 넣거나 내용을 조금 더 붙여 넣어 주세요'); return; }
  if (!hasAI()) { toast('설정에 Gemini 키를 넣어 주세요'); return; }
  bodyQ.innerHTML = '<div class="qz-wait"><i></i><p>수현이 문제 만드는 중…</p></div>'; say(pickS('making'));
  try {
    const content = [];
    for (const p of pics) content.push({ type: 'image', source: { media_type: 'image/jpeg', data: await shrink(p.file) } });
    const rg = window.examRange ? examRange(subj) : '';
    const bk = window.examBook ? examBook(subj) : '';
    content.push({ type: 'text', text: `과목: ${subj}\n문제 수: ${n}${bk ? `\n교과서: ${bk}` : ''}${rg ? `\n학교 시험 범위: ${rg} (자료가 이 범위 밖이면 그 부분은 빼고 낸다)` : ''}\n${text ? `\n[붙여 넣은 내용]\n${text}` : ''}` });
    const j = await askJSON({
      system: `너는 한국 고등학교 내신 시험 출제 도우미다. 사용자가 준 자료(사진·글)에 있는 내용만으로 ${subj} 4지선다 문제 ${n}개를 만든다.
- 자료에 없는 사실은 쓰지 않는다. 자료가 흐리거나 부족하면 확실한 부분만으로 만든다(문제 수가 모자라도 된다).
- 개념 확인, 용어 뜻, 자료 해석, 적용 문제를 섞고, 실제 내신처럼 헷갈리는 오답 보기를 만든다.
- choices는 정확히 4개, answer는 정답의 번호(0~3). 정답 위치는 고르게 섞는다.
- explain은 왜 정답인지 1~2문장, 자료 근거로. 모두 한국어.`,
      messages: [{ role: 'user', content }], schema: SCHEMA, maxTokens: 8192,
    });
    const items = (j.items || []).filter(x => x && x.q && Array.isArray(x.choices) && x.choices.length === 4 && x.answer >= 0 && x.answer < 4)
      .map(x => ({ id: uid(), subject: subj, q: x.q, choices: x.choices, answer: x.answer, explain: x.explain || '' }));
    if (!items.length) throw new Error('자료에서 문제를 만들지 못했어요. 더 또렷한 사진이나 내용을 넣어 주세요.');
    start(items, false);
  } catch (e) { toast(e.message || '문제를 만들지 못했어요'); setup(); }
}

// ---------- 2. 풀기 ----------
let run = null; // {items, i, ok, review, at, subject}
function start(items, isReview) {
  run = { items, i: 0, ok: 0, review: isReview, at: Date.now(), done: false };
  if (isReview) say(pickS('review'));
  show();
}
function review() {
  const list = dueWrong();
  if (!list.length) { say(pickS('none')); return; }
  start(list.slice(0, 15).map(w => ({ ...w })), true);
}
function show() {
  const it = run.items[run.i];
  q('.qz-prog').textContent = `${run.i + 1}/${run.items.length}`;
  bodyQ.innerHTML = `<div class="qz-card"><small>${esc(it.subject)}${run.review ? ' · 오답' : ''}</small><p class="qz-q">${esc(it.q)}</p>
    <div class="qz-ch">${it.choices.map((c, k) => `<button data-k="${k}"><b>${'①②③④'[k]}</b><span>${esc(c)}</span></button>`).join('')}</div>
    <div class="qz-ex" hidden></div></div>`;
  bodyQ.scrollTop = 0;
  bodyQ.querySelectorAll('[data-k]').forEach(b => b.onclick = () => answer(+b.dataset.k));
}
function answer(k) {
  const it = run.items[run.i], ok = k === it.answer;
  bodyQ.querySelectorAll('[data-k]').forEach(b => { b.disabled = true; const n = +b.dataset.k; if (n === it.answer) b.classList.add('right'); else if (n === k) b.classList.add('wrong'); });
  if (ok) run.ok++;
  say(pickS(ok ? 'ok' : 'no'));
  if (window.popSticker && Math.random() < .5) popSticker(ok ? 'happy' : 'angry');
  // 오답 목록
  const old = S.wrong.find(w => w.id === it.id || w.q === it.q);
  if (!ok) {
    if (old) { old.streak = 0; old.due = addDays(1); }
    else S.wrong.push({ id: it.id, subject: it.subject, q: it.q, choices: it.choices, answer: it.answer, explain: it.explain, at: Date.now(), streak: 0, due: addDays(1) });
    if (S.wrong.length > 300) S.wrong = S.wrong.slice(-300);
  } else if (old && run.review) {
    old.streak = (old.streak || 0) + 1;
    if (old.streak >= 3) S.wrong = S.wrong.filter(w => w !== old);
    else old.due = addDays([1, 3, 7][old.streak]);
  }
  save();
  const ex = bodyQ.querySelector('.qz-ex');
  ex.innerHTML = `<p><b>${ok ? '정답' : `정답은 ${'①②③④'[it.answer]}`}</b> ${esc(it.explain)}</p><button class="btn wide qz-next">${run.i + 1 < run.items.length ? '다음 문제' : '결과 보기'}</button>`;
  ex.hidden = false;
  ex.querySelector('.qz-next').onclick = () => { run.i++; if (run.i < run.items.length) show(); else result(); };
  setTimeout(() => ex.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
}
function finishRun(partial) {
  if (!run || run.done) return;
  run.done = true;
  // 푼 시간을 공부 시간에 더한다 (과목별)
  const mins = Math.round((Date.now() - run.at) / 60e3);
  if (mins >= 1 && window.addStudy && (run.i > 0 || !partial)) {
    const sub = run.items[0] && run.items[0].subject;
    addStudy(run.review ? (sub || '자습') : sub, mins);
  }
}
function result() {
  finishRun(false);
  const n = run.items.length, pct = Math.round(run.ok / n * 100);
  q('.qz-prog').textContent = '';
  say(pct >= 90 ? SAY.r90 : pct >= 70 ? SAY.r70 : pct >= 40 ? SAY.r40 : SAY.r0);
  const wrongNow = run.items.filter(it => S.wrong.some(w => w.id === it.id || w.q === it.q));
  bodyQ.innerHTML = `<div class="qz-res"><b>${run.ok} / ${n}</b><small>${pct}점</small></div>
    ${wrongNow.length ? `<button class="btn wide qz-again">틀린 ${wrongNow.length}문제 바로 다시 풀기</button>` : ''}
    <button class="btn ghost wide qz-more">새 문제 만들기</button>
    <button class="btn ghost wide qz-done">닫기</button>
    <p class="hint">틀린 문제는 오답 목록에 넣어 뒀어요. 내일부터 1일·3일·7일 뒤에 다시 나오고, 세 번 연달아 맞히면 빠져요.</p>`;
  const ag = bodyQ.querySelector('.qz-again'); if (ag) ag.onclick = () => start(wrongNow.map(w => ({ ...w })), true);
  bodyQ.querySelector('.qz-more').onclick = setup;
  bodyQ.querySelector('.qz-done').onclick = close;
}

// ---------- 들어가는 곳 ----------
window.quizOpen = open;
window.quizButton = () => {
  const b = el('button', 'btn ghost wide qz-open');
  const due = dueWrong().length;
  b.textContent = `수현 쪽지 시험${due ? ` · 오늘 오답 ${due}개` : ''}`;
  b.onclick = open;
  return b;
};

// ---------- 설정: 시험 기간 모드 ----------
const baseSet = SHEETS.set.render;
SHEETS.set.render = function () {
  baseSet();
  const b = body(), first = b.firstElementChild;
  const f = el('div', 'field', '<b>시험 기간 모드</b>');
  const on = el('input'); on.type = 'checkbox'; on.checked = !!S.examMode.on;
  const lab = el('label', 'sw', '시험 기간에는 엘리베이터 없이 바로 남수현'); lab.prepend(on);
  const until = el('input', 'in tm-in'); until.type = 'date'; until.value = S.examMode.until || examUntil(); until.setAttribute('aria-label', '시험 기간 끝나는 날');
  const row = el('div', 'row'); row.append(lab, until);
  on.onchange = () => { S.examMode.on = on.checked; save(); toast(on.checked ? `${until.value}까지 매일 수현으로 바로 들어가요` : '다시 매일 비서를 골라요 (내일부터)'); };
  until.onchange = () => { if (until.value) { S.examMode.until = until.value; save(); } };
  f.append(row, el('p', 'hint', '켜 두면 끝나는 날까지 매일 엘리베이터를 건너뛰고 수현 방으로 바로 들어가요. 기말 계획의 마지막 날이 기본이에요.'));
  b.insertBefore(f, first);
};
})();
