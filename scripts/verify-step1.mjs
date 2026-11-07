/**
 * Step 1 check, on the real running app (not mocks).
 *
 * Launches the built app against a throwaway config folder, then:
 *  1. checks the default config files were created
 *  2. checks the sidebar shows every group and space from spaces.json
 *  3. edits theme.json -> the app restyles live (no restart)
 *  4. writes a broken theme.json -> the app keeps the last good theme and shows the error
 *  5. switches to a light theme
 *  6. edits spaces.json -> the sidebar updates live
 * Screenshots go to scripts/screenshots/.
 */
import { mkdtemp, readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { _electron as electron } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "apps", "desktop");
const shots = join(root, "scripts", "screenshots");
const require = createRequire(import.meta.url);
const electronPath = require("electron");

const configDir = await mkdtemp(join(tmpdir(), "control-room-verify-"));
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const app = await electron.launch({
  executablePath: electronPath,
  args: [appDir],
  env: { ...process.env, CONTROL_ROOM_CONFIG_DIR: configDir },
});

try {
  const page = await app.firstWindow();
  await page.waitForSelector("[data-space=chatgpt]", { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(shots, "1-home.png") });

  // 1. defaults created
  const files = (await readdir(configDir)).sort().join(",");
  const themes = (await readdir(join(configDir, "themes"))).sort().join(",");
  check("default config files created", files === "modules.json,spaces.json,theme.json,themes", files);
  check("starter themes copied", themes === "catppuccin,rose-pine,tokyo-night", themes);

  // 2. sidebar content
  const spaces = JSON.parse(await readFile(join(configDir, "spaces.json"), "utf8"));
  const expected = spaces.groups.flatMap((g) => g.spaces.map((s) => s.id));
  const shown = await page.$$eval("[data-space]", (els) => els.map((e) => e.getAttribute("data-space")));
  check("sidebar shows every space from spaces.json", JSON.stringify(shown) === JSON.stringify(expected), shown.join(" "));

  await page.click("[data-space=claude-code]");
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, "2-space-selected.png") });
  const placeholder = await page.textContent("main");
  check("selected space is labelled not-built-yet", placeholder.includes("Not built yet"), "");

  const themeOf = () => page.evaluate(() => document.documentElement.dataset.theme);
  const bgOf = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--cr-bg").trim());
  check("default theme is light rose-pine", (await themeOf()) === "rose-pine", await bgOf());

  // 3. live theme switch
  await writeFile(join(configDir, "theme.json"), JSON.stringify({ current: "tokyo-night" }, null, 2));
  await page.waitForFunction(() => document.documentElement.dataset.theme === "tokyo-night", null, { timeout: 5000 });
  await page.waitForTimeout(400);
  check("editing theme.json restyles the app live", (await bgOf()) === "#1a1b26", await bgOf());
  await page.screenshot({ path: join(shots, "3-tokyo-night.png") });

  // 4. broken edit is rejected
  await writeFile(join(configDir, "theme.json"), "{ this is not json");
  await page.waitForSelector("[data-testid=config-errors]", { timeout: 5000 });
  await page.waitForTimeout(300);
  check("broken theme.json shows an error", true);
  check("broken theme.json keeps the last good theme", (await themeOf()) === "tokyo-night");
  await page.screenshot({ path: join(shots, "4-broken-edit.png") });

  // 5. light theme
  await writeFile(join(configDir, "theme.json"), JSON.stringify({ current: "rose-pine" }, null, 2));
  await page.waitForFunction(() => document.documentElement.dataset.theme === "rose-pine", null, { timeout: 5000 });
  await page.waitForTimeout(400);
  const errorsGone = (await page.$("[data-testid=config-errors]")) === null;
  check("fixing the file clears the error", errorsGone);
  check("light theme applies", (await page.evaluate(() => document.documentElement.dataset.mode)) === "light");
  await page.screenshot({ path: join(shots, "5-rose-pine-light.png") });

  // 6. live sidebar edit
  spaces.groups[3].spaces.push({ id: "test-site", title: "Test Site", kind: "web", url: "https://example.com" });
  await writeFile(join(configDir, "spaces.json"), JSON.stringify(spaces, null, 2));
  await page.waitForSelector("[data-space=test-site]", { timeout: 5000 });
  check("editing spaces.json updates the sidebar live", true);

  await writeFile(join(configDir, "theme.json"), JSON.stringify({ current: "rose-pine" }, null, 2));
  await page.waitForFunction(() => document.documentElement.dataset.theme === "rose-pine", null, { timeout: 5000 });
} catch (e) {
  check("run finished without crashing", false, e.message);
} finally {
  await app.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed. Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
