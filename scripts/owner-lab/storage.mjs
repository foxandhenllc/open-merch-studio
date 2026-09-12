import { createHmac, timingSafeEqual } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  unlink,
  lstat,
} from "node:fs/promises";
import { join, dirname } from "node:path";

// A local stand-in for the pinned Storage SDK transport. No cloud bucket is used.
export function localStorage({ directory, origin, signingKey }) {
  const bucket = "open-merch-uploads";
  const safe = (value) => {
    if (
      !value.startsWith(`${bucket}/`) ||
      value.length > 250 ||
      value
        .split("/")
        .some(
          (part) =>
            !/^[a-zA-Z0-9_.-]+$/.test(part) || part === "." || part === "..",
        )
    )
      throw new Error("Invalid local storage path.");
    return value;
  };
  async function file(value) {
    const parts = safe(value).split("/");
    for (let i = 1; i <= parts.length; i++) {
      const location = join(directory, ...parts.slice(0, i));
      const info = await lstat(location).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
      if (info?.isSymbolicLink()) throw new Error("Symlinks are not accepted.");
    }
    return join(directory, ...parts);
  }
  const mac = (payload) =>
    createHmac("sha256", signingKey).update(payload).digest("base64url");
  const token = (path, method, seconds) => {
    const payload = Buffer.from(
      JSON.stringify({ path, method, until: Date.now() + seconds * 1000 }),
    ).toString("base64url");
    return `${payload}.${mac(payload)}`;
  };
  function verify(value, path, method) {
    const [payload = "", signature = ""] = value.split(".");
    const expected = mac(payload);
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      return false;
    try {
      const data = JSON.parse(Buffer.from(payload, "base64url"));
      return (
        data.path === path && data.method === method && data.until > Date.now()
      );
    } catch {
      return false;
    }
  }
  async function handle(request) {
    const url = new URL(request.url);
    const route = decodeURIComponent(url.pathname).replace(
      /^\/storage\/v1/,
      "",
    );
    const service =
      request.headers.get("authorization") === "Bearer owner-lab-storage-only";
    const json = (data, status = 200) => Response.json(data, { status });
    try {
      if (route === `/bucket/${bucket}` && service && request.method === "GET")
        return json({ id: bucket, name: bucket, public: false });
      let match = route.match(/^\/object\/(upload\/sign|sign)\/(.+)$/);
      if (match) {
        const path = safe(match[2]);
        const method = match[1] === "upload/sign" ? "PUT" : "GET";
        if (request.method === "POST" && service) {
          const input = await request.json();
          const relative = `${route}?token=${token(path, method, method === "PUT" ? 7200 : Math.min(Number(input.expiresIn) || 60, 7200))}`;
          return json(
            method === "PUT" ? { url: relative } : { signedURL: relative },
          );
        }
        if (
          request.method !== method ||
          !verify(url.searchParams.get("token") ?? "", path, method)
        )
          return json({ message: "Private file access required." }, 403);
        if (method === "GET")
          return new Response(await readFile(await file(path)), {
            headers: {
              "content-type": path.endsWith(".webp")
                ? "image/webp"
                : "image/png",
              "cache-control": "no-store",
            },
          });
        let bytes;
        if (
          request.headers.get("content-type")?.startsWith("multipart/form-data")
        ) {
          const data = await request.formData();
          const entry = [...data.values()].find(
            (value) => typeof value !== "string",
          );
          if (!entry) throw new Error("Missing image.");
          bytes = Buffer.from(await entry.arrayBuffer());
        } else bytes = Buffer.from(await request.arrayBuffer());
        if (bytes.length > 25 * 1024 * 1024)
          throw new Error("Upload too large.");
        const target = await file(path);
        await mkdir(dirname(target), { recursive: true, mode: 0o700 });
        await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
        return json({ Key: path });
      }
      if (!service)
        return json({ message: "Private file access required." }, 403);
      if (route === `/object/list/${bucket}` && request.method === "POST") {
        const data = await request.json();
        const target = await file(`${bucket}/${data.prefix}`);
        const entries = await readdir(target, { withFileTypes: true }).catch(
          (e) => {
            if (e.code === "ENOENT") return [];
            throw e;
          },
        );
        return json(
          entries
            .slice(data.offset ?? 0, (data.offset ?? 0) + (data.limit ?? 100))
            .map((entry) => ({
              name: entry.name,
              id: entry.isFile() ? entry.name : null,
            })),
        );
      }
      if (route === `/object/${bucket}` && request.method === "DELETE") {
        const { prefixes } = await request.json();
        for (const path of prefixes)
          await unlink(await file(`${bucket}/${path}`)).catch((e) => {
            if (e.code !== "ENOENT") throw e;
          });
        return json([]);
      }
      match = route.match(/^\/object\/(?:authenticated\/)?(.+)$/);
      if (match) {
        const path = safe(match[1]);
        const target = await file(path);
        if (request.method === "GET")
          return new Response(await readFile(target));
        if (request.method === "POST") {
          const bytes = Buffer.from(await request.arrayBuffer());
          if (bytes.length > 40 * 1024 * 1024)
            throw new Error("File too large.");
          await mkdir(dirname(target), { recursive: true, mode: 0o700 });
          await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
          return json({ Key: path });
        }
      }
      return json({ message: "Unsupported local storage operation." }, 400);
    } catch {
      return json({ message: "Local private storage operation failed." }, 400);
    }
  }
  return { handle, origin };
}
