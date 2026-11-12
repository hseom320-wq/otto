// 한울아파트 알림 서버 (Cloudflare Workers, 무료)
// 앱이 꺼져 있어도 정해 둔 시각에 폰으로 알림을 보낸다.
// - 앱이 "언제 무슨 알림을 보낼지" 목록을 보내 두면(/sync), 1분마다 확인해서 때가 된 알림을 웹 푸시로 깨운다.
// - 푸시에는 내용을 싣지 않고(암호화가 필요 없어 간단하다) 깨우기만 한다. 깨어난 앱의 서비스 워커가 /pending 으로 내용을 받아 알림을 띄운다.
// - VAPID 키는 처음 실행할 때 서버가 스스로 만들어 KV 에 둔다 (비밀 값을 따로 넣을 필요 없음).
// 필요한 것: KV 바인딩 PUSH, 1분 크론 트리거 ("* * * * *").

const ALLOW = ['https://hseom320-wq.github.io', 'http://localhost:8765'];
const MAX_ITEMS = 300, MAX_BODY = 200, MAX_TITLE = 60;

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = s => new TextEncoder().encode(s);
const json = (o, st = 200, h = {}) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json', ...h } });

async function vapid(env) {
  let v = await env.PUSH.get('vapid', 'json');
  if (v) return v;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  v = { pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), jwk: await crypto.subtle.exportKey('jwk', kp.privateKey) };
  await env.PUSH.put('vapid', JSON.stringify(v));
  return v;
}
async function vapidHeader(env, endpoint) {
  const v = await vapid(env);
  const key = await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://hseom320-wq.github.io/otto/' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${v.pub}`;
}
// 내용 없는 푸시로 폰을 깨운다. 구독이 사라졌으면 false
async function wake(env, sub) {
  const r = await fetch(sub.endpoint, { method: 'POST', headers: { Authorization: await vapidHeader(env, sub.endpoint), TTL: '3600', Urgency: 'high', 'Content-Length': '0' } });
  return !(r.status === 404 || r.status === 410);
}

const clean = it => ({
  at: Math.round(+it.at) || 0,
  title: String(it.title || '').slice(0, MAX_TITLE),
  body: String(it.body || '').slice(0, MAX_BODY),
  tag: String(it.tag || '').slice(0, 60),
});
const okId = s => typeof s === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(s);

async function devices(env) { return (await env.PUSH.get('devs', 'json')) || []; }
async function run(env) {
  const now = Date.now(), ids = await devices(env), keep = [];
  for (const id of ids) {
    const rec = await env.PUSH.get('dev:' + id, 'json');
    if (!rec) continue;
    const due = rec.items.filter(i => i.at <= now + 30e3), rest = rec.items.filter(i => i.at > now + 30e3);
    if (!due.length) { keep.push(id); continue; }
    rec.items = rest;
    rec.pending = [...(rec.pending || []), ...due.filter(i => now - i.at < 6 * 3600e3)].slice(-20); // 6시간 넘게 지난 건 버린다
    let alive = true;
    if (rec.pending.length) { try { alive = await wake(env, rec.sub); } catch (e) {} }
    if (alive) { await env.PUSH.put('dev:' + id, JSON.stringify(rec)); keep.push(id); }
    else await env.PUSH.delete('dev:' + id);
  }
  if (keep.length !== ids.length) await env.PUSH.put('devs', JSON.stringify(keep));
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin') || '';
    const cors = { 'access-control-allow-origin': ALLOW.includes(origin) ? origin : ALLOW[0], 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const u = new URL(req.url);
    try {
      if (u.pathname === '/vapid') return json({ key: (await vapid(env)).pub }, 200, cors);
      if (u.pathname === '/pending') { // 서비스 워커가 깨어나서 받아 가는 알림
        const id = u.searchParams.get('id'), key = u.searchParams.get('key');
        if (!okId(id)) return json({ error: 'id' }, 400, cors);
        const rec = await env.PUSH.get('dev:' + id, 'json');
        if (!rec || rec.key !== key) return json({ items: [] }, 200, cors);
        const items = rec.pending || [];
        if (items.length) { rec.pending = []; await env.PUSH.put('dev:' + id, JSON.stringify(rec)); }
        return json({ items }, 200, cors);
      }
      if (req.method !== 'POST') return json({ ok: true, name: 'hanul-push' }, 200, cors);
      const text = await req.text(); if (text.length > 120e3) return json({ error: 'too big' }, 413, cors);
      const d = JSON.parse(text);
      if (!okId(d.id) || !okId(d.key)) return json({ error: 'id' }, 400, cors);
      const old = await env.PUSH.get('dev:' + d.id, 'json');
      if (old && old.key !== d.key) return json({ error: 'key' }, 403, cors);
      if (u.pathname === '/sync') {
        if (!d.sub || !/^https:\/\//.test(d.sub.endpoint || '')) return json({ error: 'sub' }, 400, cors);
        const items = (d.items || []).slice(0, MAX_ITEMS).map(clean).filter(i => i.at > Date.now() - 60e3).sort((a, b) => a.at - b.at);
        await env.PUSH.put('dev:' + d.id, JSON.stringify({ key: d.key, sub: { endpoint: d.sub.endpoint }, items, pending: (old && old.pending) || [], at: Date.now() }));
        const ids = await devices(env); if (!ids.includes(d.id)) { ids.push(d.id); await env.PUSH.put('devs', JSON.stringify(ids.slice(-20))); }
        return json({ ok: true, n: items.length }, 200, cors);
      }
      if (u.pathname === '/test') { // 바로 하나 보내 보기
        if (!old) return json({ error: 'sync first' }, 400, cors);
        old.pending = [...(old.pending || []), clean({ at: Date.now(), title: d.title || '한울아파트', body: d.body || '알림이 잘 와요.', tag: 'test' })].slice(-20);
        await env.PUSH.put('dev:' + d.id, JSON.stringify(old));
        const alive = await wake(env, old.sub);
        return json({ ok: alive }, 200, cors);
      }
      if (u.pathname === '/unsub') { await env.PUSH.delete('dev:' + d.id); return json({ ok: true }, 200, cors); }
      return json({ error: 'not found' }, 404, cors);
    } catch (e) { return json({ error: 'bad request' }, 400, cors); }
  },
  async scheduled(ev, env, ctx) { ctx.waitUntil(run(env)); },
};
