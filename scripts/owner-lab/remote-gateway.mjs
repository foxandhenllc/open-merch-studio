import { createServer, request } from "node:http";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const cookieName = "__Host-oms-owner-preview";
const equal = (a, b) =>
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const login = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Open Merch Studio · Private preview</title><style>body{font:17px/1.6 system-ui;background:#f7f3e8;color:#20372e;max-width:480px;margin:10vh auto;padding:24px}h1{font-size:36px;line-height:1.15}input,button{font:inherit;padding:14px;box-sizing:border-box;width:100%;border:1px solid #526d60;border-radius:8px;margin:8px 0}button{background:#294c3c;color:white;cursor:pointer}small{display:block}</style><body><p>OPEN MERCH STUDIO</p><h1>Your private owner preview.</h1><p>Enter your existing access code to explore the store and owner tools.</p><form method="post" action="/__preview/login"><label for="code">Access code</label><input id="code" name="code" type="password" autocomplete="current-password" required maxlength="256"><button>Open preview</button></form><small>QA environment. Payments, AI and fulfillment are simulated. Use sample customer details.</small></body></html>`;

/** A temporary HTTPS tunnel may reach only this gate, never the unguarded lab. */
export function createRemoteGateway({
  code,
  upstream,
  getPublicOrigin,
  now = Date.now,
}) {
  if (code.length < 24 || !/^http:\/\/127\.0\.0\.1:\d+$/.test(upstream))
    throw new Error(
      "A loopback owner lab and strong access code are required.",
    );
  // Sessions expire on restart as well as after eight hours. The code never enters a cookie.
  const key = randomBytes(32);
  const sign = (value) =>
    createHmac("sha256", key).update(value).digest("base64url");
  const valid = (cookie) => {
    const value =
      String(cookie || "")
        .split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith(`${cookieName}=`))
        ?.slice(cookieName.length + 1) || "";
    const [expiry, signature] = value.split(".");
    return (
      /^\d+$/.test(expiry || "") &&
      Number(expiry) > now() &&
      Number(expiry) <= now() + 8 * 3600000 &&
      equal(signature || "", sign(expiry))
    );
  };
  let failures = 0,
    blockedUntil = 0;
  return createServer(async (req, res) => {
    const origin = getPublicOrigin();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    const reject = (status, message) => {
      res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(message);
    };
    if (
      !origin ||
      !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin) ||
      req.headers.host !== new URL(origin).host
    )
      return reject(403, "Preview unavailable.");
    if (req.headers.origin && req.headers.origin !== origin)
      return reject(403, "Open this request from the private preview.");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== origin
    )
      return reject(403, "Preview origin required.");
    if (req.url === "/__preview/login" && req.method === "POST") {
      if (now() < blockedUntil)
        return reject(429, "Please wait a minute before trying again.");
      const chunks = [];
      let bytes = 0;
      try {
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 2048) {
            reject(413, "Request too large.");
            return;
          }
          chunks.push(chunk);
        }
        const supplied =
          new URLSearchParams(Buffer.concat(chunks).toString()).get("code") ||
          "";
        if (!equal(supplied, code)) {
          if (++failures >= 10) {
            blockedUntil = now() + 60000;
            failures = 0;
          }
          return reject(
            403,
            "That code was not accepted. Go back and try again.",
          );
        }
        failures = 0;
        const expiry = String(now() + 8 * 3600000);
        res.writeHead(303, {
          Location: "/admin/",
          "Set-Cookie": `${cookieName}=${expiry}.${sign(expiry)}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=28800`,
        });
        res.end();
      } catch {
        if (!res.headersSent) reject(400, "Could not open preview.");
      }
      return;
    }
    if (!valid(req.headers.cookie)) {
      if (
        ["GET", "HEAD"].includes(req.method) &&
        !/^\/(api|storage)\//.test(req.url) &&
        String(req.headers.accept).includes("text/html")
      ) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(req.method === "HEAD" ? "" : login);
      } else
        reject(401, "Access code required. Reopen the preview to sign in.");
      return;
    }
    // Do not forward proxy headers or the gate cookie to the local application.
    const headers = {
      ...req.headers,
      host: new URL(upstream).host,
      "accept-encoding": "identity",
    };
    for (const name of Object.keys(headers))
      if (/^(forwarded|x-forwarded-|cf-)/.test(name)) delete headers[name];
    headers.cookie = String(headers.cookie || "")
      .split(";")
      .filter((v) => !v.trim().startsWith(`${cookieName}=`))
      .join(";");
    if (headers.origin) headers.origin = upstream;
    if (headers.referer?.startsWith(origin))
      headers.referer = headers.referer.replace(origin, upstream);
    const outgoing = request(
      `${upstream}${req.url.startsWith("/") ? req.url : "/"}`,
      { method: req.method, headers },
      (incoming) => {
        const responseHeaders = {
          ...incoming.headers,
          "cache-control": "no-store",
          "x-robots-tag": "noindex, nofollow, noarchive",
        };
        if (responseHeaders.location?.startsWith(upstream))
          responseHeaders.location = responseHeaders.location.replace(
            upstream,
            origin,
          );
        if (
          /application\/json|text\/html/.test(
            String(responseHeaders["content-type"]),
          ) &&
          req.method !== "HEAD"
        ) {
          const chunks = [];
          let size = 0;
          incoming.on("data", (chunk) => {
            size += chunk.length;
            if (size > 32 * 1024 * 1024) incoming.destroy();
            else chunks.push(chunk);
          });
          incoming.on("end", () => {
            delete responseHeaders["content-length"];
            delete responseHeaders["transfer-encoding"];
            res.writeHead(incoming.statusCode, responseHeaders);
            res.end(
              Buffer.concat(chunks).toString().replaceAll(upstream, origin),
            );
          });
          incoming.on("error", () => {
            if (!res.headersSent)
              reject(502, "Preview is restarting. Please try again.");
            else res.destroy();
          });
        } else {
          res.writeHead(incoming.statusCode, responseHeaders);
          incoming.pipe(res);
        }
      },
    );
    outgoing.on("error", () => {
      if (!res.headersSent)
        reject(502, "Preview is restarting. Please try again.");
      else res.destroy();
    });
    req.pipe(outgoing);
  });
}
