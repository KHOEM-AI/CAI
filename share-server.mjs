// CAI share server · Google sign-in (no passwords) · 2-person location sharing · own-device tracking
// run: node share-server.mjs [port]   (default 127.0.0.1:5181; CAI_SHARE_HOST=0.0.0.0 to open it up)
// it also serves cai-scan.html at "/" so one public (tunnel) address gives the page AND the API
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DAY = 864e5;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const b64 = (s) => Buffer.from(s, "base64url");
const num = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s]{2,}$/;
const err = (status, message) => Object.assign(new Error(message), { status });

let certs = { keys: [], at: 0 };
async function googleKeys() {
  if (certs.keys.length && Date.now() - certs.at < 3600e3) return certs.keys;
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!r.ok) throw new Error("certs " + r.status);
  certs = { keys: (await r.json()).keys || [], at: Date.now() };
  return certs.keys;
}

export async function verifyGoogle(idToken, clientId) {
  const [h, p, s] = String(idToken).split(".");
  if (!h || !p || !s) throw new Error("malformed");
  const head = JSON.parse(b64(h).toString());
  const pay = JSON.parse(b64(p).toString());
  if (head.alg !== "RS256") throw new Error("alg");
  const jwk = (await googleKeys()).find((k) => k.kid === head.kid);
  if (!jwk) throw new Error("unknown key");
  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  if (!crypto.verify("RSA-SHA256", Buffer.from(h + "." + p), key, b64(s))) throw new Error("signature");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(pay.iss)) throw new Error("iss");
  if (pay.aud !== clientId) throw new Error("aud");
  if (!(pay.exp * 1000 > Date.now())) throw new Error("expired");
  if (!pay.email || (pay.email_verified !== true && pay.email_verified !== "true")) throw new Error("email");
  return { email: String(pay.email).toLowerCase(), name: String(pay.name || pay.email).slice(0, 80) };
}

// page a share-link opens: EN / ខ្មែរ / 中文, no account, no third-party script. The viewer's own GPS stays on their device.
const LINK_PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<title>KHOEM-AI · Location</title><style>
:root{color-scheme:light dark;--bg:#e3f4ff;--tx:#0b2a44;--mu:#4a6f8c;--g:#0a84ff}@media(prefers-color-scheme:dark){:root{--bg:#06203a;--tx:#e6f3ff;--mu:#8fb6da}}
body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 system-ui,"Noto Sans Khmer","Noto Sans SC",sans-serif;padding:14px;max-width:520px;margin:auto}
b.l{font-size:22px}b.l i{color:var(--g);font-style:normal}.mu{color:var(--mu);font-size:13px}iframe{width:100%;height:300px;border:0;border-radius:12px;margin-top:10px}
button{font:inherit;padding:10px 14px;border-radius:12px;border:1px solid var(--g);background:none;color:var(--g);margin-top:10px}</style></head><body>
<b class="l">KHOEM<i>-AI</i></b><h3 id="t"></h3><div id="s" class="mu"></div><div id="m"></div><div id="me" class="mu"></div>
<button id="b"></button><div class="mu" id="n" style="margin-top:10px"></div><script>
var L=/^km/.test(navigator.language)?"km":/^zh/.test(navigator.language)?"zh":"en";
var T={en:{w:"Shared location",no:"The sender has not sent a location yet.",ago:"updated",s:"s ago",mn:" min ago",acc:"accuracy",my:"Show my location (stays on your device)",d:"Distance to sender",g:"This link has expired or was stopped.",deny:"Location permission was not given.",n:"Your location is never sent to anyone from this page.",open:"Open in OpenStreetMap",left:"Link ends"},
km:{w:"ទីតាំងដែលបានចែករំលែក",no:"អ្នកផ្ញើមិនទាន់ផ្ញើទីតាំងនៅឡើយ។",ago:"ធ្វើបច្ចុប្បន្នភាព",s:" វិនាទីមុន",mn:" នាទីមុន",acc:"ភាពជាក់លាក់",my:"បង្ហាញទីតាំងខ្ញុំ (នៅលើឧបករណ៍អ្នកតែប៉ុណ្ណោះ)",d:"ចម្ងាយទៅអ្នកផ្ញើ",g:"តំណនេះផុតកំណត់ ឬត្រូវបានបញ្ឈប់។",deny:"មិនបានអនុញ្ញាតទីតាំងទេ។",n:"ទីតាំងរបស់អ្នកមិនត្រូវបានផ្ញើទៅនរណាម្នាក់ពីទំព័រនេះទេ។",open:"បើកក្នុង OpenStreetMap",left:"តំណផុតនៅ"},
zh:{w:"共享的位置",no:"发送者尚未发送位置。",ago:"更新于",s:" 秒前",mn:" 分钟前",acc:"精度",my:"显示我的位置（仅保留在你的设备上）",d:"与发送者的距离",g:"此链接已过期或已停止。",deny:"未授予位置权限。",n:"此页面不会把你的位置发送给任何人。",open:"在 OpenStreetMap 打开",left:"链接结束于"}}[L];
var $=function(i){return document.getElementById(i)},tok=location.pathname.split("/")[2],last=null;
$("t").textContent=T.w;$("b").textContent=T.my;$("n").textContent=T.n;
function km(a,b,c,d){var r=Math.PI/180,x=Math.sin((c-a)*r/2),y=Math.sin((d-b)*r/2),h=x*x+Math.cos(a*r)*Math.cos(c*r)*y*y;return 12742*Math.asin(Math.sqrt(h))}
function draw(j){last=j.loc;$("t").textContent=(j.label||T.w);var e=T.left+" "+new Date(j.until).toLocaleString();
 if(!j.loc){$("s").textContent=T.no+" · "+e;$("m").textContent="";return}
 var a=Math.round((Date.now()-j.loc.t)/1000),ag=a<90?a+T.s:Math.round(a/60)+T.mn;
 $("s").textContent=j.loc.lat.toFixed(5)+", "+j.loc.lon.toFixed(5)+" · "+T.acc+" "+Math.round(j.loc.acc)+" m · "+T.ago+" "+ag+" · "+e;
 var d=0.01,bb=[j.loc.lon-d,j.loc.lat-d,j.loc.lon+d,j.loc.lat+d].join(",");
 $("m").innerHTML="";var f=document.createElement("iframe");f.referrerPolicy="no-referrer";f.src="https://www.openstreetmap.org/export/embed.html?bbox="+bb+"&marker="+j.loc.lat+","+j.loc.lon;$("m").appendChild(f);
 var a2=document.createElement("a");a2.rel="noopener noreferrer";a2.target="_blank";a2.textContent=T.open;a2.href="https://www.openstreetmap.org/?mlat="+j.loc.lat+"&mlon="+j.loc.lon+"#map=16/"+j.loc.lat+"/"+j.loc.lon;$("m").appendChild(a2)}
function poll(){fetch("/s/"+tok+"/data",{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(draw).catch(function(){$("t").textContent=T.g;$("s").textContent="";$("m").textContent="";clearInterval(iv)})}
var iv=setInterval(poll,15000);poll();
$("b").onclick=function(){navigator.geolocation.getCurrentPosition(function(p){var t=p.coords.latitude.toFixed(5)+", "+p.coords.longitude.toFixed(5);
 if(last)t+=" · "+T.d+": "+km(p.coords.latitude,p.coords.longitude,last.lat,last.lon).toFixed(2)+" km";$("me").textContent=t},function(){$("me").textContent=T.deny},{enableHighAccuracy:true,timeout:15000})};
</script></body></html>`;

export function makeServer({ dbFile, clientId, verify, pageFile } = {}) {
  const home = os.homedir();
  dbFile ||= path.join(home, ".cai-share.json");
  pageFile ||= path.join(HERE, "cai-scan.html");
  const cidFile = path.join(home, ".cai-google-client-id");
  clientId ??= (process.env.GOOGLE_CLIENT_ID || (fs.existsSync(cidFile) ? fs.readFileSync(cidFile, "utf8") : "")).trim();
  verify ||= (tok) => verifyGoogle(tok, clientId);

  let db = { sessions: {}, shares: {}, devices: {}, loc: {}, blocks: {}, devkeys: {}, links: {}, scans: {}, hist: {}, hset: {} };
  try { Object.assign(db, JSON.parse(fs.readFileSync(dbFile, "utf8"))); } catch {}
  let dirty = false;
  const save = () => { dirty = true; };
  const flush = () => {
    if (!dirty) return;
    dirty = false;
    const tmp = dbFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
    fs.renameSync(tmp, dbFile);
  };

  const live = (s) => s.state === "active" && (s.until === null || s.until > Date.now());
  const open = (s) => live(s) || (s.state === "pending" && Date.now() - s.created < DAY);
  const end = (s) => { s.state = "ended"; s.ended = Date.now(); };
  const liveLink = (l) => l.state === "active" && l.until > Date.now();
  const hasActive = (email) =>
    Object.values(db.shares).some((s) => s.from === email && live(s)) ||
    Object.values(db.links).some((l) => l.from === email && liveLink(l));
  const histOn = (email) => !!(db.hset[email] && db.hset[email].enabled);
  const pushHist = (email, p) => {
    const L = (db.hist[email] ||= []), last = L[L.length - 1];
    if (last && p.t - last.t < 15000 && p.t >= last.t) return; // at most 1 point / 15 s
    L.push(p);
    L.sort((a, b) => a.t - b.t);
    if (L.length > 2000) L.splice(0, L.length - 2000);
  };
  const dropLoc = (email) => { if (!hasActive(email)) delete db.loc[email]; };

  const hits = new Map();
  const limited = (key, max) => {
    const n = Date.now(), h = hits.get(key);
    if (!h || n - h.t > 60000) { hits.set(key, { t: n, c: 1 }); return false; }
    return ++h.c > max;
  };

  function sweep() {
    const n = Date.now();
    for (const [k, s] of Object.entries(db.sessions)) if (s.exp < n) delete db.sessions[k];
    for (const [k, s] of Object.entries(db.shares)) {
      if (s.state !== "ended" && !open(s)) end(s);
      if (s.state === "ended" && n - (s.ended || s.created) > 7 * DAY) delete db.shares[k];
    }
    for (const [k, l] of Object.entries(db.links)) {
      if (l.state === "active" && l.until <= n) { l.state = "ended"; l.ended = l.until; }
      if (l.state === "ended" && n - (l.ended || l.created) > 7 * DAY) delete db.links[k];
    }
    for (const [e, L] of Object.entries(db.hist)) {
      const keep = n - ((db.hset[e] && db.hset[e].days) || 7) * DAY;
      db.hist[e] = L.filter((p) => p.t >= keep);
      if (!db.hist[e].length) delete db.hist[e];
    }
    for (const e of Object.keys(db.loc)) dropLoc(e);
    hits.clear();
    save();
  }

  function newSession(u) {
    const mine = Object.entries(db.sessions).filter(([, v]) => v.email === u.email).sort((a, b) => a[1].exp - b[1].exp);
    while (mine.length >= 10) delete db.sessions[mine.shift()[0]];
    const tok = crypto.randomBytes(32).toString("base64url");
    db.sessions[sha(tok)] = { email: u.email, name: u.name, exp: Date.now() + 30 * DAY };
    save();
    return tok;
  }
  function authed(req) {
    const m = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
    if (!m) return null;
    const key = sha(m[1]), dk = db.devkeys[key];
    if (dk) return { email: dk.email, name: dk.email, deviceId: dk.id, key };
    const s = db.sessions[key];
    return s && s.exp > Date.now() ? { ...s, key } : null;
  }

  const send = (res, code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(obj));
  };
  async function body(req) {
    let n = 0;
    const parts = [];
    for await (const c of req) {
      n += c.length;
      if (n > 20000) throw err(413, "too_big");
      parts.push(c);
    }
    if (!n) return {};
    try {
      const j = JSON.parse(Buffer.concat(parts).toString());
      return j && typeof j === "object" ? j : {};
    } catch { throw err(400, "bad_body"); }
  }

  async function handle(req, res) {
    const o = req.headers.origin;
    if (o) {
      res.setHeader("Access-Control-Allow-Origin", o);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    const route = req.method + " " + new URL(req.url, "http://x").pathname;
    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

    if (route === "GET /health") return send(res, 200, { ok: true });
    if (route === "GET /config") return send(res, 200, { clientId: clientId || null });
    if (route === "GET /" || route === "GET /cai-scan.html") {
      let h;
      try { h = fs.readFileSync(pageFile, "utf8"); } catch { throw err(404, "not_found"); }
      const tag = "<script>window.CAI_SHARE_API=location.origin</script>";
      h = h.includes("<head>") ? h.replace("<head>", () => "<head>" + tag) : tag + h;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(h);
    }
    const lm = /^\/s\/([\w-]{32})(\/data)?$/.exec(new URL(req.url, "http://x").pathname);
    if (lm && req.method === "GET") {
      if (limited("l" + ip, 90)) throw err(429, "rate");
      const th = sha(lm[1]), l = Object.values(db.links).find((x) => x.th === th);
      if (!lm[2]) {
        res.writeHead(l && liveLink(l) ? 200 : 404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
        return res.end(l && liveLink(l) ? LINK_PAGE : "<!doctype html><meta charset=utf-8><title>KHOEM-AI</title><p>Link expired · តំណផុតកំណត់ · 链接已失效");
      }
      if (!l) throw err(404, "not_found");
      if (!liveLink(l)) throw err(410, "gone");
      const p = db.loc[l.from];
      return send(res, 200, { label: l.label, until: l.until, loc: p ? { lat: p.lat, lon: p.lon, acc: p.acc, t: p.t } : null });
    }
    if (route === "POST /auth/google") {
      if (limited("a" + ip, 30)) throw err(429, "rate");
      if (!clientId) throw err(503, "no_client_id");
      const b = await body(req);
      let u;
      try { u = await verify(String(b.credential || "")); } catch (e) { console.error("auth failed:", e.message); throw err(401, "bad_token"); }
      return send(res, 200, { token: newSession(u), email: u.email, name: u.name });
    }

    const me = authed(req);
    if (!me) throw err(401, "unauthorized");
    if (limited("u" + me.key, 240)) throw err(429, "rate");
    if (me.deviceId && route !== "POST /device/report") throw err(403, "forbidden");

    if (route === "GET /me") return send(res, 200, { email: me.email, name: me.name });
    if (route === "POST /auth/logout") { delete db.sessions[me.key]; save(); return send(res, 200, { ok: true }); }

    // ---- own devices (one account) ----
    if (route === "GET /devices") return send(res, 200, { devices: Object.values(db.devices[me.email] || {}) });
    if (route === "POST /device") {
      const b = await body(req), id = String(b.id);
      if (!/^[\w-]{4,64}$/.test(id)) throw err(400, "bad_body");
      const list = (db.devices[me.email] ||= {});
      if (!list[id] && Object.keys(list).length >= 20) throw err(400, "too_many");
      const d = (list[id] ||= { id });
      d.name = String(b.name || d.name || "Device").slice(0, 40);
      d.kind = ["phone", "laptop", "tablet", "camera", "other"].includes(b.kind) ? b.kind : d.kind || "other";
      const la = num(b.lat, -90, 90), lo = num(b.lon, -180, 180);
      if (la !== null && lo !== null) { d.lat = la; d.lon = lo; d.acc = num(b.acc, 0, 1e6) ?? 0; d.t = Date.now(); }
      save();
      return send(res, 200, { ok: true });
    }
    if (route === "POST /device/remove") {
      const b = await body(req), id = String(b.id);
      if (db.devices[me.email]) delete db.devices[me.email][id];
      for (const [k, v] of Object.entries(db.devkeys)) if (v.email === me.email && v.id === id) delete db.devkeys[k];
      save();
      return send(res, 200, { ok: true });
    }
    // a gadget that can only send HTTP (camera, board, other phone) gets a key that can ONLY report its own location
    if (route === "POST /device/key") {
      const b = await body(req), id = String(b.id), d = (db.devices[me.email] || {})[id];
      if (!d) throw err(404, "not_found");
      for (const [k, v] of Object.entries(db.devkeys)) if (v.email === me.email && v.id === id) delete db.devkeys[k];
      const key = "ck_" + crypto.randomBytes(24).toString("base64url");
      db.devkeys[sha(key)] = { email: me.email, id };
      d.keyed = true;
      save();
      return send(res, 200, { key });
    }
    if (route === "POST /device/report") {
      if (!me.deviceId) throw err(403, "forbidden");
      const b = await body(req), d = (db.devices[me.email] || {})[me.deviceId];
      const la = num(b.lat, -90, 90), lo = num(b.lon, -180, 180);
      if (!d) throw err(404, "not_found");
      if (la === null || lo === null) throw err(400, "bad_body");
      d.lat = la; d.lon = lo; d.acc = num(b.acc, 0, 1e6) ?? 0; d.t = Date.now();
      save();
      return send(res, 200, { ok: true });
    }

    // ---- two-person sharing (needs the other person to accept) ----
    if (route === "GET /shares") {
      const all = Object.values(db.shares).filter(open);
      const out = all.filter((s) => s.from === me.email).map(({ id, to, minutes, state, until, mutual }) => ({ id, to, minutes, state, until, mutual: !!mutual }));
      const inc = all.filter((s) => s.to === me.email && !s.blocked).map((s) => ({
        id: s.id, from: s.from, fromName: s.fromName, minutes: s.minutes, state: s.state, until: s.until, mutual: !!s.mutual,
        loc: s.state === "active" ? db.loc[s.from] || null : null,
      }));
      return send(res, 200, { out, in: inc });
    }
    if (route === "POST /share") {
      const b = await body(req);
      const to = String(b.to || "").trim().toLowerCase();
      if (!EMAIL.test(to)) throw err(400, "bad_email");
      if (to === me.email) throw err(400, "self");
      if (![0, 30, 60].includes(b.minutes)) throw err(400, "bad_minutes");
      const mine = Object.values(db.shares).filter((s) => s.from === me.email && open(s));
      if (mine.some((s) => s.to === to)) throw err(409, "exists");
      if (mine.length >= 10) throw err(400, "too_many");
      const id = crypto.randomBytes(8).toString("hex");
      const blocked = (db.blocks[to] || []).includes(me.email); // looks like "waiting" to the sender, invisible to the receiver
      db.shares[id] = { id, from: me.email, fromName: me.name, to, minutes: b.minutes, state: "pending", created: Date.now(), until: null, mutual: b.mutual === true, blocked };
      save();
      return send(res, 200, { id });
    }
    if (route === "POST /share/respond") {
      const b = await body(req), s = db.shares[String(b.id)];
      if (!s || s.to !== me.email || s.blocked || s.state !== "pending" || !open(s)) throw err(404, "not_found");
      if (b.accept === true) {
        s.state = "active"; s.accepted = Date.now(); s.until = s.minutes ? s.accepted + s.minutes * 60000 : null;
        // "both ways": one yes also starts the share back, same end time
        const hasBack = Object.values(db.shares).some((x) => x.from === s.to && x.to === s.from && open(x));
        if (s.mutual && !hasBack && !(db.blocks[s.from] || []).includes(s.to)) {
          const rid = crypto.randomBytes(8).toString("hex");
          db.shares[rid] = { id: rid, from: s.to, fromName: me.name, to: s.from, minutes: s.minutes, state: "active", created: s.accepted, accepted: s.accepted, until: s.until, mutual: true };
        }
      } else {
        end(s);
        if (b.block === true) {
          const L = (db.blocks[me.email] ||= []);
          if (!L.includes(s.from) && L.length < 100) L.push(s.from);
          for (const x of Object.values(db.shares)) if (x.from === s.from && x.to === me.email && open(x)) { end(x); dropLoc(x.from); }
        }
      }
      save();
      return send(res, 200, { ok: true });
    }
    if (route === "POST /share/stop") {
      const b = await body(req), s = db.shares[String(b.id)];
      if (!s || (s.from !== me.email && s.to !== me.email) || s.state === "ended") throw err(404, "not_found");
      end(s);
      dropLoc(s.from);
      save();
      return send(res, 200, { ok: true });
    }
    if (route === "POST /share/stop-all") {
      let n = 0;
      for (const s of Object.values(db.shares)) if (s.from === me.email && open(s)) { end(s); n++; }
      for (const l of Object.values(db.links)) if (l.from === me.email && liveLink(l)) { l.state = "ended"; l.ended = Date.now(); n++; }
      dropLoc(me.email);
      save();
      return send(res, 200, { n });
    }
    if (route === "GET /blocks") return send(res, 200, { blocks: db.blocks[me.email] || [] });
    if (route === "POST /unblock") {
      const b = await body(req), e = String(b.email || "").toLowerCase();
      db.blocks[me.email] = (db.blocks[me.email] || []).filter((x) => x !== e);
      save();
      return send(res, 200, { ok: true });
    }
    if (route === "POST /loc") {
      const b = await body(req);
      const la = num(b.lat, -90, 90), lo = num(b.lon, -180, 180);
      if (la === null || lo === null) throw err(400, "bad_body");
      if (!hasActive(me.email) && !histOn(me.email)) throw err(409, "no_active_share");
      const p = { lat: la, lon: lo, acc: num(b.acc, 0, 1e6) ?? 0, t: Date.now() };
      if (hasActive(me.email)) db.loc[me.email] = p;
      if (histOn(me.email)) pushHist(me.email, p);
      save();
      return send(res, 200, { ok: true });
    }
    // points saved on the phone while offline: sent again later with their own time (last 24 h only)
    if (route === "POST /loc/batch") {
      const b = await body(req), n = Date.now();
      if (!Array.isArray(b.points) || b.points.length > 50) throw err(400, "bad_body");
      if (!hasActive(me.email) && !histOn(me.email)) throw err(409, "no_active_share");
      let kept = 0;
      for (const q of b.points) {
        const la = num(q && q.lat, -90, 90), lo = num(q && q.lon, -180, 180), t = num(q && q.t, n - DAY, n + 60000);
        if (la === null || lo === null || t === null) continue;
        const p = { lat: la, lon: lo, acc: num(q.acc, 0, 1e6) ?? 0, t: Math.min(t, n) };
        if (hasActive(me.email) && (!db.loc[me.email] || db.loc[me.email].t <= p.t)) db.loc[me.email] = p;
        if (histOn(me.email)) pushHist(me.email, p);
        kept++;
      }
      save();
      return send(res, 200, { kept });
    }

    // ---- share link (token, always expires; only a hash is stored; the viewer needs no account) ----
    if (route === "POST /link") {
      const b = await body(req);
      if (![30, 60, 1440, 10080].includes(b.minutes)) throw err(400, "bad_minutes");
      const mine = Object.values(db.links).filter((l) => l.from === me.email && liveLink(l));
      if (mine.length >= 10) throw err(400, "too_many");
      const id = crypto.randomBytes(8).toString("hex"), token = crypto.randomBytes(24).toString("base64url");
      db.links[id] = { id, from: me.email, label: String(b.label || "").slice(0, 40), th: sha(token), created: Date.now(), until: Date.now() + b.minutes * 60000, state: "active" };
      save();
      return send(res, 200, { id, token, path: "/s/" + token, until: db.links[id].until }); // token is shown only once
    }
    if (route === "GET /links") {
      const out = Object.values(db.links).filter((l) => l.from === me.email).map(({ id, label, created, until, state }) => ({ id, label, created, until, state: state === "active" && until <= Date.now() ? "ended" : state }));
      return send(res, 200, { links: out });
    }
    if (route === "POST /link/stop" || route === "POST /link/remove") {
      const b = await body(req), l = db.links[String(b.id)];
      if (!l || l.from !== me.email) throw err(404, "not_found");
      if (route === "POST /link/remove") delete db.links[l.id]; else if (l.state === "active") { l.state = "ended"; l.ended = Date.now(); }
      dropLoc(me.email);
      save();
      return send(res, 200, { ok: true });
    }

    // ---- photo scan records (the app sends only what the user chose; no pictures) ----
    if (route === "POST /scan") {
      const b = await body(req), id = String(b.id || "");
      if (!/^[\w-]{8,64}$/.test(id)) throw err(400, "bad_body");
      const mine = (db.scans[me.email] ||= {});
      if (!mine[id] && Object.keys(mine).length >= 5000) throw err(400, "too_many");
      const gps = b.hasGps === true;
      const la = num(b.lat, -90, 90), lo = num(b.lon, -180, 180);
      if (gps && (la === null || lo === null)) throw err(400, "bad_body");
      const txt = (v) => (typeof v === "string" ? v.trim().slice(0, 60) : "");
      mine[id] = { id, hasGps: gps, lat: gps ? la : null, lon: gps ? lo : null, country: gps ? txt(b.country) : "", city: gps ? txt(b.city) : "",
        count: Math.round(num(b.count, 0, 1e5) ?? 0), at: num(b.at, 0, Date.now() + 60000) ?? Date.now(), source: ["camera", "gallery", "bulk", "r360"].includes(b.source) ? b.source : "gallery" };
      save();
      return send(res, 200, { ok: true });
    }
    if (route === "GET /scans") return send(res, 200, { scans: Object.values(db.scans[me.email] || {}).sort((a, b) => b.at - a.at).slice(0, 200) });
    if (route === "POST /scan/remove") {
      const b = await body(req);
      if (db.scans[me.email]) delete db.scans[me.email][String(b.id)];
      save();
      return send(res, 200, { ok: true });
    }
    if (route === "POST /scan/clear") { delete db.scans[me.email]; save(); return send(res, 200, { ok: true }); }

    // ---- counts for the dashboard: real records only, never double-counted (scans are keyed by id) ----
    if (route === "GET /stats") {
      const sc = Object.values(db.scans[me.email] || {}), n = Date.now();
      const places = new Set(sc.filter((x) => x.hasGps).map((x) => x.lat.toFixed(4) + "," + x.lon.toFixed(4)));
      const dev = Object.values(db.devices[me.email] || {});
      const links = Object.values(db.links).filter((l) => l.from === me.email);
      return send(res, 200, {
        photos: { total: sc.length, withGps: sc.filter((x) => x.hasGps).length, withoutGps: sc.filter((x) => !x.hasGps).length },
        locations: places.size,
        countries: new Set(sc.filter((x) => x.country).map((x) => x.country.toLowerCase())).size,
        cities: new Set(sc.filter((x) => x.city).map((x) => (x.country + "|" + x.city).toLowerCase())).size,
        devices: dev.length,
        devicesLive: dev.filter((d) => d.t && n - d.t < 5 * 60000).length,
        shares: Object.values(db.shares).filter((s) => s.from === me.email && live(s)).length,
        links: { active: links.filter(liveLink).length, expired: links.filter((l) => !liveLink(l)).length },
        history: (db.hist[me.email] || []).length,
      });
    }

    // ---- GPS history: OFF by default; the user turns it on and picks how many days to keep ----
    if (route === "GET /history/settings") return send(res, 200, { enabled: histOn(me.email), days: (db.hset[me.email] || {}).days || 7 });
    if (route === "POST /history/settings") {
      const b = await body(req), d = Math.round(num(b.days, 1, 90) ?? 7);
      db.hset[me.email] = { enabled: b.enabled === true, days: d };
      if (b.enabled !== true) delete db.hist[me.email];
      save();
      return send(res, 200, { enabled: b.enabled === true, days: d });
    }
    if (route === "GET /history") return send(res, 200, { points: db.hist[me.email] || [] });
    if (route === "POST /history/clear") { delete db.hist[me.email]; save(); return send(res, 200, { ok: true }); }
    throw err(404, "not_found");
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      if (!e.status) console.error(e);
      if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : "server" });
      else res.end();
    });
  });
  return { server, flush, sweep, clientId };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.argv[2] || process.env.CAI_SHARE_PORT || 5181);
  const host = process.env.CAI_SHARE_HOST || "127.0.0.1";
  const { server, flush, sweep, clientId } = makeServer();
  if (!clientId) console.warn("no Google Client ID: put it in ~/.cai-google-client-id");
  sweep();
  setInterval(sweep, 10 * 60e3).unref();
  setInterval(flush, 2000).unref();
  for (const sg of ["SIGINT", "SIGTERM"]) process.on(sg, () => { flush(); process.exit(0); });
  server.listen(port, host, () => console.log(`CAI share on ${host}:${port}`));
}
