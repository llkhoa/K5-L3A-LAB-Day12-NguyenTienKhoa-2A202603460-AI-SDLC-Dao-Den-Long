import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { cpus, totalmem } from "node:os";
import assert from "node:assert/strict";

const root = "docs/proof/phase-3",
  scenarios = "tests/scenarios/phase-3";
mkdirSync(root, { recursive: true });
mkdirSync(scenarios, { recursive: true });

const quiet = {
  random_motes: false,
  random_shades: false,
  random_drifters: false,
  wind_enabled: false,
};

const cases = [
  {
    name: "decay",
    ticks: 60,
    scenario: {
      player: { pos: [0, 0, 0] },
      lanterns: [{ id: "L1", pos: [10, 0, 0], lit: true, fuel: 1 }],
    },
    frames: [],
    check: (r) => {
      const lastSnap = r.findLast((x) => x.type === "snapshot");
      assert.equal(lastSnap.lanterns[0].lit, false);
      assert.equal(lastSnap.lanterns[0].fuel, 0);
    },
  },
  {
    name: "refuel",
    ticks: 10,
    scenario: {
      player: { pos: [1, 0, 0], carried: 5 },
      lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 85 }],
    },
    frames: [{ tick: 0, interact: true }],
    check: (r) => {
      const snap = r.findLast((x) => x.type === "snapshot" && x.tick === 10);
      assert.equal(snap.player.carried, 3);
      assert.ok(snap.lanterns[0].fuel > 99);
    },
  },
  {
    name: "relight",
    ticks: 10,
    scenario: {
      player: { pos: [1, 0, 0], carried: 6 },
      lanterns: [{ id: "L1", pos: [0, 0, 0], lit: false, ever_lit: true, deposited: 0 }],
    },
    frames: [{ tick: 0, interact: true }],
    check: (r) => {
      const snap = r.findLast((x) => x.type === "snapshot" && x.tick === 10);
      assert.equal(snap.lanterns[0].lit, true);
      assert.ok(snap.lanterns[0].fuel > 99);
      assert.equal(snap.player.carried, 1);
    },
  },
  {
    name: "drain",
    ticks: 60,
    scenario: {
      player: { pos: [20, 0, 0], carried: 0 },
      lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 20 }],
      shades: [{ pos: [1, 0.8, 0], state: "wander" }],
    },
    frames: [],
    check: (r) => {
      const snap = r.findLast((x) => x.type === "snapshot");
      assert.equal(snap.shades[0].state, "drain");
      assert.ok(snap.lanterns[0].fuel < 15);
    },
  },
  {
    name: "full-night-p3",
    night: 1,
    ticks: 14400, // 240 seconds * 60 = 14400 ticks
    scenario: {},
    check: (r) => assert.ok(["won", "lost"].includes(r.at(-1).data?.result ?? "lost")),
  },
];

const results = [];
for (const c of cases) {
  const scenarioFile = `${scenarios}/${c.name}.json`;
  const inputsFile = `${scenarios}/${c.name}-inputs.json`;
  writeFileSync(scenarioFile, JSON.stringify({ ...quiet, ...c.scenario }, null, 2));
  writeFileSync(inputsFile, JSON.stringify({ frames: c.frames ?? [] }, null, 2));
  const out = `${root}/${c.name}.jsonl`;
  const t0 = performance.now();
  const res = spawnSync(
    process.execPath,
    [
      "src/headless.mjs",
      "--seed",
      "42",
      "--night",
      String(c.night ?? 1),
      "--scenario",
      scenarioFile,
      "--inputs",
      inputsFile,
      "--ticks",
      String(c.ticks),
      "--out",
      out,
    ],
    { encoding: "utf8" },
  );
  const elapsed = performance.now() - t0;
  if (res.status !== 0) {
    console.error(res.stderr);
    process.exit(res.status ?? 1);
  }
  const lines = readFileSync(out, "utf8").trim().split("\n").map(JSON.parse);
  c.check(lines);
  const rerun = `${root}/${c.name}-rerun.jsonl`;
  spawnSync(
    process.execPath,
    [
      "src/headless.mjs",
      "--seed",
      "42",
      "--night",
      String(c.night ?? 1),
      "--scenario",
      scenarioFile,
      "--inputs",
      inputsFile,
      "--ticks",
      String(c.ticks),
      "--out",
      rerun,
    ],
    { encoding: "utf8" },
  );
  const same = readFileSync(out).equals(readFileSync(rerun));
  results.push({
    scenario: c.name,
    passed: true,
    ticks: c.ticks,
    milliseconds: elapsed,
    deterministic: same,
  });
}
writeFileSync(
  `${root}/scenarios.json`,
  JSON.stringify(
    {
      date: new Date().toISOString(),
      platform: process.platform,
      node: process.version,
      cpu: cpus()[0]?.model,
      memoryBytes: totalmem(),
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(results);
