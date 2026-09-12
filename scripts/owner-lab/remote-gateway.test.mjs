import test from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { createRemoteGateway } from "./remote-gateway.mjs";

test("remote rehearsal gates every route, scopes sessions, and translates only authenticated local traffic", async (t) => {
  const code = "test-only-owner-code-".repeat(2);
  const origin = "https://owner-preview-test.trycloudflare.com";
  let received;
  const local = createServer((req, res) => {
    received = req.headers;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        signedUrl: `http://127.0.0.1:${local.address().port}/storage/v1/private`,
        method: req.method,
      }),
    );
  });
  await new Promise((done) => local.listen(0, "127.0.0.1", done));
  let clock = Date.now();
  const upstream = `http://127.0.0.1:${local.address().port}`;
  const gate = createRemoteGateway({
    code,
    upstream,
    getPublicOrigin: () => origin,
    now: () => clock,
  });
  await new Promise((done) => gate.listen(0, "127.0.0.1", done));
  t.after(() => {
    gate.closeAllConnections();
    gate.close();
    local.closeAllConnections();
    local.close();
  });
  const base = `http://127.0.0.1:${gate.address().port}`;
  const call = (path, options = {}) =>
    new Promise((done, reject) => {
      const req = request(
        base + path,
        {
          method: options.method || "GET",
          headers: { host: new URL(origin).host, ...options.headers },
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () =>
            done(
              new Response(Buffer.concat(chunks), {
                status: res.statusCode,
                headers: res.headers,
              }),
            ),
          );
        },
      );
      req.on("error", reject);
      req.end(options.body);
    });
  assert.equal((await fetch(base)).status, 403);
  // Form navigation needs its same-origin Origin header; no-referrer would suppress it.
  assert.equal(
    (await call("/admin/", { headers: { accept: "text/html" } })).headers.get(
      "referrer-policy",
    ),
    "same-origin",
  );
  assert.match(
    await (await call("/admin/", { headers: { accept: "text/html" } })).text(),
    /Access code/,
  );
  for (const path of [
    "/api/admin/orders",
    "/storage/v1/private",
    "/lab/page.js",
  ])
    assert.equal((await call(path)).status, 401);
  assert.equal(received, undefined);
  assert.equal(
    (await call("/__preview/login", { method: "POST", body: `code=${code}` }))
      .status,
    403,
  );
  assert.equal(
    (
      await call("/__preview/login", {
        method: "POST",
        headers: { origin },
        body: "code=wrong",
      })
    ).status,
    403,
  );
  const session = await call("/__preview/login", {
    method: "POST",
    headers: { origin },
    body: `code=${code}`,
  });
  assert.equal(session.status, 303);
  assert.match(
    session.headers.get("set-cookie"),
    /Secure; HttpOnly; SameSite=Lax/,
  );
  assert.ok(!session.headers.get("set-cookie").includes(code));
  const cookie = session.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (
      await call("/api/admin/orders", {
        headers: { cookie: cookie + "tampered" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call("/api/admin/orders", {
        method: "POST",
        headers: { cookie, origin: "https://attacker.example" },
      })
    ).status,
    403,
  );
  const response = await call("/api/admin/orders", {
    method: "POST",
    headers: { cookie, origin, "x-admin-access": code },
  });
  assert.equal(response.status, 200);
  assert.equal(
    (await response.json()).signedUrl,
    `${origin}/storage/v1/private`,
  );
  assert.equal(received.host, new URL(upstream).host);
  assert.equal(received.origin, upstream);
  assert.equal(received["x-admin-access"], code);
  assert.equal(received.cookie, "");
  clock += 8 * 3600000 + 1;
  assert.equal(
    (await call("/api/admin/orders", { headers: { cookie } })).status,
    401,
  );
  for (let i = 0; i < 10; i++)
    await call("/__preview/login", {
      method: "POST",
      headers: { origin },
      body: "code=wrong",
    });
  assert.equal(
    (
      await call("/__preview/login", {
        method: "POST",
        headers: { origin },
        body: `code=${code}`,
      })
    ).status,
    429,
  );
});
