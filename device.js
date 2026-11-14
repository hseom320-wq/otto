// 한울아파트 — 전체화면 · 폰과 태블릿 연동
// 설정 화면에 두 칸을 더한다.
// - 전체화면: 켜 두면 앱을 열고 처음 화면을 만질 때 전체화면으로 바뀐다 (브라우저 규칙상 한 번은 만져야 한다).
// - 연동: 이 기기의 기록을 파일 하나로 내보내고, 다른 기기에서 그 파일을 가져온다.
//   할 일·대화·호감도·보상씬·일정·공부·기말 체크가 옮겨진다. Gemini 키와 스포티파이 연결은 기기마다 따로 둔다.
// app.js 등 다른 파일 뒤에 불러온다.
'use strict';
(() => {
// ---------- 전체화면 ----------
const FS_KEY = 'hanul-fullscreen';
const fsOn = () => { try { return localStorage.getItem(FS_KEY) === '1'; } catch (e) { return false; } };
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
const canFS = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
const standalone = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
async function enterFS() {
  const d = document.documentElement;
  try { if (d.requestFullscreen) await d.requestFullscreen({ navigationUI: 'hide' }); else if (d.webkitRequestFullscreen) d.webkitRequestFullscreen(); } catch (e) {}
}
function exitFS() { try { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch (e) {} }
// 켜 두었으면 화면을 만질 때마다(전체화면이 풀려 있을 때만) 다시 들어간다
addEventListener('pointerup', () => { if (fsOn() && canFS() && !fsEl() && !standalone()) enterFS(); }, { capture: true });

// ---------- 연동 (내보내기 · 가져오기) ----------
const APP_KEY = 'hanul-v1';
const PLAN_KEY = 'final-plan-2026-2';
const LOCAL_ONLY = ['key', 'gModel', 'gModelKey', 'notify', 'wx', 'fired']; // 기기마다 다른 것
const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const device = () => /iPad|Tablet|SM-X|SM-T/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) >= 600) ? '태블릿' : '폰';
function exportData() {
  save();
  const app = read(APP_KEY) || {};
  LOCAL_ONLY.forEach(k => delete app[k]);
  return { kind: 'hanul-sync', v: 1, at: Date.now(), from: device(), app, plan: read(PLAN_KEY) };
}
const stamp = t => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
async function doExport() {
  const data = exportData(), text = JSON.stringify(data);
  const d = new Date(data.at), name = `hanul-${data.from}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  const file = new File([text], name, { type: 'application/json' });
  // 폰이면 공유 창(카톡 나에게 보내기, 퀵 셰어 등)으로, 안 되면 파일로 저장
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '한울아파트 기록' }); toast('보냈어요. 다른 기기에서 "가져오기"로 열어 주세요.'); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('파일로 저장했어요. 다른 기기로 옮긴 뒤 "가져오기"로 열어 주세요.');
}
// 기말 체크는 두 기기 것을 합친다 (어느 쪽에서든 끝낸 건 끝낸 걸로)
function mergePlan(mine, theirs) {
  if (!theirs || typeof theirs !== 'object') return mine;
  if (!mine || typeof mine !== 'object') return theirs;
  return { ...mine, v: 1, done: { ...(theirs.done || {}), ...(mine.done || {}) }, grade: { ...(theirs.grade || {}), ...(mine.grade || {}) }, score: { ...(theirs.score || {}), ...(mine.score || {}) } };
}
function doImport(file) {
  const r = new FileReader();
  r.onload = () => {
    let d = null; try { d = JSON.parse(r.result); } catch (e) {}
    if (!d || d.kind !== 'hanul-sync' || !d.app) { toast('한울아파트 기록 파일이 아니에요.'); return; }
    if (!confirm(`${d.from || '다른 기기'}에서 ${stamp(d.at)}에 내보낸 기록으로 바꿀까요?\n이 기기의 할 일·대화·호감도·일정이 그 기록으로 바뀌어요. 기말 체크는 두 기기 것을 합쳐요.\nGemini 키와 스포티파이 연결은 그대로 둬요.`)) return;
    const mine = read(APP_KEY) || {}, next = { ...d.app };
    LOCAL_ONLY.forEach(k => { if (mine[k] !== undefined) next[k] = mine[k]; else delete next[k]; });
    try {
      localStorage.setItem(APP_KEY, JSON.stringify(next));
      const plan = mergePlan(read(PLAN_KEY), d.plan);
      if (plan) localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
      localStorage.setItem('hanul-synced', JSON.stringify({ at: Date.now(), from: d.from, exported: d.at }));
    } catch (e) { toast('저장하지 못했어요. 저장 공간을 확인해 주세요.'); return; }
    toast('가져왔어요. 다시 여는 중…');
    setTimeout(() => location.reload(), 700);
  };
  r.readAsText(file);
}

// ---------- 설정 화면에 더하기 ----------
const baseSet = SHEETS.set.render;
SHEETS.set.render = function () {
  baseSet();
  const b = body(), reset = b.querySelector('.reset-all') || b.lastElementChild;
  // 전체화면
  const fs = el('div', 'field', '<b>전체화면</b>');
  const on = el('input'); on.type = 'checkbox'; on.id = 'fsOn'; on.checked = fsOn();
  const lab = el('label', 'sw', '전체화면으로 보기 (상태 표시줄·주소창 숨기기)'); lab.prepend(on);
  on.onchange = () => {
    try { localStorage.setItem(FS_KEY, on.checked ? '1' : '0'); } catch (e) {}
    if (on.checked) { if (canFS()) enterFS(); else toast('이 브라우저는 전체화면을 지원하지 않아요. 홈 화면에 추가해서 열어 주세요.'); }
    else if (fsEl()) exitFS();
  };
  fs.append(lab, el('p', 'hint', canFS()
    ? '켜 두면 앱을 열고 처음 화면을 만질 때 전체화면으로 바뀌어요. 홈 화면에 추가한 앱은 처음부터 전체화면이에요.'
    : '이 기기 브라우저는 전체화면 버튼을 지원하지 않아요. 공유 → "홈 화면에 추가"로 앱을 깔면 전체화면으로 열려요.'));
  // 연동
  const sy = el('div', 'field', '<b>폰·태블릿 연동</b>');
  const last = read('hanul-synced');
  const row = el('div', 'row'), ex = el('button', 'btn', '내보내기'), im = el('button', 'btn ghost', '가져오기');
  const pickF = el('input'); pickF.type = 'file'; pickF.accept = 'application/json,.json'; pickF.hidden = true;
  ex.onclick = doExport; im.onclick = () => pickF.click();
  pickF.onchange = () => { if (pickF.files[0]) doImport(pickF.files[0]); pickF.value = ''; };
  row.append(ex, im, pickF);
  sy.append(row, el('p', 'hint', `기록을 옮길 기기에서 "내보내기" → 카톡 나에게 보내기나 퀵 셰어로 파일을 보내고, 받는 기기에서 "가져오기"로 그 파일을 열어요. 할 일·대화·호감도·보상씬·일정·공부 기록이 옮겨지고, 기말 체크는 두 기기 것을 합쳐요.${last ? ` 마지막으로 가져온 때: ${stamp(last.at)} (${last.from || '다른 기기'} 기록)` : ''}`));
  b.insertBefore(fs, reset); b.insertBefore(sy, reset);
};
})();
