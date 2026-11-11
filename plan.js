// 한울아파트 — 기말 작전 일지
// plan.json(기말 계획)을 읽어서 비서가 브리핑하고, 비서 화면에서 오늘 할 일을 체크하고, plan.html(작전 일지 화면)을 앱 안에서 연다.
// 체크는 plan.html 과 같은 저장 칸(localStorage "final-plan-2026-2")을 쓴다. 여기서는 done 만 고치고 grade·score 는 그대로 둔다.
// app.js·features.js·study.js 뒤에 불러온다.
'use strict';
(() => {
const DEF_KEY = 'final-plan-2026-2';
let P = null;        // plan.json
let DAYS = [];       // [{date, slot, exams, tasks}] 날짜순
let KINDS = {};      // m/e/x → 이름표(미적·영어·기타)
const homeOn = () => $('home').classList.contains('on') && C;

// ---------- 날짜 (계획에 적힌 시간대 기준, 기본 Asia/Seoul) ----------
function todayISO() {
  const tz = (P && P.meta && P.meta.timezone) || 'Asia/Seoul';
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  catch (e) { const n = new Date(); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`; }
}
const utc = iso => { const p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); };
const diff = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
const md = iso => `${+iso.slice(5, 7)}.${+iso.slice(8, 10)}`;

// ---------- 저장 (plan.html 과 같은 칸) ----------
const lsKey = () => (P && P.state && P.state.storageKey) || DEF_KEY;
function readStore() {
  try { const o = JSON.parse(localStorage.getItem(lsKey())); if (o && typeof o === 'object') return o; } catch (e) {}
  return { v: 1, done: {}, grade: {}, score: {} };
}
const doneMap = () => { const d = readStore().done; return d && typeof d === 'object' ? d : {}; };
// 체크하면 done 에 id 를 true 로 넣고, 풀면 지운다. 나머지(grade·score)는 읽은 그대로 다시 저장한다.
function setDone(id, on) {
  const o = readStore();
  if (!o.done || typeof o.done !== 'object') o.done = {};
  if (on) o.done[id] = true; else delete o.done[id];
  if (o.v == null) o.v = 1;
  try { localStorage.setItem(lsKey(), JSON.stringify(o)); return true; } catch (e) { toast('저장하지 못했어요. 저장 공간을 확인해 주세요.'); return false; }
}

// ---------- 오늘 상황 ----------
function status() {
  if (!P) return null;
  const td = todayISO(), done = doneMap();
  const day = DAYS.find(d => d.date === td) || null;
  const tasks = day ? day.tasks.map(t => ({ ...t, done: !!done[t.id] })) : [];
  const late = [];
  DAYS.forEach(d => { if (d.date < td) d.tasks.forEach(t => { if (!done[t.id]) late.push({ ...t, date: d.date }); }); });
  const next = DAYS.find(d => d.exams.length && d.date >= td) || null;
  return {
    td, day, tasks, late, next,
    slot: day ? day.slot : '',
    exams: day ? day.exams : [],
    dday: next ? diff(td, next.date) : null,
    left: tasks.filter(t => !t.done).length,
    allDone: tasks.length > 0 && tasks.every(t => t.done),
    before: DAYS.length && td < DAYS[0].date,
    after: DAYS.length && td > DAYS[DAYS.length - 1].date,
  };
}
const kindName = k => (KINDS[k] && KINDS[k].label) || '기타';
const examText = x => `${x.name} ${x.period}교시 ${x.start}`;

// ---------- 비서별 말투 ----------
// 캐릭터 설정 파일은 건드리지 않고, 기말 브리핑에 쓰는 문장만 여기에 따로 둔다.
const VOICE = {
  ns: {
    sDay: '{subject} 시험 D-{n}.', sLeft: '오늘 할 거 {n}개.', sLate: '밀린 거 {n}개 있다. 그것부터 해.',
    dday: '{subject} 시험 D-{n}. 그니까, 딴짓할 때 아니다.',
    exam: '오늘 시험이다. {exams}. 그니까, 늦지 마.',
    slot: '오늘 공부 시간은 {slot}.',
    list: '오늘 할 거.',
    late: '밀린 거 {n}개 있다. 그니까, 지난번에도 이러다 벼락치기 했잖아. 그것부터 해.',
    noLate: '밀린 건 없네. 웬일이냐.',
    done: '오늘 거 다 했네. …그니까, 너 오늘 꽤 했다.',
    rest: '오늘은 따로 적힌 게 없다. 그니까, 쉬든가 밀린 거 하든가.',
    before: '기말 계획은 {date}부터다. 그 전에 몸이나 풀어 둬.',
    after: '기말 끝났다. …수고했어, 진짜로.',
  },
  ys: {
    sDay: '{subject} 시험까지… D-{n}.', sLeft: '오늘 할 거… {n}개 있어어.', sLate: '밀린 것도… {n}개 있어어.',
    dday: '{subject} 시험까지… D-{n} 남았어어.',
    exam: '오늘… 시험 날이야아. {exams}. 늦지 마아…',
    slot: '오늘 공부 시간은… {slot}.',
    list: '오늘 할 거… 같이 보자아.',
    late: '밀린 게… {n}개 있어어. 나도 마감 밀렸으니까… 같이 하나씩 하자아.',
    noLate: '밀린 건… 없어어. 나보다 낫네에.',
    done: '오늘 거 다 했어어…? 이번 회차는… 해피엔딩이네에.',
    rest: '오늘은… 적힌 게 없어어. 같이 쉬자아.',
    before: '기말 계획은… {date}부터래애.',
    after: '기말… 끝났어어. 수고했어어.',
  },
  hr: {
    sDay: '{user} 씨~ {subject} 시험 D-{n}~', sLeft: '오늘 할 건 {n}개야~', sLate: '밀린 것도 {n}개 있네~?',
    dday: '{user} 씨~ {subject} 시험까지 D-{n} 남았어~',
    exam: '{user} 씨, 오늘 시험이지~? {exams}. 아침은 꼭 먹고 가~',
    slot: '오늘 공부 시간은 {slot}~',
    list: '오늘 할 건 이거야~ 순서는 내가 정했어~',
    late: '밀린 게 {n}개 있네~? 괜찮아~ 밥 먹고 그것부터 하나씩 하자~ 내가 옆에 있을게~',
    noLate: '밀린 건 없네~ 잘하고 있어~',
    done: '오늘 거 다 했네~ …진짜 잘했어. 이제 쉬어~',
    rest: '오늘은 적힌 게 없네~ 쉬는 것도 일이야~',
    before: '기말 계획은 {date}부터야~ 그 전엔 잘 먹고 잘 자~',
    after: '기말 끝났네~ …진짜 수고했어.',
  },
  sy: {
    sDay: '{subject} 시험 D-{n}.', sLeft: '오늘 할 일 {n}개.', sLate: '밀린 거 {n}개. 15분만 하자.',
    dday: '{subject} 시험까지 D-{n}.',
    exam: '오늘 시험. {exams}. 10분 일찍 들어가.',
    slot: '오늘 공부 시간: {slot}.',
    list: '오늘 할 일, 우선순위 순서야.',
    late: '밀린 거 {n}개. 괜찮아. 제일 작은 것부터 15분만 하자.',
    noLate: '밀린 건 없어. 계획대로야.',
    done: '오늘 거 끝. …이제 쉬어도 돼. 진짜로.',
    rest: '오늘 일정은 비었어. …쉬어도 돼.',
    before: '기말 계획은 {date} 시작이야.',
    after: '기말 끝. …우리 둘 다 칭찬받아야 돼에.',
  },
  tr: {
    sDay: '{subject} 시험 D-{n}.', sLeft: '오늘 장부에 {n}개.', sLate: '밀린 거 {n}개. 지금 갚아.',
    dday: '{subject} 시험 D-{n}. 장부에 적어 놨다.',
    exam: '오늘 시험이다. {exams}. 지각하면 가만 안 둔다.',
    slot: '오늘 공부 시간은 {slot}.',
    list: '오늘 장부에 적힌 거.',
    late: '밀린 거 {n}개. 장부에 다 적혀 있다. 이자 붙기 전에 지금 갚아.',
    noLate: '밀린 건 없다. 장부 깨끗하네.',
    done: '오늘 장부 깨끗하다. …잘했다.',
    rest: '오늘은 장부에 적힌 게 없다. 쉬어. 명령이다.',
    before: '기말 계획은 {date}부터다. 그때 도망가면 알지?',
    after: '기말 끝났다. 국밥 먹으러 가자.',
  },
};
const FALLBACK = {
  sDay: '{subject} 시험 D-{n}.', sLeft: '오늘 할 일 {n}개.', sLate: '밀린 일 {n}개.',
  dday: '{subject} 시험까지 D-{n}.', exam: '오늘 시험: {exams}.', slot: '오늘 공부 시간은 {slot}.', list: '오늘 할 일.',
  late: '밀린 일이 {n}개 있어.', noLate: '밀린 일은 없어.', done: '오늘 할 일을 다 끝냈어.', rest: '오늘은 적힌 할 일이 없어.',
  before: '기말 계획은 {date}부터 시작해.', after: '기말이 끝났어. 수고했어.',
};
const V = (c, k, o = {}) => fill((VOICE[c.code] || FALLBACK)[k] || FALLBACK[k]).replace(/\{(\w+)\}/g, (m, x) => (o[x] != null ? o[x] : m));

// 브리핑: 시험 당일이면 과목·교시·시작 시간 먼저 → D-day → 오늘 공부할 수 있는 시간 → 오늘 할 일(미적·영어·기타) → 밀린 일
function briefing(c, short) {
  const s = status(); if (!s) return '';
  if (s.before) return V(c, 'before', { date: md(DAYS[0].date) });
  if (s.after) return V(c, 'after');
  const out = [];
  if (s.exams.length) out.push(V(c, 'exam', { exams: s.exams.map(examText).join(', ') }));
  else if (s.next) out.push(V(c, 'dday', { subject: s.next.exams[0].name, n: s.dday }));
  if (s.slot && !s.exams.length) out.push(V(c, 'slot', { slot: s.slot }));
  if (!s.tasks.length) { if (!s.exams.length) out.push(V(c, 'rest')); }
  else if (s.allDone) out.push(V(c, 'done'));
  else if (!short) { out.push(V(c, 'list')); s.tasks.forEach(t => out.push(`${t.done ? '✓ ' : ''}${kindName(t.kind)}: ${t.text}`)); }
  out.push(s.late.length ? V(c, 'late', { n: s.late.length }) : V(c, 'noLate'));
  return out.join('\n');
}

// 말풍선용 짧은 브리핑: D-day(시험 당일은 과목·교시·시작 시간) + 남은 할 일 개수 + 밀린 일 개수
function briefShort(c) {
  const s = status(); if (!s) return '';
  if (s.before || s.after) return briefing(c);
  const out = [];
  if (s.exams.length) out.push(V(c, 'exam', { exams: s.exams.map(examText).join(', ') }));
  else if (s.next) out.push(V(c, 'sDay', { subject: s.next.exams[0].name, n: s.dday }));
  if (s.allDone) out.push(V(c, 'done'));
  else if (s.left) out.push(V(c, 'sLeft', { n: s.left }));
  if (s.late.length) out.push(V(c, 'sLate', { n: s.late.length }));
  return out.join('\n');
}

// ---------- 브리핑 내보내기 ----------
// 앱을 열거나 비서를 바꾸면 그 비서 말투로 나온다. 말풍선에는 짧게, 대화창에는 자세한 브리핑을 남긴다(그날 그 비서의 첫 브리핑만).
let greetAt = 0, greetLen = 0, briefT = 0;
function saidMap() {
  if (!S.finalSaid || typeof S.finalSaid !== 'object') S.finalSaid = {};
  const td = todayISO();
  Object.keys(S.finalSaid).forEach(k => { if (!k.startsWith(td)) delete S.finalSaid[k]; });
  return S.finalSaid;
}
function deliver(code) {
  if (!P || !C || C.code !== code || !$('home').classList.contains('on')) return;
  const text = briefing(C), short = briefShort(C); if (!text) return;
  const m = saidMap(), k = `${todayISO()}:${code}`;
  if (!m[k]) {
    m[k] = 1;
    st(code).log.push({ who: 'her', text, at: Date.now(), fp: 1 }); trimLog();
    if (sheetOpen === 'chat') renderChat();
  }
  setBubble(short, true);
  const s = status(); if (s && s.allDone) m[k] = 2;
  save(); renderChip();
}
function queueBrief(code) {
  clearTimeout(briefT);
  briefT = setTimeout(() => {
    // 방금 아침 인사를 했으면 다 읽을 시간을 주고 이어서 말한다
    const wait = Date.now() - greetAt < 2500 ? greetLen * 28 + 1800 : 0;
    briefT = setTimeout(() => ready.then(() => deliver(code)), wait);
  }, 1100);
}
const baseEnter = enter;
enter = function (code) {
  baseEnter(code);
  // 마지막 말이 긴 브리핑이었으면 말풍선에 그대로 띄우지 않는다 (곧 짧은 브리핑이 나온다)
  const last = st(code).log.filter(m => m.who === 'her').pop();
  if (last && last.fp) setBubble('');
  renderChip(); queueBrief(code);
};
const baseGreetLine = greetLine;
greetLine = function (c) { const t = baseGreetLine(c); greetAt = Date.now(); greetLen = [...t].length; return t; };

// 오늘 할 일을 다 끝냈을 때 한마디 (비서 화면에서 체크했든, 작전 일지 화면에서 체크했든)
function cheerIfDone() {
  const s = status(); if (!s || !C) return false;
  const m = saidMap(), k = `${s.td}:${C.code}`;
  if (s.allDone && m[k] !== 2) { m[k] = 2; save(); say(V(C, 'done'), 'sparkle'); return true; }
  if (!s.allDone && m[k] === 2) { m[k] = 1; save(); }
  return false;
}

// ---------- 비서 화면: 기말 칩 + 브리핑 시트 ----------
function renderChip() {
  const b = $('finalChip'); if (!b) return;
  const s = status();
  if (!s || !C || s.before || s.after) { b.hidden = true; return; }
  const dd = s.exams.length ? '시험 날' : s.dday != null ? `D-${s.dday}` : '';
  const n = s.tasks.length;
  b.hidden = false; b.className = 'final-chip' + (s.late.length ? ' late' : s.allDone ? ' ok' : '');
  b.innerHTML = `<b>${esc(dd)}</b>기말${n ? ` · 오늘 ${n - s.left}/${n}` : ''}${s.late.length ? ` · 밀림 ${s.late.length}` : ''}`;
  b.setAttribute('aria-label', `기말 브리핑 열기. ${dd}${n ? `, 오늘 할 일 ${n}개 중 ${n - s.left}개 끝냄` : ''}${s.late.length ? `, 밀린 일 ${s.late.length}개` : ''}`);
}
function toggleFinal(id) {
  const was = !!doneMap()[id];
  if (!setDone(id, !was)) return;
  if (!was && !cheerIfDone()) { say(fill(pick(C.app.praise))); if (window.popSticker) popSticker('sparkle'); }
  if (was) cheerIfDone();
  refresh(); renderChip();
}
function taskRow(t, when) {
  const r = el('div', 'item' + (t.done ? ' done' : '') + (when ? ' late' : ''));
  const ck = el('button', 'ck', t.done ? '✓' : ''); ck.setAttribute('aria-label', `${t.text} ${t.done ? '안 한 걸로' : '끝냈어요'}`);
  ck.onclick = () => toggleFinal(t.id);
  r.append(ck);
  if (when) r.append(el('span', 'tm', esc(when)));
  r.append(el('span', 'tx', esc(t.text)), el('span', 'rep', esc(kindName(t.kind))));
  return r;
}
SHEETS.final = {
  title: () => '기말 브리핑',
  sub: () => {
    const s = status(); if (!s) return '계획을 불러오는 중';
    if (s.before || s.after) return s.before ? `${md(DAYS[0].date)}부터 시작` : '기말 끝';
    const a = [s.exams.length ? '오늘 시험' : s.dday != null ? `D-${s.dday}` : ''];
    if (s.tasks.length) a.push(`오늘 ${s.tasks.length - s.left}/${s.tasks.length}`);
    a.push(s.late.length ? `밀린 일 ${s.late.length}개` : '밀린 일 없음');
    return a.filter(Boolean).join(' · ');
  },
  tall: true,
  render() {
    const b = body(), f = foot(); b.innerHTML = ''; f.innerHTML = '';
    const s = status();
    if (!s) { b.appendChild(el('div', 'empty', '기말 계획(plan.json)을 불러오지 못했어요. 인터넷 연결을 확인하고 앱을 다시 열어 주세요.')); return; }
    const card = el('section', 'card');
    card.innerHTML = `<h3>${esc(C.name)}<small>${md(s.td)} ${WD[new Date(utc(s.td)).getUTCDay()]}요일${s.slot ? ' · ' + esc(s.slot) : ''}</small></h3><p class="voice">${esc(briefing(C, true))}</p>`;
    b.appendChild(card);
    if (s.exams.length) {
      b.appendChild(el('h4', 'sub-h', '오늘 시험'));
      s.exams.forEach(x => { const r = el('div', 'item'); r.innerHTML = `<span class="ck ghost"></span><span class="tm">${esc(x.start)}</span><span class="tx">${esc(x.name)}<small>${x.period}교시 · ${esc(x.start)}–${esc(x.end)} · ${x.minutes}분</small></span>`; b.appendChild(r); });
    }
    if (s.tasks.length) {
      b.appendChild(el('h4', 'sub-h', `오늘 할 일 ${s.tasks.length - s.left}/${s.tasks.length}`));
      s.tasks.forEach(t => b.appendChild(taskRow(t)));
    }
    if (s.late.length) {
      b.appendChild(el('h4', 'sub-h', `밀린 일 ${s.late.length}개`));
      s.late.forEach(t => b.appendChild(taskRow({ ...t, done: false }, md(t.date))));
    }
    const open = el('button', 'btn wide', '기말 작전 일지 열기');
    open.onclick = () => { closeSheet(); openPlanView(); };
    f.appendChild(open);
    f.appendChild(el('p', 'hint', '여기서 체크한 건 기말 작전 일지에도 똑같이 표시돼요.'));
  },
};

// ---------- 작전 일지 화면 (plan.html 을 앱 안에서 연다) ----------
let frameDay = '';
function openPlanView() {
  const v = $('planView'), fr = $('planFrame');
  const td = todayISO();
  if (frameDay !== td) { fr.src = 'plan.html'; frameDay = td; } // 처음 열 때, 그리고 날짜가 바뀌었을 때만 새로 읽는다
  v.hidden = false;
  try { history.pushState({ planView: 1 }, ''); } catch (e) {}
}
function hidePlanView() { const v = $('planView'); if (v.hidden) return; v.hidden = true; renderChip(); if (sheetOpen === 'final') refresh(); cheerIfDone(); }
function closePlanView() { if (history.state && history.state.planView) history.back(); else hidePlanView(); }
addEventListener('popstate', hidePlanView); // 폰의 뒤로 가기로도 닫힌다

// 작전 일지 화면에서 체크하면 비서 화면도 바로 따라 바뀐다
addEventListener('storage', e => {
  if (e.key !== lsKey()) return;
  renderChip(); if (sheetOpen === 'final') refresh();
  if ($('planView').hidden) cheerIfDone();
});

// ---------- 대화(Gemini)에도 기말 상황을 알려 준다 ----------
const basePrompt = window.promptExtra;
window.promptExtra = function (c) {
  const base = basePrompt ? basePrompt(c) : '';
  const s = status(); if (!s || s.before || s.after) return base;
  const ex = s.exams.length ? `오늘 시험: ${s.exams.map(examText).join(', ')}` : s.next ? `다음 시험: ${s.next.exams.map(x => x.name).join(', ')} (${s.next.date}, D-${s.dday})` : '';
  const tk = s.tasks.map(t => `- [${t.done ? 'x' : ' '}] ${kindName(t.kind)}: ${t.text}`).join('\n') || '(없음)';
  const lt = s.late.slice(0, 8).map(t => `- ${t.date} ${kindName(t.kind)}: ${t.text}`).join('\n') || '(없음)';
  return `${base}\n[기말 작전 일지] ${ex} · 오늘 공부 가능한 시간: ${s.slot || '(없음)'}\n[기말 계획의 오늘 할 일]\n${tk}\n[기말 계획에서 밀린 일 ${s.late.length}개]\n${lt}`;
};

// ---------- 시작 ----------
const ready = fetch('plan.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('plan.json'); return r.json(); }).then(j => {
  P = j; KINDS = j.kinds || {};
  DAYS = [];
  (j.phases || []).forEach(ph => (ph.days || []).forEach(d => DAYS.push({ date: d.date, slot: d.slot || '', exams: d.exams || [], tasks: d.tasks || [] })));
  DAYS.sort((a, b) => a.date.localeCompare(b.date));
  renderChip();
}).catch(() => { P = null; });
$('finalBtn').onclick = openPlanView;
$('planBack').onclick = closePlanView;
$('finalChip').onclick = () => openSheet('final');
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderChip(); });
})();
