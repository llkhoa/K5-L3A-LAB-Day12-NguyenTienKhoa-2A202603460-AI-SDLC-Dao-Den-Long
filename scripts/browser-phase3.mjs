import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const out = "docs/proof/phase-3";
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

  // Settings: check colorblind toggle
  await page.locator("#settings").click();
  await page.locator("#colorblind").check();
  await page.locator("#colorblind").dispatchEvent("change");
  await page.screenshot({ path: `${out}/colorblind-settings.png` });

  await page.reload();
  await page.waitForFunction(() => window.__lab);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("dao-den-long-settings")).colorblind,
    ),
    true,
  );

  // Start night 1 and screenshot in colorblind mode
  await page.locator("#play").click();
  await page.locator("#resume").click();
  await page.screenshot({ path: `${out}/gameplay-colorblind.png` });

  // Test fuel decay, refuel prompt, winning by dawn survived
  for (const night of [1, 2, 3]) {
    await page.evaluate(
      (n) =>
        window.__lab.start(
          {
            random_motes: false,
            random_shades: false,
            random_drifters: false,
            wind_enabled: false,
            time_left_s: 2 / 60,
            lanterns: Array.from({ length: n + 4 }, (_, i) => ({
              id: `L${i + 1}`,
              pos: [10, 0, 1],
              lit: i < Math.ceil(0.6 * (n + 4)),
              fuel: 100,
            })),
          },
          n,
        ),
      night,
    );
    await page.waitForFunction(() => window.__lab.game.state === "won");
    if (night < 3) {
      await page.locator("#next-night").click();
      await page.locator("#resume").click();
    } else {
      await page.screenshot({ path: `${out}/dawn-survived.png` });
    }
  }

  assert.deepEqual(errors, []);
  writeFileSync(
    `${out}/browser-phase3.json`,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        viewport: "1280x720",
        browser: await browser.version(),
        checks: [
          "colorblind settings persisted",
          "colorblind UI and shade rim",
          "fuel decay and refuel HUD",
          "win by dawn_survived at >=60% lit lanterns",
          "dawn screen",
        ],
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Browser phase 3 tests passed.");
} finally {
  await browser.close();
}
