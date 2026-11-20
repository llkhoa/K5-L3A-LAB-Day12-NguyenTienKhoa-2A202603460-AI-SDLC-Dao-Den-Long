import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { cpus, totalmem } from "node:os";
import assert from "node:assert/strict";
const root = "docs/proof/phase-2",
  scenarios = "tests/scenarios/phase-2";
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
    name: "dash",
    ticks: 12,
    scenario: {},
    frames: [{ tick: 0, dash: true }],
    check: (r) => assert.equal(r[1].player.pos[2], 2.8),
  },
  {
    name: "pause",
    ticks: 100,
    scenario: { player: { charm_ticks: 600 } },
    frames: [{ tick: 0, pause: true }],
    check: (r) => {
      assert.equal(r[1].sim_tick, 0);
      assert.equal(r[1].player.charm_s, 10);
    },
  },
  {
    name: "bridge",
    night: 2,
    ticks: 60,
    scenario: { player: { pos: [30, 0, 0] }, charms: [] },
    frames: [{ tick: 0, move: [1, 0] }],
    check: (r) => {
      assert.equal(r[1].player.pos[0], 36);
      assert.equal(r[1].player.pos[1], 0);
    },
  },
  {
    name: "pad",
    night: 2,
    ticks: 86,
    scenario: { player: { pos: [20, 0, 18] } },
    check: (r) => {
      assert.ok(r[1].player.pos[0] > 44);
      assert.equal(r[1].player.grounded, true);
    },
  },
  {
    name: "terrace",
    night: 3,
    ticks: 10,
    scenario: { player: { pos: [0, 0, 24.2] } },
    frames: [{ tick: 0, move: [0, -1] }],
    check: (r) => assert.ok(r[1].player.pos[2] > 24),
  },
  {
    name: "charm",
    night: 2,
    ticks: 1,
    scenario: { player: { pos: [35, 0, 0] } },
    check: (r) => assert.equal(r[1].player.charm_s, 10),
  },
  {
    name: "drifter-steal",
    night: 2,
    ticks: 1,
    scenario: { player: { carried: 10 }, drifters: [{ pos: [0.5, 0.8, 0] }] },
    check: (r) => assert.equal(r[1].player.carried, 7),
  },
  {
    name: "drifter-drop",
    night: 2,
    ticks: 1,
    scenario: {
      player: { carried: 10 },
      drifters: [{ pos: [2, 0.8, 0], state: "flee", stolen: 3 }],
    },
    frames: [{ tick: 0, pulse: true }],
    check: (r) => assert.equal(r[1].motes_active, 3),
  },
  {
    name: "wind",
    night: 3,
    ticks: 1800,
    scenario: { wind_enabled: true },
    check: (r) => assert.equal(r[1].wind.active, true),
  },
  {
    name: "full-night",
    night: 3,
    ticks: 21600,
    scenario: {},
    check: (r) => {
      assert.equal(r[1].tick, 21600);
      assert.equal(r[1].state, "lost");
      assert.equal(r[1].time_left_s, 0);
    },
  },
];
const results = [];
for (const c of cases) {
  const scenario = `${scenarios}/${c.name}.json`,
    inputs = `${scenarios}/${c.name}-inputs.json`,
    out = `${root}/${c.name}.jsonl`;
  writeFileSync(
    scenario,
    JSON.stringify({ ...quiet, ...c.scenario }, null, 2) + "\n",
  );
  writeFileSync(
    inputs,
    JSON.stringify({ frames: c.frames ?? [] }, null, 2) + "\n",
  );
  const args = [
    "src/headless.mjs",
    "--seed",
    "42",
    "--night",
    String(c.night ?? 1),
    "--scenario",
    scenario,
    "--inputs",
    inputs,
    "--ticks",
    String(c.ticks),
    "--snapshot-every",
    String(c.ticks),
    "--out",
    out,
  ];
  const start = performance.now();
  const run = spawnSync(process.execPath, args, { encoding: "utf8" });
  const ms = performance.now() - start;
  assert.equal(run.status, 0, run.stderr);
  const raw = readFileSync(out, "utf8");
  const rows = raw.trim().split("\n").map(JSON.parse);
  c.check(rows.filter((r) => r.type === "snapshot"));
  const repeat = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(repeat.status, 0);
  assert.equal(readFileSync(out, "utf8"), raw);
  if (c.name === "full-night") assert.ok(ms < 30000);
  results.push({
    scenario: c.name,
    passed: true,
    ticks: c.ticks,
    milliseconds: ms,
    deterministic: true,
  });
}
writeFileSync(
  `${root}/scenarios.json`,
  JSON.stringify(
    {
      date: new Date().toISOString(),
      platform: process.platform,
      node: process.version,
      cpu: cpus()[0].model,
      ramGB: Math.round(totalmem() / 1024 ** 3),
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(results);
