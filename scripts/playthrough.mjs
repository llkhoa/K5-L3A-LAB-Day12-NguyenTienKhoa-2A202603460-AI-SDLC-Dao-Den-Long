import { Game, dist } from "../src/game.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
// A normal-input bot: no teleports, no scenario, no modified inventory/health.
const g = new Game({ seed: 42, night: 1 }),
  frames = [];
let target = null;
while (g.state === "playing" && g.tick < 18000) {
  const p = g.player;
  const lanterns = g.lanterns.filter((l) => !l.lit);
  let interact = false;
  if (
    p.carried >= 10 ||
    (p.carried > 0 && lanterns.some((l) => dist(l.pos, p.pos) <= 2))
  ) {
    target = lanterns.sort(
      (a, b) => dist(a.pos, p.pos) - dist(b.pos, p.pos),
    )[0];
    interact = target && dist(target.pos, p.pos) <= 2;
  } else
    target = g.motes
      .filter((m) => m.kind === "random")
      .sort((a, b) => dist(a.pos, p.pos) - dist(b.pos, p.pos))[0];
  const d = target ? dist(target.pos, p.pos) : 0;
  let move =
    target && d > 0.4
      ? [(target.pos[0] - p.pos[0]) / d, (target.pos[2] - p.pos[2]) / d]
      : [0, 0];
  const threats=g.shades.filter(s=>!['stunned','recoil','spawning'].includes(s.state));
  if(target&&threats.some(s=>dist(s.pos,p.pos)<9)){
    let best=-Infinity;
    for(let i=0;i<32;i++){
      const angle=i*Math.PI/16,candidate=[Math.cos(angle),Math.sin(angle)];
      const next=[p.pos[0]+candidate[0]*3.6,p.pos[1],p.pos[2]+candidate[1]*3.6];
      if(Math.hypot(next[0],next[2])>38)continue;
      let risk=0;for(const s of threats){const sd=dist(s.pos,p.pos)||1;const future=[s.pos[0]+(p.pos[0]-s.pos[0])/sd*2.4,s.pos[1],s.pos[2]+(p.pos[2]-s.pos[2])/sd*2.4];risk+=Math.max(0,4-dist(next,future))**2;}
      const score=d-dist(next,target.pos)-risk*4;
      if(score>best){best=score;move=candidate;}
    }
  }
  const danger = g.shades.some(
    (s) => s.state !== "stunned" && dist(s.pos, p.pos) < 2.2,
  );
  const pulse = danger && p.carried >= 3 && p.pulseCD === 0;
  const input = {
    tick: g.tick,
    move,
    interact: !!interact && !g.input.interact,
    pulse: pulse && !g.input.pulse,
    dash: d > 4 && p.dashCD === 0 && !g.input.dash,
  };
  frames.push(input);
  g.step(input);
}
const root = "docs/proof/phase-2";
mkdirSync(root, { recursive: true });
writeFileSync(
  `${root}/playthrough-inputs.json`,
  JSON.stringify({ frames }) + "\n",
);
writeFileSync(
  `${root}/playthrough-summary.json`,
  JSON.stringify(
    {
      seed: 42,
      night: 1,
      state: g.state,
      ticks: g.tick,
      score: g.score,
      flames: g.player.flames,
      lanterns: g.lanterns.filter((l) => l.lit).length,
      method: "normal inputs only; no scenario overrides",
    },
    null,
    2,
  ) + "\n",
);
const r = spawnSync(
  process.execPath,
  [
    "src/headless.mjs",
    "--seed",
    "42",
    "--night",
    "1",
    "--ticks",
    "18000",
    "--inputs",
    `${root}/playthrough-inputs.json`,
    "--snapshot-every",
    "600",
    "--out",
    `${root}/playthrough.jsonl`,
  ],
  { encoding: "utf8" },
);
if (r.status) throw Error(r.stderr);
console.log({
  state: g.state,
  ticks: g.tick,
  score: g.score,
  lanterns: g.lanterns.filter((l) => l.lit).length,
});
