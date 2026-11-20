import test from "node:test";
import assert from "node:assert/strict";
import { Game, T, dist } from "../src/game.mjs";

const quiet = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false };
const game = (s = {}, night = 1) => new Game({ night, scenario: { ...quiet, ...s } });
const steps = (g, n, c = {}) => {
  for (let i = 0; i < n && g.state === "playing"; i++) g.step(c);
  return g;
};

test("fuel decays naturally 1.0/s and lantern goes out when fuel reaches 0", () => {
  const g = game({
    lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 1 }], // 1 fuel = 60 ticks
  });
  assert.equal(g.lanterns[0].lit, true);
  steps(g, 59);
  assert.equal(g.lanterns[0].lit, true);
  assert.equal(g.events.some((e) => e.name === "lantern_out"), false);
  g.step(); // tick 60: fuel reaches 0 -> lantern_out
  assert.equal(g.lanterns[0].lit, false);
  assert.equal(g.lanterns[0].ever_lit, true);
  assert.equal(g.lanterns[0].deposited, 0);
  assert.ok(g.events.some((e) => e.name === "lantern_out" && e.data.lantern_id === "L1"));
});

test("refueling partially fills lantern and clamps at 100 fuel", () => {
  const g = game({
    player: { carried: 5 },
    lanterns: [{ id: "L1", pos: [1, 0, 0], lit: true, fuel: 85 }], // needs 15 fuel -> ceil(1.5) = 2 motes
  });
  g.step({ interact: true });
  // Used 2 motes, carried becomes 3, fuel becomes 100
  assert.equal(g.player.carried, 3);
  assert.equal(g.lanterns[0].fuelTicks, 6000);
  assert.ok(g.events.some((e) => e.name === "refuel" && e.data.amount === 2 && e.data.fuel === 100));
});

test("relighting an ever_lit lantern only costs 5 motes and awards 40 points", () => {
  const g = game({
    player: { carried: 6 },
    lanterns: [{ id: "L1", pos: [1, 0, 0], lit: false, ever_lit: true, deposited: 0 }],
  });
  g.step({ interact: true });
  assert.equal(g.lanterns[0].lit, true);
  assert.equal(g.lanterns[0].relit_count, 1);
  assert.equal(g.player.carried, 1); // 6 - 5 = 1
  assert.equal(g.score, 5 * 5 + 40); // 5*5 for depositing + 40 for relight = 65
  assert.ok(g.events.some((e) => e.name === "lantern_lit" && e.data.relight === true));
});

test("shades enter drain state at weak lantern (fuel < 30) and emit fuel_drain", () => {
  const g = game({
    player: { pos: [20, 0, 0] }, // Player is far away so no contact/hit
    lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 20 }],
    shades: [{ id: "S1", pos: [1, 0.8, 0], state: "wander" }],
  });
  g.step(); // shade detects weak lantern within 2m, switches to drain
  assert.equal(g.shades[0].state, "drain");
  assert.equal(g.shades[0].target_lantern_id, "L1");
  // Run 60 ticks in drain state: emits fuel_drain
  steps(g, 60);
  assert.ok(g.events.some((e) => e.name === "fuel_drain" && e.data.shade_id === "S1"));
});

test("pulse on draining shade awards 15 points instead of 5", () => {
  const g = game({
    player: { carried: 5 },
    lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 25 }],
    shades: [{ id: "S1", pos: [1, 0.8, 0], state: "drain", target_lantern_id: "L1" }],
  });
  g.step({ pulse: true });
  assert.equal(g.shades[0].state, "stunned");
  assert.equal(g.score, 15);
});

test("player capacity scales with successful_lights up to 20", () => {
  const g = game({
    player: { carried: 0, successful_lights: 3 }, // 10 + 2*3 = 16
  });
  assert.equal(g.capacity, 16);
  assert.equal(g.snapshot().player.capacity, 16);
  g.player.successful_lights = 8; // 10 + 2*8 = 26 -> capped at 20
  assert.equal(g.capacity, 20);
});

test("night end evaluation requires ceil(0.6 * lanterns) lit lanterns", () => {
  // Night 1 has 5 lanterns: ceil(0.6 * 5) = 3
  const gWon = game({
    time_left_s: 1 / 60,
    player: { flames: 2 },
    lanterns: [
      { id: "L1", lit: true, fuel: 80 },
      { id: "L2", lit: true, fuel: 70 },
      { id: "L3", lit: true, fuel: 60 },
      { id: "L4", lit: false, fuel: 0 },
      { id: "L5", lit: false, fuel: 0 },
    ],
  });
  gWon.step();
  assert.equal(gWon.state, "won");
  assert.equal(gWon.events.at(-1).data.reason, "dawn_survived");

  const gLost = game({
    time_left_s: 1 / 60,
    player: { flames: 2 },
    lanterns: [
      { id: "L1", lit: true, fuel: 80 },
      { id: "L2", lit: true, fuel: 70 },
      { id: "L3", lit: false, fuel: 0 },
      { id: "L4", lit: false, fuel: 0 },
      { id: "L5", lit: false, fuel: 0 },
    ],
  });
  gLost.step();
  assert.equal(gLost.state, "lost");
  assert.equal(gLost.events.at(-1).data.reason, "dawn");
});
