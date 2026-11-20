import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const phase =
  JSON.parse(readFileSync("game.contract.json")).contract_version === "1.0"
    ? "phase-1"
    : JSON.parse(readFileSync("game.contract.json")).contract_version === "1.1"
      ? "phase-2"
      : "phase-3";
const root = `docs/proof/${phase}`;
mkdirSync(root, { recursive: true });
const test = spawnSync(
  process.execPath,
  [
    "--test",
    "tests/cli.test.mjs",
    "tests/game.test.mjs",
    "tests/phase2.test.mjs",
    "tests/phase3.test.mjs",
  ],
  { encoding: "utf8" },
);
writeFileSync(`${root}/tests.txt`, test.stdout + test.stderr);
process.stdout.write(test.stdout);
if (test.status !== 0) {
  writeFileSync(`${root}/verification.json`, JSON.stringify({date:new Date().toISOString(),testsExit:test.status??1,passed:false},null,2)+'\n');
  process.exit(test.status ?? 1);
}
if (phase === "phase-2") {
  const scenarios = spawnSync(process.execPath, ["scripts/phase2-evidence.mjs"], {encoding:"utf8"});
  writeFileSync(`${root}/scenario-run.txt`, scenarios.stdout + scenarios.stderr);
  if (scenarios.status !== 0) {
    writeFileSync(`${root}/verification.json`, JSON.stringify({date:new Date().toISOString(),testsExit:0,scenariosExit:scenarios.status??1,passed:false},null,2)+'\n');
    console.error(scenarios.stderr);process.exit(scenarios.status??1);
  }
} else if (phase === "phase-3") {
  const scenarios = spawnSync(process.execPath, ["scripts/phase3-evidence.mjs"], {encoding:"utf8"});
  writeFileSync(`${root}/scenario-run.txt`, scenarios.stdout + scenarios.stderr);
  if (scenarios.status !== 0) {
    writeFileSync(`${root}/verification.json`, JSON.stringify({date:new Date().toISOString(),testsExit:0,scenariosExit:scenarios.status??1,passed:false},null,2)+'\n');
    console.error(scenarios.stderr);process.exit(scenarios.status??1);
  }
}
const args = [
  "src/headless.mjs",
  "--seed",
  "42",
  "--night",
  "1",
  "--scenario",
  "tests/scenarios/deposit.json",
  "--inputs",
  "tests/scenarios/deposit-inputs.json",
  "--ticks",
  "120",
  "--out",
  `${root}/deposit.jsonl`,
];
for (let i = 0; i < 2; i++) {
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(r.status ?? 1);
  }
  const hash = createHash("sha256")
    .update(readFileSync(`${root}/deposit.jsonl`))
    .digest("hex");
  if (i === 0) globalThis.firstHash = hash;
  else if (hash !== globalThis.firstHash)
    throw new Error("Nondeterministic output");
}
writeFileSync(
  `${root}/verification.json`,
  JSON.stringify(
    {
      date: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      testsExit: 0,
      deterministic: true,
      sha256: globalThis.firstHash,
      hiddenTests: "not available",
      nativeMacLinux: process.platform === "linux" || process.platform === "darwin" ? process.platform : "not run",
    },
    null,
    2,
  ) + "\n",
);
console.log("Evidence saved:", root);
