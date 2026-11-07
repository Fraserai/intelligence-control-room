/**
 * Swappability check: a module may depend on @control-room/contracts and
 * third-party packages, but never on another Control Room module.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const modulesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "modules");
let bad = 0;
for (const name of await readdir(modulesDir)) {
  const pkg = JSON.parse(await readFile(join(modulesDir, name, "package.json"), "utf8"));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies });
  const offenders = deps.filter((d) => d.startsWith("@control-room/") && d !== "@control-room/contracts");
  if (offenders.length) {
    bad++;
    console.log(`FAIL  ${pkg.name} depends on other modules: ${offenders.join(", ")}`);
  } else {
    console.log(`PASS  ${pkg.name} depends only on contracts`);
  }
}
process.exit(bad ? 1 : 0);
