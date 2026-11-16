// 한울아파트 — 남수현 전화
// 매일 정한 시각(기본 밤 11:30)에 앱이 켜져 있는 기기에서 남수현이 전화를 건다. 받을 때까지 울린다.
// 받으면 수현이 세 가지를 묻는다:
//   - "지금 일어날게"  → 오늘은 더 안 건다
//   - "공부할게"       → 전화를 끊고 바로 집중 타이머(공부 화면)를 띄운다
//   - "한 번 더 전화해" → 5분 뒤에 다시 건다
// 거절하면 5분 뒤에 다시 건다.
// 밤 전화에서는 받자마자 오늘 공부한 시간(과목별)과 내일 시험/D-day를 짧게 정리해 준다.
// 시험 날 아침에는 따로 한 번 더 건다(기본 06:40): 오늘 시험 과목·교시를 알려 주고 준비물을 챙기라고 한다.
// 벨소리: 기본은 앱이 만든 벨소리, 설정에서 내 기기에 있는 음악 파일(예: 컬러링으로 쓰는 노래)을 골라 쓸 수 있다.
// 웹앱이라 앱을 완전히 닫으면 못 건다. 앱을 내려 둔(백그라운드) 상태면 울린다: 폰이 앱을 재우지 않게 아주 작은 소리를 틀어 두고,
// 울릴 때는 벨소리와 폰 알림으로 알린다. 앱이 앞에 있으면 시간 10분 전부터 화면이 꺼지지 않게 잡아 둔다.
// 전화 상태(오늘 받았는지, 다음 전화 시각)는 기기마다 따로 둔다.
'use strict';
(() => {
const ST_KEY = 'hanul-ncall';           // 이 기기의 전화 상태 {day, done, nextAt}
const DB = 'hanul-files', STORE = 'f';  // 벨소리 파일
const NS = () => DATA && DATA.characters.find(c => c.code === 'ns');
// 전화 종류: night(매일 밤) / exam(시험 날 아침). 상태는 종류마다 따로 둔다
const KEYS = { night: ST_KEY, exam: ST_KEY + '-exam' };
let kind = 'night';
const readSt = (k = kind) => { try { return JSON.parse(localStorage.getItem(KEYS[k])) || {}; } catch (e) { return {}; } };
const writeSt = (o, k = kind) => { try { localStorage.setItem(KEYS[k], JSON.stringify(o)); } catch (e) {} };
if (!S.ncall) S.ncall = { on: true, time: '23:30', tone: '', v: 2 };
// 처음에 오전 11:30으로 잘못 넣었던 것을 밤 11:30으로 고친다 (직접 바꾼 시각은 그대로)
if (S.ncall.v !== 2) { if (S.ncall.time === '11:30') S.ncall.time = '23:30'; S.ncall.v = 2; save(); }

// 수현 대사 ({me}: 내 이름)
const L = {
  hello: ['…야. 받았네. {time}이다, {time}.', '야, 자냐? 목소리 왜 그래. {time}이거든.', '받는 데 왜 이렇게 오래 걸려. 그니까, {time}이라고.'],
  ask: '그래서. 지금 일어날 거야, 공부할 거야, 아니면 5분 더 자고 내가 또 걸어?',
  wake: ['오케이. 물 한 잔 마시고 씻어. 끊는다.', '진짜지? 다시 누우면 죽는다. 끊어.', '그니까 처음부터 그렇게 일어나면 되잖아. 끊는다.'],
  study: ['오, 웬일. 타이머 켜 줄 테니까 바로 앉아.', '진짜? 그럼 지금 켠다. 50분, 딴짓하면 안다.'],
  again: ['…5분. 딱 5분이다. 다시 건다.', '하. 알았어. 5분 뒤에 또 건다, 안 받으면 문 두드린다.'],
  decline: '…안 받냐. 5분 뒤에 또 건다.',
  // 시험 날 아침
  xhello: ['야, 일어났냐. 오늘 시험이다.', '…받았네. 오늘 시험 날인 거 알지.', '일어나. 오늘 시험이다, 시험.'],
  xask: '일어났으면 일어났다고 해. 아니면 5분 뒤에 또 건다.',
  xwake: ['오케이. 아침 먹고 가. 머리 안 돌아간다.', '잘 보고 와. …긴장하지 말고. 끊는다.', '필통 다시 확인하고. 끊어.'],
  xpack: ['필통, 학생증, 컴싸 챙겨.', '컴싸랑 수정테이프 두 개씩 챙겨. 하나는 꼭 안 나온다.', '시계 챙겨. 교실 시계 믿지 마.'],
};
const dur = m => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`);
// 밤 전화: 오늘 공부 정리 + 내일
function nightSummary(day) {
  const subs = Object.entries((S.slogSub || {})[day] || {}).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
  const total = ((S.slog || {})[day]) || subs.reduce((a, [, m]) => a + m, 0);
  let t;
  if (!total) t = '근데 오늘 공부 기록 0분이던데. …진짜냐.';
  else {
    const top = subs.slice(0, 3).map(([n, m]) => `${n} ${dur(m)}`).join(', ');
    t = `오늘 ${top || '공부'}${subs.length > 3 ? ' 그리고 더' : ''}. 다 합치면 ${dur(total)}. ` + (total >= 240 ? '…오늘 진짜 많이 했네.' : total >= 120 ? '꽤 했네.' : total >= 60 ? '나쁘지 않아. 근데 더 할 수 있잖아.' : '그니까, 좀 더 해.');
  }
  // 내일 시험이 있으면 그것, 아니면 다음 시험 D-day
  const tm = new Date(day + 'T12:00:00'); tm.setDate(tm.getDate() + 1);
  const tk = `${tm.getFullYear()}-${pad(tm.getMonth() + 1)}-${pad(tm.getDate())}`;
  const ex = window.examDays ? examDays().find(d => d.date === tk) : null;
  if (ex) t += ` 내일 ${ex.exams.map(x => `${x.period}교시 ${x.name}`).join(', ')} 시험이다.`;
  else { const n = window.nextExamInfo && nextExamInfo(); if (n && n.n > 0) t += ` ${n.subject}까지 D-${n.n}.`; }
  return t;
}
function examToday(day) { return window.examDays ? examDays().find(d => d.date === day) || null : null; }
const line = (k, o) => { const t = Array.isArray(L[k]) ? pick(L[k]) : L[k]; return t.replace(/\{(\w+)\}/g, (x, key) => (o && o[key] != null ? o[key] : x)); };
const timeWord = hm => { const [h, m] = hm.split(':').map(Number); const ap = h < 6 ? '새벽' : h < 12 ? '오전' : h < 18 ? '오후' : '밤', hh = h % 12 || 12; return `${ap} ${hh}시${m ? ` ${m === 30 ? '반' : m + '분'}` : ''}`; };

// ---------- 화면 ----------
const v = document.createElement('section');
v.id = 'ncall'; v.className = 'ncall'; v.hidden = true;
v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', '남수현 전화');
v.innerHTML = `
  <img class="nc-bg" alt="">
  <div class="nc-top">
    <div class="nc-ava"><img alt=""></div>
    <b class="nc-name">남수현</b>
    <small class="nc-sub">휴대전화 · 11층 마주 보는 집</small>
    <span class="nc-state">전화 왔어요</span>
  </div>
  <div class="nc-ytbox" hidden><small>컬러링</small><div class="nc-yt"></div></div>
  <p class="nc-line" aria-live="polite"></p>
  <div class="nc-choices" hidden></div>
  <div class="nc-keys">
    <button class="nc-no" aria-label="거절"><svg viewBox="0 0 24 24"><path d="M3 15.5c5-4.6 13-4.6 18 0l-2.3 2.6-3.6-1.6v-2.6c-2-.7-4.2-.7-6.2 0v2.6l-3.6 1.6z"/></svg><span>거절</span></button>
    <button class="nc-yes" aria-label="받기"><svg viewBox="0 0 24 24"><path d="M6.6 3.5l2.6 3-1.3 2.8c1.2 2.4 3.4 4.6 5.8 5.8l2.8-1.3 3 2.6-1.4 3.2C10.8 19.8 4.2 13.2 3.4 4.9z"/></svg><span>받기</span></button>
  </div>
  <button class="nc-end" hidden aria-label="끊기"><svg viewBox="0 0 24 24"><path d="M3 15.5c5-4.6 13-4.6 18 0l-2.3 2.6-3.6-1.6v-2.6c-2-.7-4.2-.7-6.2 0v2.6l-3.6 1.6z"/></svg></button>`;
document.getElementById('app').appendChild(v);
const q = s => v.querySelector(s);
const CHOICES = {
  night: [['wake', '지금 일어날게'], ['study', '공부할게'], ['again', '5분 뒤에 한 번 더 전화해 줘']],
  exam: [['wake', '일어났어, 챙길게'], ['again', '5분 뒤에 다시 전화해 줘']],
};

// ---------- 벨소리 ----------
let audio = null, toneUrl = '', synthT = 0, vibT = 0;
function idb() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function getTone() { try { const db = await idb(); return await new Promise(res => { const t = db.transaction(STORE).objectStore(STORE).get('ringtone'); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); }); } catch (e) { return null; } }
async function setTone(file) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(file, 'ringtone'); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
async function delTone() { try { const db = await idb(); db.transaction(STORE, 'readwrite').objectStore(STORE).delete('ringtone'); } catch (e) {} }
// 기본 벨소리: 마림바 같은 짧은 가락을 되풀이 (앱이 직접 만든 소리)
function synthOnce() {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const notes = [[784, 0], [988, .16], [1175, .32], [988, .48], [1319, .72], [1175, .88], [988, 1.04]];
    notes.forEach(([f, t]) => {
      const o = AC.createOscillator(), g = AC.createGain(), at = AC.currentTime + t;
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(AC.destination);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.25, at + .01); g.gain.exponentialRampToValueAtTime(.001, at + .35);
      o.start(at); o.stop(at + .4);
    });
  } catch (e) {}
}
// 유튜브 링크 컬러링: 전화 화면에 유튜브 플레이어를 작게 띄워 그 소리로 울린다 (유튜브 규칙상 플레이어는 보이게 둔다)
// 쿠키를 안 남기는 유튜브 주소 (맞춤 광고가 줄어든다. 광고 자체를 없애거나 건너뛰는 건 유튜브 규칙상 못 한다)
const YT_HOST = 'https://www.youtube-nocookie.com';
let ytFrame = null, ytOk = false, ytFallT = 0;
function ytParse(text) {
  const s = String(text || ''), m = s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/);
  if (!m) return null;
  const t = s.match(/[?&#](?:t|start)=(?:(\d+)h)?(?:(\d+)m)?(\d+)s?/);
  const start = t ? (+(t[1] || 0)) * 3600 + (+(t[2] || 0)) * 60 + (+(t[3] || 0)) : 0;
  return { id: m[1], start };
}
function ytCmd(func, args) { try { ytFrame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), YT_HOST); } catch (e) {} }
function startYT(y) {
  const box = q('.nc-yt'); box.innerHTML = '';
  const p = new URLSearchParams({ autoplay: '1', playsinline: '1', controls: '0', rel: '0', enablejsapi: '1', origin: location.origin, start: String(y.start || 0) });
  ytFrame = document.createElement('iframe');
  ytFrame.allow = 'autoplay; encrypted-media'; ytFrame.title = '컬러링';
  ytFrame.referrerPolicy = 'strict-origin-when-cross-origin';
  ytFrame.src = `${YT_HOST}/embed/${y.id}?${p}`;
  box.appendChild(ytFrame); q('.nc-ytbox').hidden = false; ytOk = false;
  ytFrame.addEventListener('load', () => { let n = 0; const ping = () => { if (!ytFrame || ytOk || n++ > 10) return; try { ytFrame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YT_HOST); } catch (e) {} setTimeout(ping, 500); }; ping(); });
  // 5초 안에 재생이 안 되면(자동 재생 막힘 등) 기본 벨소리도 같이 울린다
  clearTimeout(ytFallT); ytFallT = setTimeout(() => { if (ytFrame && !ytOk && !synthT) { synthOnce(); synthT = setInterval(synthOnce, 2000); } }, 5000);
}
addEventListener('message', e => {
  if (!ytFrame || e.source !== ytFrame.contentWindow) return;
  let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
  const i = d && d.info; if (!i) return;
  if (i.playerState === 1 && !ytOk) { ytOk = true; clearInterval(synthT); synthT = 0; }
  if (i.playerState === 0) { ytCmd('seekTo', [(S.ncall.yt && S.ncall.yt.start) || 0, true]); ytCmd('playVideo'); } // 끝나면 처음(정한 곳)부터 다시
  if (i.videoData && i.videoData.title && S.ncall.yt && !S.ncall.yt.title) { S.ncall.yt.title = i.videoData.title; save(); }
});
// 스포티파이 곡 컬러링: 스포티파이 앱(프리미엄)에서 그 곡을 튼다. 광고 없음. 스포티파이 앱을 쓸 수 없으면 다음 순서로 넘어간다
const SP_PRESET = { uri: 'spotify:track:5meI9gVYkStBAoKNx7V8TF', name: 'TIKITIK · 컬러링' };
let spOn = false;
function spParse(text) {
  const m = String(text || '').match(/(?:open\.spotify\.com\/(?:intl-[\w-]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/);
  return m ? `spotify:track:${m[1]}` : null;
}
// 울리는 순서: 스포티파이 곡 → (스포티파이를 못 쓰면) 내 음악 파일 → 유튜브 → 기본 벨소리.
// 자는 동안 폰이 스포티파이 앱을 꺼 버려서 스포티파이를 못 찾으면, 대신 울리면서 15초마다 스포티파이를 다시 찾아본다.
// 찾으면 대신 울리던 소리를 끄고 스포티파이 곡으로 바꾼다.
let spRetryT = 0;
async function startTone() {
  stopTone();
  const wantSp = S.ncall.sp && S.ncall.sp.uri && window.spotifyRing && spotifyRing.linked();
  if (wantSp && await trySp()) return;
  await startBackup();
  if (wantSp) spRetryT = setInterval(async () => { if (!ringing) { clearInterval(spRetryT); return; } if (await trySp()) { stopBackup(); clearInterval(spRetryT); } }, 15e3);
}
async function trySp() {
  if (!(await spotifyRing.start(S.ncall.sp.uri))) return false;
  if (!ringing) { spotifyRing.stop(); return true; } // 그 사이 받았으면 바로 멈춤
  spOn = true; return true;
}
async function startBackup() {
  const f = S.ncall.tone ? await getTone() : null;
  if (f) {
    toneUrl = URL.createObjectURL(f); audio = new Audio(toneUrl); audio.loop = true;
    try { await audio.play(); return; } catch (e) { stopBackup(); } // 못 틀면 다음 순서로
  }
  if (S.ncall.yt && S.ncall.yt.id) { startYT(S.ncall.yt); return; }
  synthOnce(); synthT = setInterval(synthOnce, 2000);
}
function stopBackup() {
  clearInterval(synthT); synthT = 0; clearTimeout(ytFallT);
  if (ytFrame) { ytFrame.remove(); ytFrame = null; q('.nc-ytbox').hidden = true; }
  if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
  if (toneUrl) { URL.revokeObjectURL(toneUrl); toneUrl = ''; }
}
function stopTone() {
  clearInterval(spRetryT); spRetryT = 0;
  if (spOn) { spOn = false; if (window.spotifyRing) spotifyRing.stop(); }
  stopBackup();
}
// 처음 화면을 만질 때 소리를 미리 깨워 둔다 (브라우저는 사람이 한 번 만져야 소리를 내게 해 준다)
addEventListener('pointerdown', function unlock() {
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) {}
  removeEventListener('pointerdown', unlock, true);
}, true);

// ---------- 울리기 ----------
let ringing = false, talking = false, talkAt = 0, talkT = 0, noteT = 0, decided = false;
async function osNote() {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration(); if (!reg) return;
    await reg.showNotification('📞 남수현', { body: '전화 왔어요. 눌러서 받기', tag: 'hanul-ncall', renotify: true, requireInteraction: true, vibrate: [600, 300, 600, 300, 600], icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './' } });
  } catch (e) {}
}
async function closeNote() { try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) (await reg.getNotifications({ tag: 'hanul-ncall' })).forEach(n => n.close()); } catch (e) {} }
function ring(k) {
  if (ringing || talking) return;
  kind = k || 'night';
  q('.nc-choices').innerHTML = CHOICES[kind].map(([c, t]) => `<button data-c="${c}">${t}</button>`).join('');
  q('.nc-choices').querySelectorAll('button').forEach(b => b.onclick = () => choose(b.dataset.c));
  const c = NS(); if (!c) return;
  ringing = true; stopKeep();
  const img = (c.scenes.morning && c.scenes.morning.img) || 'assets/ns/scene/morning.webp';
  q('.nc-bg').src = img; q('.nc-ava img').src = img;
  q('.nc-state').textContent = '전화 왔어요'; q('.nc-state').classList.add('ring');
  q('.nc-line').textContent = ''; q('.nc-choices').hidden = true; q('.nc-keys').hidden = false; q('.nc-end').hidden = true;
  v.hidden = false; v.classList.remove('talk'); v.classList.add('ringing');
  startTone();
  const buzz = () => { try { navigator.vibrate && navigator.vibrate([700, 500, 700]); } catch (e) {} };
  buzz(); vibT = setInterval(buzz, 2400);
  if (document.hidden) osNote();
  clearInterval(noteT); noteT = setInterval(() => { if (document.hidden) osNote(); }, 30e3); // 앱이 뒤에 있으면 30초마다 다시 알린다
}
function stopRing() {
  ringing = false; stopTone(); clearInterval(vibT); clearInterval(noteT);
  try { navigator.vibrate && navigator.vibrate(0); } catch (e) {}
  q('.nc-state').classList.remove('ring'); v.classList.remove('ringing'); closeNote();
}
function hangUp(after) {
  stopRing(); talking = false; clearInterval(talkT);
  v.classList.add('bye');
  setTimeout(() => { v.hidden = true; v.classList.remove('bye', 'talk'); if (after) after(); }, 500);
}
const say = t => { q('.nc-line').textContent = ''; if (window.typeInto) typeInto(q('.nc-line'), t, 'ncall'); else q('.nc-line').textContent = t; };
q('.nc-yes').onclick = () => {
  stopRing(); talking = true; talkAt = Date.now(); decided = false;
  v.classList.add('talk'); q('.nc-keys').hidden = true; q('.nc-end').hidden = false;
  const tick = () => { const s = Math.floor((Date.now() - talkAt) / 1e3); q('.nc-state').textContent = `통화 중 ${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
  tick(); talkT = setInterval(tick, 1000);
  const now = new Date(), hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const day = callDay || dayKey();
  // 인사 → 정리 → 묻기
  const steps = kind === 'exam'
    ? [line('xhello'), (() => { const ex = examToday(day); return (ex ? `${ex.exams.map(x => `${x.period}교시 ${x.name}`).join(', ')}. ` : '') + line('xpack'); })(), L.xask]
    : [line('hello', { time: timeWord(hm) }), nightSummary(day), L.ask];
  say(steps[0]);
  let at = 3000;
  steps.slice(1).forEach((t, i) => { setTimeout(() => { if (!talking || decided) return; say(t); if (i === steps.length - 2) q('.nc-choices').hidden = false; }, at); at += Math.max(3200, t.length * 110); });
};
q('.nc-no').onclick = () => { stopRing(); later(); say(L.decline); setTimeout(() => hangUp(), 1800); };
q('.nc-end').onclick = () => { if (!decided) later(); hangUp(); }; // 고르지 않고 끊으면 5분 뒤 다시
function choose(c) {
  q('.nc-choices').hidden = true; decided = true;
  if (c === 'wake') { finish(); say(line(kind === 'exam' ? 'xwake' : 'wake')); setTimeout(() => hangUp(), 3000); }
  else if (c === 'study') {
    finish(); say(line('study'));
    setTimeout(() => hangUp(() => { if (window.startFocusFree) startFocusFree(); else if (window.openSheet) openSheet('study'); }), 2600);
  } else { later(); say(line('again')); setTimeout(() => hangUp(), 2600); }
}

// ---------- 언제 거나 ----------
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// 전화의 "날"은 걸기로 한 날로 둔다 (밤 11:30에 시작한 전화를 자정 넘어 받아도 그날 것으로)
let callDay = '';
function finish() { writeSt({ day: callDay || dayKey(), done: true, nextAt: 0 }); }
function later() { writeSt({ day: callDay || dayKey(), done: false, nextAt: Date.now() + 5 * 60e3 }); }
const recallAt = st => (st.nextAt && !st.done && Date.now() - st.nextAt < 3 * 3600e3 ? st.nextAt : 0); // 다시 걸 전화 (자정을 넘어도)
const timeOf = k => (k === 'exam' ? (S.ncall.examTime || '06:40') : (S.ncall.time || '23:30'));
const kindOn = k => S.ncall.on && (k === 'night' || (S.ncall.exam !== false && !!examToday(dayKey())));
function todayAt(k = 'night') { const [h, m] = timeOf(k).split(':').map(Number), t = new Date(); t.setHours(h, m, 0, 0); return t.getTime(); }
function dueAt(k = 'night') {
  const st = readSt(k), r = recallAt(st);
  if (r) return r;
  if (!kindOn(k)) return 0;
  if (st.day === dayKey() && st.done) return 0;
  return todayAt(k);
}
let wake = null;
function check() {
  if (!S.ncall || !S.ncall.on || !DATA) return;
  const now = Date.now(); let soonest = 0;
  for (const k of ['exam', 'night']) {
    const st = readSt(k), r = recallAt(st);
    const at = r || (!kindOn(k) || (st.day === dayKey() && st.done) ? 0 : todayAt(k)); if (!at) continue;
    if (at > now && (!soonest || at < soonest)) soonest = at;
    // 처음 전화는 정한 시각부터 20분 안에 앱이 켜져 있을 때만, 다시 거는 전화는 3시간 안에는 언제든
    if (!ringing && !talking && now >= at && (r || now - at < 20 * 60e3)) { callDay = r ? st.day : dayKey(); kind = k; ring(k); if (!r) writeSt({ day: callDay, done: false, nextAt: at }, k); }
  }
  const at = soonest;
  // 10분 전부터 화면이 꺼지지 않게 (앱이 앞에 있을 때만 된다)
  const soon = at - now > 0 && at - now < 10 * 60e3;
  if (soon && !wake && !document.hidden && navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { wake = w; w.addEventListener('release', () => { wake = null; }); }).catch(() => {});
  if (!soon && wake && !ringing && !talking) { try { wake.release(); } catch (e) {} wake = null; }
}
setInterval(check, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { stopKeep(); check(); if (ringing) closeNote(); } else startKeep(); });
// 안드로이드는 내려 둔 웹앱을 5분쯤 지나면 재운다(타이머가 멈춘다). 소리를 내고 있는 앱은 재우지 않아서,
// 앱을 내려 둘 때 다음 전화가 14시간 안에 있으면 사람 귀에는 거의 안 들리는 아주 작은 소리를 계속 틀어 깨어 있게 한다.
// 이때 폰 알림 창에 "남수현 전화 기다리는 중"이 뜬다. 설정에서 끌 수 있다(끄면 내려 둔 지 몇 분 뒤부터는 못 울릴 수 있다).
let keep = null, keepUrl = '';
function nextCall() {
  if (!S.ncall || !S.ncall.on) return 0;
  const now = Date.now(), list = [];
  for (const k of ['exam', 'night']) { const at = dueAt(k); if (at && (at > now || recallAt(readSt(k)))) list.push(at); }
  // 내일 시험이면 내일 아침 전화, 아니면 내일 밤 전화
  const tm = new Date(); tm.setDate(tm.getDate() + 1); const tk = `${tm.getFullYear()}-${pad(tm.getMonth() + 1)}-${pad(tm.getDate())}`;
  if (S.ncall.exam !== false && examToday(tk)) list.push(todayAt('exam') + 24 * 3600e3);
  list.push(todayAt('night') + 24 * 3600e3);
  return Math.min(...list);
}
function hum() { // 아주 작은 잡음 1초짜리 소리 파일을 만든다 (16비트, 8000Hz)
  const n = 8000, buf = new ArrayBuffer(44 + n * 2), d = new DataView(buf);
  const w = (o, t) => [...t].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
  d.setUint32(24, 8000, true); d.setUint32(28, 16000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) d.setInt16(44 + i * 2, Math.round((Math.random() * 2 - 1) * 60), true); // 약 -55dB
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function startKeep() {
  if (keep || ringing || talking || S.ncall.bg === false) return;
  const at = nextCall(); if (!at || at - Date.now() > 14 * 3600e3) return;
  keepUrl = keepUrl || hum();
  keep = new Audio(keepUrl); keep.loop = true;
  keep.play().then(() => {
    try {
      const t = new Date(at);
      navigator.mediaSession.metadata = new MediaMetadata({ title: '남수현 전화 기다리는 중', artist: `${timeWord(`${pad(t.getHours())}:${pad(t.getMinutes())}`)}에 전화가 와요`, album: '한울아파트', artwork: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }] });
      navigator.mediaSession.setActionHandler('pause', () => { stopKeep(); S.ncall.bg = false; save(); }); // 알림에서 멈추면 이 기능을 끈 걸로
    } catch (e) {}
  }).catch(() => { keep = null; });
}
function stopKeep() {
  if (!keep) return;
  try { keep.pause(); } catch (e) {} keep = null;
  try { navigator.mediaSession.metadata = null; } catch (e) {}
}
// 그래도 재워졌다가 깨어나면 바로 확인
document.addEventListener('resume', check);
setTimeout(check, 3000);
window.ncallTest = k => { writeSt({ day: dayKey(), done: false, nextAt: Date.now() }, k || 'night'); check(); };

// ---------- 설정 ----------
const baseSet = SHEETS.set.render;
SHEETS.set.render = function () {
  baseSet();
  const b = body(), reset = b.querySelector('.reset-all') || b.lastElementChild;
  const f = el('div', 'field nc-field', '<b>남수현 전화</b>');
  const on = el('input'); on.type = 'checkbox'; on.checked = !!S.ncall.on;
  const lab = el('label', 'sw', '매일 전화 받기'); lab.prepend(on);
  const tm = el('input', 'in tm-in'); tm.type = 'time'; tm.value = S.ncall.time; tm.setAttribute('aria-label', '전화 시각');
  const row = el('div', 'row'); row.append(lab, tm);
  // 시험 날 아침 전화
  const xon = el('input'); xon.type = 'checkbox'; xon.checked = S.ncall.exam !== false;
  const xlab = el('label', 'sw', '시험 날 아침에도 전화'); xlab.prepend(xon);
  const xtm = el('input', 'in tm-in'); xtm.type = 'time'; xtm.value = S.ncall.examTime || '06:40'; xtm.setAttribute('aria-label', '시험 날 아침 전화 시각');
  const xrow = el('div', 'row'); xrow.append(xlab, xtm);
  xon.onchange = () => { S.ncall.exam = xon.checked; save(); };
  xtm.onchange = () => { if (xtm.value) { S.ncall.examTime = xtm.value; save(); toast(`시험 날 ${timeWord(xtm.value)}에 전화해요`); } };
  const xtest = el('button', 'btn ghost sm', '시험 날 아침 전화 받아 보기');
  xtest.onclick = () => { closeSheet(); setTimeout(() => window.ncallTest('exam'), 400); };
  on.onchange = () => { S.ncall.on = on.checked; save(); toast(on.checked ? `매일 ${timeWord(S.ncall.time)}에 수현이 전화해요` : '수현 전화를 껐어요'); };
  tm.onchange = () => { if (!tm.value) return; S.ncall.time = tm.value; save(); const st = readSt(); if (st.day === dayKey() && !st.done) writeSt({}); toast(`매일 ${timeWord(tm.value)}에 전화해요`); };
  // 벨소리
  const tone = el('div', 'row nc-tone');
  const toneName = () => {
    const l = [];
    if (S.ncall.sp && S.ncall.sp.uri) l.push(`스포티파이 · ${S.ncall.sp.name || '고른 곡'}`);
    if (S.ncall.tone) l.push(`파일 · ${S.ncall.tone}`);
    if (S.ncall.yt && S.ncall.yt.id) l.push(`유튜브 · ${S.ncall.yt.title || S.ncall.yt.id}${S.ncall.yt.start ? ` (${Math.floor(S.ncall.yt.start / 60)}:${pad(S.ncall.yt.start % 60)}부터)` : ''}`);
    l.push('기본 벨소리');
    return '벨소리 순서: ' + l.join(' → ');
  };
  const name = el('span', 'nc-tone-name'); name.textContent = toneName();
  const pickB = el('button', 'btn ghost sm', '음악 파일 고르기'), test = el('button', 'btn ghost sm', '들어 보기'), back = el('button', 'btn ghost sm', '모두 지우기');
  const file = el('input'); file.type = 'file'; file.accept = 'audio/*'; file.hidden = true;
  pickB.onclick = () => file.click();
  file.onchange = async () => {
    const x = file.files[0]; file.value = ''; if (!x) return;
    if (x.size > 30e6) { toast('파일이 너무 커요 (30MB까지)'); return; }
    try { await setTone(x); S.ncall.tone = x.name; save(); name.textContent = toneName(); toast('벨소리를 바꿨어요'); } catch (e) { toast('저장하지 못했어요'); }
  };
  let playing = false;
  test.onclick = async () => { if ((S.ncall.yt && S.ncall.yt.id) || (S.ncall.sp && S.ncall.sp.uri)) { closeSheet(); setTimeout(window.ncallTest, 400); return; } if (playing) { stopTone(); playing = false; test.textContent = '들어 보기'; return; } await startTone(); playing = true; test.textContent = '멈추기'; setTimeout(() => { if (playing) { stopTone(); playing = false; test.textContent = '들어 보기'; } }, 8000); };
  back.onclick = () => { delTone(); S.ncall.tone = ''; S.ncall.yt = null; S.ncall.sp = null; save(); name.textContent = toneName(); };
  tone.append(name, pickB, test, back, file);
  // 유튜브 링크로 컬러링
  const ytRow = el('div', 'row nc-ytrow');
  const ytIn = el('input', 'in'); ytIn.placeholder = '유튜브 링크 붙여 넣기 (예: youtu.be/…?t=30)'; ytIn.setAttribute('aria-label', '유튜브 링크');
  const ytSave = el('button', 'btn sm', '컬러링으로');
  ytSave.onclick = () => {
    const y = ytParse(ytIn.value);
    if (!y) { toast('유튜브 링크가 아니에요'); return; }
    S.ncall.yt = { id: y.id, start: y.start, title: '' }; save(); ytIn.value = ''; name.textContent = toneName();
    toast(y.start ? `${Math.floor(y.start / 60)}분 ${y.start % 60}초부터 울려요` : '컬러링을 바꿨어요');
  };
  ytRow.append(ytIn, ytSave);
  // 스포티파이 곡으로 컬러링 (광고 없음, 프리미엄·스포티파이 연결 필요)
  const spRow = el('div', 'row nc-ytrow');
  const spIn = el('input', 'in'); spIn.placeholder = '스포티파이 곡 링크 (공유 → 링크 복사)'; spIn.setAttribute('aria-label', '스포티파이 곡 링크');
  const spSave = el('button', 'btn sm', '컬러링으로');
  const setSp = (uri, nm) => {
    if (!window.spotifyRing || !spotifyRing.linked()) { toast('먼저 음악 메뉴에서 스포티파이를 연결해 주세요'); return; }
    S.ncall.sp = { uri, name: nm || '' }; save(); spIn.value = ''; name.textContent = toneName(); toast('스포티파이 곡으로 울려요');
  };
  spSave.onclick = () => { const u = spParse(spIn.value); if (!u) { toast('스포티파이 곡 링크가 아니에요'); return; } setSp(u, '고른 곡'); };
  const preset = el('button', 'btn ghost sm nc-preset', `${SP_PRESET.name}으로 하기`);
  preset.onclick = () => setSp(SP_PRESET.uri, SP_PRESET.name);
  spRow.append(spIn, spSave);
  const bg = el('input'); bg.type = 'checkbox'; bg.checked = S.ncall.bg !== false;
  const bgLab = el('label', 'sw', '앱을 내려 둬도 울리기'); bgLab.prepend(bg);
  bg.onchange = () => { S.ncall.bg = bg.checked; save(); };
  const now = el('button', 'btn ghost wide', '지금 전화 받아 보기');
  now.onclick = () => { closeSheet(); setTimeout(window.ncallTest, 400); };
  f.append(row, xrow, el('p', 'hint', '밤 전화에서는 오늘 공부한 시간(과목별)과 내일 시험·D-day를 먼저 말해 줘요. 시험 날 아침 전화는 오늘 시험 과목·교시와 준비물을 알려 줘요.'), xtest, tone, preset, spRow, el('p', 'hint', '스포티파이 곡은 폰의 스포티파이 앱에서 울려서 광고가 없어요(프리미엄 필요). 받으면 멈추고, 원래 듣던 노래가 있었으면 그 자리부터 다시 틀어요. 자는 동안 폰이 스포티파이 앱을 꺼서 못 찾으면, 순서대로 음악 파일 → 유튜브 → 기본 벨소리로 울리면서 15초마다 스포티파이를 다시 찾아요. 같은 노래 mp3 파일을 "음악 파일 고르기"로 넣어 두면 그때도 그 노래로 울려요. 폰 설정 → 애플리케이션 → Spotify → 배터리 → "제한 없음"으로 두면 스포티파이가 덜 꺼져요.'), ytRow, el('p', 'hint', '유튜브 링크에 시간(?t=30 같은 것)이 있으면 그 부분부터 울려요. 유튜브 영상은 전화 화면에 작게 보이면서 울려요. 앱을 내려 둔 상태에서는 유튜브가 소리를 막을 수 있어서, 그때는 기본 벨소리도 같이 울려요.'), bgLab, el('p', 'hint', '홈 버튼으로 앱을 내려 두거나 다른 앱을 써도 울려요. 그동안 알림 창에 "남수현 전화 기다리는 중"이 떠요(폰이 앱을 재우지 않게 아주 작은 소리를 틀어 둬서, 배터리를 조금 더 써요). 최근 앱 목록에서 앱을 밀어서 완전히 닫으면 못 걸어요.'), now,
    el('p', 'hint', '받을 때까지 울리고, 거절하면 5분 뒤에 다시 걸어요. 앱이 내려가 있을 때는 폰 알림으로도 울려요(알림을 켜 둔 경우). 벨소리 파일은 이 기기에만 저장돼요.'));
  b.insertBefore(f, reset);
};
})();
