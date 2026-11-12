/**
 * Runs after `npm install` so a fresh install works first time:
 *  1. node-pty's macOS helper (spawn-helper) must be executable, or no
 *     terminal can start ("posix_spawnp failed"). Its published files don't
 *     always keep that permission, so we set it.
 *  2. Electron's binary is downloaded by its own install script; if that
 *     didn't run, run it now.
 */
import { chmod, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const prebuilds = join(root, "node_modules", "node-pty", "prebuilds");
if (existsSync(prebuilds)) {
  for (const platform of await readdir(prebuilds)) {
    const helper = join(prebuilds, platform, "spawn-helper");
    if (existsSync(helper)) {
      const mode = (await stat(helper)).mode;
      if ((mode & 0o111) === 0) {
        await chmod(helper, 0o755);
        console.log(`postinstall: made ${platform}/spawn-helper executable`);
      }
    }
  }
}

const electronDir = join(root, "node_modules", "electron");
if (existsSync(electronDir) && !existsSync(join(electronDir, "path.txt"))) {
  console.log("postinstall: downloading the Electron binary");
  execFileSync(process.execPath, [join(electronDir, "install.js")], { stdio: "inherit" });
}
