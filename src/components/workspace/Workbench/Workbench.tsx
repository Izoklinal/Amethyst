import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  clearStoredVaultPath,
  closeVault,
  onVaultChanged,
  openVault,
  pickVaultDirectory,
  readStoredVaultPath,
  vaultErrorMessage,
  writeStoredVaultPath,
  type VaultInfo,
} from "../../../api/vault";
import { applyTheme, readTheme, type Theme } from "../../../theme/theme";
import {
  createCommands,
  eventMatchesShortcut,
} from "../../../workspace/commands";
import { cycleTab } from "../../../workspace/editorGroup";
import {
  clampSidebarWidth,
  defaultLayout,
  readLayout,
  writeLayout,
  type LayoutState,
  type ToolId,
} from "../../../workspace/layoutState";
import { ActivityBar } from "../ActivityBar/ActivityBar";
import { BottomPanel } from "../BottomPanel/BottomPanel";
import { CommandPalette } from "../CommandPalette/CommandPalette";
import { ContextSidebar } from "../ContextSidebar/ContextSidebar";
import { EditorArea } from "../EditorArea/EditorArea";
import { EditorGroup } from "../EditorGroup/EditorGroup";
import { useOpenNotes } from "../EditorGroup/useOpenNotes";
import { useExplorerActions } from "../PrimarySidebar/explorerActions";
import { PrimarySidebar } from "../PrimarySidebar/PrimarySidebar";
import { StatusBar } from "../StatusBar/StatusBar";
import { Resizer } from "../../ui/Resizer/Resizer";
import styles from "./Workbench.module.css";

export function Workbench() {
  const [layout, setLayout] = useState<LayoutState>(() => readLayout());
  const [theme, setTheme] = useState<Theme>(() => readTheme());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const layoutRef = useRef(layout);
  const vaultRequest = useRef(0);
  layoutRef.current = layout;

  const openSelectedVault = useCallback(() => {
    setLayout((current) => ({
      ...current,
      activeTool: "explorer",
      primarySidebarVisible: true,
    }));
    void (async () => {
      let picked: string | null;
      try {
        picked = await pickVaultDirectory();
      } catch (error: unknown) {
        setVaultError(vaultErrorMessage(error));
        return;
      }
      if (!picked) {
        return;
      }
      const request = ++vaultRequest.current;
      try {
        const info = await openVault(picked);
        if (vaultRequest.current !== request) {
          return;
        }
        writeStoredVaultPath(info.path);
        setVault(info);
        setVaultError(null);
      } catch (error: unknown) {
        if (vaultRequest.current !== request) {
          return;
        }
        setVaultError(vaultErrorMessage(error));
      }
    })();
  }, []);

  const closeCurrentVault = useCallback(() => {
    void (async () => {
      const request = ++vaultRequest.current;
      try {
        await closeVault();
        if (vaultRequest.current !== request) {
          return;
        }
        clearStoredVaultPath();
        setVault(null);
        setVaultError(null);
      } catch (error: unknown) {
        if (vaultRequest.current !== request) {
          return;
        }
        setVaultError(vaultErrorMessage(error));
      }
    })();
  }, []);

  useEffect(() => {
    const stored = readStoredVaultPath();
    if (!stored) {
      return;
    }
    const request = ++vaultRequest.current;
    openVault(stored)
      .then((info) => {
        if (vaultRequest.current !== request) {
          return;
        }
        writeStoredVaultPath(info.path);
        setVault(info);
        setVaultError(null);
      })
      .catch((error: unknown) => {
        if (vaultRequest.current !== request) {
          return;
        }
        clearStoredVaultPath();
        setVaultError(vaultErrorMessage(error));
      });
  }, []);

  useEffect(() => {
    writeLayout(layout);
  }, [layout]);

  function resizeSidebar(delta: number) {
    const next = {
      ...layoutRef.current,
      primarySidebarWidth: clampSidebarWidth(
        layoutRef.current.primarySidebarWidth + delta,
      ),
    };
    layoutRef.current = next;
    setLayout(next);
  }

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    applyTheme(next);
    setTheme(next);
  }

  function selectTool(tool: ToolId) {
    setLayout((current) => {
      if (current.activeTool === tool) {
        return {
          ...current,
          primarySidebarVisible: !current.primarySidebarVisible,
        };
      }
      return { ...current, activeTool: tool, primarySidebarVisible: true };
    });
  }

  function focusEditor() {
    document.getElementById("editor-area")?.focus();
  }

  const refreshExplorer = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  const noteClosed = useRef<(path: string) => void>(() => undefined);
  const notes = useOpenNotes(vault?.path ?? null, refreshToken, (path) => {
    noteClosed.current(path);
  });
  const explorer = useExplorerActions(vault?.path ?? null, refreshExplorer);
  noteClosed.current = (path) => {
    if (explorer.selection?.path === path) {
      explorer.setSelection(null);
    }
  };

  const showExplorerAction = useCallback((action: () => void) => {
    setLayout((current) => ({
      ...current,
      activeTool: "explorer",
      primarySidebarVisible: true,
    }));
    action();
  }, []);

  const commands = useMemo(
    () =>
      createCommands({
        openPalette: () => setPaletteOpen(true),
        togglePrimarySidebar: () =>
          setLayout((current) => ({
            ...current,
            primarySidebarVisible: !current.primarySidebarVisible,
          })),
        toggleContextSidebar: () =>
          setLayout((current) => ({
            ...current,
            contextSidebarVisible: !current.contextSidebarVisible,
          })),
        toggleBottomPanel: () =>
          setLayout((current) => ({
            ...current,
            bottomPanelVisible: !current.bottomPanelVisible,
          })),
        toggleTheme,
        focusEditor,
        resetLayout: () => setLayout(defaultLayout()),
        nextTab: () => notes.setGroup((current) => cycleTab(current, 1)),
        previousTab: () => notes.setGroup((current) => cycleTab(current, -1)),
        closeTab: () => {
          if (notes.group.activeTabId) {
            notes.requestClose(notes.group.activeTabId);
          }
        },
        openVault: openSelectedVault,
        closeVault: closeCurrentVault,
        newNote: () => showExplorerAction(explorer.newNote),
        newFolder: () => showExplorerAction(explorer.newFolder),
        renameEntry: () => showExplorerAction(explorer.rename),
        moveEntry: () => showExplorerAction(explorer.move),
        deleteEntry: () => showExplorerAction(explorer.remove),
        saveNote: notes.saveActive,
      }),
    [
      theme,
      openSelectedVault,
      closeCurrentVault,
      showExplorerAction,
      explorer.newNote,
      explorer.newFolder,
      explorer.rename,
      explorer.move,
      explorer.remove,
      notes.setGroup,
      notes.requestClose,
      notes.saveActive,
      notes.group.activeTabId,
    ],
  );

  useEffect(() => {
    if (!vault) {
      return;
    }
    let disposed = false;
    let unlistenChange: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;

    void onVaultChanged(() => {
      refreshExplorer();
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
      } else {
        unlistenChange = unlisten;
      }
    });

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) {
          refreshExplorer();
        }
      })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
        } else {
          unlistenFocus = unlisten;
        }
      });

    return () => {
      disposed = true;
      unlistenChange?.();
      unlistenFocus?.();
    };
  }, [vault, refreshExplorer]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (paletteOpen) {
        return;
      }
      const target = event.target;
      const inFormField =
        target instanceof HTMLInputElement ||
        (target instanceof HTMLTextAreaElement && target.dataset.noteEditor !== "true");
      if (inFormField) {
        return;
      }
      for (const command of commands) {
        if (command.shortcut && eventMatchesShortcut(event, command.shortcut)) {
          event.preventDefault();
          command.run();
          return;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commands, paletteOpen]);

  const paletteCommands = commands.filter(
    (command) => command.id !== "palette.open",
  );

  return (
    <div className={styles.workbench}>
      <div className={styles.body}>
        <ActivityBar
          activeTool={layout.activeTool}
          theme={theme}
          onSelectTool={selectTool}
          onToggleTheme={toggleTheme}
        />
        {layout.primarySidebarVisible && (
          <>
            <PrimarySidebar
              tool={layout.activeTool}
              width={layout.primarySidebarWidth}
              vault={vault}
              vaultError={vaultError}
              refreshToken={refreshToken}
              explorer={explorer}
              onOpenVault={openSelectedVault}
              onOpenNote={notes.openMarkdown}
            />
            <Resizer
              label="Resize primary sidebar"
              onDrag={resizeSidebar}
              onDragEnd={() => writeLayout(layoutRef.current)}
            />
          </>
        )}
        <div className={styles.center}>
          <EditorArea>
            <EditorGroup
              group={notes.group}
              text={notes.activeBuffer ? notes.activeBuffer.text : null}
              dirtyTabIds={notes.dirtyTabIds}
              pendingTitle={notes.pendingTab?.title ?? null}
              onActivate={(tabId) =>
                notes.setGroup((current) =>
                  current.tabs.some((tab) => tab.id === tabId)
                    ? { ...current, activeTabId: tabId }
                    : current,
                )
              }
              onClose={notes.requestClose}
              onChange={(text) => {
                if (notes.group.activeTabId) {
                  notes.edit(notes.group.activeTabId, text);
                }
              }}
              onSaveClose={notes.confirmSave}
              onDiscardClose={notes.discard}
              onCancelClose={notes.cancelClose}
            />
          </EditorArea>
          {layout.bottomPanelVisible && <BottomPanel />}
        </div>
        {layout.contextSidebarVisible && <ContextSidebar />}
      </div>
      <StatusBar
        vaultName={vault?.name ?? null}
        vaultPath={vault?.path ?? null}
        noteStatus={notes.noteStatus}
      />
      {paletteOpen && (
        <CommandPalette
          commands={paletteCommands}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}
