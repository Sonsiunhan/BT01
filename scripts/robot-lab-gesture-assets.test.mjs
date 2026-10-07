import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test("all six frozen reference gestures are distinct transparent PNGs with pinned provenance", async () => {
  const base = new URL("../apps/web/src/assets/pieces/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("provenance.json", base), "utf8"));
  assert.match(manifest.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.files.length, 6);
  assert.deepEqual(new Set(manifest.files.map((entry) => entry.glyph)), new Set(["✊", "✋", "✌️"]));
  const digests = new Set();
  for (const entry of manifest.files) {
    const bytes = await readFile(new URL(entry.name, base));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    assert.equal(bytes.readUInt32BE(16), entry.width);
    assert.equal(bytes.readUInt32BE(20), entry.height);
    assert.equal(bytes[25], 6, "RGBA artwork must preserve transparency");
    digests.add(entry.sha256);
  }
  assert.equal(digests.size, 6);
});
