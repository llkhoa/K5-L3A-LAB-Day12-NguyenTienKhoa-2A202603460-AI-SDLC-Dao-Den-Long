import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const out = "docs/proof/phase-2";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
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
  assert.match(await page.locator("#dialog-title").textContent(), /1/);
  await page.locator("#resume").click();
  await page.keyboard.press("KeyP");
  assert.equal(await page.evaluate(() => window.__lab.game.state), "paused");
  const sim = await page.evaluate(() => window.__lab.game.sim_tick);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__lab.game.sim_tick), sim);
  await page.locator("#dialog-settings").click();
  await page.locator("#volume").fill("0.2");
  await page.locator("#volume").dispatchEvent("input");
  await page.reload();
  await page.waitForFunction(() => window.__lab);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("dao-den-long-settings")).volume,
    ),
    0.2,
  );
  const performance = [];
  for (const night of [1, 2, 3]) {
    await page.evaluate((n) => window.__lab.start({}, n), night);
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.__lab.resetFps());
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyW");
    await page.waitForTimeout(9500);
    performance.push(
      await page.evaluate(() => ({
        night: window.__lab.game.night,
        fps: window.__lab.fps,
        renderer: window.__lab.renderer,
      })),
    );
    await page.screenshot({ path: `${out}/night-${night}.png` });
  }
  // Exercise result -> next introduction -> start, with controlled scenarios.
  await page.locator("#pause-button").click();
  await page.locator("#menu").click();
  for (const night of [1, 2, 3]) {
    await page.evaluate(
      (n) =>
        window.__lab.start(
          {
            random_motes: false,
            random_shades: false,
            random_drifters: false,
            wind_enabled: false,
            player: { pos: [10, 0, 0], carried: 10 },
            lanterns: Array.from({ length: n + 4 }, (_, i) => ({
              id: `L${i + 1}`,
              pos: [10, 0, 1],
              lit: i > 0,
            })),
          },
          n,
        ),
      night,
    );
    await page.keyboard.press("KeyE");
    await page.waitForFunction(() => window.__lab.game.state === "won");
    if (night < 3) {
      await page.locator("#next-night").click();
      assert.match(
        await page.locator("#dialog-title").textContent(),
        new RegExp(String(night + 1)),
      );
      await page.locator("#resume").click();
      assert.equal(
        await page.evaluate(() => window.__lab.game.night),
        night + 1,
      );
    } else {
      assert.equal(await page.locator("#next-night").isVisible(), false);
      await page.screenshot({ path: `${out}/dawn.png` });
    }
  }
  assert.ok((await page.evaluate(() => window.__lab.totalScore)) > 0);
  assert.deepEqual(errors, []);
  writeFileSync(
    `${out}/browser-phase2.json`,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        viewport: "1280x720",
        browser: await browser.version(),
        checks: [
          "intro",
          "pause freeze",
          "settings persisted",
          "three maps",
          "quick E buffered",
          "night transitions",
          "final dawn",
          "total won score",
        ],
        performance,
        errors,
        note: "10 second samples after 2 second warmup, headless Chrome with host GPU, not human playtest",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(performance);
} finally {
  await browser.close();
}
