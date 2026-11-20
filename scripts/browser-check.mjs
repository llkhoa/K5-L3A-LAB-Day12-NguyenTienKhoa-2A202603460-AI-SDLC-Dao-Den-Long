import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
const phase =
  JSON.parse(readFileSync("game.contract.json")).contract_version === "1.0"
    ? "phase-1"
    : "phase-2";
const out = `docs/proof/${phase}`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--enable-webgl",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173/?test=1");
  await page.waitForFunction(() => window.__lab);
  await page.screenshot({ path: `${out}/menu.png` });
  await page.locator("#play").click();
  await page.locator("#resume").click();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(600);
  await page.keyboard.up("KeyW");
  assert.ok((await page.evaluate(() => window.__lab.game.player.pos[2])) > 1);
  await page.keyboard.down("Space");
  await page.waitForTimeout(180);
  assert.ok((await page.evaluate(() => window.__lab.game.player.pos[1])) > 0.3);
  await page.keyboard.up("Space");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/gameplay.png` });
  await page.evaluate(() =>
    window.__lab.start({
      random_motes: false,
      random_shades: false,
      player: { carried: 10 },
      lanterns: Array.from({ length: 5 }, (_, i) => ({
        id: `L${i + 1}`,
        pos: [0, 0, 1],
        lit: i > 0,
      })),
    }),
  );
  await page.keyboard.down("KeyE");
  await page.waitForTimeout(250);
  await page.keyboard.up("KeyE");
  await page.waitForFunction(() => window.__lab.game.state === "won");
  await page.screenshot({ path: `${out}/win.png` });
  await page.evaluate(() => window.__lab.start());
  assert.equal(await page.evaluate(() => window.__lab.game.state), "playing");
  await page.evaluate(() =>
    window.__lab.start({
      random_motes: false,
      random_shades: false,
      time_left_s: 0.1,
    }),
  );
  await page.waitForFunction(() => window.__lab.game.state === "lost");
  assert.deepEqual(errors, []);
  const fps = await page.evaluate(() => window.__lab.fps);
  writeFileSync(
    `${out}/browser.json`,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        viewport: "1280x720",
        renderer: "Chrome headless SwiftShader (software)",
        checks: [
          "menu",
          "W movement",
          "jump",
          "deposit and win",
          "restart",
          "dawn loss",
        ],
        errors,
        fpsSample: fps,
        performanceNote: "software smoke sample, not native gameplay benchmark",
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Browser smoke passed", { fps });
} finally {
  await browser.close();
}
