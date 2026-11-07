/**
 * Web-space module (Electron).
 *
 * Every website (ChatGPT, Claude, Grok, Gemini, providers, sites) runs as the
 * company's own real website in its own WebContentsView:
 *  - its own saved login ("persist:space-<id>"), so logins survive restarts
 *    and sites never see each other's cookies
 *  - created once and kept alive, so switching spaces or changing the layout
 *    never reloads the page or logs you out
 *  - a normal Chrome user agent, so sites treat it like Chrome
 *    (idea from Ferdium, Apache-2.0: https://github.com/ferdium/ferdium-app)
 *  - no access to the app or your computer: sandboxed, no preload, no Node
 *
 * The app never reads, copies or proxies the logins (AGENTS.md Rule 1).
 */
import {
  BrowserWindow,
  Menu,
  WebContentsView,
  clipboard,
  session as electronSession,
  shell,
  type Session,
  type WebContents,
} from "electron";
import type {
  ControlRoomModule,
  Rect,
  Space,
  WebNavAction,
  WebSpaceHostApi,
  WebSpaceStatus,
} from "@control-room/contracts";

/** Sign-in pages that sites open as popups. They stay inside the app. */
const SIGN_IN_HOSTS = [
  "accounts.google.com",
  "appleid.apple.com",
  "login.microsoftonline.com",
  "login.live.com",
  "auth.openai.com",
  "x.com",
  "twitter.com",
  "github.com",
];

/** Permissions a site may use without asking the app (mic is for voice mode). */
const ALLOWED_PERMISSIONS = new Set(["clipboard-sanitized-write", "fullscreen", "media", "notifications"]);

/** A normal Chrome user agent with no "Electron" or app name in it. */
export function cleanUserAgent(chromeVersion: string = process.versions.chrome): string {
  const major = chromeVersion.split(".")[0];
  return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

function siteOf(host: string): string {
  return host.split(".").slice(-2).join(".");
}

function isSignInHost(host: string): boolean {
  return SIGN_IN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

interface Entry {
  space: Space;
  view: WebContentsView;
  status: WebSpaceStatus;
}

class ElectronWebHost implements WebSpaceHostApi {
  private win?: BrowserWindow;
  private entries = new Map<string, Entry>();
  private visibleId?: string;
  private background = "#00000000";
  private listeners = new Set<(s: WebSpaceStatus) => void>();
  private preparedSessions = new WeakSet<Session>();

  attach(nativeWindow: unknown): void {
    const win = nativeWindow as BrowserWindow;
    // macOS can close the window without quitting. Move any site views that
    // are still loaded over to the new window, so logins and pages survive.
    if (this.win !== win) {
      for (const [id, entry] of this.entries) {
        if (entry.view.webContents.isDestroyed()) {
          this.entries.delete(id);
          continue;
        }
        win.contentView.addChildView(entry.view);
        entry.view.setVisible(false);
      }
      this.visibleId = undefined;
    }
    this.win = win;
  }

  show(space: Space, bounds: Rect): void {
    if (!this.win || !space.url) return;
    const entry = this.entries.get(space.id) ?? this.create(space);
    if (this.visibleId && this.visibleId !== space.id) {
      this.entries.get(this.visibleId)?.view.setVisible(false);
    }
    entry.view.setBounds(roundRect(bounds));
    entry.view.setVisible(true);
    this.visibleId = space.id;
  }

  hide(): void {
    if (this.visibleId) this.entries.get(this.visibleId)?.view.setVisible(false);
    this.visibleId = undefined;
  }

  navigate(id: string, action: WebNavAction): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    const wc = entry.view.webContents;
    if (action === "back" && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    if (action === "forward" && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
    if (action === "reload") wc.reload();
    if (action === "home" && entry.space.url) void wc.loadURL(entry.space.url);
  }

  setBackground(color: string): void {
    this.background = color;
    for (const e of this.entries.values()) e.view.setBackgroundColor(color);
  }

  statuses(): WebSpaceStatus[] {
    return [...this.entries.values()].map((e) => e.status);
  }

  onStatus(callback: (s: WebSpaceStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /** For checks on the running app only. */
  webContentsOf(id: string): WebContents | undefined {
    return this.entries.get(id)?.view.webContents;
  }

  private prepareSession(ses: Session): void {
    if (this.preparedSessions.has(ses)) return;
    this.preparedSessions.add(ses);
    ses.setUserAgent(cleanUserAgent());
    ses.setPermissionRequestHandler((_wc, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)));
    ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));
  }

  private create(space: Space): Entry {
    const partition = `persist:space-${space.id}`;
    const ses = electronSession.fromPartition(partition);
    this.prepareSession(ses);

    const view = new WebContentsView({
      webPreferences: { partition, sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    view.setBorderRadius(10);
    view.setBackgroundColor(this.background);
    view.setVisible(false);
    this.win!.contentView.addChildView(view);

    const status: WebSpaceStatus = {
      id: space.id,
      url: space.url!,
      title: space.title,
      loading: true,
      canGoBack: false,
      canGoForward: false,
      open: true,
    };
    const entry: Entry = { space, view, status };
    this.entries.set(space.id, entry);
    this.wire(entry, ses);
    void view.webContents.loadURL(space.url!);
    this.emit(entry);
    return entry;
  }

  private wire(entry: Entry, ses: Session): void {
    const wc = entry.view.webContents;
    const homeSite = siteOf(new URL(entry.space.url!).hostname);
    const update = (patch: Partial<WebSpaceStatus>) => {
      Object.assign(entry.status, patch, {
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      });
      this.emit(entry);
    };

    wc.on("did-start-loading", () => update({ loading: true, error: undefined }));
    wc.on("did-stop-loading", () => update({ loading: false, url: wc.getURL() }));
    wc.on("did-fail-load", (_e, code, description, _url, isMainFrame) => {
      // -3 is ERR_ABORTED: a redirect or a deliberately stopped load, not a failure.
      if (isMainFrame && code !== -3) update({ loading: false, error: `${description} (${code})` });
    });
    wc.on("did-navigate", (_e, url) => update({ url }));
    wc.on("did-navigate-in-page", (_e, url) => update({ url }));
    wc.on("page-title-updated", (_e, title) => update({ title }));
    wc.on("page-favicon-updated", (_e, icons) => {
      void fetchFavicon(ses, icons).then((favicon) => favicon && update({ favicon }));
    });

    // Popups: sign-in windows and same-site pages stay inside the app (same
    // saved login); any other link opens in your normal browser.
    wc.setWindowOpenHandler(({ url }) => {
      let host: string;
      try {
        const u = new URL(url);
        if (u.protocol !== "https:" && u.protocol !== "http:") return { action: "deny" };
        host = u.hostname;
      } catch {
        return { action: "deny" };
      }
      if (isSignInHost(host) || siteOf(host) === homeSite) {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            width: 560,
            height: 760,
            parent: this.win,
            webPreferences: { partition: `persist:space-${entry.space.id}`, sandbox: true, contextIsolation: true },
          },
        };
      }
      void shell.openExternal(url);
      return { action: "deny" };
    });

    wc.on("context-menu", (_e, p) => {
      const items: Electron.MenuItemConstructorOptions[] = [];
      if (p.linkURL) {
        items.push(
          { label: "Open Link in Browser", click: () => void shell.openExternal(p.linkURL) },
          { label: "Copy Link", click: () => clipboard.writeText(p.linkURL) },
          { type: "separator" },
        );
      }
      if (p.isEditable) items.push({ role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" });
      else if (p.selectionText) items.push({ role: "copy" });
      if (items.length && items[items.length - 1].type !== "separator") items.push({ type: "separator" });
      items.push(
        { label: "Back", enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
        { label: "Reload", click: () => wc.reload() },
      );
      Menu.buildFromTemplate(items).popup();
    });
  }

  private emit(entry: Entry): void {
    for (const l of this.listeners) l({ ...entry.status });
  }
}

/** Download the site's favicon through its own session, as a small data: URL. */
async function fetchFavicon(ses: Session, icons: string[]): Promise<string | undefined> {
  for (const url of icons) {
    try {
      const res = await ses.fetch(url);
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "image/png";
      if (!type.startsWith("image/")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 256 * 1024) continue;
      return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
    } catch {
      // try the next icon
    }
  }
  return undefined;
}

function roundRect(r: Rect): Rect {
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
}

const webElectronModule: ControlRoomModule<WebSpaceHostApi & { webContentsOf(id: string): WebContents | undefined }> = {
  manifest: {
    id: "web-electron",
    kind: "web-space",
    name: "Websites in Electron views",
    version: "0.1.0",
  },
  async activate() {
    return new ElectronWebHost();
  },
};

export default webElectronModule;
