// 한울아파트 — 고등학생 내신 공부
// 시간표 · 시험(D-day) · 공부 계획 자동 배치(시험 3주 전부터 회독 단계, 평일 2과목·주말 3과목, 50분 블록)
// · 공부 타이머(비서가 옆에서 응원) · 노트 정리(필기·교과서 사진/PDF를 Gemini가 단원별로 정리, 퀴즈)
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
// 내 학교 시간표 (2학년 2학기, 2026). 수업 50분·쉬는 시간 10분, 4교시 뒤 점심 1시간. 금요일 6·7교시 창체는 없는 날도 있다(2시 또는 4시 끝)
const MY_TT = {
  periods: ['08:20', '09:20', '10:20', '11:20', '13:10', '14:10', '15:10'],  // 8시~8시 10분 등교, 8시 20분 1교시
  cells: {
    '1-1': '현대사회와 윤리', '1-2': '한국지리탐구', '1-3': '독서와 작문', '1-4': '미적분Ⅰ', '1-5': '영어Ⅱ', '1-6': '언어생활탐구',
    '2-1': '언어생활탐구', '2-2': '영어Ⅱ', '2-3': '심화일본어', '2-4': '독서와 작문', '2-5': '미적분Ⅰ', '2-6': '동아시아역사기행', '2-7': '영어Ⅱ',
    '3-1': '현대사회와 윤리', '3-2': '한국지리탐구', '3-3': '미적분Ⅰ', '3-4': '스포츠 과학', '3-5': '음악/미술', '3-6': '심화일본어',
    '4-1': '음악/미술', '4-2': '언어생활탐구', '4-3': '영어Ⅱ', '4-4': '독서와 작문', '4-5': '동아시아역사기행', '4-6': '독서와 작문', '4-7': '심화일본어',
    '5-1': '현대사회와 윤리', '5-2': '한국지리탐구', '5-3': '스포츠 과학', '5-4': '동아시아역사기행', '5-5': '미적분Ⅰ', '5-6': '창체', '5-7': '창체',
  },
};
// 시간표가 비어 있으면 내 시간표로 채운다 (한 번만, 직접 고친 건 덮어쓰지 않는다)
if (!S.ttLoaded && !Object.keys(S.tt.cells).length) { S.tt = { periods: MY_TT.periods.slice(), cells: { ...MY_TT.cells } }; S.ttLoaded = 1; save(); }
// 1교시가 8시 40분이던 예전 판을 받은 경우: 교시 시각만 8시 20분 기준으로 고친다
if (S.ttLoaded === 1 && S.tt.periods[0] === '08:40') { S.tt.periods = MY_TT.periods.slice(); S.ttLoaded = 2; save(); }
// 매주 일정: 등교·학원 (한 번만 넣는다. 끝 시각 end 가 있으면 공부 계획이 그 시간을 피한다)
const MY_REPS = [
  { key: 'school', text: '등교 (8:10까지 도착)', days: [1, 2, 3, 4, 5], time: '08:00', end: '08:10' },
  { key: 'math', text: '수학 학원', days: [2, 4], time: '16:00', end: '18:00' },
  { key: 'math', text: '수학 학원', days: [5], time: '20:00', end: '22:00' },
  { key: 'math', text: '수학 학원', days: [6], time: '14:00', end: '16:00' },
  { key: 'kor', text: '국어 학원', days: [4], time: '19:00', end: '22:00' },
  { key: 'kor', text: '국어 학원', days: [6], time: '10:00', end: '13:00' },
  { key: 'eng', text: '영어 학원 (보통 7시쯤 끝)', days: [3, 5], time: '16:00', end: '19:00' },
  { key: 'eng', text: '영어 학원', days: [6], time: '16:00', end: '18:00' },
];
const MY_REPS2 = [{ key: 'history', text: '역사 특강', days: [0], time: '13:00', end: '19:00' }]; // 일요일, 내가 하는 특강
if (!S.repsLoaded) { MY_REPS.forEach(r => S.reps.push({ id: uid(), ...r })); S.repsLoaded = 1; save(); }
if (S.repsLoaded < 2) { MY_REPS2.forEach(r => { if (!S.reps.some(x => x.key === r.key)) S.reps.push({ id: uid(), ...r }); }); S.repsLoaded = 2; save(); }
const endOf = t => { const [h, m] = t.split(':').map(Number), x = h * 60 + m + 50; return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`; };
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
  const busy = S.reps.filter(r => r.days.includes(wd)).map(r => [toMin(r.time), r.end ? toMin(r.end) + 30 : toMin(r.time) + 60]); // 학원 끝나고 30분은 이동·식사
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
  const fb = finalButtons(); if (fb) b.appendChild(fb);
  b.appendChild(weekBox());
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
    if (i === 4) g.appendChild(el('span', 'tt-lunch', '점심')); // 4교시 뒤 점심 1시간
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
  b.appendChild(el('p', 'hint', `수업 50분, 쉬는 시간 10분, 4교시 뒤 점심 1시간 (${endOf(S.tt.periods[3])}~${S.tt.periods[4]}). 금요일 창체는 없는 날도 있어요. 칸을 누르고 아래에 과목을 쓰면 고칠 수 있어요.`));
  const reload = el('button', 'btn ghost sm', '학교 시간표로 되돌리기');
  reload.onclick = () => { if (confirm('직접 고친 칸을 지우고 학교 시간표로 되돌릴까요?')) { S.tt = { periods: MY_TT.periods.slice(), cells: { ...MY_TT.cells } }; S.ttLoaded = 1; save(); SHEETS.study.render(); toast('학교 시간표로 되돌렸어요'); } };
  b.appendChild(reload);
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

// ---------- 노트 정리 (Gemini) ----------
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
  return askJSON({ messages: [{ role: 'user', content }], schema: NOTE, maxTokens: 16000 });
}
function renderNotes(b) {
  if (noteOpen) return renderNote(b, S.notes.find(n => n.id === noteOpen));
  const subs = [...new Set(S.notes.map(n => n.subject))];
  if (!S.notes.length) b.appendChild(el('div', 'empty', '필기나 교과서, 학습지 사진(PDF도 돼요)을 올리면 AI가 단원별 노트와 백지 복습 퀴즈로 정리해 줘요.'));
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
    if (!hasAI()) { toast('설정에서 Gemini 무료 키를 넣어 주세요'); return; }
    const fs = [...file.files].slice(0, 5); if (!fs.length) { toast('사진이나 PDF를 먼저 골라 주세요'); return; }
    go.disabled = true; go.textContent = '정리하는 중…'; info.textContent = 'AI가 읽고 있어요. 30초~1분쯤 걸려요.';
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
// 타이머 상태는 S.focus 에 저장해서, 앱을 닫았다 열어도 이어진다 (닫혀 있는 동안 끝났으면 열 때 마무리).
// 폰을 엎어 두면 비서가 칭찬하고, 다른 앱에 다녀오면 어디 갔다 왔냐고 묻는다. 과목별 공부 시간이 쌓인다.
if (!S.slogSub) S.slogSub = {};                                       // 날짜 -> {과목: 분}
let F = null, fT = 0, wake = null;
const FL = { // 타이머 중 비서 한마디: 엎어 둠 · 다시 집어 듦 · 다른 앱에 다녀옴({n}분)
  ns: { down: ['폰 엎었네. 그니까, 그렇게 하는 거야.', '오, 진짜 집중하네.'], up: ['벌써 폰 보냐.', '그니까, 아직 안 끝났거든.'], back: ['{n}분 동안 어디 갔다 왔냐.', '딴짓했지. 다 안다.'] },
  ys: { down: ['폰 엎었어어…? 나도 원고 집중할게에.', '…같이 집중하는 거, 좋다아.'], up: ['벌써… 폰 보는 거야아?', '아직… 남았는데에.'], back: ['{n}분… 어디 갔었어어?', '나 혼자… 원고 하고 있었어어.'] },
  hr: { down: ['어머, 폰 엎어 뒀네~ 잘하고 있어~', '그치~ 그렇게 하는 거야~'], up: ['벌써 폰 봐~? 조금만 더 하자~', '어머, 아직 시간 남았어~'], back: ['{n}분 동안 어디 갔다 왔어~?', '다녀왔어~? 다시 하자~'] },
  sy: { down: ['좋아, 폰 엎은 거 잘했어.', '이 페이스면 충분해.'], up: ['폰은 쉬는 시간에.', '…알림 확인은 나중에 해도 돼.'], back: ['{n}분 자리 비웠어. 괜찮아, 다시 하자.', '돌아왔네. 남은 것만 하면 돼.'] },
  tr: { down: ['폰 엎었냐. 제법인데.', '그래, 그렇게 해.'], up: ['폰 내려놔.', '벌써 보냐. 장부에 적는다.'], back: ['{n}분. 어디 갔다 왔냐.', '튀었다가 돌아왔네. 앉아.'] },
};
const focusSay = (k, o) => { const l = (FL[C.code] || FL.ns)[k]; if (l) typeInto($('focusLine'), fillT(pick(l), o), 'focus'); };
const saveF = () => { S.focus = F ? { ...F, code: C ? C.code : null } : null; save(); };
const mmLeft = () => Math.ceil((F.paused || Math.max(0, F.end - Date.now())) / 60e3);
const hhmm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function logMins(subject, mins) {
  if (mins <= 0) return;
  const d = calToday(); S.slog[d] = (S.slog[d] || 0) + mins;
  const m = S.slogSub[d] || (S.slogSub[d] = {}); m[subject] = (m[subject] || 0) + mins;
}

// 닫혀 있어도 보이게: 진행 중인 타이머를 알림으로 띄워 둔다 (알림을 켠 경우)
async function focusNote(close) {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration(); if (!reg) return;
    (await reg.getNotifications({ tag: 'hanul-focus' })).forEach(n => n.close());
    if (close || !F || !S.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    const body = F.paused ? `잠깐 멈춤 · ${mmLeft()}분 남았어요` : `${hhmm(F.end)}에 끝나요 · ${mmLeft()}분 남음`;
    await reg.showNotification(`📚 ${F.x.subject} 공부 중`, { body: `${body}\n${C ? C.name : ''}가 옆에서 기다리는 중`, tag: 'hanul-focus', silent: true, requireInteraction: true, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './' } });
  } catch (e) {}
}
function showFocusUI(noTick) {
  const x = F.x;
  $('focusSub').textContent = x.subject; $('focusPhase').textContent = x.range ? `${x.text.replace(x.subject + ' ', '')}, ${x.range}` : x.text.replace(x.subject + ' ', '');
  $('focusWho').textContent = C.name;
  $('focusPause').textContent = F.paused ? '계속하기' : '잠깐 멈춤'; $('focusStop').hidden = false;
  $('focus').hidden = false; $('home').classList.add('focusing');
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => wake = w).catch(() => {}); } catch (e) {}
  clearInterval(fT); fT = setInterval(focusTick, 500); if (!noTick) focusTick();
}
function startFocus(x) {
  closeSheet();
  const len = S.study.len * 60e3;
  F = { x, end: Date.now() + len, len, paused: 0, half: false, start: Date.now(), awayAt: 0, away: 0, awayN: 0, downAt: 0, downs: 0 };
  saveF(); showFocusUI();
  typeInto($('focusLine'), fillT(C.app.study_start, { subject: x.subject }), 'focus');
  // 아이폰은 기울기 센서를 쓰려면 허락이 필요하다 (버튼을 누른 지금 물어본다)
  try { if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {}); } catch (e) {}
  focusNote();
}
function focusTick() {
  if (!F) return;
  const left = F.paused ? F.paused : Math.max(0, F.end - Date.now());
  $('focusTime').textContent = `${pad(Math.floor(left / 60e3))}:${pad(Math.floor(left / 1e3) % 60)}`;
  $('focusBar').style.width = `${100 - left / F.len * 100}%`;
  if (!F.half && left <= F.len / 2) { F.half = true; saveF(); typeInto($('focusLine'), fillT(C.app.study_half), 'focus'); }
  if (left <= 0 && !F.paused) finishFocus();
}
function finishFocus(whileAway) {
  const x = F.x, mins = Math.round(F.len / 60e3), stats = { away: F.away, awayN: F.awayN, downs: F.downs };
  clearInterval(fT); F = null; saveF();
  if (x.id) S.sdone[x.id] = mins;
  logMins(x.subject, mins);
  const s = st(C.code); s.aff = Math.min(C.affection.range[1], s.aff + 1); save();
  if (!whileAway) { ding(); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} }
  const extra = stats.downs ? ' 폰도 잘 엎어 뒀고.' : stats.awayN >= 2 ? ` 중간에 ${stats.awayN}번 나갔다 왔지만.` : '';
  typeInto($('focusLine'), fillT(C.app.study_end) + (whileAway ? '' : extra), 'focus');
  $('focusTime').textContent = '00:00'; $('focusBar').style.width = '100%';
  $('focusPause').textContent = '닫기'; $('focusStop').hidden = true;
  if (window.popSticker) setTimeout(() => popSticker('sparkle'), 300);
  focusNote(true);
  // 앱이 뒤에 있으면 끝났다고 알린다
  if (document.hidden && window.notifyFocusEnd) notifyFocusEnd(x.subject, mins);
  if (window.pushSync) pushSync();
}
function closeFocus() { clearInterval(fT); F = null; saveF(); $('focus').hidden = true; $('focusStop').hidden = false; $('home').classList.remove('focusing'); try { wake && wake.release(); } catch (e) {} focusNote(true); if (window.pushSync) pushSync(); renderHome(); }
$('focusPause').onclick = () => {
  if (!F) { closeFocus(); return; }
  if (F.paused) { F.end = Date.now() + F.paused; F.paused = 0; $('focusPause').textContent = '잠깐 멈춤'; }
  else { F.paused = Math.max(0, F.end - Date.now()); $('focusPause').textContent = '계속하기'; }
  saveF(); focusNote(); if (window.pushSync) pushSync(); focusTick();
};
$('focusStop').onclick = () => {
  if (!F) return closeFocus();
  const done = Math.round((F.len - (F.paused || Math.max(0, F.end - Date.now()))) / 60e3);
  logMins(F.x.subject, done); save();
  closeFocus(); toast(done > 0 ? `${done}분 공부했어요` : '타이머를 껐어요');
};
window.focusState = () => (F ? { subject: F.x.subject, end: F.end, paused: F.paused, len: F.len } : null);

// 다른 앱에 다녀오면 어디 갔다 왔냐고 묻는다
document.addEventListener('visibilitychange', () => {
  if (!F) return;
  if (document.hidden) { if (!F.paused) { F.awayAt = Date.now(); saveF(); focusNote(); } return; }
  if (F.awayAt) {
    const gone = Date.now() - F.awayAt; F.awayAt = 0;
    if (gone > 20e3 && F.end > Date.now()) { F.away += gone; F.awayN++; focusSay('back', { n: Math.max(1, Math.round(gone / 60e3)) }); }
    saveF();
  }
  focusTick();
});
// 폰을 엎어 두면 칭찬, 엎어 뒀다가 금방 다시 집으면 한마디 (기울기 센서)
let downNow = false, downT = 0;
addEventListener('deviceorientation', e => {
  if (!F || F.paused || e.beta == null) return;
  const down = Math.abs(e.beta) > 150 && Math.abs(e.gamma || 0) < 35;
  if (down === downNow) return;
  downNow = down; clearTimeout(downT);
  if (down) downT = setTimeout(() => { if (!F || !downNow) return; F.downAt = Date.now(); F.downs++; saveF(); if (F.downs === 1 || Math.random() < .3) focusSay('down'); }, 1500);
  else if (F.downAt && Date.now() - F.downAt > 60e3 && F.end - Date.now() > 60e3) { F.downAt = 0; saveF(); focusSay('up'); }
});

// 앱을 다시 열었을 때 이어서 (닫혀 있는 동안 끝났으면 마무리)
(function restoreFocus() {
  const f = S.focus;
  if (!f || !f.x) return;
  const go = () => {
    if (!C || !$('home').classList.contains('on')) return setTimeout(go, 400);
    if (F) return;
    F = { awayAt: 0, away: 0, awayN: 0, downAt: 0, downs: 0, ...f }; delete F.code;
    if (F.awayAt) { const gone = Math.min(Date.now(), F.end) - F.awayAt; if (gone > 20e3) { F.away += gone; F.awayN++; } F.awayAt = 0; }
    const ended = !F.paused && F.end <= Date.now();
    showFocusUI(ended);
    if (ended) { finishFocus(true); toast('자리 비운 사이에 타이머가 끝났어요'); }
    else typeInto($('focusLine'), F.paused ? '잠깐 멈춘 채로 있었어. 다시 할래?' : `이어서 하자. ${mmLeft()}분 남았어.`, 'focus');
  };
  setTimeout(go, 600);
})();

// ---------- 이번 주 공부 (막대 그래프) ----------
function weekBox() {
  const box = el('section', 'card week');
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return dk(d); });
  const mins = days.map(d => S.slog[d] || 0), max = Math.max(60, ...mins), total = mins.reduce((a, b) => a + b, 0);
  const subj = {}; days.forEach(d => Object.entries(S.slogSub[d] || {}).forEach(([k, v]) => subj[k] = (subj[k] || 0) + v));
  const hm = m => (m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60 ? `${m % 60}분` : ''}`.trim() : `${m}분`);
  box.innerHTML = `<h3>이번 주 공부<small>7일 합계 ${hm(total)}</small></h3>
    <div class="wbars" role="img" aria-label="최근 7일 공부 시간: ${days.map((d, i) => `${WD[new Date(d + 'T12:00').getDay()]} ${mins[i]}분`).join(', ')}">
    ${days.map((d, i) => `<div class="wb${d === calToday() ? ' today' : ''}"><span class="wv">${mins[i] ? mins[i] : ''}</span><i style="height:${Math.round(mins[i] / max * 100)}%"></i><span class="wd">${WD[new Date(d + 'T12:00').getDay()]}</span></div>`).join('')}</div>`;
  const list = Object.entries(subj).sort((a, b) => b[1] - a[1]);
  if (list.length) box.insertAdjacentHTML('beforeend', `<div class="wsub">${list.map(([k, v]) => `<span><b>${esc(k)}</b>${hm(v)}</span>`).join('')}</div>`);
  else box.insertAdjacentHTML('beforeend', '<p class="hint">타이머로 공부하면 여기에 쌓여요.</p>');
  return box;
}
// 기말 과목으로 바로 시작 (plan.js 가 과목 목록을 준다)
function finalButtons() {
  const list = window.finalSubjects ? finalSubjects() : [];
  if (!list.length) return null;
  const w = el('div', 'fsub');
  w.appendChild(el('p', 'hint top', '기말 과목으로 50분 시작'));
  const row = el('div', 'fsub-row');
  list.forEach(n => { const x = el('button', 'btn ghost sm', esc(n)); x.onclick = () => startFocus({ id: null, subject: n, text: `${n} 기말 공부`, range: '' }); row.appendChild(x); });
  w.appendChild(row); return w;
}

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
