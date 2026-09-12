import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, symlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localStorage } from "./storage.mjs";

test("local storage signs exact methods and paths, refuses overwrite, public reads and traversal, and survives restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "oms-lab-storage-"));
  try {
    const settings = {
      directory,
      origin: "http://127.0.0.1:5188",
      signingKey: "test-signing-key",
    };
    let storage = localStorage(settings);
    const request = (route, method = "GET", body, service = false) =>
      storage.handle(
        new Request(`${settings.origin}/storage/v1${route}`, {
          method,
          headers: {
            ...(service
              ? { authorization: "Bearer owner-lab-storage-only" }
              : {}),
            "content-type": "application/json",
          },
          ...(body === undefined
            ? {}
            : { body: typeof body === "string" ? body : JSON.stringify(body) }),
        }),
      );
    const path = "open-merch-uploads/session/image.png";
    const signed = await (
      await request(`/object/upload/sign/${path}`, "POST", {}, true)
    ).json();
    assert.equal((await request(signed.url, "PUT", "sample")).status, 200);
    assert.equal((await request(signed.url, "PUT", "replacement")).status, 400);
    assert.equal((await request(signed.url, "GET")).status, 403);
    assert.equal((await request(`/object/${path}`)).status, 403);
    const preview = await (
      await request(`/object/sign/${path}`, "POST", { expiresIn: 60 }, true)
    ).json();
    storage = localStorage(settings);
    assert.equal(await (await request(preview.signedURL)).text(), "sample");
    assert.equal(
      (await request(preview.signedURL.replace("image.png", "other.png")))
        .status,
      403,
    );
    assert.equal((await request(`/object/public/${path}`)).status, 403);
    assert.equal(
      (
        await request(
          "/object/open-merch-uploads/%2e%2e%2fescape",
          "POST",
          "bad",
          true,
        )
      ).status,
      400,
    );
    await mkdir(join(directory, "open-merch-uploads", "nested"));
    await symlink(
      tmpdir(),
      join(directory, "open-merch-uploads", "nested", "link"),
    );
    assert.equal(
      (
        await request(
          "/object/open-merch-uploads/nested/link/escape",
          "POST",
          "bad",
          true,
        )
      ).status,
      400,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
