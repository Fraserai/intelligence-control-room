import { useEffect, useRef, useState } from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { Folder, RotateCw } from "lucide-react";
import type { Palette, Space, SpaceGroup, TerminalSession } from "@control-room/contracts";
import { SpaceIcon } from "./SpaceIcon";

/**
 * Terminal colours from the theme's palette, using Omarchy's mapping for
 * terminals (MIT, https://github.com/omacom/omarchy default/themed/alacritty.toml.tpl).
 */
export function terminalTheme(p: Palette): ITheme {
  return {
    background: p.background,
    foreground: p.foreground,
    cursor: p.bright_foreground,
    cursorAccent: p.background,
    selectionBackground: p.selection,
    black: p.background,
    red: p.red,
    green: p.green,
    yellow: p.yellow,
    blue: p.blue,
    magenta: p.magenta,
    cyan: p.cyan,
    white: p.foreground,
    brightBlack: p.muted,
    brightRed: p.bright_red,
    brightGreen: p.bright_green,
    brightYellow: p.bright_yellow,
    brightBlue: p.bright_blue,
    brightMagenta: p.bright_magenta,
    brightCyan: p.bright_cyan,
    brightWhite: p.bright_foreground,
  };
}

function shortPath(path: string): string {
  const home = path.match(/^\/Users\/[^/]+/)?.[0];
  return home ? path.replace(home, "~") : path;
}

/** A coding agent's official CLI, running in a real terminal owned by the main process. */
export function TerminalView(props: { group: SpaceGroup; space: Space; palette: Palette }) {
  const { group, space, palette } = props;
  const box = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | undefined>(undefined);
  const [session, setSession] = useState<TerminalSession>();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let disposed = false;
    const cleanups: (() => void)[] = [];
    // Measure the font only once it has loaded, or letters are drawn far apart.
    void document.fonts.load('13px "Geist Mono Variable"').finally(() => {
      if (!disposed) cleanups.push(mount(el));
    });
    return () => {
      disposed = true;
      for (const c of cleanups) c();
    };
    // The palette is applied by the effect below, so it isn't a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id]);

  function mount(el: HTMLDivElement): () => void {
    const term = new Terminal({
      fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      allowProposedApi: true,
      macOptionIsMeta: true,
      scrollback: 10000,
      theme: terminalTheme(palette),
    });
    termRef.current = term;
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon((_e, uri) => window.open(uri)));
    term.open(el);
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // falls back to the standard renderer
    }
    fit.fit();

    // Size and what's on screen, for checks on the running app.
    let marking = false;
    const mark = () => {
      if (marking) return;
      marking = true;
      requestAnimationFrame(() => {
        marking = false;
        const b = term.buffer.active;
        let chars = 0;
        for (let i = 0; i < term.rows; i++) chars += b.getLine(b.viewportY + i)?.translateToString(true).trim().length ?? 0;
        el.dataset.cols = String(term.cols);
        el.dataset.rows = String(term.rows);
        el.dataset.chars = String(chars);
      });
    };
    const writeSub = term.onWriteParsed(mark);

    let ready = false;
    const offData = window.controlRoom.term.onData((id, data) => {
      if (id === space.id && ready) term.write(data);
    });
    const offSession = window.controlRoom.term.onSession((s) => {
      if (s.id !== space.id) return;
      setSession(s);
      if (s.running && ready) {
        // A restart: start from a clean screen.
        term.reset();
        window.controlRoom.term.resize(space.id, term.cols, term.rows);
      }
    });
    const inputSub = term.onData((data) => window.controlRoom.term.input(space.id, data));
    const resizeSub = term.onResize(({ cols, rows }) => {
      window.controlRoom.term.resize(space.id, cols, rows);
      mark();
    });

    void window.controlRoom.term.attach(space.id).then((res) => {
      if (!res) return;
      setSession(res.session);
      if (res.backlog) term.write(res.backlog);
      ready = true;
      window.controlRoom.term.resize(space.id, term.cols, term.rows);
      term.focus();
    });

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // not visible yet
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      offData();
      offSession();
      inputSub.dispose();
      resizeSub.dispose();
      writeSub.dispose();
      term.dispose();
      termRef.current = undefined;
    };
  }

  // Live theme changes recolour the terminal without restarting the agent.
  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = terminalTheme(palette);
  }, [palette]);

  const btn =
    "no-drag flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-fg-dim transition-colors hover:bg-[color-mix(in_oklab,var(--cr-fg)_8%,transparent)] hover:text-fg-bright";
  const agent = session?.agent;
  const exited = session && agent?.installed && !session.running;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="drag flex h-12 shrink-0 items-center gap-2 px-4">
        <SpaceIcon group={group} space={space} size={18} />
        <span className="text-[13px] font-medium text-fg-bright">{space.title}</span>
        {agent?.version && <span className="font-mono text-[11px] text-fg-dim">{agent.version}</span>}
        <div className="ml-auto flex items-center gap-1">
          {session && (
            <button className={btn} onClick={() => void window.controlRoom.term.pickFolder(space.id)} data-testid="pick-folder">
              <Folder size={13} />
              <span className="max-w-[320px] truncate font-mono text-[11px]">{shortPath(session.cwd)}</span>
            </button>
          )}
          <button className={btn} onClick={() => void window.controlRoom.term.restart(space.id)} aria-label="Restart">
            <RotateCw size={13} />
          </button>
        </div>
      </header>

      <div className="relative mx-1.5 mb-1.5 min-h-0 flex-1 overflow-hidden rounded-[10px]" style={{ background: palette.background }}>
        <div ref={box} className="absolute inset-0 p-3" data-testid="terminal" />

        {agent && !agent.installed && (
          <Overlay>
            <p className="text-lg font-semibold text-fg-bright">{space.title} isn't installed</p>
            <p className="mt-2 text-[13px] text-fg-dim">Install its official CLI, then press Restart:</p>
            <code className="mt-3 block rounded-md px-3 py-2 font-mono text-[12px] text-fg-bright" style={{ background: "var(--cr-bg-lighter)" }}>
              {agent.installHint}
            </code>
          </Overlay>
        )}
        {exited && (
          <Overlay>
            <p className="text-lg font-semibold text-fg-bright">{space.title} has stopped</p>
            <p className="mt-1 text-[13px] text-fg-dim">Exit code {session.exitCode ?? "unknown"}</p>
            <button
              className="no-drag mt-4 rounded-lg px-4 py-2 text-[13px] font-medium text-white"
              style={{ background: "var(--cr-accent)" }}
              onClick={() => void window.controlRoom.term.restart(space.id)}
            >
              Start again
            </button>
          </Overlay>
        )}
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 grid place-items-center text-center backdrop-blur-sm"
      style={{ background: "color-mix(in oklab, var(--cr-bg) 75%, transparent)" }}
      data-testid="terminal-overlay"
    >
      <div>{children}</div>
    </div>
  );
}
