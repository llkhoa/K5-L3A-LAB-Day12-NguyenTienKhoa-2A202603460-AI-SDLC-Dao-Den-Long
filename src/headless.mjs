import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Game } from "./game.mjs";
import { validateInputs, validateScenario } from "./validation.mjs";
let options;
try {
  options = { seed: 1, night: 1, "snapshot-every": 10 };
  const args = process.argv.slice(2);
  const allowed = [
    "seed",
    "night",
    "scenario",
    "inputs",
    "ticks",
    "out",
    "snapshot-every",
  ];
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    if (
      !args[i].startsWith("--") ||
      !allowed.includes(key) ||
      args[i + 1] === undefined
    )
      throw new Error(`Tham số không hợp lệ: ${args[i]}`);
    options[key] = args[i + 1];
  }
  for (const key of ["seed", "night", "ticks", "snapshot-every"]) {
    options[key] = Number(options[key]);
    if (!Number.isSafeInteger(options[key]))
      throw new Error(`${key} phải là số nguyên`);
  }
  if (
    ![1, 2, 3].includes(options.night) ||
    options.ticks < 0 ||
    options["snapshot-every"] <= 0 ||
    !options.out
  )
    throw new Error(
      "Cần --night 1/2/3 --ticks >=0 --out file và snapshot-every >0",
    );
  const read = (p) =>
    JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
  options.scenario = options.scenario
    ? validateScenario(read(options.scenario), options.night)
    : {};
  options.frames = options.inputs
    ? validateInputs(read(options.inputs)).frames
    : [];
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
try {
  const game = new Game(options),
    lines = [JSON.stringify(game.snapshot())];
  let index = 0;
  for (
    let i = 0;
    i < options.ticks && !["won", "lost"].includes(game.state);
    i++
  ) {
    const frame =
      options.frames[index]?.tick === i ? options.frames[index++] : {};
    for (const event of game.step(frame)) lines.push(JSON.stringify(event));
    if (game.tick % options["snapshot-every"] === 0)
      lines.push(JSON.stringify(game.snapshot()));
  }
  lines.push(
    JSON.stringify({
      type: "end",
      ticks: game.tick,
      state: game.state,
      score: game.score,
    }),
  );
  mkdirSync(dirname(options.out), { recursive: true });
  writeFileSync(options.out, lines.join("\n") + "\n");
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
