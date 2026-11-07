/**
 * Home quote rotation check, on the real running app.
 *
 * Confirms the quote changes by itself — no clicks — within the expected
 * window (2 minutes plus slack), reading straight from the live DOM.
 *
 * Takes ~2.5 minutes to run.
 */
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { _electron as electron } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "apps", "desktop");
const require = createRequire(import.meta.url);
const electronPath = require("electron");

const configDir = await mkdtemp(join(tmpdir(), "control-room-quote-verify-"));
const userDataDir = await mkdtemp(join(tmpdir(), "control-room-quote-verify-"));

const app = await electron.launch({
  executablePath: electronPath,
  args: [appDir],
  env: { ...process.env, CONTROL_ROOM_CONFIG_DIR: configDir, CONTROL_ROOM_USER_DATA: userDataDir, CONTROL_ROOM_TEST: "1" },
});
const readQuote = async (page) =>
  (await page.evaluate(() => {
    const text = document.querySelector("blockquote p")?.textContent;
    const author = document.querySelector("blockquote footer")?.textContent;
    return text ? `${text} — ${author}` : "";
  })) || "";

try {
  const page = await app.firstWindow();
  await page.waitForSelector("blockquote p", { timeout: 20000 });
  const first = await readQuote(page);
  console.log(`quote at launch: ${first}`);

  const deadline = Date.now() + 150_000;
  let changed = false;
  while (Date.now() < deadline) {
    const current = await readQuote(page);
    if (current && current !== first) {
      changed = true;
      console.log(`quote changed automatically after ~${Math.round((150_000 - (deadline - Date.now())) / 1000)}s: ${current}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(changed ? "PASS  the quote rotates automatically" : "FAIL  quote never changed within 150s");
  process.exitCode = changed ? 0 : 1;
} finally {
  await app.close();
}
