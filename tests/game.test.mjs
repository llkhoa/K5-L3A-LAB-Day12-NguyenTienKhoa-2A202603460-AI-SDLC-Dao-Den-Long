import test from "node:test";
import assert from "node:assert/strict";
import { Game, T, dist } from "../src/game.mjs";
const quiet = { random_motes: false, random_shades: false };
const game = (s = {}) => new Game({ scenario: { ...quiet, ...s } });
const steps = (g, n, c = {}) => {
  for (let i = 0; i < n && g.state === "playing"; i++) g.step(c);
  return g;
};
test("60 fixed steps move six metres, yaw and diagonal are normalized", () => {
  let g = steps(game(), 60, { move: [0, 1] });
  assert.equal(g.snapshot().player.pos[2], 6);
  g = steps(game(), 60, { move: [1, 1] });
  assert.ok(Math.abs(dist(g.player.pos, [0, 0, 0]) - 6) < 1e-9);
  g = steps(game(), 60, { move: [0, 1], cam_yaw_deg: 90 });
  assert.equal(g.snapshot().player.pos[0], 6);
});
test("partial input persists; held jump does not bounce again", () => {
  const g = game();
  g.step({ move: [0, 1], jump: true });
  steps(g, 70);
  assert.equal(g.snapshot().player.pos[2], 7.1);
  assert.equal(g.player.pos[1], 0);
  assert.equal(g.player.grounded, true);
});
test("pickup includes radius boundary, excludes height and respects capacity", () => {
  const g = game({
    player: { carried: 9 },
    motes: [
      [1, 0, 0],
      [0.5, 0, 0],
      [0, 2, 0],
      [1.01, 0, 0],
    ],
  });
  g.step();
  assert.equal(g.player.carried, 10);
  assert.equal(g.motes.length, 3);
  assert.deepEqual(
    g.events.map((e) => e.name),
    ["night_start", "mote_picked"],
  );
});
test("deposit partial and held button edge; no construction events or score", () => {
  const g = game({
    player: { carried: 4 },
    lanterns: [{ id: "L1", pos: [0, 0, 0], deposited: 3 }],
  });
  assert.equal(g.score, 0);
  assert.equal(g.events.length, 0);
  g.step({ interact: true });
  assert.equal(g.lanterns[0].deposited, 7);
  assert.equal(g.score, 40);
  g.player.carried = 6;
  g.step({ interact: true });
  assert.equal(g.lanterns[0].deposited, 7);
  g.step({ interact: false });
  g.step({ interact: true });
  assert.equal(g.lanterns[0].lit, true);
  assert.equal(g.player.carried, 3);
  assert.equal(g.score, 170);
});
test("nearest unlit lantern wins distance/id tie and lit lantern is ignored", () => {
  const g = game({
    player: { carried: 10 },
    lanterns: [
      { id: "L1", pos: [1, 0, 0], lit: true },
      { id: "L2", pos: [2, 0, 0] },
      { id: "L3", pos: [-2, 0, 0] },
    ],
  });
  g.step({ interact: true });
  assert.equal(g.lanterns[1].lit, true);
  assert.equal(g.lanterns[2].deposited, 0);
});
test("pulse pays once, stuns inside, pushes four metres and cooldown prevents retry", () => {
  const g = game({
    player: { carried: 10 },
    shades: [
      { id: "S1", pos: [2, 0.8, 0] },
      { id: "S2", pos: [8, 0.8, 0] },
    ],
  });
  g.step({ pulse: true });
  assert.equal(g.player.carried, 7);
  assert.equal(g.shades[0].state, "stunned");
  assert.deepEqual(g.events.find((e) => e.name === "pulse").data.stunned_ids, [
    "S1",
  ]);
  steps(g, 14);
  assert.ok(Math.abs(g.shades[0].pos[0] - 6) < 1e-9);
  g.step({ pulse: false });
  g.step({ pulse: true });
  assert.equal(g.player.carried, 7);
  assert.equal(g.score, 5);
});
test("insufficient motes do not activate pulse", () => {
  const g = game({ player: { carried: 2 }, shades: [{ pos: [2, 0.8, 0] }] });
  g.step({ pulse: true });
  assert.equal(g.player.carried, 2);
  assert.equal(
    g.events.some((e) => e.name === "pulse"),
    false,
  );
});
test("one hit per tick, floor drop ratio and invulnerability", () => {
  const g = game({
    player: { carried: 9 },
    shades: [{ pos: [0.5, 0.8, 0] }, { pos: [-0.5, 0.8, 0] }],
  });
  g.step();
  assert.equal(g.player.flames, 2);
  assert.equal(g.player.carried, 5);
  assert.equal(g.motes.length, 4);
  steps(g, 20);
  assert.equal(g.player.flames, 2);
  assert.equal(g.events.filter((e) => e.name === "player_hit").length, 0);
});
test("lit lantern ejects and blocks shades", () => {
  const g = game({
    lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true }],
    shades: [{ pos: [1, 0.8, 0] }],
  });
  steps(g, 100);
  assert.ok(dist(g.shades[0].pos, [0, 0, 0]) >= 6 - 1e-8);
  assert.equal(g.player.flames, 3);
});
test("fall hits once then respawns with immunity", () => {
  const g = game({ player: { pos: [42, -11, 0], carried: 7 } });
  g.step();
  assert.equal(g.player.flames, 2);
  assert.equal(g.player.carried, 0);
  steps(g, 59);
  assert.equal(g.player.flames, 2);
  assert.equal(g.player.respawn, 1);
  g.step();
  assert.deepEqual(g.player.pos, [0, 0, 0]);
  assert.equal(g.player.invuln, 90);
});
test("winning on final tick beats dawn; no flames beats all lit", () => {
  let g = game({
    time_left_s: 1 / 60,
    player: { carried: 10 },
    lanterns: Array.from({ length: 5 }, (_, i) => ({
      id: `L${i + 1}`,
      pos: [0, 0, 0],
      lit: i > 0,
    })),
  });
  g.step({ interact: true });
  assert.equal(g.state, "won");
  assert.equal(g.score, 350);
  assert.equal(g.events.at(-1).data.reason, "all_lit");
  g = game({
    player: { flames: 0 },
    lanterns: Array.from({ length: 5 }, (_, i) => ({
      id: `L${i + 1}`,
      lit: true,
    })),
  });
  g.step();
  assert.equal(g.state, "lost");
  assert.equal(g.events.at(-1).data.reason, "no_flames");
});
test("dawn and terminal state stop simulation", () => {
  const g = game({ time_left_s: 2 / 60 });
  steps(g, 10);
  assert.equal(g.tick, 2);
  assert.equal(g.state, "lost");
  assert.equal(g.events.at(-1).data.reason, "dawn");
  assert.deepEqual(g.step(), []);
});
test("seed and input reproduce generated entities; random flags suppress schedules", () => {
  const a = new Game({ seed: 77 }),
    b = new Game({ seed: 77 });
  steps(a, 600, { move: [0.1, 0] });
  steps(b, 600, { move: [0.1, 0] });
  assert.deepEqual(a.snapshot(), b.snapshot());
  const g = steps(game(), 600);
  assert.equal(g.shades.length, 0);
  assert.equal(g.motes.length, 0);
});
test("runtime constants match declared tuning", async () => {
  const { readFileSync } = await import("node:fs");
  const contract = JSON.parse(readFileSync("game.contract.json"));
  for (const [key, value] of Object.entries(T))
    assert.equal(contract.tuning[key], value, key);
});
