/**
 * Step 3 check, on the real running app: the coding agents.
 *
 * Launches the built app with a throwaway config and data folder. Each agent
 * is pointed at a throwaway working folder (via agents.json), so nothing in
 * your real folders is touched and no prompt is ever sent to a model.
 *
 *  1. Claude Code, Codex and OpenCode each start their official CLI in a
 *     terminal inside the app and draw output
 *  2. each runs in the folder from agents.json
 *  3. the terminal size inside the app matches the real terminal
 *  4. an agent keeps running (same process) when you go Home and come back
 *  5. a theme change recolours the terminal without restarting the agent
 *  6. the sidebar shows a live dot for each running agent
 *  7. quitting the app stops every agent process
 * Screenshots go to scripts/screenshots/.
 */
import { mkdtemp, mkdir, writeFile, realpath } from "node:fs/promises";
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Never hang: give up after 3 minutes.
setTimeout(() => {
  console.log("FAIL  check timed out after 3 minutes");
  process.exit(2);
}, 180_000).unref();

const configDir = await mkdtemp(join(tmpdir(), "control-room-verify3-"));
const userData = await mkdtemp(join(tmpdir(), "control-room-verify3-data-"));
const work = await realpath(await mkdtemp(join(tmpdir(), "control-room-verify3-work-")));
const agents = ["claude-code", "codex", "opencode"];
const folders = {};
for (const id of agents) {
  folders[id] = join(work, id);
  await mkdir(folders[id], { recursive: true });
}
await writeFile(join(configDir, "agents.json"), JSON.stringify(Object.fromEntries(agents.map((id) => [id, { cwd: folders[id] }])), null, 2));
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const app = await electron.launch({
  executablePath: electronPath,
  args: [appDir],
  env: { ...process.env, CONTROL_ROOM_CONFIG_DIR: configDir, CONTROL_ROOM_USER_DATA: userData, CONTROL_ROOM_TEST: "1" },
});

const sessionOf = (id) =>
  app.evaluate((_e, id) => {
    const host = globalThis.__controlRoomTest.terminals;
    const t = host.terms.get(id);
    if (!t) return null;
    return { ...t.session, pid: t.proc?.pid, cols: t.cols, rows: t.rows, backlog: t.backlog.join("").length };
  }, id);

const pids = {};
try {
  const page = await app.firstWindow();
  await page.waitForSelector("[data-space=claude-code]", { timeout: 20000 });

  for (const id of agents) {
    await page.click(`[data-space=${id}]`);
    await page.waitForSelector("[data-testid=terminal] .xterm", { timeout: 10000 });
    // Wait for the CLI to draw something.
    let s;
    for (let i = 0; i < 40; i++) {
      s = await sessionOf(id);
      if (s?.backlog > 50) break;
      await sleep(250);
    }
    await sleep(2500);
    s = await sessionOf(id);
    const name = { "claude-code": "Claude Code", codex: "Codex", opencode: "OpenCode" }[id];
    check(`${name} starts its official CLI in a terminal`, !!s?.running && !!s?.pid, `${s?.agent?.path} ${s?.agent?.version ?? ""}`);
    check(`${name} draws output in the app`, (s?.backlog ?? 0) > 50, `${s?.backlog ?? 0} bytes`);
    check(`${name} runs in its chosen folder`, s?.cwd === folders[id], s?.cwd);
    const shown = await page.evaluate(() => {
      const d = document.querySelector("[data-testid=terminal]")?.dataset ?? {};
      return { cols: Number(d.cols), rows: Number(d.rows) };
    });
    check(`${name} terminal size matches the app`, s?.rows === shown.rows && s?.cols === shown.cols && s?.cols > 20, `agent ${s?.cols}x${s?.rows}, app ${shown.cols}x${shown.rows}`);
    pids[id] = s?.pid;
    await page.screenshot({ path: join(shots, `step3-${id}.png`) });
  }

  // 4. keeps running across navigation
  await page.click("[data-testid=home-button]");
  await sleep(800);
  await page.click("[data-space=claude-code]");
  await page.waitForSelector("[data-testid=terminal] .xterm", { timeout: 10000 });
  await sleep(800);
  const back = await sessionOf("claude-code");
  check("an agent keeps running while you're elsewhere", back?.running && back?.pid === pids["claude-code"], `pid ${back?.pid}`);
  const redrawn = await page.evaluate(() => Number(document.querySelector("[data-testid=terminal]")?.dataset.chars ?? 0));
  check("coming back shows the agent's screen again", redrawn > 0, `${redrawn} characters on screen`);

  // 5. theme change
  await writeFile(join(configDir, "theme.json"), JSON.stringify({ current: "tokyo-night", glass: true }, null, 2));
  await page.waitForFunction(() => document.documentElement.dataset.theme === "tokyo-night", null, { timeout: 5000 });
  await sleep(600);
  const afterTheme = await sessionOf("claude-code");
  check("a theme change doesn't restart the agent", afterTheme?.pid === pids["claude-code"]);
  await page.screenshot({ path: join(shots, "step3-claude-code-tokyo-night.png") });
  await writeFile(join(configDir, "theme.json"), JSON.stringify({ current: "rose-pine", glass: true }, null, 2));
  await page.waitForFunction(() => document.documentElement.dataset.theme === "rose-pine", null, { timeout: 5000 });

  // 6. live dots
  const dots = await page.$$eval("[data-space]", (els) =>
    els.filter((e) => e.querySelector("[data-testid=live-dot]")).map((e) => e.getAttribute("data-space")),
  );
  check("the sidebar shows a live dot for each running agent", agents.every((id) => dots.includes(id)), dots.join(" "));
} catch (e) {
  check("run finished without crashing", false, e.message);
} finally {
  await app.close();
}

// 7. quitting stops the agents
await sleep(1500);
const alive = Object.entries(pids).filter(([, pid]) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
});
check("quitting the app stops every agent", alive.length === 0, alive.map(([id]) => id).join(" ") || "all stopped");

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed. Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
