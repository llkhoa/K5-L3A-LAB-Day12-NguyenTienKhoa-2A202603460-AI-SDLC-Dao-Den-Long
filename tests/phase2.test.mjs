import test from "node:test";
import assert from "node:assert/strict";
import { Game, dist } from "../src/game.mjs";
import { floorAt } from "../src/world.mjs";
const quiet = {
  random_motes: false,
  random_shades: false,
  random_drifters: false,
  wind_enabled: false,
};
const game = (s = {}, night = 1) =>
  new Game({ night, scenario: { ...quiet, ...s } });
const steps = (g, n, c = {}) => {
  for (let i = 0; i < n && !["won", "lost"].includes(g.state); i++) g.step(c);
  return g;
};
test("dash 12 steps moves 2.8m, starts cooldown and held key does not repeat", () => {
  const g = game();
  steps(g, 12, { dash: true });
  assert.ok(Math.abs(g.player.pos[2] - 2.8) < 1e-9);
  assert.equal(g.player.dashCD, 79);
  steps(g, 100);
  assert.ok(Math.abs(g.player.pos[2] - 2.8) < 1e-9);
  g.step({ dash: false });
  g.step({ dash: true });
  assert.ok(g.player.pos[2] > 2.8);
});
test("air dash holds height for all 12 dash steps", () => {
  const g = game({ player: { pos: [0, 3, 0] } });
  steps(g, 12, { dash: true });
  assert.equal(g.player.pos[1], 3);
  g.step({ dash: false });
  assert.ok(g.player.pos[1] < 3);
});
test("pause advances tick only, freezes all counters and resumes on rising edge", () => {
  const g = game({
    player: {
      carried: 6,
      invuln_ticks: 90,
      charm_ticks: 600,
      dash_cd_ticks: 60,
      pulse_cd_ticks: 100,
    },
  });
  g.addMote([10, 0, 0], "dropped", 480);
  g.step({ pause: true });
  steps(g, 100);
  assert.equal(g.tick, 101);
  assert.equal(g.sim_tick, 0);
  assert.equal(g.timeTicks, 18000);
  assert.equal(g.player.invuln, 90);
  assert.equal(g.player.charm, 600);
  assert.equal(g.motes[0].ttl, 480);
  assert.equal(g.snapshot().state, "paused");
  g.step({ pause: false });
  g.step({ pause: true });
  assert.equal(g.sim_tick, 1);
  assert.equal(g.state, "playing");
  assert.ok(g.events.some((e) => e.name === "resumed"));
});
test("pulse uses 3D centre and does not hit high shades", () => {
  const g = game({
    player: { carried: 10 },
    shades: [
      { id: "S1", pos: [0, 5.8, 0] },
      { id: "S2", pos: [0, 5.801, 0] },
    ],
  });
  g.step({ pulse: true });
  assert.deepEqual(g.events.find((e) => e.name === "pulse").data.stunned_ids, [
    "S1",
  ]);
});
test("night2 bridge support and falling outside bridge", () => {
  assert.equal(floorAt(2, 35, 2), 0);
  assert.equal(floorAt(2, 35, 2.01), -Infinity);
  const g = game({ player: { pos: [35, 0, 3] } }, 2);
  steps(g, 70);
  assert.equal(g.player.flames, 2);
});
test("jump pad locks horizontal launch and lands on other island", () => {
  const g = game({ player: { pos: [20, 0, 18] } }, 2);
  g.step();
  assert.equal(g.player.vel[1], 14);
  assert.equal(g.player.grounded, false);
  const velocity = [...g.player.launch];
  g.step({ move: [-1, 0] });
  assert.equal(g.player.vel[0], velocity[0]);
  steps(g, 85, { move: [0, 0] });
  assert.equal(g.player.grounded, true);
  assert.ok(g.player.pos[0] > 44);
  assert.equal(g.player.pos[1], 0);
});
test("night3 floors ramps walls and tower block", () => {
  assert.equal(floorAt(3, 0, 5), 6);
  assert.equal(floorAt(3, 0, 18), 3);
  assert.equal(floorAt(3, 0, -18), 0);
  assert.ok(
    Math.abs(floorAt(3, 27 * Math.cos(Math.PI / 6), 13.5) - 1.5) < 1e-8,
  );
  const g = game({ player: { pos: [0, 0, 24.2] } }, 3);
  steps(g, 10, { move: [0, -1] });
  assert.ok(g.player.pos[2] > 24);
  const tower = game({ player: { pos: [2.2, 6, 0] } }, 3);
  steps(tower, 10, { move: [-1, 0] });
  assert.ok(tower.player.pos[0] >= 2);
});
test("night3 pad lands on centre platform", () => {
  const g = game({ player: { pos: [0, 3, 13] } }, 3);
  g.step();
  steps(g, 64);
  assert.equal(g.player.pos[1], 6);
  assert.equal(g.player.grounded, true);
  assert.ok(g.player.pos[2] < 8 && g.player.pos[2] >= 2);
});
test("charm pickup makes run 7.2m/s, no dash cooldown, expires and respawns", () => {
  const g = game({ player: { pos: [35, 0, 0] } }, 2);
  g.step();
  assert.equal(g.player.charm, 600);
  assert.equal(g.charms[0].available, false);
  g.step({ move: [1, 0] });
  assert.ok(Math.abs(g.player.pos[0] - 35.12) < 1e-9);
  g.step({ dash: true });
  assert.equal(g.player.dashCD, 0);
  steps(g, 12, { dash: false, move: [0, 0] });
  g.step({ dash: true });
  assert.ok(g.events.some((e) => e.name === "dash"));
  g.player.pos = [0, 0, 0];
  g.player.dashTicks = 0;
  steps(g, 2700, { dash: false });
  assert.equal(g.player.charm, 0);
  assert.equal(g.charms[0].available, true);
});
test("drifter steals once before shade hit even while player invulnerable", () => {
  const g = game(
    {
      player: { carried: 10, invuln_ticks: 90 },
      drifters: [{ id: "D1", pos: [0.5, 0.8, 0] }],
      shades: [{ pos: [0.5, 0.8, 0] }],
    },
    2,
  );
  g.step();
  assert.equal(g.player.carried, 7);
  assert.equal(g.player.flames, 3);
  assert.equal(g.drifters[0].stolen, 3);
  assert.equal(g.drifters[0].state, "flee");
  steps(g, 241);
  assert.equal(g.drifters.length, 0);
});
test("drifter theft precedes floor half drop from shade", () => {
  const g = game(
    {
      player: { carried: 10 },
      drifters: [{ pos: [0.5, 0.8, 0] }],
      shades: [{ pos: [0.5, 0.8, 0] }],
    },
    2,
  );
  g.step();
  assert.equal(g.player.carried, 4);
  assert.equal(g.events.find((e) => e.name === "player_hit").data.dropped, 3);
  assert.ok(
    g.events.findIndex((e) => e.name === "drifter_steal") <
      g.events.findIndex((e) => e.name === "player_hit"),
  );
});
test("pulse repels chasing drifter, returns stolen motes while fleeing", () => {
  let g = game(
    {
      player: { carried: 10 },
      drifters: [{ pos: [2, 0.8, 0], state: "chase" }],
    },
    2,
  );
  g.step({ pulse: true });
  assert.equal(g.drifters[0].state, "flee");
  assert.equal(g.drifters[0].stolen, 0);
  g = game(
    {
      player: { carried: 10 },
      drifters: [{ pos: [2, 0.8, 0], state: "flee", stolen: 3 }],
    },
    2,
  );
  g.step({ pulse: true });
  assert.equal(g.drifters[0].stolen, 0);
  assert.equal(g.motes.length, 3);
  assert.equal(g.drifters[0].remaining, 120);
  assert.equal(g.events.find((e) => e.name === "drifter_drop").data.amount, 3);
});
test("scheduled spawns and capacities, wind tick boundaries", () => {
  const g = new Game({
    night: 2,
    scenario: { random_motes: false, random_shades: false },
  });
  steps(g, 1200);
  assert.equal(g.drifters.length, 1);
  assert.equal(g.drifters[0].born, 1200);
  const w = new Game({
    night: 3,
    seed: 7,
    scenario: {
      random_motes: false,
      random_shades: false,
      random_drifters: false,
    },
  });
  steps(w, 1799);
  assert.equal(w.wind.active, false);
  w.step();
  assert.equal(w.wind.active, true);
  const before = [...w.player.pos];
  steps(w, 60);
  assert.ok(Math.abs(dist(before, w.player.pos) - 2) < 1e-8);
  steps(w, 240);
  assert.equal(w.wind.active, false);
});
test("contract snapshot fields, scenario counters and three night definitions", () => {
  for (const n of [1, 2, 3]) {
    const g = game(
      {
        player: {
          invuln_ticks: 30,
          dash_cd_ticks: 60,
          pulse_cd_ticks: 120,
          charm_ticks: 600,
        },
      },
      n,
    );
    const s = g.snapshot();
    assert.equal(s.night, n);
    assert.equal(s.lanterns.length, n + 4);
    assert.equal(s.time_left_s, 270 + n * 30);
    assert.equal(s.player.invuln, true);
    assert.equal(s.player.dash_cd_s, 1);
    assert.equal(s.player.charm_s, 10);
    for (const k of ["motes", "drifters", "charms"])
      assert.ok(Array.isArray(s[k]));
  }
});
