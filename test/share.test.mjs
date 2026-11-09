// node --test test/   (no network, no Google: the sign-in check is injected, the real RS256 check is tested with a local key)
import test, { after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeServer, verifyGoogle } from "../share-server.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cai-share-"));
const dbFile = path.join(tmp, "db.json"), pageFile = path.join(tmp, "page.html");
fs.writeFileSync(pageFile, "<html><head></head><body>page</body></html>");
const names = ["alice", "bob", "carol", "dave", "erin", "mallory", "frank", "grace", "heidi"];
const verify = async (c) => { if (!names.includes(c)) throw new Error("bad"); return { email: c + "@x.com", name: c[0].toUpperCase() + c.slice(1) }; };
const app = makeServer({ dbFile, pageFile, clientId: "cid", verify });
await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${app.server.address().port}`;
after(() => { app.server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

async function call(p, body, tok) {
  const r = await fetch(base + p, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(tok ? { Authorization: "Bearer " + tok } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { s: r.status, j: await r.json().catch(() => ({})) };
}
const login = async (u) => (await call("/auth/google", { credential: u })).j.token;
const shares = async (tok) => (await call("/shares", undefined, tok)).j;

test("sign-in: bad token refused, no token = 401, good token works", async () => {
  assert.equal((await call("/auth/google", { credential: "nope" })).s, 401);
  assert.equal((await call("/me")).s, 401);
  assert.equal((await call("/shares", undefined, "fake")).s, 401);
  const t = await login("alice");
  assert.equal((await call("/me", undefined, t)).j.email, "alice@x.com");
  await call("/auth/logout", {}, t);
  assert.equal((await call("/me", undefined, t)).s, 401);
});

test("sharing needs a yes; location reaches only the receiver while active; stop deletes it", async () => {
  const [A, B, C] = [await login("alice"), await login("bob"), await login("carol")];
  assert.equal((await call("/loc", { lat: 1, lon: 1 }, A)).j.error, "no_active_share");
  const sh = await call("/share", { to: "Bob@X.com ", minutes: 60 }, A);
  assert.equal(sh.s, 200);
  assert.equal((await call("/share", { to: "bob@x.com", minutes: 30 }, A)).s, 409, "duplicate");
  let b = await shares(B);
  assert.equal(b.in[0].state, "pending");
  assert.equal(b.in[0].loc, null);
  assert.equal((await call("/loc", { lat: 1, lon: 1 }, A)).j.error, "no_active_share", "pending is not enough");
  assert.equal((await call("/share/respond", { id: sh.j.id, accept: true }, C)).s, 404, "a third person cannot accept");
  assert.equal((await call("/share/respond", { id: sh.j.id, accept: true }, A)).s, 404, "the sender cannot accept");
  assert.equal((await call("/share/respond", { id: sh.j.id, accept: true }, B)).s, 200);
  assert.equal((await call("/loc", { lat: 999, lon: 1 }, A)).s, 400);
  assert.equal((await call("/loc", { lat: 11.5, lon: 104.9, acc: 12 }, A)).s, 200);
  b = await shares(B);
  assert.equal(b.in[0].loc.lat, 11.5);
  assert.ok(b.in[0].until > Date.now());
  assert.ok(!JSON.stringify(await shares(C)).includes("11.5"), "a stranger never sees it");
  assert.equal((await call("/share/stop", { id: sh.j.id }, B)).s, 200, "the receiver can stop it too");
  assert.equal((await shares(B)).in.length, 0);
  assert.equal((await call("/loc", { lat: 1, lon: 1 }, A)).j.error, "no_active_share");
  app.flush();
  assert.ok(!JSON.parse(fs.readFileSync(dbFile, "utf8")).loc["alice@x.com"], "stored location is deleted");
});

test("both ways with one yes; stop-all ends only my own outgoing shares", async () => {
  const [C, D] = [await login("carol"), await login("dave")];
  const sh = await call("/share", { to: "dave@x.com", minutes: 0, mutual: true }, C);
  assert.equal((await shares(D)).in[0].mutual, true);
  await call("/share/respond", { id: sh.j.id, accept: true }, D);
  await call("/loc", { lat: 11.5, lon: 104.9 }, C);
  await call("/loc", { lat: 12.5, lon: 105.9 }, D);
  assert.equal((await shares(C)).in[0].loc.lat, 12.5);
  assert.equal((await shares(D)).in[0].loc.lat, 11.5);
  assert.equal((await shares(D)).in[0].until, null, "24/7 has no end time");
  await call("/share/stop-all", {}, C);
  assert.equal((await shares(D)).in.length, 0);
  assert.equal((await shares(C)).in.length, 1, "dave's share to carol stays until dave stops it");
  await call("/share/stop-all", {}, D);
});

test("block: invisible to the receiver, looks like 'waiting' to the sender, can be undone", async () => {
  const [M, E] = [await login("mallory"), await login("erin")];
  const first = await call("/share", { to: "erin@x.com", minutes: 0 }, M);
  const id = (await shares(E)).in.find((s) => s.from === "mallory@x.com").id;
  assert.equal(id, first.j.id);
  await call("/share/respond", { id, accept: false, block: true }, E);
  assert.deepEqual((await call("/blocks", undefined, E)).j.blocks, ["mallory@x.com"]);
  const again = await call("/share", { to: "erin@x.com", minutes: 0 }, M);
  assert.equal(again.s, 200, "no hint that it is blocked");
  assert.ok((await shares(M)).out.some((s) => s.to === "erin@x.com" && s.state === "pending"));
  assert.equal((await shares(E)).in.length, 0);
  assert.equal((await call("/share/respond", { id: again.j.id, accept: true }, E)).s, 404);
  await call("/unblock", { email: "mallory@x.com" }, E);
  assert.deepEqual((await call("/blocks", undefined, E)).j.blocks, []);
});

test("input checks", async () => {
  const A = await login("alice");
  assert.equal((await call("/share", { to: "nope", minutes: 30 }, A)).j.error, "bad_email");
  assert.equal((await call("/share", { to: "alice@x.com", minutes: 30 }, A)).j.error, "self");
  assert.equal((await call("/share", { to: "bob@x.com", minutes: 5 }, A)).j.error, "bad_minutes");
  assert.equal((await call("/share", { to: "bob@x.com", minutes: "30" }, A)).j.error, "bad_minutes");
  assert.equal((await call("/share", { to: "x@y.com", minutes: 30, pad: "x".repeat(30000) }, A)).s, 413);
  assert.equal((await call("/nothing", undefined, A)).s, 404);
});

test("a gadget key can ONLY report that one device's location", async () => {
  const F = await login("frank");
  await call("/device", { id: "cam-01", name: "Door camera", kind: "camera" }, F);
  assert.equal((await call("/device/key", { id: "nope-999" }, F)).s, 404);
  const k = (await call("/device/key", { id: "cam-01" }, F)).j.key;
  assert.match(k, /^ck_/);
  assert.equal((await call("/device/report", { lat: 11.55, lon: 104.92, acc: 5 }, k)).s, 200);
  const dev = (await call("/devices", undefined, F)).j.devices[0];
  assert.equal(dev.lat, 11.55);
  assert.equal((await call("/shares", undefined, k)).s, 403);
  assert.equal((await call("/devices", undefined, k)).s, 403);
  assert.equal((await call("/share", { to: "bob@x.com", minutes: 30 }, k)).s, 403);
  assert.equal((await call("/device/report", { lat: 1, lon: 1 }, F)).s, 403, "a normal session cannot use the gadget route");
  assert.equal((await call("/device/report", { lat: 999, lon: 1 }, k)).s, 400);
  const k2 = (await call("/device/key", { id: "cam-01" }, F)).j.key;
  assert.equal((await call("/device/report", { lat: 1, lon: 1 }, k)).s, 401, "old key dies on re-issue");
  app.flush();
  assert.ok(!fs.readFileSync(dbFile, "utf8").includes(k2), "the raw key is never stored");
  await call("/device/remove", { id: "cam-01" }, F);
  assert.equal((await call("/device/report", { lat: 1, lon: 1 }, k2)).s, 401, "key dies with the device");
  assert.equal((await call("/devices", undefined, await login("grace"))).j.devices.length, 0, "another account sees nothing");
});

test("serves the page with the API address injected, but never the source", async () => {
  const r = await fetch(base + "/");
  const html = await r.text();
  assert.equal(r.status, 200);
  assert.ok(html.includes("<head><script>window.CAI_SHARE_API=location.origin</script>"));
  const src = await fetch(base + "/share-server.mjs");
  assert.notEqual(src.status, 200);
  assert.ok(!(await src.text()).includes("createServer"));
});

test("a finished share disappears (time passes while the server is off)", async () => {
  const [H, B] = [await login("heidi"), await login("bob")];
  const sh = await call("/share", { to: "bob@x.com", minutes: 30 }, H);
  await call("/share/respond", { id: sh.j.id, accept: true }, B);
  app.flush();
  const db = JSON.parse(fs.readFileSync(dbFile, "utf8"));
  db.shares[sh.j.id].until = Date.now() - 1000;
  const f2 = path.join(tmp, "db2.json");
  fs.writeFileSync(f2, JSON.stringify(db));
  const b2 = makeServer({ dbFile: f2, pageFile, clientId: "cid", verify: async () => ({ email: "bob@x.com", name: "Bob" }) });
  await new Promise((r) => b2.server.listen(0, "127.0.0.1", r));
  const u = `http://127.0.0.1:${b2.server.address().port}`;
  const tok = (await (await fetch(u + "/auth/google", { method: "POST", body: JSON.stringify({ credential: "x" }) })).json()).token;
  const list = await (await fetch(u + "/shares", { headers: { Authorization: "Bearer " + tok } })).json();
  assert.ok(!list.in.some((s) => s.id === sh.j.id));
  b2.server.close();
});

test("Google token check: signature, issuer, audience, expiry, verified email", async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
  const real = globalThis.fetch;
  globalThis.fetch = (u, ...a) => (String(u).includes("googleapis.com") ? Promise.resolve({ ok: true, json: async () => ({ keys: [jwk] }) }) : real(u, ...a));
  try {
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const mk = (pay, kid = "k1", key = privateKey) => {
      const h = enc({ alg: "RS256", kid }), p = enc(pay);
      return h + "." + p + "." + crypto.sign("RSA-SHA256", Buffer.from(h + "." + p), key).toString("base64url");
    };
    const good = { iss: "https://accounts.google.com", aud: "cid", exp: Math.floor(Date.now() / 1000) + 600, email: "Me@Gmail.com", email_verified: true, name: "Me" };
    assert.equal((await verifyGoogle(mk(good), "cid")).email, "me@gmail.com");
    const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    for (const [why, tok] of [
      ["audience", mk({ ...good, aud: "other" })], ["expired", mk({ ...good, exp: 1 })], ["issuer", mk({ ...good, iss: "https://evil.com" })],
      ["unverified email", mk({ ...good, email_verified: false })], ["unknown key", mk(good, "zzz")], ["forged signature", mk(good, "k1", other)], ["garbage", "a.b"],
    ]) await assert.rejects(verifyGoogle(tok, "cid"), undefined, why);
  } finally { globalThis.fetch = real; }
});
