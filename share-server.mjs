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

export function makeServer({ dbFile, clientId, verify, pageFile } = {}) {
  const home = os.homedir();
  dbFile ||= path.join(home, ".cai-share.json");
  pageFile ||= path.join(HERE, "cai-scan.html");
  const cidFile = path.join(home, ".cai-google-client-id");
  clientId ??= (process.env.GOOGLE_CLIENT_ID || (fs.existsSync(cidFile) ? fs.readFileSync(cidFile, "utf8") : "")).trim();
  verify ||= (tok) => verifyGoogle(tok, clientId);

  let db = { sessions: {}, shares: {}, devices: {}, loc: {}, blocks: {}, devkeys: {} };
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
  const hasActive = (email) => Object.values(db.shares).some((s) => s.from === email && live(s));
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
      if (!hasActive(me.email)) throw err(409, "no_active_share");
      db.loc[me.email] = { lat: la, lon: lo, acc: num(b.acc, 0, 1e6) ?? 0, t: Date.now() };
      save();
      return send(res, 200, { ok: true });
    }
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
