// Opt-in, public read-only requests. No real account credentials are loaded.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const storage = new Map();
globalThis.host = {
  storage: { get: (key) => structuredClone(storage.get(key) ?? null), set: (key, value) => storage.set(key, structuredClone(value)), remove: (key) => storage.delete(key) },
};
const plugin = await import(`../index.js?smoke=${randomUUID()}`);
assert.equal(await plugin.account(), null);
const home = await plugin.home();
assert.equal(home.title, "喜马拉雅");
assert.ok(home.sections[0].shows.length > 0);
console.log(`home: ${home.sections[0].shows.length} recommended albums`);
for (const kind of ["shows", "tracks"]) {
  const found = await plugin.search({ query: "唐诗", kind, offset: 0 });
  assert.ok(found[kind].length > 0);
  console.log(`${kind}: ${found[kind].length} results; more=${found.more}`);
}
const a = await plugin.show({ id: "5534601", offset: 0 });
const b = await plugin.show({ id: "5534601", offset: a.episodes.length });
assert.ok(a.episodes.length && b.episodes.length);
assert.equal(new Set([...a.episodes, ...b.episodes].map((t) => t.id)).size, a.episodes.length + b.episodes.length);
console.log(`show: ${a.show.name}; pages=${a.episodes.length}+${b.episodes.length}`);
const sampleID = "12914712";
const resolved = await plugin.search({ query: `https://www.ximalaya.com/sound/${sampleID}`, kind: "tracks" });
assert.equal(resolved.tracks[0].id, sampleID);
assert.ok(resolved.tracks[0].duration >= 600000);
const stream = { id: sampleID, quality: "high" };
async function readRange(audio, start) {
  assert.ok(["mp3", "m4a", "aac", "flac"].includes(audio.type));
  const end = start + 255;
  const response = await fetch(audio.url, { headers: { ...audio.headers, Range: `bytes=${start}-${end}` }, redirect: "error", signal: AbortSignal.timeout(10000) });
  const reader = response.body.getReader();
  try {
    assert.equal(response.status, 206);
    const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range") || "");
    assert.ok(range);
    assert.deepEqual(range.slice(1, 3).map(Number), [start, end]);
    const total = Number(range[3]);
    assert.ok(Number.isSafeInteger(total) && total > end);
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      assert.ok(length <= 256);
    }
    assert.equal(length, 256);
    console.log(`audio: HTTP ${response.status}; type=${audio.type}; range=${range[0]}; bytes=${length}`);
    return total;
  } finally {
    await reader.cancel();
  }
}
const total = await readRange(await plugin.stream(stream), 0);
assert.ok(total > 1024 * 1024);
assert.equal(await readRange(await plugin.stream(stream), Math.floor(total * 0.8)), total);
await plugin.played({ id: a.episodes[0].id });
const local = await plugin.browse({ page: "local-recent" });
assert.equal(local.sections[0].tracks[0].id, a.episodes[0].id);
console.log("Public smoke passed. Account login and paid playback still require an in-app test.");
