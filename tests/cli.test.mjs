import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "dao-den-long-test-"));
const run = (args = []) =>
  spawnSync(
    process.execPath,
    [
      "src/headless.mjs",
      "--seed",
      "42",
      "--night",
      "1",
      "--ticks",
      "120",
      "--out",
      join(dir, "out.jsonl"),
      ...args,
    ],
    { encoding: "utf8" },
  );
test("CLI tick zero, event tick, final end and byte determinism", () => {
  writeFileSync(
    join(dir, "scenario.json"),
    JSON.stringify({
      random_motes: false,
      random_shades: false,
      motes: [[0, 0, 0]],
    }),
  );
  const args = ["--scenario", join(dir, "scenario.json")];
  assert.equal(run(args).status, 0);
  const first = readFileSync(join(dir, "out.jsonl"), "utf8"),
    rows = first.trim().split("\n").map(JSON.parse);
  assert.equal(rows[0].tick, 0);
  assert.equal(rows[0].player.carried, 0);
  assert.equal(rows.find((r) => r.type === "event").tick, 1);
  assert.deepEqual(rows.at(-1), {
    type: "end",
    ticks: 120,
    state: "playing",
    score: 0,
  });
  assert.equal(run(args).status, 0);
  assert.equal(readFileSync(join(dir, "out.jsonl"), "utf8"), first);
});
test("invalid JSON, input types/order and scenario return 2 with stderr", () => {
  for (const bad of [
    "{",
    JSON.stringify({ frames: [{ tick: 1 }, { tick: 1 }] }),
    JSON.stringify({ frames: [{ tick: 0, move: [2, 0] }] }),
    JSON.stringify({ frames: [{ tick: 0, pulse: "yes" }] }),
  ]) {
    const p = join(dir, "bad.json");
    writeFileSync(p, bad);
    const r = run(["--inputs", p]);
    assert.equal(r.status, 2);
    assert.ok(r.stderr.length > 0);
  }
  writeFileSync(
    join(dir, "bad.json"),
    JSON.stringify({ lanterns: [{ id: "L99" }] }),
  );
  assert.equal(run(["--scenario", join(dir, "bad.json")]).status, 2);
});
test("zero ticks produces snapshot and end; invalid snapshot interval fails", () => {
  assert.equal(run(["--ticks", "0"]).status, 0);
  assert.equal(
    readFileSync(join(dir, "out.jsonl"), "utf8").trim().split("\n").length,
    2,
  );
  assert.equal(run(["--snapshot-every", "0"]).status, 2);
});
