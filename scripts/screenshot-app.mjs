/**
 * Full-window screenshot of the real running app, via macOS screencapture.
 * The native web views don't appear in renderer screenshots, so we grab the
 * window itself (needs Screen Recording permission for the terminal).
 *
 *   node scripts/screenshot-app.mjs [output.png]
 *
 * Defaults to the Home view; pass CONTROL_ROOM_CONFIG_DIR/CONTROL_ROOM_USER_DATA
 * to point at a throwaway setup. Uses the real app as-is otherwise.
 */
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { _electron as electron } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "apps", "desktop");
const shots = join(root, "scripts", "screenshots");
const require = createRequire(import.meta.url);
const electronPath = require("electron");
const output = process.argv[2] ?? join(shots, "app-window.png");
await mkdir(shots, { recursive: true });

const configDir = process.env.CONTROL_ROOM_CONFIG_DIR ?? (await mkdtemp(join(tmpdir(), "control-room-shot-config-")));
const userDataDir = process.env.CONTROL_ROOM_USER_DATA ?? (await mkdtemp(join(tmpdir(), "control-room-shot-data-")));

const app = await electron.launch({
  executablePath: electronPath,
  args: [appDir],
  env: { ...process.env, CONTROL_ROOM_CONFIG_DIR: configDir, CONTROL_ROOM_USER_DATA: userDataDir, CONTROL_ROOM_TEST: "1" },
});
try {
  const page = await app.firstWindow();
  await page.waitForSelector("[data-testid=home-button]", { timeout: 20000 });
  await page.waitForTimeout(3500);
  await app.evaluate(() => {
    const win = globalThis.__controlRoomTest?.win;
    win?.show();
    win?.focus();
  });
  await new Promise((r) => setTimeout(r, 1500));
  const source = await app.evaluate(() => globalThis.__controlRoomTest?.win?.getMediaSourceId?.() ?? "");
  const windowId = String(source).split(":")[1];
  if (!windowId) throw new Error("no window id");
  execFileSync("screencapture", ["-x", "-o", "-l", windowId, output]);
  console.log(`saved ${output}`);
} finally {
  await app.close();
}
