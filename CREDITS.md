# Credits

Control Room is its own codebase. Nothing here is a fork. This file lists every open-source project we borrowed code, data or ideas from, with its licence.

## Borrowed code, data or ideas

| Project | Licence | What we took | Where it's used |
|---|---|---|---|
| [Omarchy](https://github.com/omacom/omarchy), © David Heinemeier Hansson | MIT | The `colors.toml` theme format (one palette restyles everything). The theme palettes for Tokyo Night, Catppuccin and Rosé Pine, copied unchanged from `themes/<name>/colors.toml`. The idea of config as plain files in `~/.config/<app>/`. | `modules/theme-colors-toml`, `defaults/themes/` |
| [Tokyo Night](https://github.com/folke/tokyonight.nvim) (palette, via Omarchy) | Apache-2.0 | Colour palette | `defaults/themes/tokyo-night` |
| [Catppuccin](https://github.com/catppuccin/catppuccin) (palette, via Omarchy) | MIT | Colour palette | `defaults/themes/catppuccin` |
| [Rosé Pine](https://github.com/rose-pine/rose-pine-theme) (palette, via Omarchy) | MIT | Colour palette | `defaults/themes/rose-pine` |
| [Ferdium](https://github.com/ferdium/ferdium-app) | Apache-2.0 | The idea of giving every embedded website its own saved login and keeping it alive in the background, with a normal Chrome user agent so sites treat it like a browser. No code copied. | `modules/web-electron` |

## Libraries used

| Library | Licence |
|---|---|
| [Electron](https://github.com/electron/electron) | MIT |
| [electron-vite](https://github.com/alex8088/electron-vite) | MIT |
| [Vite](https://github.com/vitejs/vite), [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | MIT |
| [React](https://github.com/facebook/react) | MIT |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | MIT |
| [Lucide](https://github.com/lucide-icons/lucide) | ISC |
| [Motion](https://github.com/motiondivision/motion) (the sliding sidebar highlight, page fades, live dot and Home glow) | MIT |
| [Geist and Geist Mono fonts](https://github.com/vercel/geist-font) (via Fontsource) | SIL OFL 1.1 |
| [zod](https://github.com/colinhacks/zod) | MIT |
| [smol-toml](https://github.com/squirrelchat/smol-toml) | BSD-3-Clause |
| [chokidar](https://github.com/paulmillr/chokidar) | MIT |
| [Playwright](https://github.com/microsoft/playwright) (`playwright-core`, used for checks on the running app) | Apache-2.0 |
| [TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 |
