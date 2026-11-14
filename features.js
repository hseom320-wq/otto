// 한울아파트 — 레나식 비서 기능
// 일정(오늘·달력·매주) · 먼저 챙기기(10분 전 알림·밀린 일·후속 질문) · 인터폰 모닝콜 · 우편함(못 받은 인터폰·운세·일기) · 날씨 · 기분 스티커
// app.js 뒤에 불러온다. app.js의 S, C, DATA, SHEETS, say, toast, fill, pick, el, esc … 를 그대로 쓴다.
'use strict';
(() => {
// ---------- 날짜 ----------
const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // 달력 날짜
const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const calToday = () => dk(new Date());
const addDays = (day, n) => { const d = new Date(day + 'T12:00'); d.setDate(d.getDate() + n); return dk(d); };
const dayLabel = day => { const d = new Date(day + 'T12:00'); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일`; };
function whenText(due) {
  const day = due.slice(0, 10), t = due.slice(11, 16), td = calToday();
  if (day === td) return `오늘 ${t}`;
  if (day === addDays(td, 1)) return `내일 ${t}`;
  const d = new Date(day + 'T12:00');
  return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]}) ${t}`;
}
const CH = code => DATA.characters.find(x => x.code === code);
const fillT = (t, o = {}) => fill(String(t || '')).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
const homeOn = () => $('home').classList.contains('on') && C;
// 하루를 시드로 쓰는 작은 난수 (운세가 하루 동안 바뀌지 않게)
function seeded(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }

// ---------- 일정 ----------
function itemsOn(day) {
  const wd = new Date(day + 'T12:00').getDay();
  const a = S.todos.filter(t => t.due && t.due.slice(0, 10) === day).map(t => ({ kind: 'todo', id: t.id, time: t.due.slice(11, 16), text: t.text, done: t.done }));
  const r = S.reps.filter(x => x.days.includes(wd)).map(x => ({ kind: 'rep', id: x.id, time: x.time, text: x.end ? `${x.text} (~${x.end})` : x.text }));
  const st2 = window.extraItems ? extraItems(day) : []; // 공부 계획 (study.js)
  return [...a, ...r, ...st2].sort((x, y) => (x.time || '').localeCompare(y.time || ''));
}
const lateOnes = () => S.todos.filter(t => !t.done && t.due && new Date(t.due) < new Date());
function nextToday() {
  const now = hm(new Date());
  return itemsOn(calToday()).find(x => !x.done && x.time >= now);
}

let tab = 'today', calMonth = null, calDay = null;
SHEETS.plan = {
  title: () => '일정',
  sub: () => { const a = S.todos.filter(t => !t.done).length, l = lateOnes().length; return l ? `밀린 일정 ${l}개, 남은 할 일 ${a}개` : a ? `남은 할 일 ${a}개. 하나 끝낼 때마다 보상씬` : '오늘 거 다 끝났어요'; },
  tall: true,
  render() {
    const b = body(); b.innerHTML = '';
    const seg = el('div', 'seg');
    [['today', '오늘'], ['cal', '달력'], ['week', '매주']].forEach(([k, n]) => {
      const x = el('button', null, n); x.setAttribute('aria-pressed', String(tab === k));
      x.onclick = () => { tab = k; foot().innerHTML = ''; SHEETS.plan.render(); }; seg.appendChild(x);
    });
    b.appendChild(seg);
    if (tab === 'today') renderDay(b, calToday(), true);
    if (tab === 'cal') renderCal(b);
    if (tab === 'week') renderWeek(b);
  },
};
function itemRow(x) {
  const t = x.kind === 'todo' ? S.todos.find(y => y.id === x.id) : null;
  const r = el('div', 'item' + (x.done ? ' done' : '') + (t && !t.done && t.due && new Date(t.due) < new Date() ? ' late' : ''));
  r.innerHTML = `<span class="tm">${x.time || ''}</span><span class="tx">${esc(x.text)}</span>${x.kind === 'rep' ? '<span class="rep">매주</span>' : x.kind === 'study' ? '<span class="rep">공부</span>' : ''}`;
  if (t) {
    const ck = el('button', 'ck', t.done ? '✓' : ''); ck.setAttribute('aria-label', t.done ? '안 한 걸로' : '끝냈어요');
    ck.onclick = () => toggleTodo(t.id); r.prepend(ck);
    const del = el('button', 'del', '✕'); del.setAttribute('aria-label', '지우기');
    del.onclick = () => { S.todos = S.todos.filter(y => y.id !== t.id); save(); refresh(); renderHome(); }; r.appendChild(del);
  } else if (x.kind === 'study') {
    const ck = el('button', 'ck', x.done ? '✓' : ''); ck.setAttribute('aria-label', x.done ? '안 한 걸로' : '끝냈어요');
    ck.onclick = () => { if (S.sdone[x.id]) delete S.sdone[x.id]; else S.sdone[x.id] = S.study.len; save(); refresh(); renderHome(); }; r.prepend(ck);
  } else r.prepend(el('span', 'ck ghost'));
  return r;
}
function renderDay(b, day, withUntimed) {
  b.appendChild(el('h3', 'day-h', dayLabel(day) + (day === calToday() ? ', 오늘' : '')));
  const list = itemsOn(day);
  const untimed = withUntimed ? S.todos.filter(t => !t.due) : [];
  const late = day === calToday() ? lateOnes().filter(t => t.due.slice(0, 10) < day) : [];
  if (!list.length && !untimed.length && !late.length) b.appendChild(el('div', 'empty', '비어 있어요. 아래에서 할 일이나 일정을 넣어 주세요.'));
  late.forEach(t => { const r = itemRow({ kind: 'todo', id: t.id, time: whenText(t.due).replace(' ', '\n'), text: t.text, done: false }); b.appendChild(r); });
  list.forEach(x => b.appendChild(itemRow(x)));
  if (untimed.length) {
    b.appendChild(el('h4', 'sub-h', '시간 없는 할 일'));
    [...untimed].sort((x, y) => x.done - y.done).forEach(t => b.appendChild(itemRow({ kind: 'todo', id: t.id, time: '', text: t.text, done: t.done })));
  }
  addForm(day);
}
function addForm(day) {
  const f = foot(); if (f.dataset.day === day && f.childElementCount) return;
  f.innerHTML = ''; f.dataset.day = day;
  const row = el('div', 'row'), i = el('input', 'in'), tm = el('input', 'in tm-in');
  i.placeholder = day === calToday() ? '할 일이나 일정' : `${dayLabel(day).replace(/ \S+요일$/, '')} 일정`; i.enterKeyHint = 'done'; i.id = 'planText';
  tm.type = 'time'; tm.id = 'planTime'; tm.setAttribute('aria-label', '시간 (없으면 비워 두기)');
  const add = el('button', 'btn', '넣기');
  const go = () => {
    const v = i.value.trim(); if (!v) return;
    const due = tm.value ? `${day}T${tm.value}` : (day === calToday() ? null : `${day}T09:00`);
    addTodo(v, due); i.value = ''; tm.value = ''; i.focus();
  };
  add.onclick = go; i.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) go(); };
  row.append(i, tm, add); f.appendChild(row);
  f.appendChild(el('p', 'hint', day === calToday() ? '시간을 넣으면 10분 전에 챙겨 줘요. 비우면 시간 없는 할 일이에요.' : '시간을 비우면 아침 9시로 넣어요.'));
}
function renderCal(b) {
  const now = new Date();
  if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!calDay) calDay = calToday();
  const head = el('div', 'cal-head');
  const prev = el('button', 'nav', '‹'), next = el('button', 'nav', '›');
  prev.setAttribute('aria-label', '지난달'); next.setAttribute('aria-label', '다음 달');
  prev.onclick = () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); SHEETS.plan.render(); };
  next.onclick = () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); SHEETS.plan.render(); };
  head.append(prev, el('b', null, `${calMonth.getFullYear()}년 ${calMonth.getMonth() + 1}월`), next);
  b.appendChild(head);
  const g = el('div', 'cal');
  [...WD].forEach((w, i) => g.appendChild(el('span', 'wd' + (i === 0 ? ' su' : i === 6 ? ' sa' : ''), w)));
  const start = new Date(calMonth); start.setDate(1 - start.getDay());
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); const day = dk(d);
    const n = itemsOn(day).length;
    const x = el('button', 'cd' + (d.getMonth() !== calMonth.getMonth() ? ' out' : '') + (day === calToday() ? ' td' : '') + (day === calDay ? ' sel' : ''));
    x.innerHTML = `<span>${d.getDate()}</span>${n ? `<i>${'•'.repeat(Math.min(n, 3))}</i>` : ''}`;
    x.setAttribute('aria-label', `${dayLabel(day)}${n ? `, 일정 ${n}개` : ''}`);
    x.onclick = () => { calDay = day; SHEETS.plan.render(); };
    g.appendChild(x);
  }
  b.appendChild(g);
  renderDay(b, calDay, false);
}
function renderWeek(b) {
  b.appendChild(el('p', 'hint top', '수업·학원·운동처럼 매주 같은 시간에 있는 걸 넣어 두면, 그 요일마다 일정에 나오고 10분 전에 챙겨 줘요.'));
  if (!S.reps.length) b.appendChild(el('div', 'empty', '아직 없어요.'));
  [...S.reps].sort((x, y) => x.time.localeCompare(y.time)).forEach(x => {
    const r = el('div', 'item');
    r.innerHTML = `<span class="ck ghost"></span><span class="tm">${x.time}</span><span class="tx">${esc(x.text)}<small>${x.days.map(d => WD[d]).join(' ')}${x.end ? ` · ${x.time}~${x.end}` : ''}</small></span>`;
    const del = el('button', 'del', '✕'); del.setAttribute('aria-label', '지우기');
    del.onclick = () => { S.reps = S.reps.filter(y => y.id !== x.id); save(); refresh(); }; r.appendChild(del);
    b.appendChild(r);
  });
  const f = foot(); f.innerHTML = ''; f.dataset.day = '';
  const days = new Set([new Date().getDay()]);
  const dr = el('div', 'days');
  [...WD].forEach((w, i) => { const x = el('button', null, w); x.setAttribute('aria-pressed', String(days.has(i))); x.onclick = () => { days.has(i) ? days.delete(i) : days.add(i); x.setAttribute('aria-pressed', String(days.has(i))); }; dr.appendChild(x); });
  const row = el('div', 'row'), i = el('input', 'in'), tm = el('input', 'in tm-in'), add = el('button', 'btn', '넣기');
  i.placeholder = '예: 영어 학원'; i.id = 'repText'; tm.type = 'time'; tm.value = '19:00'; tm.id = 'repTime';
  add.onclick = () => { const v = i.value.trim(); if (!v || !days.size || !tm.value) return; S.reps.push({ id: uid(), text: v, days: [...days].sort(), time: tm.value }); save(); i.value = ''; refresh(); };
  row.append(i, tm, add); f.append(dr, row);
}

// ---------- 메인 화면: 다음 일정 · 우편함 표시 ----------
window.renderHomeExtra = function () {
  const b = $('nextUp'), late = lateOnes(), nx = nextToday();
  if (late.length) { b.hidden = false; b.className = 'next-up late'; b.textContent = `밀린 일정 ${late.length}개`; }
  else if (nx) { b.hidden = false; b.className = 'next-up'; b.innerHTML = `<b>${nx.time}</b> ${esc(nx.text)}`; }
  else b.hidden = true;
  b.onclick = () => { tab = 'today'; openSheet('plan'); };
  const un = S.mail.filter(m => !m.read).length; $('mailBadge').textContent = un || '';
  $('todoBadge').textContent = (S.todos.filter(t => !t.done).length + 0) || '';
};

// ---------- 인사·대화에 붙는 것 (날씨 · 후속 질문 · 밀린 일 · 오늘 일정) ----------
window.greetExtra = function (c) {
  const out = [];
  const w = wxToday();
  if (w) { if (w.pop >= 50) out.push(fillT(c.app.rain)); else if (w.max <= 4) out.push(fillT(c.app.cold)); }
  const f = S.follow.find(x => !x.asked && x.code === c.code && x.date <= calToday());
  if (f) { f.asked = true; out.push(f.q); save(); }
  const late = lateOnes();
  if (late.length) out.push(fillT(c.app.late, { text: late[0].text }));
  else { const it = itemsOn(calToday()).filter(x => !x.done && x.time >= hm(new Date())).slice(0, 3); if (it.length) out.push(`오늘은 ${it.map(x => `${x.time} ${x.text}`).join(', ')}.`); }
  return out;
};
window.promptExtra = function (c) {
  const day = calToday(), it = itemsOn(day).map(x => `- ${x.time} ${x.text}${x.kind === 'rep' ? ' (매주)' : ''}${x.done ? ' (끝남)' : ''}`).join('\n') || '(없음)';
  const w = wxToday();
  const f = S.follow.filter(x => !x.asked).map(x => `- ${x.date}: ${x.q}`).join('\n') || '(없음)';
  return `[오늘 일정]\n${it}\n[날씨] ${w ? `${w.desc}, 최고 ${w.max}° 최저 ${w.min}°, 비 올 확률 ${w.pop}%` : '(모름)'}\n[나중에 물어볼 것]\n${f}`;
};

// ---------- 먼저 챙기기 (앱이 열려 있을 때) ----------
async function notifyOS(title, bodyText) {
  if (!S.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) reg.showNotification(title, { body: bodyText, icon: 'icon-192.png', tag: title }); else new Notification(title, { body: bodyText, icon: 'icon-192.png' }); } catch (e) {}
}
function remindLine(text, time) {
  const c = C || CH(S.pick ? S.pick.code : DATA.characters[0].code);
  const line = fillT(c.app.remind, { text, time });
  if (homeOn() && !document.hidden) say(line, 'sweat'); else toast(`${time} ${text}`);
  notifyOS(`${c.name}`, line);
}
function tick() {
  if (!DATA) return;
  const now = new Date(), day = calToday();
  // 10분 전 알림 (할 일 + 매주 일정)
  S.todos.forEach(t => {
    if (t.done || !t.due) return;
    const ms = new Date(t.due) - now;
    if (ms > 0 && ms <= 10 * 60e3 && !S.fired[t.id + ':pre']) { S.fired[t.id + ':pre'] = 1; remindLine(t.text, t.due.slice(11, 16)); }
    if (ms < -30 * 60e3 && !S.fired[t.id + ':late'] && homeOn() && !document.hidden) { S.fired[t.id + ':late'] = 1; say(fillT(C.app.late, { text: t.text }), 'angry'); }
  });
  itemsOn(day).filter(x => x.kind !== 'todo' && !x.done).forEach(x => {
    const ms = new Date(`${day}T${x.time}`) - now, k = `${x.id}:${day}`;
    if (ms > 0 && ms <= 10 * 60e3 && !S.fired[k]) { S.fired[k] = 1; remindLine(x.text, x.time); }
  });
  // 인터폰 모닝콜
  if (S.morning.on && S.mcDay !== day && !callOpen) {
    const at = new Date(`${day}T${S.morning.time}`), late = now - at;
    if (late >= 0 && late < 30 * 60e3 && !(S.snoozeUntil && now < S.snoozeUntil)) ring();
    else if (late >= 30 * 60e3) missCall(day);
  }
  // 오래된 알림 기록 정리
  const keys = Object.keys(S.fired); if (keys.length > 400) keys.slice(0, 200).forEach(k => delete S.fired[k]);
  save();
  if (homeOn()) renderHomeExtra();
}

// ---------- 인터폰 모닝콜 ----------
let callOpen = false, ringT = 0, ringN = 0;
const caller = () => CH(S.pick ? S.pick.code : DATA.characters[0].code);
function dingdong() {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    [[659.3, 0], [523.3, .45]].forEach(([f, t]) => {
      const o = AC.createOscillator(), g = AC.createGain(), at = AC.currentTime + t;
      o.type = 'triangle'; o.frequency.value = f; o.connect(g); g.connect(AC.destination);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.22, at + .02); g.gain.exponentialRampToValueAtTime(.001, at + 1.3);
      o.start(at); o.stop(at + 1.4);
    });
  } catch (e) {}
  try { navigator.vibrate && navigator.vibrate([300, 200, 300]); } catch (e) {}
}
function sceneOf(c, sl) { const sc = c.scenes[sl] || {}; return (isWide() && sc.wide && sc.wide.img) || sc.img || (c.outfits.find(o => o.default) || c.outfits[0]).cover; }
function ring() {
  const c = caller(); callOpen = true;
  $('callWho').textContent = `${c.floor}층 ${c.name}`;
  $('callUnit').textContent = `${c.floor}01호에서 왔어요`;
  $('callImg').src = sceneOf(c, 'morning');
  typeInto($('callLine'), '띵동, 띵동.', 'call');
  $('callAnswer').textContent = '받기'; $('callSnooze').hidden = false;
  $('call').hidden = false;
  ringN = 0; dingdong(); clearInterval(ringT); ringT = setInterval(() => { if (++ringN > 12) { clearInterval(ringT); return; } dingdong(); }, 4000);
  notifyOS('인터폰', `${c.name}이(가) 문 앞에 왔어요`);
  $('callAnswer').onclick = () => {
    if ($('callAnswer').dataset.done) { closeCall(); if (!(S.pick && S.pick.day === today())) { renderLift(); show('lift'); } return; }
    clearInterval(ringT); S.mcDay = calToday(); save();
    typeInto($('callLine'), fillT(pick(c.app.call)), 'call');
    $('callSnooze').hidden = true; $('callAnswer').textContent = '엘리베이터 타기'; $('callAnswer').dataset.done = '1';
  };
  $('callSnooze').onclick = () => {
    clearInterval(ringT); S.snoozeUntil = Date.now() + 5 * 60e3; save();
    typeInto($('callLine'), fillT(c.app.snooze), 'call'); setTimeout(closeCall, 1600);
  };
}
function closeCall() { clearInterval(ringT); callOpen = false; $('call').hidden = true; delete $('callAnswer').dataset.done; }
function missCall(day) {
  const c = caller(); S.mcDay = day;
  S.mail.push({ id: uid(), at: Date.now(), kind: 'missed', code: c.code, title: `못 받은 인터폰, ${S.morning.time}`, text: fillT(c.app.missed), read: false });
  if (S.mail.length > 60) S.mail = S.mail.slice(-60);
  save(); if (callOpen) closeCall();
}

// ---------- 날씨 (Open-Meteo, 키 없음) ----------
const WXN = c => c === 0 ? '맑음' : c <= 3 ? '구름 조금' : c <= 48 ? '흐림' : c <= 67 ? '비' : c <= 77 ? '눈' : c <= 82 ? '소나기' : c <= 86 ? '눈' : '뇌우';
async function fetchWx(force) {
  const w = S.wx; if (!w.on || w.lat == null) return;
  if (!force && w.data && Date.now() - w.at < 3 * 3600e3) return;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=2`);
    const j = await r.json();
    w.data = j.daily.time.map((d, i) => ({ d, code: j.daily.weather_code[i], max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]), pop: j.daily.precipitation_probability_max[i] || 0 }));
    w.at = Date.now(); save();
  } catch (e) {}
}
function wxToday() { const w = S.wx; if (!w.on || !w.data) return null; const d = w.data.find(x => x.d === calToday()); return d ? { ...d, desc: WXN(d.code) } : null; }

// ---------- 운세 · 일기 ----------
const ITEMS = ['딸기우유', '검정 볼펜', '접이식 우산', '이어폰', '따뜻한 국물', '손수건', '500원짜리 동전', '편의점 삼각김밥', '립밤', '보조배터리', '파란 양말', '민트 사탕'];
// 한 줄짜리 글 받기 (askJSON은 app.js — Gemini)
const TEXT = { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } };
const aiText = prompt => askJSON({ messages: [{ role: 'user', content: prompt }], schema: TEXT, maxTokens: 4096 });
const voiceOf = c => `너는 ${c.name}. 말투: ${c.speech?.register || ''}. 호칭: ${fill(c.speech?.address || '')}. 예시: ${Object.values(c.speech?.examples || {}).slice(0, 4).map(fill).join(' / ')}`;
async function makeFortune(c) {
  const key = `${calToday()}-${c.code}`; if (S.fortune[key]) return S.fortune[key];
  const rnd = seeded(key), stars = 2 + Math.floor(rnd() * 4), item = ITEMS[Math.floor(rnd() * ITEMS.length)];
  let f = { stars, item, text: fillT(c.app.fortune[Math.floor(rnd() * c.app.fortune.length)], { item }) };
  if (hasAI()) {
    try {
      const g = await aiText(`${voiceOf(c)}\n오늘(${dayLabel(calToday())}) 옆집 이웃 ${userName()}에게 오늘의 운세를 캐릭터 말투로 2~3문장. 별점 ${stars}개(5개 만점), 행운의 물건 "${item}"을 꼭 넣고, 일·사람·건강 중 하나를 짚어 줘. 이모지 금지.`);
      if (g.text) f.text = g.text;
    } catch (e) {}
  }
  S.fortune[key] = f; save(); return f;
}
function yesterday() { const d = new Date(Date.now() - S.dayStart * 36e5); d.setDate(d.getDate() - 1); return dk(d); }
async function makeDiary(day) {
  const h = S.hist[day]; if (!h) return null;
  const c = CH(h.code), key = `${day}-${h.code}`; if (S.diary[key]) return { c, text: S.diary[key] };
  let text = h.done.length ? fillT(c.app.diary, { n: h.done.length, list: h.done.slice(0, 4).join(', ') }) : fillT(c.app.diary_none);
  if (hasAI()) {
    try {
      const log = st(c.code).log.filter(m => dk(new Date(m.at)) === day).slice(-12).map(m => `${m.who === 'me' ? userName() : c.name}: ${m.text}`).join('\n');
      const g = await aiText(`${voiceOf(c)}\n${dayLabel(day)}에 옆집 이웃 ${userName()}의 비서를 하루 맡았다. 그날 밤 ${c.name}이 쓰는 짧은 일기를 1인칭으로 3~4문장. 속마음이 살짝 드러나게. 끝낸 일: ${h.done.join(', ') || '없음'}\n나눈 얘기:\n${log || '(별로 없음)'}\n이모지·제목 금지.`);
      if (g.text) text = g.text;
    } catch (e) {}
  }
  S.diary[key] = text; save(); return { c, text };
}

// ---------- 우편함 ----------
SHEETS.mail = {
  title: () => '우편함',
  sub: () => { const n = S.mail.filter(m => !m.read).length; return n ? `안 읽은 것 ${n}개` : '운세와 일기, 못 받은 인터폰이 여기 와요'; },
  tall: true,
  render() {
    const b = body(); b.innerHTML = ''; foot().innerHTML = '';
    // 오늘의 운세
    const fk = `${calToday()}-${C.code}`, f = S.fortune[fk];
    const fc = el('section', 'card fortune');
    fc.innerHTML = `<h3>오늘의 운세<small>${esc(C.name)}</small></h3>`;
    if (f) fc.insertAdjacentHTML('beforeend', `<p class="stars" aria-label="별 ${f.stars}개">${'★'.repeat(f.stars)}<i>${'★'.repeat(5 - f.stars)}</i></p><p class="voice">${esc(f.text)}</p><p class="lucky">행운의 물건<b>${esc(f.item)}</b></p>`);
    else { const x = el('button', 'btn', '운세 보기'); x.onclick = async () => { x.disabled = true; x.textContent = '보는 중…'; await makeFortune(C); refresh(); }; fc.appendChild(x); }
    b.appendChild(fc);
    // 어제의 일기
    const yd = yesterday(), h = S.hist[yd];
    if (h) {
      const c = CH(h.code), dc = el('section', 'card diary'), dtext = S.diary[`${yd}-${h.code}`];
      dc.innerHTML = `<h3>${esc(c.name)}의 일기<small>${dayLabel(yd)}</small></h3>`;
      if (dtext) dc.insertAdjacentHTML('beforeend', `<p class="voice">${esc(dtext)}</p>`);
      else { const x = el('button', 'btn ghost', '몰래 읽기'); x.onclick = async () => { x.disabled = true; x.textContent = '펼치는 중…'; await makeDiary(yd); refresh(); }; dc.appendChild(x); }
      b.appendChild(dc);
    }
    // 쪽지 (못 받은 인터폰 등)
    b.appendChild(el('h4', 'sub-h', '쪽지'));
    const ms = [...S.mail].reverse();
    if (!ms.length) b.appendChild(el('div', 'empty', '아직 온 쪽지가 없어요.'));
    ms.forEach(m => {
      const c = CH(m.code), d = new Date(m.at);
      const r = el('div', 'mailrow' + (m.read ? '' : ' new'));
      r.innerHTML = `<div class="mh"><b>${esc(c ? c.name : '관리사무소')}</b><small>${esc(m.title)}, ${d.getMonth() + 1}/${d.getDate()} ${hm(d)}</small></div><p class="voice">${esc(m.text)}</p>`;
      b.appendChild(r);
    });
    S.mail.forEach(m => m.read = true); save();
    setTimeout(() => { $('mailBadge').textContent = ''; }, 0);
  },
};

// ---------- 설정에 더하기: 모닝콜 · 알림 · 날씨 ----------
const baseSet = SHEETS.set.render;
SHEETS.set.render = function () {
  baseSet();
  const b = body(), reset = b.querySelector('.reset-all') || b.lastElementChild;
  const mc = el('div', 'field', '<b>인터폰 모닝콜</b>');
  const r1 = el('div', 'row'), on = el('input'), tm = el('input', 'in tm-in');
  on.type = 'checkbox'; on.id = 'mcOn'; on.checked = S.morning.on; tm.type = 'time'; tm.id = 'mcTime'; tm.value = S.morning.time;
  const lab = el('label', 'sw', '쓰기'); lab.prepend(on);
  on.onchange = () => { S.morning.on = on.checked; S.mcDay = ''; save(); toast(on.checked ? `매일 ${S.morning.time}에 인터폰이 울려요` : '모닝콜을 껐어요'); };
  tm.onchange = () => { if (tm.value) { S.morning.time = tm.value; S.mcDay = ''; save(); } };
  r1.append(lab, tm); mc.append(r1, el('p', 'hint', '전날 고른 비서가 인터폰으로 깨워 줘요. 앱이 열려 있을 때 울리고, 30분 안에 못 받으면 우편함에 쪽지를 남겨요.'));
  const nf = el('div', 'field', '<b>알림</b>');
  const on2 = el('input'); on2.type = 'checkbox'; on2.id = 'nfOn'; on2.checked = S.notify;
  const lab2 = el('label', 'sw', '일정 10분 전 알림을 폰 알림으로도 받기'); lab2.prepend(on2);
  on2.onchange = async () => {
    if (on2.checked && 'Notification' in window) { const p = await Notification.requestPermission(); if (p !== 'granted') { on2.checked = false; toast('폰 설정에서 이 앱의 알림을 허용해 주세요'); return; } }
    S.notify = on2.checked; save();
  };
  nf.append(lab2, el('p', 'hint', '앱이 백그라운드에 열려 있을 때까지만 와요. 앱을 완전히 닫아도 오게 하려면 알림 서버가 필요해요(다음 단계).'));
  const wx = el('div', 'field', '<b>날씨</b>');
  const on3 = el('input'); on3.type = 'checkbox'; on3.id = 'wxOn'; on3.checked = S.wx.on;
  const lab3 = el('label', 'sw', '지금 있는 곳 날씨를 인사와 대화에 넣기'); lab3.prepend(on3);
  on3.onchange = () => {
    if (!on3.checked) { S.wx.on = false; save(); return; }
    if (!navigator.geolocation) { on3.checked = false; toast('이 기기는 위치를 쓸 수 없어요'); return; }
    navigator.geolocation.getCurrentPosition(p => {
      S.wx = { ...S.wx, on: true, lat: +p.coords.latitude.toFixed(2), lon: +p.coords.longitude.toFixed(2) }; save();
      fetchWx(true).then(() => { const w = wxToday(); toast(w ? `오늘 ${w.desc}, ${w.min}°~${w.max}°` : '날씨를 켰어요'); });
    }, () => { on3.checked = false; toast('위치 권한을 허용해 주세요'); }, { timeout: 10000 });
  };
  wx.append(lab3, el('p', 'hint', '위치는 대략적인 좌표(소수점 둘째 자리)만 이 폰에 저장하고, 날씨 조회(Open-Meteo)에만 써요.'));
  b.insertBefore(mc, reset); b.insertBefore(nf, reset); b.insertBefore(wx, reset);
};

// ---------- 기분 스티커 ----------
const STK = { happy: 'heart', sweat: 'sweat', angry: 'anger', sparkle: 'sparkle', sleepy: 'zzz', confused: 'question' };
window.popSticker = function (mood) {
  const n = STK[mood]; if (!n || !homeOn()) return;
  const i = el('img', 'pop'); i.src = `assets/ui/st_${n}.webp`; i.alt = '';
  i.style.left = (innerWidth * (isWide() ? .56 + Math.random() * .1 : .58 + Math.random() * .2)) + 'px';
  i.style.top = (innerHeight * (.2 + Math.random() * .1)) + 'px';
  $('home').appendChild(i); setTimeout(() => i.remove(), 1800);
};

// ---------- 시작 ----------
const start = () => { fetchWx(); tick(); setInterval(tick, 15e3); };
if (document.readyState === 'complete') setTimeout(start, 800); else addEventListener('load', () => setTimeout(start, 800));
document.addEventListener('visibilitychange', () => { if (!document.hidden) { fetchWx(); tick(); } });
// 할 일 하나 끝낼 때 칭찬에 반짝이 스티커
const baseToggle = toggleTodo;
toggleTodo = function (id, quiet) { const t = S.todos.find(x => x.id === id), was = t && t.done; baseToggle(id, quiet); if (t && !was && t.done) popSticker('sparkle'); };
})();
