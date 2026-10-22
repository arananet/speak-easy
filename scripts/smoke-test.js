#!/usr/bin/env node
// Functional smoke test for the built worker. Stubs env (no AI binding)
// and exercises login, sessions, static routes, and input validation.
"use strict";

(async () => {
  const worker = (await import("../dist/worker.js")).default;
  const { randomUUID } = await import("node:crypto");
  const testPassword = "smoke-test-" + randomUUID(); // random per run, never a real secret
  const env = { APP_PASSWORD: testPassword };
  const req = (path, opts = {}) => new Request("https://smoke.test" + path, opts);
  const results = [];
  const check = (name, ok) => {
    results.push([name, ok]);
    if (!ok) console.error("FAIL:", name);
  };

  const login = (body, e = env) => worker.fetch(req("/api/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }), e);

  let r = await worker.fetch(req("/"), env);
  let t = await r.text();
  check("unauth root shows login page", r.status === 200 && t.includes("Contrase") && t.includes("Usuario"));

  r = await worker.fetch(req("/api/phrases"), env);
  check("unauth api is 401", r.status === 401);

  r = await login({ username: "eduardo", password: "wrong" });
  check("wrong password is 401", r.status === 401);

  r = await login({ username: "nadie", password: testPassword });
  check("unknown user is 401", r.status === 401);

  // Legacy fallback: with only APP_PASSWORD configured, it signs in either user.
  r = await login({ username: "eduardo", password: testPassword });
  const setCookie = r.headers.get("Set-Cookie") || "";
  check("fallback login sets HttpOnly Secure cookie",
    r.status === 200 && /HttpOnly/.test(setCookie) && /Secure/.test(setCookie));
  const cookie = setCookie.split(";")[0];
  check("session cookie identifies the user", cookie.includes(".eduardo."));
  const authed = { headers: { Cookie: cookie } };

  r = await login({ username: "blanquita", password: testPassword });
  check("fallback login works for blanquita too", r.status === 200);

  // Both per-user secrets set: own secret works, shared APP_PASSWORD stops working.
  const envUsers = {
    BLANQUITA_PASSWORD: "blan-" + randomUUID(),
    EDUARDO_PASSWORD: "edu-" + randomUUID(),
    APP_PASSWORD: testPassword,
  };
  r = await login({ username: "blanquita", password: envUsers.BLANQUITA_PASSWORD }, envUsers);
  check("blanquita logs in with her own secret", r.status === 200);
  r = await login({ username: "eduardo", password: envUsers.EDUARDO_PASSWORD }, envUsers);
  check("eduardo logs in with his own secret", r.status === 200);
  r = await login({ username: "eduardo", password: envUsers.BLANQUITA_PASSWORD }, envUsers);
  check("eduardo cannot use blanquita's secret", r.status === 401);
  r = await login({ username: "blanquita", password: testPassword }, envUsers);
  check("APP_PASSWORD fallback retires once both secrets are set", r.status === 401);

  // Only one per-user secret set: the fallback still covers the other user.
  const envPartial = { BLANQUITA_PASSWORD: envUsers.BLANQUITA_PASSWORD, APP_PASSWORD: testPassword };
  r = await login({ username: "eduardo", password: testPassword }, envPartial);
  check("fallback still covers eduardo while his secret is unset", r.status === 200);
  r = await login({ username: "blanquita", password: envUsers.BLANQUITA_PASSWORD }, envPartial);
  check("blanquita's own secret already works in partial config", r.status === 200);

  r = await worker.fetch(req("/", authed), env);
  t = await r.text();
  check("authed root shows app", r.status === 200 && t.includes("Frases para practicar"));

  for (const [p, ct] of [["/app.js", "application/javascript"], ["/styles.css", "text/css"]]) {
    r = await worker.fetch(req(p, authed), env);
    check("authed " + p + " served", r.status === 200 &&
      (r.headers.get("Content-Type") || "").includes(ct));
  }

  r = await worker.fetch(req("/api/phrases", authed), env);
  const phrases = await r.json();
  check("phrases has 3 packs", r.status === 200 && phrases.packs.length === 3);

  r = await worker.fetch(req("/api/phrases", { headers: { Cookie: "se_sess=1.deadbeef" } }), env);
  check("tampered cookie is 401", r.status === 401);

  r = await worker.fetch(req("/api/logout", { method: "POST", ...authed }), env);
  check("logout clears cookie", /Max-Age=0/.test(r.headers.get("Set-Cookie") || ""));

  r = await login({ username: "eduardo", password: "whatever" }, {});
  check("no password configured at all is 500", r.status === 500);

  r = await worker.fetch(req("/api/translate", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ text: "" }),
  }), env);
  check("empty input is 400", r.status === 400);

  r = await worker.fetch(req("/api/translate", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ text: "x".repeat(401) }),
  }), env);
  check("oversize input is 400", r.status === 400);

  const failed = results.filter(([, ok]) => !ok);
  console.log(failed.length === 0
    ? `smoke test passed (${results.length} checks)`
    : `smoke test FAILED (${failed.length}/${results.length})`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => { console.error("smoke test error:", e); process.exit(1); });
