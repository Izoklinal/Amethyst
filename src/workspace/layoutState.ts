export type ToolId = "explorer" | "search";

export type LayoutState = {
  activeTool: ToolId;
  primarySidebarVisible: boolean;
  contextSidebarVisible: boolean;
  bottomPanelVisible: boolean;
  primarySidebarWidth: number;
};

export const SIDEBAR_DEFAULT_WIDTH = 220;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 480;

const STORAGE_KEY = "amethyst-layout";

export function defaultLayout(): LayoutState {
  return {
    activeTool: "explorer",
    primarySidebarVisible: true,
    contextSidebarVisible: false,
    bottomPanelVisible: false,
    primarySidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  };
}

export function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

export function readLayout(): LayoutState {
  const fallback = defaultLayout();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return fallback;
    }
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    const value = parsed as Partial<LayoutState>;
    return {
      activeTool: value.activeTool === "search" ? "search" : "explorer",
      primarySidebarVisible: value.primarySidebarVisible !== false,
      contextSidebarVisible: value.contextSidebarVisible === true,
      bottomPanelVisible: value.bottomPanelVisible === true,
      primarySidebarWidth: clampSidebarWidth(
        typeof value.primarySidebarWidth === "number"
          ? value.primarySidebarWidth
          : SIDEBAR_DEFAULT_WIDTH,
      ),
    };
  } catch {
    return fallback;
  }
}

export function writeLayout(layout: LayoutState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}
