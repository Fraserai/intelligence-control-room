import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Our own workspace packages are TypeScript source, so they are bundled
// into the app instead of being loaded from node_modules at runtime.
const workspacePackages = ["@control-room/contracts", "@control-room/theme-colors-toml"];

export default defineConfig({
  main: {
    build: {
      externalizeDeps: { exclude: [...workspacePackages, "zod", "smol-toml"] },
    },
  },
  preload: {
    build: {
      externalizeDeps: { exclude: workspacePackages },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    build: {
      rollupOptions: { input: resolve(__dirname, "src/renderer/index.html") },
    },
    plugins: [react(), tailwindcss()],
  },
});
