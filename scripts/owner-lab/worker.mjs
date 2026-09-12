import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "node:http";
import express from "express";
import { localStorage } from "./storage.mjs";

const root = process.cwd();
const instance = process.env.OMS_LAB_INSTANCE;
const origin = process.env.BACKEND_URL;
const { ownerRehearsalEnabled } =
  await import("../../backend/dist/config/owner-rehearsal.js");
if (!instance || !ownerRehearsalEnabled())
  throw new Error("Local rehearsal safety checks failed.");
const storage = localStorage({
  directory: join(instance, "files"),
  origin,
  signingKey: process.env.ADMIN_ACCESS_CODE,
});
let variables = JSON.parse(
  await readFile(join(instance, "variables.json"), "utf8"),
);
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.origin === origin && url.pathname.startsWith("/storage/v1/"))
    return storage.handle(request);
  if (url.origin === origin) return realFetch(request);
  if (url.origin !== "https://api.vercel.com")
    throw new Error("External providers are disabled in the owner lab.");
  if (url.pathname.startsWith("/v9/projects/"))
    return Response.json({ id: "prj_ownerlab", accountId: "team_ownerlab" });
  if (url.pathname.startsWith("/v1/integrations/deploy/")) {
    setTimeout(() => process.send?.({ type: "rebuild" }), 400);
    return Response.json({ job: { id: "local-rebuild", state: "PENDING" } });
  }
  if (request.method === "POST") {
    const proposed = await request.json();
    // Profile publication is real locally. Account keys never activate a provider here.
    if (
      !Array.isArray(proposed) ||
      proposed.some(
        (item) =>
          !["OMS_MERCHANT_PROFILE", "OMS_CONNECTIONS_REVISION"].includes(
            item.key,
          ) && !String(item.value).startsWith("lab-"),
      )
    )
      return Response.json(
        {
          message:
            "Use lab- example values only; real credentials are disabled in this local rehearsal.",
        },
        { status: 403 },
      );
    for (const item of proposed)
      variables = [
        ...variables.filter((entry) => entry.key !== item.key),
        item,
      ];
    await writeFile(
      join(instance, "variables.json"),
      JSON.stringify(variables),
      { mode: 0o600 },
    );
    return Response.json({ created: proposed, failed: [] });
  }
  return Response.json({ envs: variables });
};
const { createApp } = await import("../../backend/dist/app.js");
const { sampleCatalog } =
  await import("../../backend/dist/services/catalog-fixtures.js");
for (const product of sampleCatalog.products)
  for (const [index, variant] of product.variants.entries())
    variant.printfulVariantId = 12345 + index;
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});
app.use(
  "/storage/v1",
  express.raw({ type: "*/*", limit: "25mb" }),
  async (req, res) => {
    const response = await storage.handle(
      new Request(`${origin}${req.originalUrl}`, {
        method: req.method,
        headers: req.headers,
        ...(!["GET", "HEAD"].includes(req.method) ? { body: req.body } : {}),
      }),
    );
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(Buffer.from(await response.arrayBuffer()));
  },
);
app.use((req, res, next) =>
  req.path.startsWith("/api/") ? createApi(req, res, next) : next(),
);
const createApi = createApp();
const dist = join(root, "frontend/dist");
app.use((req, res, next) =>
  /\.[a-z0-9]+$/i.test(req.path)
    ? express.static(dist, { index: false })(req, res, next)
    : next(),
);
app.get("*", async (req, res) => {
  let document = req.path.startsWith("/admin")
    ? "admin/index.html"
    : req.path.startsWith("/collections")
      ? "collections/index.html"
      : "index.html";
  const html = await readFile(join(dist, document), "utf8");
  res
    .type("html")
    .send(
      html.replace(
        "<body>",
        '<body><aside style="padding:10px 16px;background:#213b32;color:#fff;font:14px system-ui;position:relative;z-index:10000">Local owner rehearsal · payments, AI and hosting are simulated. <a style="color:#fff;text-decoration:underline" href="/lab/">Scenarios & backup</a></aside>',
      ),
    );
});
const server = createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
process.send?.({ type: "ready", port: server.address().port });
process.on("SIGTERM", () =>
  server.close(async () => {
    const { prisma } = await import("../../backend/dist/config/database.js");
    await prisma.$disconnect();
    process.exit(0);
  }),
);
