# PLAN.md: Control Room ("Omarchy for AI", working name)

AGENTS.md is the only source of truth. Each line below is either from AGENTS.md, from Caesey's answers (2026-11-07), or a proposal for **how** to build it. No code until Caesey approves.

---

## 1. What we build

One beautiful, malleable, agentic desktop app. It's the single command centre for Caesey's AI world and daily work.

| From AGENTS.md | What the app does (proposal) |
|---|---|
| **LLMs:** ChatGPT, Claude, Grok, Gemini, "with all the features they already have" | Each one is its official website running inside the app, with its own saved login. Subscriptions are used only through these websites (Rule 1). |
| **LLMs:** HuggingChat | The open-source HuggingChat app (chat-ui) runs locally inside the app. It works only with an API key. It's set up ready, and Caesey adds the key later in Keys. |
| **Coding agents:** Claude Code, Codex, OpenCode | The official `claude`, `codex` and `opencode` CLIs, each running in a real terminal inside the app. |
| **Inference providers:** Fireworks, Baseten, Together to start | Each provider's own website opens inside the app with a saved login, and its API key is stored in Keys. More providers can be added later. |
| **Sites I use daily:** Artificial Analysis, Hugging Face | Each one opens inside the app with a saved login. More can be added later. |
| **System agent:** "the system itself is agentic and built for agents to use" | One agent built into the app, **separate from the coding agents**. It can change anything in the app: layout, look, what's in it, and the app's own source code. **Which model powers it: see Q1.** |
| **System:** sexy, fully malleable, fully customisable | All settings live in plain files, and the app updates live when they change. The system agent edits these files and the source code. |
| **System:** everything modular and swappable | Every LLM, coding agent, provider, site, memory, key store, theme, panel and the system agent is a self-contained module behind a clear interface (section 3). |
| **Memory:** shared memory and context with all my data and projects, from four years of daily AI work | `~/caesey-memory` is the memory. It's connected to Claude Code, Codex, OpenCode and the system agent through its existing MCP server. |
| **Access:** "my computer and everything on it, as well as the memory and context" | Agents work across the whole Mac, not just one folder. They ask before deleting anything (Rule 3). |
| **Keys:** one place for API keys | One Keys screen backed by the macOS Keychain. Keys are never stored in plain text, in the repo or in logs (Rule 2). |
| **Keys:** app connector option | A connector interface so a password-manager app can plug in later. 1Password is parked for now (Caesey, 2026-11-07). |
| **"They can work together"** | Parked for now (Caesey, 2026-11-07). |

---

## 2. Open-source gems (borrowed, not forked)

Each one goes in CREDITS.md with its licence.

| Project | Licence | Gem we take |
|---|---|---|
| **T3 Code** | MIT | Claude Code, Codex and OpenCode running side by side in one app, with terminals that keep running when the window reloads. |
| **Omarchy** | MIT | Opinionated, beautiful defaults. One theme file (`colors.toml`) restyles everything, and Omarchy's own themes work too. Config as plain files. A menu for everything. Agent skills that let the system's agent reshape the system itself. |
| **HuggingChat chat-ui** | Apache-2.0 | It *is* the HuggingChat LLM, run unchanged. |
| **OpenCode** | MIT | One of the three coding agents. |
| **Ferdium** | Apache-2.0 | A proven way to give each embedded website its own saved login. |
| **UI:** shadcn/ui + Base UI, Tailwind, cmdk, react-resizable-panels, xterm.js, node-pty, Lucide, Motion, Geist | MIT / ISC / OFL | Components, command menu, split views, terminals, icons, motion and fonts. |
| **Starter themes:** Catppuccin, Rosé Pine, Tokyo Night | MIT / Apache-2.0 | Themes to switch between. |

---

## 3. How it's built (proposal)

- **App:** Electron + TypeScript + React, macOS first. Each website runs in its own `WebContentsView` with its own saved login, so moving or splitting panels never logs anyone out.
- **Terminals:** `node-pty` + `xterm.js`.
- **Config:** `~/.config/control-room/` holds the layout, the theme, the lists of LLMs, agents, providers and sites, and which modules are used. The app hot-reloads when any file changes.
- **System agent and source code:** the app's source lives in this folder as a git repo. When the system agent changes it, the app rebuilds and reloads. Every change is a git commit, so any change can be undone. If a change breaks the app, it goes back to the last working version. Nothing is deleted without asking (Rule 3).
- **Modules:** each module is its own package and depends only on the shared interface, never on another module.

```ts
interface Module { id; kind; activate(ctx): Promise<Instance> }   // every module
interface WebSpace { id; title; url; loginStorage }               // LLM sites, providers, sites
interface CodingAgent { detect(); launch({ cwd, env }): Terminal } // Claude Code, Codex, OpenCode
interface SystemAgent { request(text): Changes }                  // the app's own agent
interface Memory { search(); read(); serveToAgents() }            // ~/caesey-memory
interface KeyStore { list(); get(); set(); remove() }             // Keychain now, other apps later
interface Theme { load(name): Palette }                           // colors.toml
interface Panel { id; render() }                                  // any screen in the app
```

- **Secrets:** a key is read only when it's needed, handed straight to the process that uses it, and never shown, saved to a file or logged.

---

## 4. Build order

There are no timelines. This is the order, and Caesey sets the pace.

1. **Setup:** the app shell, module system, config folder with live reload, default theme and sidebar.
2. **LLMs:** ChatGPT, Claude, Grok and Gemini inside the app. Caesey signs in himself, and the logins survive a restart.
3. **Coding agents:** install the free `claude`, `codex` and `opencode` CLIs (approved), then run them in terminals.
4. **Providers and sites:** Fireworks, Baseten, Together, Artificial Analysis and Hugging Face.
5. **Keys:** the Keys screen on the Keychain, plus the connector interface.
6. **Memory:** connect `~/caesey-memory` to the three coding agents.
7. **HuggingChat:** chat-ui set up to take the API key Caesey adds later.
8. **System agent:** changes anything in the app, including its source code.
9. **Polish:** keep going until it's sexy.

Each step is checked on the real running app before the next starts.

---

## 5. Things to know

- **Google sign-in (only matters for Gemini):** Google sometimes blocks sign-in inside apps like this one. If Gemini's sign-in page refuses, the fallback is a passkey, or opening Gemini in your normal browser. The app never copies logins out of another browser (Rule 1).
- **Claude:** Anthropic doesn't allow other apps to use a claude.ai subscription login, so Claude Code runs only as the official `claude` CLI and Claude chat runs only as the claude.ai website.

---

## 6. Answered (Caesey, 2026-11-07)

1. **System agent model:** any AI API key can power it, or a subscription Caesey already has. A subscription is used only through that company's official tool, such as the `claude` or `codex` CLI (Rule 1). So the system agent has swappable drivers: an API-key driver and an official-CLI driver.
2. **"Deep level" for providers, and memory in the LLM websites:** parked for now.
