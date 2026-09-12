import assert from "node:assert/strict";
import { spawn, spawnSync, fork, execFileSync } from "node:child_process";
import { createServer, request as proxyRequest } from "node:http";
import { createServer as socketServer } from "node:net";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
  readdirSync,
  lstatSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { labEnvironment } from "./environment.mjs";

assert.equal(
  process.versions.node.split(".")[0],
  "22",
  "Use the Node version in .nvmrc before starting the owner lab.",
);
const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const home = join(root, "artifacts/private/owner-lab");
mkdirSync(home, { recursive: true, mode: 0o700 });
const codePath = join(home, "access-code");
if (!existsSync(codePath))
  writeFileSync(codePath, randomBytes(24).toString("base64url"), {
    mode: 0o600,
    flag: "wx",
  });
const code = readFileSync(codePath, "utf8");
const configPath = join(home, "lab.json");
const pgCandidates = [
  process.env.OMS_POSTGRES_BIN,
  "/opt/homebrew/opt/postgresql@14/bin",
  "/usr/local/opt/postgresql@14/bin",
  "/usr/lib/postgresql/16/bin",
  "/usr/lib/postgresql/15/bin",
].filter(Boolean);
const pg =
  pgCandidates.find((entry) => existsSync(join(entry, "initdb"))) ??
  dirname(spawnSync("which", ["initdb"], { encoding: "utf8" }).stdout.trim());
assert.ok(
  existsSync(join(pg, "initdb")),
  "Install PostgreSQL locally or set OMS_POSTGRES_BIN. The lab never uses your application DATABASE_URL.",
);
const port = Number(process.env.OMS_LAB_PORT || 5188);
assert.ok(Number.isSafeInteger(port) && port > 1024 && port < 65535);
const origin = `http://127.0.0.1:${port}`;
const freePort = () =>
  new Promise((done) => {
    const server = socketServer();
    server.listen(0, "127.0.0.1", () => {
      const value = server.address().port;
      server.close(() => done(value));
    });
  });
let config = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, "utf8"))
  : { pgPort: await freePort(), port, active: "initial", snapshots: [] };
assert.equal(
  config.port,
  port,
  "Resume the same OMS_LAB_PORT to preserve private-file namespaces.",
);
assert.match(config.active, /^[a-z0-9_-]+$/);
const saveConfig = () =>
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
const database = () => `oms_owner_lab_${config.active.replaceAll("-", "_")}`;
const databaseUrl = () =>
  `postgresql://oms_lab:${encodeURIComponent(code)}@127.0.0.1:${config.pgPort}/${database()}`;
const instance = () => join(home, "instances", config.active);
const dbDirectory = join(home, "postgres");
const source = join(home, "source");
const pgEnvironment = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  PGPASSWORD: code,
  PGUSER: "oms_lab",
  PGHOST: "127.0.0.1",
  PGPORT: String(config.pgPort),
};
function run(command, args, options = {}) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, {
      cwd: source,
      env: pgEnvironment,
      stdio: "inherit",
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (status) =>
      status === 0
        ? done()
        : reject(
            new Error(
              `${command.split("/").at(-1)} failed (${status}); see the private lab log.`,
            ),
          ),
    );
  });
}
const pgRun = (command, args) => run(join(pg, command), args, { cwd: home });
let worker,
  workerPort,
  busy = false,
  pgStarted = false,
  shuttingDown = false;
let state = "Preparing local owner rehearsal";
const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.headers.host !== `127.0.0.1:${port}`) {
    res.writeHead(403);
    res.end("Loopback host required.");
    return;
  }
  const url = new URL(req.url, origin);
  if (url.pathname.startsWith("/lab/")) {
    if (
      req.method === "GET" &&
      ["/lab/", "/lab/page.js"].includes(url.pathname)
    ) {
      const file = url.pathname.endsWith(".js") ? "page.js" : "page.html";
      res.setHeader(
        "Content-Type",
        file.endsWith(".js") ? "text/javascript" : "text/html",
      );
      res.end(readFileSync(join(root, "scripts/owner-lab", file)));
      return;
    }
    if (
      req.method === "GET" &&
      /^\/lab\/samples\/(community|artist|coffee|local)\.png$/.test(
        url.pathname,
      )
    ) {
      const target = join(home, "samples", url.pathname.split("/").at(-1));
      if (existsSync(target)) {
        res.setHeader("Content-Type", "image/png");
        res.end(readFileSync(target));
        return;
      }
    }
    const supplied = String(req.headers["x-lab-code"] ?? "");
    if (
      req.method !== "POST" ||
      supplied.length !== code.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(code)) ||
      (req.headers.origin && req.headers.origin !== origin)
    ) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: "Admin access is required." }));
      return;
    }
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/lab/status") {
      res.end(
        JSON.stringify({
          message: `${state}. Active local copy: ${config.active}. Backups: ${config.snapshots.length}. Real provider calls are disabled.`,
        }),
      );
      return;
    }
    if (
      !["/lab/backup", "/lab/restore", "/lab/rebuild"].includes(url.pathname)
    ) {
      res.writeHead(404);
      res.end("{}");
      return;
    }
    if (busy) {
      res.writeHead(409);
      res.end(
        JSON.stringify({
          error:
            "A rebuild or recovery is already running. Wait and refresh status.",
        }),
      );
      return;
    }
    busy = true;
    try {
      const message = url.pathname.endsWith("backup")
        ? await backup()
        : url.pathname.endsWith("rebuild")
          ? (await rebuild(), "Local store rebuilt. Open admin and refresh.")
          : await restore();
      res.end(JSON.stringify({ message }));
    } catch (error) {
      console.error(error.message);
      res.writeHead(500);
      res.end(
        JSON.stringify({
          error:
            "The local operation did not finish. Existing copies remain intact; inspect the private lab log before retrying.",
        }),
      );
    } finally {
      busy = false;
    }
    return;
  }
  if (!workerPort) {
    res.writeHead(503, { "Content-Type": "text/html", "Retry-After": "3" });
    res.end(
      '<!doctype html><meta http-equiv="refresh" content="3"><title>Local store is rebuilding</title><p style="font:20px system-ui;padding:40px">The local store is preparing your changes. This page will retry shortly. <a href="/lab/">Owner rehearsal guide</a></p>',
    );
    return;
  }
  const proxy = proxyRequest(
    {
      hostname: "127.0.0.1",
      port: workerPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (upstream) => {
      res.writeHead(upstream.statusCode, upstream.headers);
      upstream.pipe(res);
    },
  );
  proxy.on("error", () => {
    if (!res.headersSent) res.writeHead(503);
    res.end("The local store is restarting. Refresh shortly.");
  });
  req.pipe(proxy);
});
await new Promise((done, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", done);
});
async function stopWorker() {
  workerPort = undefined;
  if (!worker) return;
  const current = worker;
  worker = undefined;
  await new Promise((done) => {
    current.once("exit", done);
    current.kill("SIGTERM");
    setTimeout(() => {
      if (current.exitCode === null) current.kill("SIGKILL");
    }, 15000).unref();
  });
}
const variables = () =>
  JSON.parse(readFileSync(join(instance(), "variables.json"), "utf8"));
const environment = () =>
  labEnvironment({
    databaseUrl: databaseUrl(),
    origin,
    code,
    instance: instance(),
    variables: variables(),
  });
async function startWorker() {
  worker = fork(join(source, "scripts/owner-lab/worker.mjs"), [], {
    cwd: source,
    env: environment(),
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  const current = worker;
  await new Promise((done, reject) => {
    current.once("error", reject);
    current.once("exit", (status) => {
      if (!workerPort) reject(new Error(`Local worker stopped (${status}).`));
      if (worker === current) {
        workerPort = undefined;
        state = "Local worker stopped; retry local rebuild";
      }
    });
    current.on("message", (message) => {
      if (message.type === "ready") {
        workerPort = message.port;
        state = "Ready for owner testing";
        done();
      }
      if (message.type === "rebuild" && !busy) {
        busy = true;
        rebuild()
          .catch((e) => {
            state = "Local rebuild needs repair";
            console.error(e.message);
          })
          .finally(() => (busy = false));
      }
    });
  });
}
async function rebuild() {
  state = "Rebuilding the reviewed store profile";
  await stopWorker();
  await run(process.execPath, [process.env.npm_execpath, "run", "build"], {
    env: { ...environment(), NODE_ENV: "production" },
  });
  await startWorker();
}
function fileManifest(directory, prefix = "") {
  return readdirSync(join(directory, prefix), { withFileTypes: true }).flatMap(
    (entry) => {
      const relative = join(prefix, entry.name);
      assert.ok(!entry.isSymbolicLink(), "Backup refuses symlinks.");
      return entry.isDirectory()
        ? fileManifest(directory, relative)
        : [
            {
              path: relative,
              sha256: createHash("sha256")
                .update(readFileSync(join(directory, relative)))
                .digest("hex"),
            },
          ];
    },
  );
}
async function backup() {
  state = "Creating paired database and private-file backup";
  await stopWorker();
  const id = `backup-${Date.now()}`;
  const target = join(home, "backups", id);
  mkdirSync(target, { recursive: true, mode: 0o700 });
  try {
    await pgRun("pg_dump", [
      "--format=custom",
      "--file",
      join(target, "database.dump"),
      database(),
    ]);
    cpSync(instance(), join(target, "instance"), { recursive: true });
    const manifest = {
      version: 1,
      source: config.active,
      createdAt: new Date().toISOString(),
      files: fileManifest(target),
      migrations: "backend/prisma/migrations",
      origin,
    };
    writeFileSync(
      join(target, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      { mode: 0o600 },
    );
    config.snapshots.push(id);
    saveConfig();
    return "Backup complete. The database and private files were captured together while the store was paused.";
  } finally {
    await startWorker();
  }
}
async function restore() {
  const id = config.snapshots.at(-1);
  assert.ok(id && /^backup-\d+$/.test(id), "Create a backup first.");
  const backupDirectory = join(home, "backups", id);
  const manifest = JSON.parse(
    readFileSync(join(backupDirectory, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.origin, origin);
  assert.equal(manifest.version, 1);
  const actual = fileManifest(backupDirectory).filter(
    (item) => item.path !== "manifest.json",
  );
  assert.deepEqual(
    actual.sort((a, b) => a.path.localeCompare(b.path)),
    manifest.files.sort((a, b) => a.path.localeCompare(b.path)),
    "Backup checksums do not match.",
  );
  state = "Restoring into a separate local database and file copy";
  await stopWorker();
  const previous = config.active;
  const restored = `restored_${Date.now()}`;
  try {
    const next = join(home, "instances", restored);
    cpSync(join(backupDirectory, "instance"), next, { recursive: true });
    await pgRun("createdb", [`oms_owner_lab_${restored}`]);
    await pgRun("pg_restore", [
      "--exit-on-error",
      "--no-owner",
      "--dbname",
      `oms_owner_lab_${restored}`,
      join(backupDirectory, "database.dump"),
    ]);
    config.active = restored;
    saveConfig();
    await rebuild();
    return `Restore complete. Active copy: ${restored}. Previous copy ${previous} is preserved. Open admin and verify your saved profile, collection, artwork and order.`;
  } catch (error) {
    config.active = previous;
    saveConfig();
    await rebuild();
    throw error;
  }
}
async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close();
  await stopWorker();
  if (pgStarted)
    await pgRun("pg_ctl", ["-D", dbDirectory, "-m", "fast", "-w", "stop"]);
  process.exit(exitCode);
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
try {
  mkdirSync(source, { recursive: true });
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root })
    .toString()
    .split("\0")
    .filter(Boolean);
  for (const file of tracked.filter((file) =>
    /^(backend\/|frontend\/|packages\/|scripts\/|config\/|package(?:-lock)?\.json$|vercel\.json$|\.nvmrc$)/.test(
      file,
    ),
  )) {
    const from = join(root, file);
    if (!existsSync(from)) continue;
    assert.ok(!lstatSync(from).isSymbolicLink());
    mkdirSync(dirname(join(source, file)), { recursive: true });
    cpSync(from, join(source, file));
  }
  mkdirSync(instance(), { recursive: true, mode: 0o700 });
  mkdirSync(join(instance(), "files"), { recursive: true, mode: 0o700 });
  if (!existsSync(join(instance(), "variables.json")))
    writeFileSync(join(instance(), "variables.json"), "[]", { mode: 0o600 });
  if (!existsSync(dbDirectory))
    await pgRun("initdb", [
      "-D",
      dbDirectory,
      "--username=oms_lab",
      "--auth=scram-sha-256",
      "--pwfile",
      codePath,
      "--no-locale",
      "--encoding=UTF8",
    ]);
  await pgRun("pg_ctl", [
    "-D",
    dbDirectory,
    "-l",
    join(home, "postgres.log"),
    "-o",
    `-p ${config.pgPort} -h 127.0.0.1 -k ${home}`,
    "-w",
    "start",
  ]);
  pgStarted = true;
  if (!existsSync(configPath)) {
    await pgRun("createdb", [database()]);
    await pgRun("psql", [
      "--dbname",
      database(),
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      join(source, "backend/prisma/ci-storage-bootstrap.sql"),
    ]);
    saveConfig();
  }
  const lockHash = createHash("sha256")
    .update(readFileSync(join(source, "package-lock.json")))
    .digest("hex");
  const installedLockPath = join(home, "installed-lock.sha256");
  if (
    !existsSync(join(source, "node_modules")) ||
    !existsSync(installedLockPath) ||
    readFileSync(installedLockPath, "utf8") !== lockHash
  ) {
    await run(process.execPath, [process.env.npm_execpath, "ci"], {
      env: environment(),
    });
    writeFileSync(installedLockPath, lockHash, { mode: 0o600 });
  }
  await run(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      "--schema",
      "backend/prisma/schema.prisma",
    ],
    { env: environment() },
  );
  const { default: sharp } = await import("sharp");
  mkdirSync(join(home, "samples"), { recursive: true });
  const colors = {
    community: "#574779",
    artist: "#c46c4f",
    coffee: "#704d38",
    local: "#315d50",
  };
  for (const [name, color] of Object.entries(colors))
    await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1800"><rect width="1800" height="1800" fill="#f7f0dc"/><circle cx="900" cy="800" r="550" fill="${color}"/><path d="M380 1180 L900 350 L1420 1180Z" fill="#edc877"/><circle cx="900" cy="1000" r="220" fill="${color}"/><text x="900" y="1560" text-anchor="middle" font-family="sans-serif" font-size="110" fill="${color}">${name.toUpperCase()}</text></svg>`,
      ),
    )
      .png()
      .toFile(join(home, "samples", `${name}.png`));
  writeFileSync(
    join(home, "ACCESS.md"),
    `# Local owner rehearsal\n\nOpen ${origin}/lab/\n\nAdmin access code: ${code}\n\nThis code controls only this local rehearsal. Keep it private.\nResume: npm run owner:lab\nStop: Ctrl-C in the lab terminal. Data survives a restart.\n`,
    { mode: 0o600 },
  );
  await rebuild();
  console.log(
    `Owner lab ready: ${origin}/lab/\nAccess code is in artifacts/private/owner-lab/ACCESS.md`,
  );
} catch (error) {
  console.error(error.message);
  await shutdown(1);
}
