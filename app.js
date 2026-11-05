// 한울아파트 비서 앱 — 1단계 뼈대
// 매일 아침 엘리베이터에서 오늘의 비서(층)를 고르고, 그 캐릭터와 할 일·대화·옷장을 쓴다.
'use strict';

const $ = id => document.getElementById(id);
const pick = a => a[Math.random() * a.length | 0];
const pad = n => String(n).padStart(2, '0');
const WD = '일월화수목금토';
const KEY = 'hanul-v1';

// ---------------- 저장 ----------------
const S = Object.assign({
  me: '',            // 내 이름
  key: '',           // Gemini 키 (이 폰에만)
  dayStart: 5,       // 하루가 바뀌는 시각
  pick: null,        // {day, code}
  todos: [],         // [{id, text, done, day, doneDay}]
  memory: [],        // [{text, at}] — 5명이 함께 씀
  ch: {},            // code -> {aff, hearts, owned:[], wear:{day, code}|null, auto:true, log:[]}
}, load());
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

let DATA = null, C = null; // C = 오늘의 캐릭터 데이터

// ---------------- 날짜 ----------------
function today() { const d = new Date(Date.now() - S.dayStart * 36e5); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function nowText() { const d = new Date(); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
const uid = () => Math.random().toString(36).slice(2, 8);

// ---------------- 캐릭터 상태 ----------------
function st(code) {
  const c = DATA.characters.find(x => x.code === code);
  if (!S.ch[code]) S.ch[code] = { aff: c.affection.start, hearts: 0, owned: [], wear: null, auto: true, log: [] };
  return S.ch[code];
}
const userName = () => S.me || '이웃';
const fill = t => String(t).replace(/\{user\}/g, userName());

function stageOf(c) {
  const a = st(c.code).aff, s = c.affection.stages || [];
  const i = a < 60 ? 0 : a < 120 ? 1 : a < 180 ? 2 : a < 240 ? 3 : 4;
  return s[Math.min(i, s.length - 1)] || '';
}

// 시간대에 따라 자동으로 입는 옷
function timeOutfit(c) {
  const rules = c.app.outfit_by_time || {}, d = new Date(), h = d.getHours(), wk = d.getDay() > 0 && d.getDay() < 6;
  for (const [code, r] of Object.entries(rules)) {
    if (r.weekday && !wk) continue;
    const inRange = r.from <= r.to ? h >= r.from && h < r.to : h >= r.from || h < r.to;
    if (inRange) return code;
  }
  return c.app.default_outfit || (c.outfits.find(o => o.default) || c.outfits[0]).code;
}
function freeOutfits(c) { return new Set([...(c.outfits.filter(o => o.default).map(o => o.code)), ...Object.keys(c.app.outfit_by_time || {}), c.app.default_outfit].filter(Boolean)); }
const owns = (c, code) => freeOutfits(c).has(code) || st(c.code).owned.includes(code);
function wearing(c) {
  const s = st(c.code);
  if (s.wear && s.wear.day === today() && owns(c, s.wear.code)) return c.outfits.find(o => o.code === s.wear.code);
  return c.outfits.find(o => o.code === timeOutfit(c));
}

// ---------------- 화면 전환 ----------------
function show(id) { document.querySelectorAll('.screen').forEach(e => e.classList.toggle('on', e.id === id)); }
async function doors(fn) {
  const d = $('doors'); d.classList.add('shut'); await sleep(600); fn(); await sleep(150); d.classList.remove('shut');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let toastT;
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2200); }

// ---------------- 소리 ----------------
let AC;
function ding() {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    [[1318.5, 0], [1046.5, .22]].forEach(([f, t]) => {
      const o = AC.createOscillator(), g = AC.createGain(), at = AC.currentTime + t;
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(AC.destination);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.18, at + .01); g.gain.exponentialRampToValueAtTime(.001, at + 1.1);
      o.start(at); o.stop(at + 1.2);
    });
  } catch (e) {}
}

// ---------------- 엘리베이터 ----------------
function renderLift() {
  const d = new Date();
  $('liftDate').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일`;
  $('meRow').style.display = S.me ? 'none' : '';
  const box = $('floors'); box.innerHTML = '';
  [...DATA.characters].sort((a, b) => b.floor - a.floor).forEach(c => {
    const o = c.outfits.find(x => x.default) || c.outfits[0];
    const b = document.createElement('button'); b.className = 'fl';
    const picked = S.pick && S.pick.day === today() && S.pick.code === c.code;
    b.innerHTML = `<span class="btn">${c.floor}</span><span class="face"></span><span class="txt"><b>${c.name}</b><small>${c.temperature} · ${c.job.split(' (')[0]}</small></span>${picked ? '<span class="today">오늘</span>' : ''}`;
    const f = b.querySelector('.face');
    if (o.cover) { f.style.backgroundImage = `url(${o.cover})`; f.style.backgroundPosition = `${o.focus}% 18%`; }
    b.onclick = () => choose(c, b);
    box.appendChild(b);
  });
  $('ledNum').textContent = S.pick && S.pick.day === today() ? DATA.characters.find(x => x.code === S.pick.code).floor : 1;
}
let busy = false;
async function choose(c, el) {
  if (busy) return; busy = true;
  const nm = $('meName').value.trim(); if (nm) { S.me = nm; }
  el.classList.add('lit');
  // 층 표시가 올라간다
  const led = $('ledNum'); let f = +led.textContent || 1; const dir = c.floor >= f ? 1 : -1;
  $('ledArrow').textContent = dir > 0 ? '▲' : '▼';
  while (f !== c.floor) { f += dir; led.textContent = f; await sleep(f === c.floor ? 0 : 160); }
  ding();
  const first = !(S.pick && S.pick.day === today() && S.pick.code === c.code);
  S.pick = { day: today(), code: c.code }; save();
  await doors(() => { enter(c.code); show('home'); });
  el.classList.remove('lit'); busy = false;
  if (first) say(fill(pick(c.app.greet)));
}
function openLift() { renderLift(); doors(() => show('lift')); }

// ---------------- 메인 ----------------
function enter(code) {
  C = DATA.characters.find(x => x.code === code);
  document.documentElement.style.setProperty('--accent', C.app.color || '#6f8cff');
  renderHome();
  const last = st(code).log.filter(m => m.who === 'her').pop();
  if (last) setBubble(last.text);
}
function renderHome(cut) {
  const s = st(C.code), o = wearing(C);
  $('hudFloor').textContent = `${C.floor}F`;
  $('hudName').textContent = C.name;
  $('hudTemp').textContent = `${o.emoji || ''} ${o.name} · ${stageOf(C)}`;
  $('hudAff').textContent = `♥ ${s.aff}`;
  $('hudHeart').textContent = `👗 하트 ${s.hearts}`;
  $('bubName').textContent = C.name;
  const src = cut && o.cuts && o.cuts.includes(cut) ? `assets/${C.code}/${o.code}/${pad(cut)}.webp` : o.cover;
  setBg(src, o.focus);
  const left = S.todos.filter(t => !t.done).length;
  $('todoBadge').textContent = left || '';
}
function setBg(src, focus) {
  const bg = $('bg');
  bg.style.objectPosition = `${focus || 50}% 30%`;
  if (!src) { bg.removeAttribute('src'); bg.style.background = `radial-gradient(circle at 50% 35%, ${C.app.color}55, #000 70%)`; return; }
  if (bg.getAttribute('src') === src) return;
  bg.classList.add('fade');
  const im = new Image(); im.onload = () => { bg.src = src; bg.classList.remove('fade'); }; im.src = src;
}
function setBubble(t) { $('bubText').textContent = t; }
// 말하기: 말풍선 + 대화 기록
function say(text, cut) {
  setBubble(text);
  st(C.code).log.push({ who: 'her', text, at: Date.now() }); trimLog(); save();
  if (cut) renderHome(cut);
  if (sheetOpen === 'chat') renderChat();
}
function trimLog() { const s = st(C.code); if (s.log.length > 60) s.log = s.log.slice(-60); }

// ---------------- 시트 ----------------
let sheetOpen = null;
const SHEETS = {};
function openSheet(name) {
  sheetOpen = name; const sh = SHEETS[name];
  $('sheetTitle').textContent = sh.title(); $('sheetSub').textContent = sh.sub ? sh.sub() : '';
  $('sheet').classList.toggle('tall', !!sh.tall);
  foot().innerHTML = ''; sh.render(); $('sheet').classList.add('on'); $('scrim').classList.add('on');
  if (sh.focus) setTimeout(sh.focus, 320);
}
function closeSheet() { sheetOpen = null; $('sheet').classList.remove('on'); $('scrim').classList.remove('on'); renderHome(); }
function refresh() { if (!sheetOpen) return; const sh = SHEETS[sheetOpen]; $('sheetSub').textContent = sh.sub ? sh.sub() : ''; sh.render(); }
const body = () => $('sheetBody'), foot = () => $('sheetFoot');
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ----- 할 일 -----
function cleanTodos() { const d = today(); S.todos = S.todos.filter(t => !t.done || t.doneDay === d); }
SHEETS.todo = {
  title: () => '할 일',
  sub: () => { const a = S.todos.filter(t => !t.done).length; return a ? `남은 것 ${a}개 · 끝내면 하트 1개` : '오늘 거 끝!'; },
  render() {
    const b = body(); b.innerHTML = '';
    if (!S.todos.length) b.appendChild(el('div', 'empty', `아직 없어요. ${C.name}에게 오늘 할 일을 알려 주세요.`));
    [...S.todos].sort((x, y) => x.done - y.done).forEach(t => {
      const r = el('div', 'todo' + (t.done ? ' done' : ''), `<button class="ck" aria-label="완료">${t.done ? '✓' : ''}</button><span>${esc(t.text)}</span><button class="del" aria-label="지우기">✕</button>`);
      r.querySelector('.ck').onclick = () => toggleTodo(t.id);
      r.querySelector('.del').onclick = () => { S.todos = S.todos.filter(x => x.id !== t.id); save(); refresh(); };
      b.appendChild(r);
    });
    const f = foot(); f.innerHTML = '';
    const row = el('div', 'row'), i = el('input', 'in'); i.placeholder = '할 일 추가'; i.enterKeyHint = 'done';
    const add = el('button', 'btn', '추가');
    const go = () => { const v = i.value.trim(); if (!v) return; addTodo(v); i.value = ''; i.focus(); };
    add.onclick = go; i.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) go(); };
    row.append(i, add); f.appendChild(row);
  },
};
function addTodo(text) { S.todos.push({ id: uid(), text, done: false, day: today() }); save(); refresh(); renderHome(); }
function toggleTodo(id, quiet) {
  const t = S.todos.find(x => x.id === id); if (!t) return;
  t.done = !t.done; t.doneDay = t.done ? today() : null;
  const s = st(C.code);
  if (t.done) {
    s.hearts += 1; s.aff = Math.min(C.affection.range[1], s.aff + 2);
    const left = S.todos.filter(x => !x.done).length;
    if (left === 0) allDone(); else if (!quiet) say(fill(pick(C.app.praise)));
  } else { s.hearts = Math.max(0, s.hearts - 1); s.aff = Math.max(C.affection.range[0], s.aff - 2); }
  save(); refresh(); renderHome();
}
// 다 끝내면: 보너스 하트 + 보상 의상으로 갈아입기
function allDone() {
  const s = st(C.code); s.hearts += 2;
  const cur = wearing(C).code;
  const reward = C.outfits.filter(o => o.cover && o.code !== cur && owns(C, o.code) && !freeOutfits(C).has(o.code));
  if (reward.length) { const o = pick(reward); s.wear = { day: today(), code: o.code }; toast(`보상 의상: ${o.emoji || ''} ${o.name}`); }
  else toast('오늘 할 일 끝! 하트 +2');
  say(fill(pick(C.app.alldone)));
}

// ----- 옷장 -----
SHEETS.closet = {
  title: () => `${C.name}의 옷장`,
  sub: () => `👗 하트 ${st(C.code).hearts}개 · 할 일을 끝내면 모여요`,
  tall: true,
  render() {
    const b = body(), s = st(C.code), cur = wearing(C); b.innerHTML = ''; foot().innerHTML = '';
    const auto = el('button', 'btn ghost auto', s.wear && s.wear.day === today() ? '🕘 시간대에 맞춰 입기로 돌아가기' : '🕘 지금은 시간대에 맞춰 입는 중');
    auto.onclick = () => { s.wear = null; save(); refresh(); renderHome(); };
    b.appendChild(auto);
    const g = el('div', 'grid');
    C.outfits.forEach(o => {
      const own = owns(C, o.code), on = cur.code === o.code;
      const card = el('button', 'oc' + (on ? ' on' : ''));
      const ph = el('div', 'ph' + (own ? '' : ' lock'), o.cover ? '' : (o.emoji || '👗'));
      if (o.cover) { ph.style.backgroundImage = `url(${o.cover})`; ph.style.backgroundPosition = `${o.focus}% 30%`; }
      const state = on ? '입는 중' : own ? (o.cover ? '입기' : '그림 준비 중') : `🔒 하트 ${o.cost}개`;
      card.append(ph, el('div', 'meta', `<b>${o.emoji || ''} ${esc(o.name)}</b><small>${esc(o.use || '')}</small>`), el('span', 'tag', state));
      card.onclick = () => {
        if (on) return;
        if (!own) {
          if (s.hearts < o.cost) { toast(`하트가 ${o.cost - s.hearts}개 더 필요해요`); return; }
          s.hearts -= o.cost; s.owned.push(o.code); save(); toast(`${o.name} 열었어요!`);
        }
        if (o.cover) { s.wear = { day: today(), code: o.code }; save(); renderHome(); }
        refresh();
      };
      g.appendChild(card);
    });
    b.appendChild(g);
  },
};

// ----- 대화 -----
SHEETS.chat = {
  title: () => C.name,
  sub: () => (S.key ? 'Gemini 연결됨' : '키 없음 · 설정에서 Gemini 키를 넣으면 진짜 대화'),
  tall: true,
  render: renderChat,
  focus: () => { const i = document.querySelector('#sheetFoot .in'); if (i && !matchMedia('(pointer:coarse)').matches) i.focus(); },
};
function renderChat() {
  const b = body(); b.innerHTML = '';
  const log = el('div', 'log');
  const msgs = st(C.code).log.slice(-40);
  if (!msgs.length) log.appendChild(el('div', 'msg sys', '여기서 나눈 얘기는 이 폰에만 저장돼요.'));
  msgs.forEach(m => log.appendChild(el('div', 'msg ' + m.who, esc(m.text))));
  if (thinking) log.appendChild(el('div', 'msg her wait', '…'));
  b.appendChild(log); b.scrollTop = b.scrollHeight;
  if (foot().childElementCount) return;
  const row = el('div', 'row'), i = el('input', 'in'); i.placeholder = `${C.name}에게 말하기`; i.enterKeyHint = 'send';
  const mic = el('button', 'btn ghost mic', '🎤'), sendB = el('button', 'btn', '보내기');
  const go = () => { const v = i.value.trim(); if (!v || thinking) return; i.value = ''; send(v); };
  sendB.onclick = go; i.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) go(); };
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) mic.onclick = () => listen(SR, i, mic); else mic.style.display = 'none';
  row.append(mic, i, sendB); foot().appendChild(row);
}
function listen(SR, input, btn) {
  const r = new SR(); r.lang = 'ko-KR'; r.interimResults = true;
  btn.classList.add('on');
  r.onresult = e => { input.value = [...e.results].map(x => x[0].transcript).join(''); };
  r.onend = () => { btn.classList.remove('on'); if (input.value.trim()) { const v = input.value.trim(); input.value = ''; send(v); } };
  r.onerror = () => { btn.classList.remove('on'); toast('마이크를 쓸 수 없어요. 권한을 확인해 주세요.'); };
  r.start();
}

let thinking = false;
async function send(text) {
  const s = st(C.code);
  s.log.push({ who: 'me', text, at: Date.now() }); trimLog(); save();
  if (!S.key) { renderChat(); await sleep(500); say(fill(pick([...C.app.greet, ...C.app.praise]))); setTimeout(() => toast('설정에서 Gemini 키를 넣으면 진짜로 대화해요'), 400); return; }
  thinking = true; renderChat();
  try {
    const r = await gemini(C, s.log);
    thinking = false;
    applyActions(r.actions || []);
    say(r.say || '…', r.cut);
  } catch (e) {
    thinking = false; renderChat();
    toast(e.message || '연결이 안 됐어요');
  }
}

// ---------------- Gemini ----------------
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const CUTS = () => DATA.world.cut_numbers.common_01_29;
function sysPrompt(c) {
  const sp = c.speech || {}, o = wearing(c);
  const todos = S.todos.map(t => `- [${t.done ? 'x' : ' '}] (${t.id}) ${t.text}`).join('\n') || '(없음)';
  const mem = S.memory.slice(-30).map(m => `- ${m.text}`).join('\n') || '(없음)';
  const ex = Object.entries(sp.examples || {}).map(([k, v]) => `  ${k}: ${fill(v)}`).join('\n');
  return `너는 「${c.name}」이다. 한울아파트 ${c.floor}층에 사는 ${c.age}세, ${c.job}.
사용자는 옆집 이웃 「${userName()}」이다. 오늘 하루 너는 ${userName()}의 비서를 맡았다(매일 아침 5명 중 한 명을 고르는 앱, 오늘은 너).

[세계관] ${DATA.world.era}. ${DATA.world.genre_rule}.
[성격] ${(c.personality || []).join(' / ')}
[결핍] ${c.lack || ''}
[좋아함] ${(c.likes || []).join(', ')} / [싫어함] ${(c.dislikes || []).join(', ')}
[관계] ${c.relationship_to_user || ''} · 현재 단계: ${stageOf(c)} (호감도 ${st(c.code).aff})
[말투] ${sp.register || ''} / 호칭: ${fill(sp.address || '')}
${(sp.patterns || []).map(p => '- ' + fill(p)).join('\n')}
[욕] ${sp.swearing || ''}
[예시]
${ex}
[금지] ${[...(sp.forbidden || []), ...(c.rules || [])].join(' / ')}
[비서 스타일] ${c.app.assistant}

[지금] ${nowText()} · 입은 옷: ${o.name}
[오늘 할 일]
${todos}
[기억하는 것 (5명이 함께 앎)]
${mem}

규칙:
- 반드시 캐릭터 말투로, 1~3문장. 메신저처럼 짧게. 지문·괄호 서술·이모지 남발 금지.
- 성적 묘사 금지. 순애 톤 유지. 사용자가 진심으로 싫어하면 바로 물러난다.
- 할 일을 새로 말하면 actions에 {"type":"add_todo","text":"..."}. 끝냈다고 하면 {"type":"done_todo","id":"할 일 id"}.
- 사용자에 대해 오래 기억할 만한 사실(이름, 일정, 취향)은 {"type":"remember","text":"..."}.
- cut은 지금 표정에 맞는 번호(1~29): ${CUTS().map((n, i) => `${i + 1}${n}`).join(', ')}. 17~20은 실제 스킨십일 때만, 26~29는 실제로 술 마실 때만.`;
}
async function gemini(c, log) {
  const contents = log.slice(-16).map(m => ({ role: m.who === 'me' ? 'user' : 'model', parts: [{ text: m.text }] }));
  while (contents.length && contents[0].role !== 'user') contents.shift();
  const body = {
    systemInstruction: { parts: [{ text: sysPrompt(c) }] },
    contents,
    generationConfig: {
      temperature: 1, maxOutputTokens: 600, responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT', required: ['say'],
        properties: {
          say: { type: 'STRING' }, cut: { type: 'INTEGER' },
          actions: { type: 'ARRAY', items: { type: 'OBJECT', required: ['type'], properties: { type: { type: 'STRING', enum: ['add_todo', 'done_todo', 'remember'] }, text: { type: 'STRING' }, id: { type: 'STRING' } } } },
        },
      },
    },
    safetySettings: ['HARASSMENT', 'HATE_SPEECH', 'SEXUALLY_EXPLICIT', 'DANGEROUS_CONTENT'].map(k => ({ category: 'HARM_CATEGORY_' + k, threshold: 'BLOCK_ONLY_HIGH' })),
  };
  let lastErr;
  for (const m of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(S.key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 404) { lastErr = new Error('모델을 찾지 못했어요'); continue; }
    if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error('키가 맞지 않아요. 설정에서 확인해 주세요.');
    if (r.status === 429) throw new Error('오늘 무료 사용량을 다 썼어요. 잠시 후에 다시.');
    if (!r.ok) { lastErr = new Error('연결이 불안정해요'); continue; }
    const j = await r.json();
    const t = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts.map(p => p.text || '').join('');
    if (!t) throw new Error('대답이 막혔어요. 다르게 말해 볼래요?');
    try { return JSON.parse(t); } catch (e) { return { say: t }; }
  }
  throw lastErr || new Error('연결이 안 됐어요');
}
function applyActions(list) {
  list.forEach(a => {
    if (a.type === 'add_todo' && a.text) { S.todos.push({ id: uid(), text: a.text, done: false, day: today() }); toast(`할 일 추가: ${a.text}`); }
    if (a.type === 'done_todo' && a.id) { const t = S.todos.find(x => x.id === a.id && !x.done); if (t) toggleTodo(t.id, true); }
    if (a.type === 'remember' && a.text) { S.memory.push({ text: a.text, at: Date.now() }); if (S.memory.length > 50) S.memory.shift(); }
  });
  save(); renderHome();
}

// ----- 설정 -----
SHEETS.set = {
  title: () => '설정',
  sub: () => '모두 이 폰에만 저장돼요',
  render() {
    const b = body(); b.innerHTML = ''; foot().innerHTML = '';
    const f1 = el('div', 'field', '<b>내 이름</b>'), n = el('input', 'in'); n.value = S.me; n.placeholder = '캐릭터가 부를 이름';
    n.onchange = () => { S.me = n.value.trim(); save(); };
    f1.appendChild(n);
    const f2 = el('div', 'field', '<b>Gemini 키 (대화용)</b>'), k = el('input', 'in'); k.type = 'password'; k.value = S.key; k.placeholder = 'AIza…'; k.autocomplete = 'off';
    k.onchange = () => { S.key = k.value.trim(); save(); toast(S.key ? '키를 저장했어요' : '키를 지웠어요'); };
    f2.append(k, el('p', 'hint', '<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>에서 무료로 받을 수 있어요. 키는 이 폰에만 저장되고 Google에만 보내져요.'));
    const f3 = el('div', 'field', '<b>하루가 바뀌는 시각</b>'), sel = el('select');
    [3, 4, 5, 6, 7].forEach(h => { const o = el('option', null, `새벽 ${h}시`); o.value = h; if (h === S.dayStart) o.selected = true; sel.appendChild(o); });
    sel.onchange = () => { S.dayStart = +sel.value; save(); };
    f3.append(sel, el('p', 'hint', '이 시각이 지나고 앱을 열면 "오늘은 누구로 할래?"를 다시 물어요.'));
    const f4 = el('div', 'field', `<b>기억하는 것 (${S.memory.length})</b>`);
    if (!S.memory.length) f4.appendChild(el('p', 'hint', '대화하다 보면 캐릭터들이 기억해 둬요.'));
    S.memory.slice().reverse().forEach(m => { const r = el('div', 'todo', `<span>${esc(m.text)}</span><button class="del" aria-label="잊기">✕</button>`); r.querySelector('.del').onclick = () => { S.memory = S.memory.filter(x => x !== m); save(); refresh(); }; f4.appendChild(r); });
    const reset = el('button', 'btn ghost', '모든 기록 지우기');
    reset.onclick = () => { if (confirm('할 일, 대화, 하트, 옷장 기록을 모두 지울까요?')) { localStorage.removeItem(KEY); location.reload(); } };
    b.append(f1, f2, f3, f4, reset);
  },
};

// ---------------- 시작 ----------------
async function init() {
  DATA = await (await fetch('data/characters.json')).json();
  cleanTodos(); save();
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openSheet(b.dataset.open));
  $('btnLift').onclick = $('hudFloor').onclick = openLift;
  $('sheetX').onclick = $('scrim').onclick = closeSheet;
  $('bubble').onclick = () => openSheet('chat');
  if (S.pick && S.pick.day === today()) { enter(S.pick.code); show('home'); }
  else { renderLift(); show('lift'); }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
// 앱을 켜 둔 채 하루가 바뀌면 다시 묻는다
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !DATA) return;
  cleanTodos();
  if (!(S.pick && S.pick.day === today()) && $('home').classList.contains('on')) { closeSheet(); renderLift(); show('lift'); }
});
init();
