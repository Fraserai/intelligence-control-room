/**
 * Step 2 check, on the real running app (not mocks).
 *
 * A throwaway config folder AND a throwaway user-data folder are used, so
 * this never touches real logins.
 *
 *  1. the sidebar starts with no site marked open
 *  2. ChatGPT, Claude, Grok and Gemini each load their real website
 *  3. each site has its own saved login (separate cookie stores)
 *  4. switching spaces never reloads a page (page state survives)
 *  5. a site stays loaded in the background after you leave it
 *  6. changing the theme doesn't reload or log out any site
 *  7. a saved login survives a full restart
 *  8. the ⌘1–9 Spaces menu selects sites
 *  9. a real favicon replaces the generic sidebar icon
 *
 * Screenshots go to scripts/screenshots/.
 */
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
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

const configDir = await mkdtemp(join(tmpdir(), "control-room-step2-config-"));
const userDataDir = await mkdtemp(join(tmpdir(), "control-room-step2-data-"));
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SITES = [
  { id: "chatgpt", title: "ChatGPT", hosts: ["chatgpt.com", "openai.com"] },
  { id: "claude", title: "Claude", hosts: ["claude.ai", "anthropic.com"] },
  { id: "grok", title: "Grok", hosts: ["grok.com", "x.ai", "x.com"] },
  { id: "gemini", title: "Gemini", hosts: ["gemini.google.com", "google.com"] },
];

const launch = () =>
  electron.launch({
    executablePath: electronPath,
    args: [appDir],
    env: {
      ...process.env,
      CONTROL_ROOM_CONFIG_DIR: configDir,
      CONTROL_ROOM_USER_DATA: userDataDir,
      CONTROL_ROOM_TEST: "1",
    },
  });

/** Wait until the native view for a site has been created. */
async function waitForView(app, id, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await app.evaluate(({}, id) => !!globalThis.__controlRoomTest?.web?.webContentsOf(id), id)) return true;
    await sleep(100);
  }
  return false;
}

/** Wait until the site has finished loading (or timed out). */
async function waitForLoad(app, id, timeout = 45000) {
  if (!(await waitForView(app, id))) return { ok: false, reason: "view was never created" };
  return app.evaluate(
    async ({}, { id, timeout }) => {
      const wc = globalThis.__controlRoomTest.web.webContentsOf(id);
      if (!wc) return { ok: false, reason: "view was never created" };
      const snapshot = () => {
        const status = globalThis.__controlRoomTest.web.statuses().find((s) => s.id === id);
        return { url: wc.getURL(), title: wc.getTitle(), loading: wc.isLoading(), error: status?.error, open: status?.open };
      };
      if (!wc.isLoading()) {
        // Give a just-created view a moment to actually start loading.
        await new Promise((r) => setTimeout(r, 400));
        if (!wc.isLoading()) return { ok: true, ...snapshot() };
      }
      return new Promise((resolve) => {
        const done = () => {
          clearTimeout(timer);
          wc.removeListener("did-stop-loading", done);
          resolve({ ok: true, ...snapshot() });
        };
        const timer = setTimeout(() => {
          wc.removeListener("did-stop-loading", done);
          resolve({ ok: false, reason: "timed out", ...snapshot() });
        }, timeout);
        wc.once("did-stop-loading", done);
      });
    },
    { id, timeout },
  );
}

async function captureView(app, id, file) {
  try {
    const base64 = await app.evaluate(async ({}, id) => {
      const wc = globalThis.__controlRoomTest.web.webContentsOf(id);
      if (!wc) return null;
      const image = await wc.capturePage();
      return image.isEmpty() ? null : image.toPNG().toString("base64");
    }, id);
    if (!base64) return false;
    await writeFile(file, Buffer.from(base64, "base64"));
    return true;
  } catch {
    return false;
  }
}

async function setTheme(name) {
  await writeFile(join(configDir, "theme.json"), JSON.stringify({ current: name }, null, 2));
}

async function clickMenu(app, label) {
  return app.evaluate(({}, label) => {
    const menu = globalThis.__controlRoomTest?.menu;
    const spaces = menu?.items.find((i) => i.label === "Spaces");
    const item = spaces?.submenu?.items.find((i) => i.label === label);
    if (!item) return false;
    item.click();
    return true;
  }, label);
}

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const hostAllowed = (url, hosts) => hosts.some((h) => hostOf(url) === h || hostOf(url).endsWith(`.${h}`));

const app = await launch();
try {
  let page = await app.firstWindow();
  await page.waitForSelector("[data-space=chatgpt]", { timeout: 20000 });
  await page.waitForTimeout(600);

  // 1. Nothing is marked open before anything is opened.
  const dotsAtStart = await page.$$eval("[data-testid=live-dot]", (els) => els.length);
  check("no site is marked open before you open one", dotsAtStart === 0, `${dotsAtStart} dots`);
  const webSpacesShown = await page.$$eval(
    "[data-space]",
    (els, ids) => els.map((e) => e.getAttribute("data-space")).filter((id) => ids.includes(id)),
    SITES.map((s) => s.id),
  );
  check("all four LLM websites are in the sidebar", webSpacesShown.length === 4, webSpacesShown.join(" "));
  await page.screenshot({ path: join(shots, "step2-1-home.png") });

  // 2. Every site loads its real website.
  const loaded = {};
  for (const site of SITES) {
    await page.click(`[data-space=${site.id}]`);
    const result = await waitForLoad(app, site.id);
    // Let the site paint; did-stop-loading fires before a single-page app draws.
    if (result.ok) await page.waitForTimeout(1500);
    const paint = result.ok
      ? await app.evaluate(async ({}, id) => {
          const wc = globalThis.__controlRoomTest.web.webContentsOf(id);
          const text = await wc.executeJavaScript("document.body ? document.body.innerText.length : 0").catch(() => 0);
          return { url: wc.getURL(), title: wc.getTitle(), text };
        }, site.id)
      : { url: result.url, title: result.title, text: 0 };
    const good = result.ok && !result.error && hostAllowed(paint.url, site.hosts) && paint.text > 20;
    loaded[site.id] = { ...result, ...paint };
    check(
      `${site.title} loads and shows its real website`,
      good,
      result.ok
        ? `${hostOf(paint.url)}${result.error ? ` — ${result.error}` : ""}, "${paint.title}", ${paint.text} chars`
        : `${result.reason} (${hostOf(result.url) || "no url"})`,
    );
    if (good) {
      const captured = await captureView(app, site.id, join(shots, `step2-site-${site.id}.png`));
      if (!captured) console.log(`      (could not capture a picture of ${site.title})`);
    }
  }
  await page.screenshot({ path: join(shots, "step2-2-all-sites-open.png") });

  // 9. Real favicons replace the generic sidebar icons.
  const favicons = await app.evaluate(() => {
    const out = {};
    for (const s of globalThis.__controlRoomTest.web.statuses()) if (s.favicon) out[s.id] = s.favicon.slice(0, 24);
    return out;
  });
  const faviconCount = Object.keys(favicons).length;
  const iconImages = await page.$$eval("aside img", (els) => els.length);
  check(
    "real site icons replace the generic sidebar icons",
    faviconCount > 0 && iconImages > 0,
    `${faviconCount} favicons, ${iconImages} shown`,
  );

  // 3. Each site has its own cookie store (its own saved login).
  const cookieProbe = await app.evaluate(async ({}, sites) => {
    const t = globalThis.__controlRoomTest;
    const year = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
    const sets = {
      chatgpt: [
        { url: "https://chatgpt.com/", name: "cr-login-probe", value: "keep-me", secure: true, expirationDate: year },
        { url: "https://example.com/", name: "cr-neutral-probe", value: "space-chatgpt", secure: true, expirationDate: year },
      ],
    };
    for (const id of Object.keys(sets)) {
      const wc = t.web.webContentsOf(id);
      for (const c of sets[id]) await wc.session.cookies.set(c);
    }
    const sessions = sites.map((s) => t.web.webContentsOf(s.id)?.session).filter(Boolean);
    const distinct = new Set(sessions).size;
    const reads = {};
    for (const s of sites) {
      const wc = t.web.webContentsOf(s.id);
      reads[s.id] = {
        login: (await wc.session.cookies.get({ name: "cr-login-probe" })).map((c) => c.value),
        neutral: (await wc.session.cookies.get({ name: "cr-neutral-probe" })).map((c) => c.value),
      };
    }
    return { distinct, reads };
  }, SITES.map((s) => ({ id: s.id })));
  const others = ["claude", "grok", "gemini"];
  const isolated =
    cookieProbe.distinct === 4 &&
    cookieProbe.reads.chatgpt.login.includes("keep-me") &&
    cookieProbe.reads.chatgpt.neutral.includes("space-chatgpt") &&
    others.every((id) => cookieProbe.reads[id].login.length === 0 && cookieProbe.reads[id].neutral.length === 0);
  check("each site has its own saved login", isolated, `${cookieProbe.distinct} separate stores`);

  // 4 + 5. Switching away and back never reloads the page, and it stays alive.
  await page.click("[data-space=chatgpt]");
  await page.waitForTimeout(400);
  const before = await app.evaluate(async () => {
    const wc = globalThis.__controlRoomTest.web.webContentsOf("chatgpt");
    const token = `alive-${Math.random().toString(36).slice(2)}`;
    await wc.executeJavaScript(`sessionStorage.setItem("cr-probe", ${JSON.stringify(token)})`);
    return { token, id: wc.id, url: wc.getURL() };
  });
  await page.click("[data-space=claude]");
  await page.waitForTimeout(900);
  const whileAway = await app.evaluate(() => {
    const wc = globalThis.__controlRoomTest.web.webContentsOf("chatgpt");
    const status = globalThis.__controlRoomTest.web.statuses().find((s) => s.id === "chatgpt");
    return { exists: !!wc, id: wc?.id, open: status?.open, loading: wc?.isLoading() };
  });
  check(
    "a site stays loaded while you're in another space",
    whileAway.exists && whileAway.id === before.id && whileAway.open === true && whileAway.loading === false,
    `view ${whileAway.id}`,
  );
  await page.click("[data-space=chatgpt]");
  await page.waitForTimeout(900);
  const after = await app.evaluate(async () => {
    const wc = globalThis.__controlRoomTest.web.webContentsOf("chatgpt");
    return {
      token: await wc.executeJavaScript('sessionStorage.getItem("cr-probe")'),
      id: wc.id,
      url: wc.getURL(),
    };
  });
  check(
    "switching spaces never reloads the page",
    after.token === before.token && after.id === before.id && after.url === before.url,
    `page state ${after.token === before.token ? "kept" : "lost"}`,
  );

  // 6. Theme changes leave the websites alone.
  await setTheme("tokyo-night");
  await page.waitForFunction(() => document.documentElement.dataset.theme === "tokyo-night", null, { timeout: 6000 });
  await page.waitForTimeout(800);
  const afterTheme = await app.evaluate(async () => {
    const wc = globalThis.__controlRoomTest.web.webContentsOf("chatgpt");
    return {
      token: await wc.executeJavaScript('sessionStorage.getItem("cr-probe")'),
      id: wc.id,
      url: wc.getURL(),
      cookies: (await wc.session.cookies.get({ name: "cr-login-probe" })).map((c) => c.value),
    };
  });
  check(
    "changing the theme doesn't reload or log out a site",
    afterTheme.token === before.token && afterTheme.id === before.id && afterTheme.url === before.url && afterTheme.cookies.includes("keep-me"),
    afterTheme.url,
  );
  await page.screenshot({ path: join(shots, "step2-3-tokyo-night.png") });

  // 8. The ⌘1–9 Spaces menu selects sites.
  const menuClicked = await clickMenu(app, "Claude");
  await page.waitForFunction(() => document.querySelector("main")?.textContent?.includes("Claude"), null, { timeout: 5000 }).catch(() => {});
  const claudeHeader = await page.evaluate(() => document.querySelector("main")?.textContent?.includes("Claude"));
  check("the Spaces menu (⌘1–9) selects a site", menuClicked && !!claudeHeader);

  await clickMenu(app, "Home");
  await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Control Room", null, { timeout: 5000 }).catch(() => {});
  const homeShown = await page.evaluate(() => document.querySelector("h1")?.textContent === "Control Room");
  const allAlive = await page.evaluate(() =>
    [...document.querySelectorAll("[data-testid=live-dot]")].map((e) => e.dataset.state),
  );
  check("Home leaves all sites running in the background", homeShown && allAlive.length === 4, `${allAlive.length} sites open`);
  await page.screenshot({ path: join(shots, "step2-4-home-with-sites-alive.png") });

  // 7. A saved login survives a full restart: flush, quit, relaunch, reopen.
  await app.evaluate(async () => {
    const wc = globalThis.__controlRoomTest.web.webContentsOf("chatgpt");
    await wc.session.cookies.flushStore();
  });
  await sleep(500);
  await app.close();
  await sleep(800);

  const app2 = await launch();
  try {
    page = await app2.firstWindow();
    await page.waitForSelector("[data-space=chatgpt]", { timeout: 20000 });
    await page.click("[data-space=chatgpt]");
    const viewBack = await waitForView(app2, "chatgpt");
    await page.waitForTimeout(1200);
    const persisted = await app2.evaluate(async () => {
      const wc = globalThis.__controlRoomTest?.web?.webContentsOf("chatgpt");
      if (!wc) return null;
      const login = (await wc.session.cookies.get({ name: "cr-login-probe" })).map((c) => c.value);
      const neutral = (await wc.session.cookies.get({ name: "cr-neutral-probe" })).map((c) => c.value);
      return { login, neutral, url: wc.getURL() };
    });
    check(
      "a saved login survives a full restart",
      viewBack && !!persisted && persisted.login.includes("keep-me") && persisted.neutral.includes("space-chatgpt"),
      persisted ? `${hostOf(persisted.url)} — ${persisted.login.length} cookie(s)` : "no view",
    );

    // Full-window picture, including the native site view and the macOS sidebar.
    await app2.evaluate(() => {
      const win = globalThis.__controlRoomTest?.win;
      win?.show();
      win?.focus();
    });
    await sleep(1200);
    try {
      const source = await app2.evaluate(() => globalThis.__controlRoomTest?.win?.getMediaSourceId?.() ?? "");
      const windowId = String(source).split(":")[1];
      if (windowId) {
        execFileSync("screencapture", ["-x", "-o", "-l", windowId, join(shots, "step2-5-full-window.png")]);
        console.log(`      full-window picture: step2-5-full-window.png`);
      }
    } catch (e) {
      console.log(`      (full-window picture needs macOS Screen Recording permission: ${e.message})`);
    }
  } finally {
    await app2.close();
  }
} catch (e) {
  check("run finished without crashing", false, e.message);
  try {
    await app.close();
  } catch {
    // already closed
  }
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed. Screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
