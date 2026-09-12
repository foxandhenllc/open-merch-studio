import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { createRemoteGateway } from "./remote-gateway.mjs";

const home = resolve("artifacts/private/owner-lab");
const config = JSON.parse(readFileSync(join(home, "lab.json")));
const code = readFileSync(join(home, "access-code"), "utf8");
const upstream = `http://127.0.0.1:${config.port}`;
const ready = await fetch(`${upstream}/lab/`);
if (!ready.ok) throw new Error("Start npm run owner:lab first.");
let origin;
const gateway = createRemoteGateway({
  code,
  upstream,
  getPublicOrigin: () => origin,
});
await new Promise((done) => gateway.listen(0, "127.0.0.1", done));
const tunnel = spawn(
  "cloudflared",
  [
    "tunnel",
    "--no-autoupdate",
    "--url",
    `http://127.0.0.1:${gateway.address().port}`,
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
const awake =
  process.platform === "darwin"
    ? spawn("caffeinate", ["-i", "-w", String(process.pid)], {
        stdio: "ignore",
      })
    : null;
const info = join(home, "remote-preview.json");
let buffer = "",
  stopped = false;
function stop(status = 0) {
  if (stopped) return;
  stopped = true;
  tunnel.kill();
  awake?.kill();
  gateway.close();
  try {
    unlinkSync(info);
  } catch {
    /* Already removed. */
  }
  setTimeout(() => process.exit(status), 200).unref();
}
tunnel.stderr.on("data", (chunk) => {
  buffer = (buffer + chunk.toString()).slice(-16000);
  const found = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (!origin && found) {
    origin = found[0];
    writeFileSync(
      info,
      JSON.stringify(
        {
          origin,
          pid: process.pid,
          startedAt: new Date().toISOString(),
          expires:
            "When this process stops; sign-in sessions last eight hours.",
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log(`Private owner preview: ${origin}/admin/`);
    console.log(
      "Use your existing owner-lab access code. Keep this Mac online and this process running. No production providers are enabled.",
    );
  }
});
tunnel.on("error", () => {
  console.error("Install cloudflared, then retry npm run owner:lab:share.");
  stop(1);
});
tunnel.on("exit", (status) => {
  if (!stopped) {
    console.error(
      "The temporary preview tunnel stopped. Restart to obtain a new link.",
    );
    stop(status || 1);
  }
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
