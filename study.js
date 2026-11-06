// 한울아파트 — 고등학생 내신 공부
// 시간표 · 시험(D-day) · 공부 계획 자동 배치(시험 3주 전부터 회독 단계, 평일 2과목·주말 3과목, 50분 블록)
// · 공부 타이머(비서가 옆에서 응원) · 노트 정리(필기·교과서 사진/PDF를 Claude가 단원별로 정리, 퀴즈)
// app.js·features.js 뒤에 불러온다.
'use strict';
(() => {
const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const calToday = () => dk(new Date());
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const addMin = (t, m) => { const [h, mm] = t.split(':').map(Number), x = h * 60 + mm + m; return `${pad(Math.floor(x / 60) % 24)}:${pad(x % 60)}`; };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fillT = (t, o = {}) => fill(String(t || '')).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
const dayLabel = day => { const d = new Date(day + 'T12:00'); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일`; };
const homeOn = () => $('home').classList.contains('on') && C;

// ---------- 저장 ----------
const DEF_PERIODS = ['08:40', '09:40', '10:40', '11:40', '13:30', '14:30', '15:30'];
if (!S.tt) S.tt = { periods: DEF_PERIODS.slice(), cells: {} };      // cells['요일(1~5)-교시'] = 과목
if (!S.exams) S.exams = [];                                           // [{id, subject, date, range}]
if (!S.study) S.study = { wStart: '19:00', eStart: '10:00', wdN: 2, weN: 3, len: 50 };
if (!S.sdone) S.sdone = {};                                           // '날짜|과목|순서' -> 분
if (!S.slog) S.slog = {};                                             // 날짜 -> 공부한 분
if (!S.notes) S.notes = [];                                           // [{id, subject, unit, title, summary, points, quiz, at}]

// ---------- 공부 계획 (시험 3주 전부터) ----------
// 남은 날로 회독 단계를 정한다: 15일 이상 개념, 8~14일 문제, 2~7일 오답·기출, 1일 백지 복습
function phaseOf(d) { return d >= 15 ? '1회독, 개념 정리' : d >= 8 ? '2회독, 문제 풀이' : d >= 2 ? '3회독, 오답·기출' : '최종, 백지 복습'; }
function studyBlocks(day) {
  const up = S.exams.filter(e => e.date > day && daysBetween(day, e.date) <= 21).sort((a, b) => a.date.localeCompare(b.date));
  if (!up.length) return [];
  const wd = new Date(day + 'T12:00').getDay(), weekend = wd === 0 || wd === 6;
  let n = weekend ? S.study.weN : S.study.wdN;
  if (up.some(e => daysBetween(day, e.date) <= 7)) n = Math.min(4, n + 1); // 1주 전부터 한 칸 더
  // 급한 순서로 과목을 고르고, 시험이 적으면 가장 급한 과목을 한 번 더
  const subs = []; let i = 0;
  while (subs.length < n && i < n * 3) { const e = up[i % up.length]; subs.push(e); i++; }
  // 시간: 매주 일정(학원 등)과 겹치는 자리는 건너뛴다
  const busy = S.reps.filter(r => r.days.includes(wd)).map(r => [toMin(r.time), toMin(r.time) + 60]);
  let t = toMin(weekend ? S.study.eStart : S.study.wStart);
  const out = [];
  subs.forEach((e, k) => {
    while (busy.some(([a, b]) => t < b && t + S.study.len > a)) t += 30;
    if (t + S.study.len > 24 * 60) return;
    const d = daysBetween(day, e.date), time = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
    const key = `${day}|${e.subject}|${k}`;
    out.push({ kind: 'study', id: key, time, text: `${e.subject} ${phaseOf(d)}`, subject: e.subject, range: e.range, dleft: d, done: !!S.sdone[key] });
    t += Math.round(S.study.len) + 10;
  });
  return out;
}
window.extraItems = day => studyBlocks(day);
const nextExam = () => S.exams.filter(e => e.date >= calToday()).sort((a, b) => a.date.localeCompare(b.date))[0];
window.addExam = function (subject, date, range) {
  if (S.exams.some(e => e.subject === subject && e.date === date)) return;
  S.exams.push({ id: uid(), subject, date, range: range || '' }); save();
  toast(`시험 추가: ${subject} ${date.slice(5).replace('-', '/')}`);
};

// ---------- 오늘 시간표 (학교) ----------
function classesOn(day) {
  const wd = new Date(day + 'T12:00').getDay(); if (wd < 1 || wd > 5) return [];
  return S.tt.periods.map((p, i) => ({ p: i + 1, time: p, sub: S.tt.cells[`${wd}-${i + 1}`] || '' })).filter(x => x.sub);
}

// ---------- 공부 탭 ----------
let tab = 'plan', ttSel = null, noteOpen = null;
SHEETS.study = {
  title: () => '공부',
  sub: () => { const m = S.slog[calToday()] || 0, e = nextExam(); return `오늘 ${m >= 60 ? `${Math.floor(m / 60)}시간 ` : ''}${m % 60}분${e ? `, ${e.subject} D-${daysBetween(calToday(), e.date) || 'day'}` : ''}`; },
  tall: true,
  render() {
    const b = body(); b.innerHTML = ''; foot().innerHTML = ''; foot().dataset.day = '';
    const seg = el('div', 'seg');
    [['plan', '오늘 계획'], ['exam', '시험'], ['tt', '시간표'], ['note', '노트']].forEach(([k, n]) => {
      const x = el('button', null, n); x.setAttribute('aria-pressed', String(tab === k));
      x.onclick = () => { tab = k; noteOpen = null; ttSel = null; SHEETS.study.render(); }; seg.appendChild(x);
    });
    b.appendChild(seg);
    ({ plan: renderPlan, exam: renderExams, tt: renderTT, note: renderNotes })[tab](b);
  },
};
function renderPlan(b) {
  const day = calToday(), up = S.exams.filter(e => e.date >= day).sort((a, x) => a.date.localeCompare(x.date));
  if (up.length) {
    const chips = el('div', 'dchips');
    up.slice(0, 5).forEach(e => { const d = daysBetween(day, e.date); chips.appendChild(el('span', 'dchip' + (d <= 7 ? ' near' : ''), `<b>D-${d || 'day'}</b>${esc(e.subject)}`)); });
    b.appendChild(chips);
  }
  const cls = classesOn(day);
  if (cls.length) b.appendChild(el('p', 'hint top', `오늘 수업: ${cls.map(c => `${c.p}교시 ${esc(c.sub)}`).join(', ')}`));
  b.appendChild(el('h3', 'day-h', `${dayLabel(day)} 공부`));
  const blocks = studyBlocks(day);
  if (!blocks.length) b.appendChild(el('div', 'empty', up.length ? '오늘은 계획이 없어요. 시험 3주 전부터 자동으로 짜 줘요.' : '시험 탭에 시험 날짜를 넣으면, 3주 전부터 매일 공부 계획을 짜 줘요.'));
  blocks.forEach(x => {
    const r = el('div', 'item' + (x.done ? ' done' : ''));
    r.innerHTML = `<span class="ck">${x.done ? '✓' : ''}</span><span class="tm">${x.time}</span><span class="tx">${esc(x.text)}${x.range ? `<small>범위: ${esc(x.range)}</small>` : ''}</span>`;
    r.querySelector('.ck').setAttribute('role', 'button'); r.querySelector('.ck').setAttribute('aria-label', x.done ? '안 한 걸로' : '끝냈어요');
    r.querySelector('.ck').onclick = () => { if (S.sdone[x.id]) delete S.sdone[x.id]; else S.sdone[x.id] = S.study.len; save(); refresh(); renderHome(); };
    if (!x.done) { const go = el('button', 'btn sm', '시작'); go.onclick = () => startFocus(x); r.appendChild(go); }
    b.appendChild(r);
  });
  // 자유 타이머 + 설정
  const free = el('button', 'btn ghost wide', '계획 없이 50분 공부하기'); free.onclick = () => startFocus({ id: null, subject: '자습', text: '자습', range: '' });
  b.appendChild(free);
  const f = foot();
  const r1 = el('div', 'row set-row'), w = el('input', 'in tm-in'), e = el('input', 'in tm-in');
  w.type = 'time'; w.value = S.study.wStart; w.id = 'stW'; e.type = 'time'; e.value = S.study.eStart; e.id = 'stE';
  w.onchange = () => { if (w.value) { S.study.wStart = w.value; save(); refresh(); } };
  e.onchange = () => { if (e.value) { S.study.eStart = e.value; save(); refresh(); } };
  r1.append(el('span', 'lab', '평일 시작'), w, el('span', 'lab', '주말'), e);
  f.append(r1, el('p', 'hint', '매주 일정(학원 등)과 겹치는 시간은 피해서 50분씩 넣어요. 끝낸 계획은 일정에도 표시돼요.'));
}
function renderExams(b) {
  const day = calToday(), list = [...S.exams].sort((a, x) => a.date.localeCompare(x.date));
  if (!list.length) b.appendChild(el('div', 'empty', '시험 날짜를 넣으면 D-day를 세고, 3주 전부터 공부 계획을 짜 줘요. 대화에서 "수학 시험 12월 2일"이라고 말해도 돼요.'));
  list.forEach(x => {
    const d = daysBetween(day, x.date), past = d < 0;
    const r = el('div', 'item' + (past ? ' done' : ''));
    r.innerHTML = `<span class="tm dd">${past ? '끝' : `D-${d || 'day'}`}</span><span class="tx">${esc(x.subject)}<small>${x.date.slice(5).replace('-', '/')}(${WD[new Date(x.date + 'T12:00').getDay()]})${x.range ? `, ${esc(x.range)}` : ''}</small></span>`;
    const del = el('button', 'del', '✕'); del.setAttribute('aria-label', '지우기');
    del.onclick = () => { S.exams = S.exams.filter(y => y.id !== x.id); save(); refresh(); };
    r.appendChild(del); b.appendChild(r);
  });
  const f = foot(), row = el('div', 'row'), s = el('input', 'in'), dt = el('input', 'in dt-in'), rg = el('input', 'in'), add = el('button', 'btn', '넣기');
  s.placeholder = '과목'; s.id = 'exSub'; s.setAttribute('list', 'subList'); dt.type = 'date'; dt.id = 'exDate'; dt.min = day;
  rg.placeholder = '시험 범위 (예: 1단원~3단원, 교과서 12~58쪽)'; rg.id = 'exRange';
  const dl = el('datalist'); dl.id = 'subList'; [...new Set(Object.values(S.tt.cells))].forEach(v => { const o = el('option'); o.value = v; dl.appendChild(o); });
  add.onclick = () => { if (!s.value.trim() || !dt.value) return; addExam(s.value.trim(), dt.value, rg.value.trim()); refresh(); };
  row.append(s, dt); const row2 = el('div', 'row'); row2.append(rg, add);
  f.append(dl, row, row2);
}
function renderTT(b) {
  const g = el('div', 'tt');
  g.appendChild(el('span', 'th', ''));
  ['월', '화', '수', '목', '금'].forEach(d => g.appendChild(el('span', 'th', d)));
  S.tt.periods.forEach((p, i) => {
    g.appendChild(el('span', 'tp', `${i + 1}<small>${p}</small>`));
    for (let wd = 1; wd <= 5; wd++) {
      const k = `${wd}-${i + 1}`, v = S.tt.cells[k] || '';
      const c = el('button', 'tc' + (ttSel === k ? ' sel' : '') + (new Date().getDay() === wd ? ' today' : ''), esc(v));
      c.setAttribute('aria-label', `${'월화수목금'[wd - 1]}요일 ${i + 1}교시 ${v || '비어 있음'}`);
      c.onclick = () => { ttSel = k; SHEETS.study.render(); setTimeout(() => $('ttIn') && $('ttIn').focus(), 50); };
      g.appendChild(c);
    }
  });
  b.appendChild(g);
  b.appendChild(el('p', 'hint', '칸을 누르고 아래에 과목을 쓰면 돼요. 수업은 인사와 대화에 쓰이고, 과목 이름은 시험 넣을 때 고를 수 있어요.'));
  const f = foot();
  if (ttSel) {
    const [wd, p] = ttSel.split('-').map(Number);
    const row = el('div', 'row'), i = el('input', 'in'), save1 = el('button', 'btn', '저장');
    i.id = 'ttIn'; i.value = S.tt.cells[ttSel] || ''; i.placeholder = `${'월화수목금'[wd - 1]}요일 ${p}교시 과목`; i.enterKeyHint = 'done';
    const go = () => { const v = i.value.trim(); if (v) S.tt.cells[ttSel] = v; else delete S.tt.cells[ttSel]; save(); // 다음 칸으로
      const n = wd < 5 ? `${wd + 1}-${p}` : p < S.tt.periods.length ? `1-${p + 1}` : null; ttSel = n; SHEETS.study.render(); if (n) setTimeout(() => $('ttIn') && $('ttIn').focus(), 50); };
    save1.onclick = go; i.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) go(); };
    row.append(i, save1); f.appendChild(row);
  }
}

// ---------- 노트 정리 (Claude) ----------
const NOTE = {
  type: 'object', additionalProperties: false, required: ['subject', 'unit', 'title', 'summary', 'points', 'quiz'],
  properties: {
    subject: { type: 'string' }, unit: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' },
    points: { type: 'array', items: { type: 'string' } },
    quiz: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['q', 'a'], properties: { q: { type: 'string' }, a: { type: 'string' } } } },
  },
};
const readB64 = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(f); });
// 큰 사진은 줄여서 보낸다 (긴 변 1600px, JPEG)
async function shrink(f) {
  if (!f.type.startsWith('image/')) return { type: f.type, data: await readB64(f) };
  const bmp = await createImageBitmap(f), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return { type: 'image/jpeg', data: cv.toDataURL('image/jpeg', .86).split(',')[1] };
}
async function makeNote(files, subject, extra) {
  const content = [];
  for (const f of files) {
    const x = await shrink(f);
    if (x.type === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: x.data } });
    else content.push({ type: 'image', source: { type: 'base64', media_type: x.type, data: x.data } });
  }
  content.push({ type: 'text', text: `고등학생 내신 대비 노트를 만들어 줘. 과목: ${subject || '(자료를 보고 판단)'}.
위 필기·교과서·학습지를 읽고:
- subject: 과목, unit: 단원 이름, title: 이 노트 제목(짧게)
- summary: 핵심 개념 정리. 학생이 시험 직전에 보는 노트처럼 소제목과 줄 바꿈으로 구조를 잡고, 공식·정의·예시를 빠짐없이. 자료에 없는 내용은 지어내지 말 것.
- points: 시험에 잘 나오는 포인트 3~6개 (서술형·함정 포함)
- quiz: 백지 복습용 문제 5개와 정답 (단답·서술 섞어서)
${extra ? `학생이 덧붙인 말: ${extra}` : ''}` });
  return askJSON({ messages: [{ role: 'user', content }], schema: NOTE, effort: 'medium', maxTokens: 16000 });
}
function renderNotes(b) {
  if (noteOpen) return renderNote(b, S.notes.find(n => n.id === noteOpen));
  const subs = [...new Set(S.notes.map(n => n.subject))];
  if (!S.notes.length) b.appendChild(el('div', 'empty', '필기나 교과서, 학습지 사진(PDF도 돼요)을 올리면 Claude가 단원별 노트와 백지 복습 퀴즈로 정리해 줘요.'));
  subs.forEach(sub => {
    b.appendChild(el('h4', 'sub-h', esc(sub)));
    S.notes.filter(n => n.subject === sub).sort((a, x) => x.at - a.at).forEach(n => {
      const r = el('button', 'item note-row');
      r.innerHTML = `<span class="tx">${esc(n.title)}<small>${esc(n.unit)}, ${new Date(n.at).getMonth() + 1}/${new Date(n.at).getDate()}</small></span><span class="chev">›</span>`;
      r.onclick = () => { noteOpen = n.id; SHEETS.study.render(); }; b.appendChild(r);
    });
  });
  const f = foot(), row = el('div', 'row'), sub = el('input', 'in'), file = el('input'), pickB = el('button', 'btn ghost', '사진·PDF'), go = el('button', 'btn', '정리하기');
  sub.placeholder = '과목 (비우면 알아서)'; sub.id = 'ntSub'; sub.setAttribute('list', 'subList2');
  const dl = el('datalist'); dl.id = 'subList2'; [...new Set([...Object.values(S.tt.cells), ...S.exams.map(e => e.subject)])].forEach(v => { const o = el('option'); o.value = v; dl.appendChild(o); });
  file.type = 'file'; file.accept = 'image/*,application/pdf'; file.multiple = true; file.hidden = true; file.id = 'ntFile';
  const info = el('p', 'hint', '한 번에 최대 5장. 사진 원본은 저장하지 않고, 정리된 글만 이 기기에 남아요.');
  pickB.onclick = () => file.click();
  file.onchange = () => { const n = file.files.length; info.textContent = n ? `${n}개 골랐어요${n > 5 ? ' (앞의 5개만 써요)' : ''}` : '한 번에 최대 5장.'; };
  go.onclick = async () => {
    if (!hasAI()) { toast('설정에서 Claude 키를 넣어 주세요'); return; }
    const fs = [...file.files].slice(0, 5); if (!fs.length) { toast('사진이나 PDF를 먼저 골라 주세요'); return; }
    go.disabled = true; go.textContent = '정리하는 중…'; info.textContent = 'Claude가 읽고 있어요. 30초~1분쯤 걸려요.';
    try {
      const n = await makeNote(fs, sub.value.trim());
      S.notes.push({ id: uid(), ...n, at: Date.now() }); if (S.notes.length > 200) S.notes.shift(); save();
      toast(`노트를 만들었어요: ${n.title}`); noteOpen = S.notes[S.notes.length - 1].id; SHEETS.study.render();
      if (homeOn()) say(fillT(C.app.study_end || '끝.'), 'sparkle');
    } catch (e) { toast(e.message || '정리하지 못했어요'); go.disabled = false; go.textContent = '정리하기'; info.textContent = '다시 해 볼래요?'; }
  };
  row.append(sub, pickB, go); f.append(dl, file, row, info);
}
function renderNote(b, n) {
  if (!n) { noteOpen = null; return renderNotes(b); }
  const back = el('button', 'btn ghost back', '‹ 노트 목록'); back.onclick = () => { noteOpen = null; SHEETS.study.render(); };
  b.appendChild(back);
  b.appendChild(el('h3', 'note-h', `${esc(n.title)}<small>${esc(n.subject)}, ${esc(n.unit)}</small>`));
  b.appendChild(el('div', 'note-body', esc(n.summary)));
  if (n.points && n.points.length) { b.appendChild(el('h4', 'sub-h', '시험 포인트')); const ul = el('ul', 'pts'); n.points.forEach(p => ul.appendChild(el('li', null, esc(p)))); b.appendChild(ul); }
  if (n.quiz && n.quiz.length) {
    b.appendChild(el('h4', 'sub-h', '백지 복습 퀴즈 (눌러서 정답 보기)'));
    n.quiz.forEach((q, i) => { const d = el('details', 'quiz'); d.innerHTML = `<summary>${i + 1}. ${esc(q.q)}</summary><p>${esc(q.a)}</p>`; b.appendChild(d); });
  }
  const del = el('button', 'btn ghost wide', '이 노트 지우기');
  del.onclick = () => { if (del.dataset.sure) { S.notes = S.notes.filter(x => x.id !== n.id); save(); noteOpen = null; SHEETS.study.render(); } else { del.dataset.sure = '1'; del.textContent = '한 번 더 누르면 지워져요'; } };
  b.appendChild(del);
}

// ---------- 공부 타이머 ----------
let F = null, fT = 0, wake = null;
function startFocus(x) {
  closeSheet();
  const len = S.study.len * 60e3;
  F = { x, end: Date.now() + len, len, paused: 0, half: false };
  $('focusSub').textContent = x.subject; $('focusPhase').textContent = x.range ? `${x.text.replace(x.subject + ' ', '')}, ${x.range}` : x.text.replace(x.subject + ' ', '');
  $('focusWho').textContent = C.name;
  typeInto($('focusLine'), fillT(C.app.study_start, { subject: x.subject }), 'focus');
  $('focusPause').textContent = '잠깐 멈춤';
  $('focus').hidden = false; $('home').classList.add('focusing');
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => wake = w).catch(() => {}); } catch (e) {}
  clearInterval(fT); fT = setInterval(focusTick, 500); focusTick();
}
function focusTick() {
  if (!F) return;
  const left = F.paused ? F.paused : Math.max(0, F.end - Date.now());
  $('focusTime').textContent = `${pad(Math.floor(left / 60e3))}:${pad(Math.floor(left / 1e3) % 60)}`;
  $('focusBar').style.width = `${100 - left / F.len * 100}%`;
  if (!F.half && left <= F.len / 2) { F.half = true; typeInto($('focusLine'), fillT(C.app.study_half), 'focus'); }
  if (left <= 0 && !F.paused) finishFocus();
}
function finishFocus() {
  const x = F.x, mins = Math.round(F.len / 60e3); clearInterval(fT); F = null;
  if (x.id) S.sdone[x.id] = mins;
  const d = calToday(); S.slog[d] = (S.slog[d] || 0) + mins;
  const s = st(C.code); s.aff = Math.min(C.affection.range[1], s.aff + 1); save();
  ding(); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
  typeInto($('focusLine'), fillT(C.app.study_end), 'focus');
  $('focusTime').textContent = '00:00'; $('focusBar').style.width = '100%';
  $('focusPause').textContent = '닫기'; $('focusStop').hidden = true;
  if (window.popSticker) setTimeout(() => popSticker('sparkle'), 300);
}
function closeFocus() { clearInterval(fT); F = null; $('focus').hidden = true; $('focusStop').hidden = false; $('home').classList.remove('focusing'); try { wake && wake.release(); } catch (e) {} renderHome(); }
$('focusPause').onclick = () => {
  if (!F) { closeFocus(); return; }
  if (F.paused) { F.end = Date.now() + F.paused; F.paused = 0; $('focusPause').textContent = '잠깐 멈춤'; }
  else { F.paused = Math.max(0, F.end - Date.now()); $('focusPause').textContent = '계속하기'; }
  focusTick();
};
$('focusStop').onclick = () => {
  if (!F) return closeFocus();
  const done = Math.round((F.len - (F.paused || Math.max(0, F.end - Date.now()))) / 60e3);
  if (done > 0) { const d = calToday(); S.slog[d] = (S.slog[d] || 0) + done; save(); }
  closeFocus(); toast(done > 0 ? `${done}분 공부했어요` : '타이머를 껐어요');
};
document.addEventListener('visibilitychange', () => { if (!document.hidden && F) focusTick(); });

// ---------- 인사·대화·메인 화면에 붙이기 ----------
const baseGreet = window.greetExtra;
window.greetExtra = function (c) {
  const out = baseGreet ? baseGreet(c) : [];
  const e = nextExam(), d = e ? daysBetween(calToday(), e.date) : 99;
  if (e && d <= 7 && c.app.exam_soon) out.push(fillT(c.app.exam_soon, { subject: e.subject, n: d || 'day' }));
  return out;
};
window.studyPrompt = function () {
  const day = calToday(), cls = classesOn(day).map(c => `${c.p}교시(${c.time}) ${c.sub}`).join(', ') || '(없음)';
  const ex = S.exams.filter(e => e.date >= day).sort((a, b) => a.date.localeCompare(b.date)).map(e => `- ${e.subject} ${e.date} (D-${daysBetween(day, e.date)})${e.range ? ` 범위: ${e.range}` : ''}`).join('\n') || '(없음)';
  const pl = studyBlocks(day).map(x => `- ${x.time} ${x.text}${x.done ? ' (끝남)' : ''}`).join('\n') || '(없음)';
  const notes = S.notes.slice(-8).map(n => `- ${n.subject} ${n.unit}: ${n.title}`).join('\n') || '(없음)';
  return `[오늘 학교 수업] ${cls}\n[시험]\n${ex}\n[오늘 공부 계획]\n${pl}\n[오늘 공부한 시간] ${S.slog[day] || 0}분\n[정리한 노트]\n${notes}`;
};
const baseHome = window.renderHomeExtra;
window.renderHomeExtra = function () {
  baseHome && baseHome();
  const b = $('nextUp');
  if (b.hidden) { const e = nextExam(); if (e) { const d = daysBetween(calToday(), e.date); b.hidden = false; b.className = 'next-up'; b.innerHTML = `<b>D-${d || 'day'}</b> ${esc(e.subject)} 시험`; b.onclick = () => { tab = 'exam'; openSheet('study'); }; } }
};
})();
