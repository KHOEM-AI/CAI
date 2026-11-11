// node --test test/   (no network; same harness style as share.test.mjs)
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeServer } from "../share-server.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cai-gps-"));
const dbFile = path.join(tmp, "db.json"), pageFile = path.join(tmp, "page.html");
fs.writeFileSync(pageFile, "<html><head></head><body>page</body></html>");
const verify = async (c) => ({ email: c + "@x.com", name: c });
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
  const text = await r.text();
  let j = {}; try { j = JSON.parse(text); } catch {}
  return { s: r.status, j, text, h: r.headers };
}
const login = async (u) => (await call("/auth/google", { credential: u })).j.token;

test("the viewer page script is valid JavaScript", async () => {
  const A = await login("zed");
  const l = await call("/link", { minutes: 30 }, A);
  const page = await call(l.j.path);
  const js = /<script>([\s\S]*)<\/script>/.exec(page.text)[1];
  new Function(js); // throws on a syntax error
  assert.equal(page.h.get("referrer-policy"), "no-referrer");
});

test("share link: needs a login to create, expires, hides the owner, can be stopped and deleted", async () => {
  const A = await login("alice");
  assert.equal((await call("/link", { minutes: 30 })).s, 401);
  assert.equal((await call("/link", { minutes: 5 }, A)).s, 400, "only fixed lifetimes, always expiring");
  assert.equal((await call("/link", { minutes: 0 }, A)).s, 400, "no forever link");
  const l = await call("/link", { minutes: 60, label: "Trip" }, A);
  assert.equal(l.s, 200);
  assert.match(l.j.path, /^\/s\/[\w-]{32}$/);
  assert.equal((await call("/loc", { lat: 11.5, lon: 104.9, acc: 8 }, A)).s, 200, "a live link counts as sharing");
  const data = await call(l.j.path + "/data");
  assert.equal(data.s, 200, "the viewer needs no account");
  assert.equal(data.j.loc.lat, 11.5);
  assert.equal(data.j.label, "Trip");
  assert.ok(!data.text.includes("alice"), "owner email never shown");
  assert.equal((await call("/s/" + "x".repeat(32) + "/data")).s, 404, "wrong token");
  const list = JSON.stringify((await call("/links", undefined, A)).j);
  assert.ok(!list.includes(l.j.token), "the token itself is not stored or listed");
  assert.equal((await call("/link/stop", { id: l.j.id }, await login("bob"))).s, 404, "only the owner can stop it");
  assert.equal((await call("/link/stop", { id: l.j.id }, A)).s, 200);
  assert.equal((await call(l.j.path + "/data")).s, 410);
  assert.equal((await call("/loc", { lat: 1, lon: 1 }, A)).j.error, "no_active_share", "location is dropped after the last link ends");
  assert.equal((await call("/link/remove", { id: l.j.id }, A)).s, 200);
  assert.equal((await call(l.j.path + "/data")).s, 404);
});

test("stop-all also ends share links", async () => {
  const C = await login("carol");
  const l = await call("/link", { minutes: 30 }, C);
  assert.equal((await call("/share/stop-all", {}, C)).j.n, 1);
  assert.equal((await call(l.j.path + "/data")).s, 410);
});

test("scans: no duplicates, bad GPS refused, counts are real", async () => {
  const D = await login("dave");
  const s1 = { id: "photo-0001", hasGps: true, lat: 11.5564, lon: 104.9282, country: "Cambodia", city: "Phnom Penh", count: 4, source: "gallery" };
  assert.equal((await call("/scan", s1, D)).s, 200);
  assert.equal((await call("/scan", s1, D)).s, 200, "same id again");
  assert.equal((await call("/scan", { id: "photo-0002", hasGps: false, count: 2 }, D)).s, 200);
  assert.equal((await call("/scan", { id: "photo-0003", hasGps: true, lat: 999, lon: 1 }, D)).s, 400);
  assert.equal((await call("/scan", { id: "x" }, D)).s, 400);
  const st = (await call("/stats", undefined, D)).j;
  assert.deepEqual(st.photos, { total: 2, withGps: 1, withoutGps: 1 });
  assert.equal(st.locations, 1);
  assert.equal(st.countries, 1);
  assert.equal(st.cities, 1);
  const E = await login("erin");
  assert.equal((await call("/stats", undefined, E)).j.photos.total, 0, "another account sees none of it");
  assert.equal((await call("/scan/remove", { id: "photo-0001" }, D)).s, 200);
  assert.equal((await call("/stats", undefined, D)).j.photos.total, 1);
  await call("/scan/clear", {}, D);
  assert.equal((await call("/stats", undefined, D)).j.photos.total, 0);
});

test("GPS history: off by default, opt-in, offline batch, clear, turning off deletes", async () => {
  const F = await login("frank");
  assert.equal((await call("/history/settings", undefined, F)).j.enabled, false);
  assert.equal((await call("/loc", { lat: 1, lon: 1 }, F)).j.error, "no_active_share", "nothing is stored by default");
  assert.equal((await call("/history/settings", { enabled: true, days: 30 }, F)).j.days, 30);
  assert.equal((await call("/loc", { lat: 11.5, lon: 104.9, acc: 5 }, F)).s, 200);
  const now = Date.now();
  const batch = await call("/loc/batch", { points: [
    { lat: 11.51, lon: 104.91, acc: 5, t: now - 3600e3 },
    { lat: 11.52, lon: 104.92, acc: 5, t: now - 1800e3 },
    { lat: 999, lon: 1, t: now - 1000 },                 // bad
    { lat: 11.5, lon: 104.9, t: now - 3 * 864e5 },       // older than 24 h
    { lat: 11.5, lon: 104.9, t: now + 3600e3 },          // in the future
  ] }, F);
  assert.equal(batch.j.kept, 2);
  assert.equal((await call("/loc/batch", { points: new Array(51).fill({}) }, F)).s, 400);
  const h = (await call("/history", undefined, F)).j.points;
  assert.equal(h.length, 3);
  assert.ok(h[0].t < h[1].t && h[1].t < h[2].t, "sorted by time");
  assert.equal((await call("/history/clear", {}, F)).s, 200);
  assert.equal((await call("/history", undefined, F)).j.points.length, 0);
  await call("/loc", { lat: 11.5, lon: 104.9 }, F);
  await call("/history/settings", { enabled: false }, F);
  assert.equal((await call("/history", undefined, F)).j.points.length, 0, "turning it off deletes the data");
});

test("history is saved even when only the account is tracking, but location is not shown to anyone", async () => {
  const G = await login("grace");
  await call("/history/settings", { enabled: true, days: 1 }, G);
  await call("/loc", { lat: 5, lon: 5 }, G);
  assert.equal((await call("/stats", undefined, G)).j.history, 1);
  assert.ok(!JSON.stringify(await call("/shares", undefined, await login("heidi"))).includes('"lat":5'));
});
