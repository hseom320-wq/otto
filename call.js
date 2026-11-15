// 한울아파트 — 남수현 전화
// 매일 정한 시각(기본 11:30)에 앱이 켜져 있는 기기에서 남수현이 전화를 건다. 받을 때까지 울린다.
// 받으면 수현이 세 가지를 묻는다:
//   - "지금 일어날게"  → 오늘은 더 안 건다
//   - "공부할게"       → 전화를 끊고 바로 집중 타이머(공부 화면)를 띄운다
//   - "한 번 더 전화해" → 5분 뒤에 다시 건다
// 거절하면 5분 뒤에 다시 건다.
// 벨소리: 기본은 앱이 만든 벨소리, 설정에서 내 기기에 있는 음악 파일(예: 컬러링으로 쓰는 노래)을 골라 쓸 수 있다.
// 웹앱이라 앱이 완전히 꺼져 있으면 못 건다. 앱이 뒤에 있으면 폰 알림으로 울리고, 시간 10분 전부터 화면이 꺼지지 않게 잡아 둔다.
// 전화 상태(오늘 받았는지, 다음 전화 시각)는 기기마다 따로 둔다.
'use strict';
(() => {
const ST_KEY = 'hanul-ncall';           // 이 기기의 전화 상태 {day, done, nextAt}
const DB = 'hanul-files', STORE = 'f';  // 벨소리 파일
const NS = () => DATA && DATA.characters.find(c => c.code === 'ns');
const readSt = () => { try { return JSON.parse(localStorage.getItem(ST_KEY)) || {}; } catch (e) { return {}; } };
const writeSt = o => { try { localStorage.setItem(ST_KEY, JSON.stringify(o)); } catch (e) {} };
if (!S.ncall) S.ncall = { on: true, time: '11:30', tone: '' };

// 수현 대사 ({me}: 내 이름)
const L = {
  hello: ['…야. 받았네. {time}이다, {time}.', '야, 자냐? 목소리 왜 그래. {time}이거든.', '받는 데 왜 이렇게 오래 걸려. 그니까, {time}이라고.'],
  ask: '그래서. 지금 일어날 거야, 공부할 거야, 아니면 5분 더 자고 내가 또 걸어?',
  wake: ['오케이. 물 한 잔 마시고 씻어. 끊는다.', '진짜지? 다시 누우면 죽는다. 끊어.', '그니까 처음부터 그렇게 일어나면 되잖아. 끊는다.'],
  study: ['오, 웬일. 타이머 켜 줄 테니까 바로 앉아.', '진짜? 그럼 지금 켠다. 50분, 딴짓하면 안다.'],
  again: ['…5분. 딱 5분이다. 다시 건다.', '하. 알았어. 5분 뒤에 또 건다, 안 받으면 문 두드린다.'],
  decline: '…안 받냐. 5분 뒤에 또 건다.',
};
const line = (k, o) => { const t = Array.isArray(L[k]) ? pick(L[k]) : L[k]; return t.replace(/\{(\w+)\}/g, (x, key) => (o && o[key] != null ? o[key] : x)); };
const timeWord = hm => { const [h, m] = hm.split(':').map(Number); const ap = h < 12 ? '오전' : '오후', hh = h % 12 || 12; return `${ap} ${hh}시${m ? ` ${m === 30 ? '반' : m + '분'}` : ''}`; };

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
  <p class="nc-line" aria-live="polite"></p>
  <div class="nc-choices" hidden>
    <button data-c="wake">지금 일어날게</button>
    <button data-c="study">공부할게</button>
    <button data-c="again">5분 뒤에 한 번 더 전화해 줘</button>
  </div>
  <div class="nc-keys">
    <button class="nc-no" aria-label="거절"><svg viewBox="0 0 24 24"><path d="M3 15.5c5-4.6 13-4.6 18 0l-2.3 2.6-3.6-1.6v-2.6c-2-.7-4.2-.7-6.2 0v2.6l-3.6 1.6z"/></svg><span>거절</span></button>
    <button class="nc-yes" aria-label="받기"><svg viewBox="0 0 24 24"><path d="M6.6 3.5l2.6 3-1.3 2.8c1.2 2.4 3.4 4.6 5.8 5.8l2.8-1.3 3 2.6-1.4 3.2C10.8 19.8 4.2 13.2 3.4 4.9z"/></svg><span>받기</span></button>
  </div>
  <button class="nc-end" hidden aria-label="끊기"><svg viewBox="0 0 24 24"><path d="M3 15.5c5-4.6 13-4.6 18 0l-2.3 2.6-3.6-1.6v-2.6c-2-.7-4.2-.7-6.2 0v2.6l-3.6 1.6z"/></svg></button>`;
document.getElementById('app').appendChild(v);
const q = s => v.querySelector(s);

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
async function startTone() {
  stopTone();
  const f = S.ncall.tone ? await getTone() : null;
  if (f) {
    toneUrl = URL.createObjectURL(f); audio = new Audio(toneUrl); audio.loop = true;
    try { await audio.play(); return; } catch (e) { stopTone(); } // 못 틀면 기본 벨소리로
  }
  synthOnce(); synthT = setInterval(synthOnce, 2000);
}
function stopTone() {
  clearInterval(synthT); synthT = 0;
  if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
  if (toneUrl) { URL.revokeObjectURL(toneUrl); toneUrl = ''; }
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
function ring() {
  if (ringing || talking) return;
  const c = NS(); if (!c) return;
  ringing = true;
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
  say(line('hello', { time: timeWord(hm) }));
  setTimeout(() => { if (!talking) return; say(L.ask); q('.nc-choices').hidden = false; }, 3200);
};
q('.nc-no').onclick = () => { stopRing(); later(); say(L.decline); setTimeout(() => hangUp(), 1800); };
q('.nc-end').onclick = () => { if (!decided) later(); hangUp(); }; // 고르지 않고 끊으면 5분 뒤 다시
v.querySelectorAll('.nc-choices button').forEach(b => b.onclick = () => {
  const c = b.dataset.c; q('.nc-choices').hidden = true; decided = true;
  if (c === 'wake') { finish(); say(line('wake')); setTimeout(() => hangUp(), 3000); }
  else if (c === 'study') {
    finish(); say(line('study'));
    setTimeout(() => hangUp(() => { if (window.startFocusFree) startFocusFree(); else if (window.openSheet) openSheet('study'); }), 2600);
  } else { later(); say(line('again')); setTimeout(() => hangUp(), 2600); }
});

// ---------- 언제 거나 ----------
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
function finish() { writeSt({ day: dayKey(), done: true, nextAt: 0 }); }
function later() { writeSt({ day: dayKey(), done: false, nextAt: Date.now() + 5 * 60e3 }); }
function dueAt() {
  const st = readSt(), day = dayKey();
  if (st.day === day && st.done) return 0;
  if (st.day === day && st.nextAt) return st.nextAt;
  const [h, m] = (S.ncall.time || '11:30').split(':').map(Number), t = new Date(); t.setHours(h, m, 0, 0);
  return t.getTime();
}
let wake = null;
function check() {
  if (!S.ncall || !S.ncall.on || !DATA) return;
  const at = dueAt(), now = Date.now(); if (!at) return;
  const st = readSt(), recall = st.day === dayKey() && st.nextAt;
  // 처음 전화는 정한 시각부터 20분 안에 앱이 켜져 있을 때만, 다시 거는 전화는 오늘 안에는 언제든
  if (now >= at && (recall || now - at < 20 * 60e3)) { ring(); if (!recall) writeSt({ day: dayKey(), done: false, nextAt: at }); }
  // 10분 전부터 화면이 꺼지지 않게 (앱이 앞에 있을 때만 된다)
  const soon = at - now > 0 && at - now < 10 * 60e3;
  if (soon && !wake && !document.hidden && navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { wake = w; w.addEventListener('release', () => { wake = null; }); }).catch(() => {});
  if (!soon && wake && !ringing && !talking) { try { wake.release(); } catch (e) {} wake = null; }
}
setInterval(check, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { check(); if (ringing) closeNote(); } });
setTimeout(check, 3000);
window.ncallTest = () => { writeSt({ day: dayKey(), done: false, nextAt: Date.now() }); check(); };

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
  on.onchange = () => { S.ncall.on = on.checked; save(); toast(on.checked ? `매일 ${timeWord(S.ncall.time)}에 수현이 전화해요` : '수현 전화를 껐어요'); };
  tm.onchange = () => { if (!tm.value) return; S.ncall.time = tm.value; save(); const st = readSt(); if (st.day === dayKey() && !st.done) writeSt({}); toast(`매일 ${timeWord(tm.value)}에 전화해요`); };
  // 벨소리
  const tone = el('div', 'row nc-tone');
  const name = el('span', 'nc-tone-name', S.ncall.tone ? `벨소리: ${esc(S.ncall.tone)}` : '벨소리: 기본');
  const pickB = el('button', 'btn ghost sm', '파일 고르기'), test = el('button', 'btn ghost sm', '들어 보기'), back = el('button', 'btn ghost sm', '기본으로');
  const file = el('input'); file.type = 'file'; file.accept = 'audio/*'; file.hidden = true;
  pickB.onclick = () => file.click();
  file.onchange = async () => {
    const x = file.files[0]; file.value = ''; if (!x) return;
    if (x.size > 30e6) { toast('파일이 너무 커요 (30MB까지)'); return; }
    try { await setTone(x); S.ncall.tone = x.name; save(); name.textContent = `벨소리: ${x.name}`; toast('벨소리를 바꿨어요'); } catch (e) { toast('저장하지 못했어요'); }
  };
  let playing = false;
  test.onclick = async () => { if (playing) { stopTone(); playing = false; test.textContent = '들어 보기'; return; } await startTone(); playing = true; test.textContent = '멈추기'; setTimeout(() => { if (playing) { stopTone(); playing = false; test.textContent = '들어 보기'; } }, 8000); };
  back.onclick = () => { delTone(); S.ncall.tone = ''; save(); name.textContent = '벨소리: 기본'; };
  tone.append(name, pickB, test, back, file);
  const now = el('button', 'btn ghost wide', '지금 전화 받아 보기');
  now.onclick = () => { closeSheet(); setTimeout(window.ncallTest, 400); };
  f.append(row, tone, now, el('p', 'hint', '앱이 켜져 있는 기기에서만 울려요(앱을 완전히 닫으면 못 걸어요). 받을 때까지 울리고, 거절하면 5분 뒤에 다시 걸어요. 앱이 뒤에 있으면 폰 알림으로 울려요(알림을 켜 둔 경우). 벨소리 파일은 이 기기에만 저장돼요.'));
  b.insertBefore(f, reset);
};
})();
