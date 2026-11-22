import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import {
  clearStoredVaultPath,
  closeVault,
  onVaultChanged,
  openVault,
  pickVaultDirectory,
  readStoredVaultPath,
  noteBlockOffset,
  noteOutline,
  listVaultNotes,
  readVaultImage,
  readVaultNote,
  resolveVaultEmbed,
  resolveVaultWikilink,
  vaultAbsolutePath,
  vaultErrorMessage,
  writeStoredVaultPath,
  type NoteMatch,
  type VaultInfo,
} from "../../../api/vault";
import { applyTheme, readTheme, type Theme } from "../../../theme/theme";
import { createCommands, type Command } from "../../../workspace/commands";
import { readOpenCounts } from "../../../workspace/noteOpens";
import {
  defaultKeybindings,
  labelForCommand,
  matchKeybinding,
  shortcutFromEvent,
  type KeyContext,
  type Shortcut,
} from "../../../workspace/keybindings";
import {
  readHiddenToolbarButtons,
  toolbarButtons,
  writeHiddenToolbarButtons,
} from "../../../workspace/toolbarState";
import { activateTab, cycleTab } from "../../../workspace/editorGroup";
import {
  clampSidebarWidth,
  defaultLayout,
  readLayout,
  writeLayout,
  type LayoutState,
  type ToolId,
} from "../../../workspace/layoutState";
import type { NoteEditorHandle } from "../../../editor/NoteEditor";
import { embedLabel, headingSection } from "../../../editor/embed";
import { markdownLinkAt, type EmbedPaint } from "../../../editor/livePreview";
import { noteLinkPath } from "../../../editor/noteLink";
import { ContextMenu, type ContextMenuItem } from "../../ui/ContextMenu/ContextMenu";
import { ActivityBar } from "../ActivityBar/ActivityBar";
import { BottomPanel } from "../BottomPanel/BottomPanel";
import { QuickOpen } from "../QuickOpen/QuickOpen";
import { ContextSidebar } from "../ContextSidebar/ContextSidebar";
import { EditorArea } from "../EditorArea/EditorArea";
import { EditorGroup } from "../EditorGroup/EditorGroup";
import { useOpenNotes } from "../EditorGroup/useOpenNotes";
import { useExplorerActions } from "../PrimarySidebar/explorerActions";
import { PrimarySidebar } from "../PrimarySidebar/PrimarySidebar";
import type { ExplorerTreeHandle } from "../VaultTree/VaultTree";
import { StatusBar } from "../StatusBar/StatusBar";
import { Resizer } from "../../ui/Resizer/Resizer";
import styles from "./Workbench.module.css";

export function Workbench() {
  const [layout, setLayout] = useState<LayoutState>(() => readLayout());
  const [theme, setTheme] = useState<Theme>(() => readTheme());
  const [picker, setPicker] = useState<{ query: string; token: number } | null>(null);
  const [pickerNotes, setPickerNotes] = useState<NoteMatch[]>([]);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerReady, setPickerReady] = useState(false);
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [hiddenToolbar, setHiddenToolbar] = useState<string[]>(readHiddenToolbarButtons);
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(
    null,
  );
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [headingRequest, setHeadingRequest] = useState(0);
  const layoutRef = useRef(layout);
  const vaultRequest = useRef(0);
  const treeHandle = useRef<ExplorerTreeHandle | null>(null);
  const [readingTabs, setReadingTabs] = useState<ReadonlySet<string>>(() => new Set());
  const [sourceTabs, setSourceTabs] = useState<ReadonlySet<string>>(() => new Set());
  const readingFocusRef = useRef(false);
  const commandArgument = useRef<string | null>(null);
  const noteEditorRef = useRef<NoteEditorHandle>(null);
  const activeNoteRef = useRef<{ path: string; text: string } | null>(null);
  const pendingHeading = useRef<{
    path: string;
    heading: string | null;
    block: string | null;
  } | null>(null);
  const chordRef = useRef<{ keys: Shortcut[]; at: number } | null>(null);
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

  useEffect(() => {
    writeHiddenToolbarButtons(hiddenToolbar);
  }, [hiddenToolbar]);

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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (readingFocusRef.current) {
          document.getElementById("note-reading")?.focus();
          return;
        }
        if (noteEditorRef.current) {
          noteEditorRef.current.focus();
          return;
        }
        document.getElementById("editor-area")?.focus();
      });
    });
  }

  function focusExplorer() {
    setLayout((current) => ({
      ...current,
      activeTool: "explorer",
      primarySidebarVisible: true,
    }));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (treeHandle.current) {
          treeHandle.current.focus();
          return;
        }
        document.getElementById("explorer-sidebar")?.focus();
      });
    });
  }

  const refreshExplorer = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  const noteClosed = useRef<(path: string) => void>(() => undefined);
  const notes = useOpenNotes(
    vault?.path ?? null,
    refreshToken,
    (path) => {
      noteClosed.current(path);
    },
    () => focusEditor(),
  );
  const explorer = useExplorerActions(vault?.path ?? null, refreshExplorer);
  readingFocusRef.current = notes.group.activeTabId
    ? readingTabs.has(notes.group.activeTabId)
    : false;
  activeNoteRef.current = notes.activeBuffer
    ? { path: notes.activeBuffer.path, text: notes.activeBuffer.text }
    : null;
  const loadEmbed = useCallback(async (body: string): Promise<EmbedPaint> => {
    const fallback = embedLabel(body) ?? body;
    const source = activeNoteRef.current?.path;
    if (!source) {
      return { kind: "missing", text: "", src: "", name: fallback };
    }
    try {
      const resolved = await resolveVaultEmbed(source, body);
      const name = resolved.path.split("/").pop() ?? resolved.path;
      if (resolved.kind === "note") {
        const own = activeNoteRef.current;
        const text =
          own && own.path.replace(/\\/g, "/") === resolved.path
            ? own.text
            : await readVaultNote(resolved.path);
        if (!resolved.heading) {
          return { kind: "note", text, src: "", name };
        }
        const headings = await noteOutline(text);
        return {
          kind: "note",
          text: headingSection(text, headings, resolved.heading) ?? "No heading matches that link.",
          src: "",
          name,
        };
      }
      if (resolved.kind === "image") {
        try {
          const image = await readVaultImage(resolved.path);
          return {
            kind: "image",
            text: "",
            src: `data:${image.mediaType};base64,${image.base64}`,
            name,
          };
        } catch {
          return { kind: "file", text: "", src: "", name };
        }
      }
      return { kind: "file", text: "", src: "", name };
    } catch {
      return { kind: "missing", text: "", src: "", name: fallback };
    }
  }, []);
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

  function openAddress(url: string) {
    if (!url) {
      return;
    }
    if (/^(https?:|mailto:)/i.test(url)) {
      void openUrl(url).catch((error: unknown) => {
        setLinkStatus(vaultErrorMessage(error));
      });
      return;
    }
    const source = activeNoteRef.current?.path;
    const path = source ? noteLinkPath(source, url) : null;
    if (!path) {
      setLinkStatus("This link can't be opened.");
      return;
    }
    const name = path.split("/").pop() ?? path;
    notes.openMarkdown({ path, name, kind: "file" });
    setLinkStatus(null);
  }

  const commands = useMemo(
    () =>
      createCommands({
        openPalette: () => setPicker((current) => ({ query: ">", token: (current?.token ?? 0) + 1 })),
        findNote: () => setPicker((current) => ({ query: "", token: (current?.token ?? 0) + 1 })),
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
        focusExplorer,
        resetLayout: () => setLayout(defaultLayout()),
        nextTab: () => {
          let changed = false;
          notes.setGroup((current) => {
            const next = cycleTab(current, 1);
            changed = next.activeTabId !== current.activeTabId;
            return next;
          });
          if (changed) {
            focusEditor();
          }
        },
        previousTab: () => {
          let changed = false;
          notes.setGroup((current) => {
            const next = cycleTab(current, -1);
            changed = next.activeTabId !== current.activeTabId;
            return next;
          });
          if (changed) {
            focusEditor();
          }
        },
        activateTab: () => {
          const tabId = commandArgument.current;
          if (!tabId) {
            return;
          }
          notes.setGroup((current) => activateTab(current, tabId));
          focusEditor();
        },
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
        toggleTask: () => {
          const editor = noteEditorRef.current;
          const at = Number(commandArgument.current);
          if (!editor || !Number.isInteger(at)) {
            return;
          }
          const marker = editor.text().slice(at, at + 3);
          if (marker === "[ ]") {
            editor.replace(at, at + 3, "[x]");
          } else if (marker === "[x]" || marker === "[X]") {
            editor.replace(at, at + 3, "[ ]");
          }
        },
        toggleReading: () => {
          const tabId = notes.group.activeTabId;
          if (!tabId) {
            return;
          }
          setReadingTabs((current) => {
            const next = new Set(current);
            if (next.has(tabId)) {
              next.delete(tabId);
            } else {
              next.add(tabId);
            }
            return next;
          });
          setSourceTabs((current) => {
            if (!current.has(tabId)) {
              return current;
            }
            const next = new Set(current);
            next.delete(tabId);
            return next;
          });
          focusEditor();
        },
        toggleSource: () => {
          const tabId = notes.group.activeTabId;
          if (!tabId) {
            return;
          }
          setSourceTabs((current) => {
            const next = new Set(current);
            if (next.has(tabId)) {
              next.delete(tabId);
            } else {
              next.add(tabId);
            }
            return next;
          });
          setReadingTabs((current) => {
            if (!current.has(tabId)) {
              return current;
            }
            const next = new Set(current);
            next.delete(tabId);
            return next;
          });
          focusEditor();
        },
        toggleCallout: () => {
          const editor = noteEditorRef.current;
          const at = Number(commandArgument.current);
          if (!editor || !Number.isInteger(at)) {
            return;
          }
          const text = editor.text();
          if (text[at] !== "]") {
            return;
          }
          const next = text[at + 1];
          if (next === "-") {
            editor.edit(at + 1, at + 2, "+");
          } else if (next === "+") {
            editor.edit(at + 1, at + 2, "-");
          } else {
            editor.edit(at + 1, at + 1, "-");
          }
        },
        openEmbed: () => {
          const body = commandArgument.current?.trim() ?? "";
          const source = activeNoteRef.current?.path;
          if (!body || !source) {
            return;
          }
          void resolveVaultEmbed(source, body)
            .then(async (resolved) => {
              if (resolved.kind === "note") {
                if (resolved.heading) {
                  pendingHeading.current = {
                    path: resolved.path,
                    heading: resolved.heading,
                    block: null,
                  };
                  setHeadingRequest((current) => current + 1);
                } else {
                  pendingHeading.current = null;
                }
                if (resolved.path !== source.replace(/\\/g, "/")) {
                  const name = resolved.path.split("/").pop() ?? resolved.path;
                  notes.openMarkdown({ path: resolved.path, name, kind: "file" });
                }
                setLinkStatus(null);
                return;
              }
              const path = await vaultAbsolutePath(resolved.path);
              await openPath(path);
              setLinkStatus(null);
            })
            .catch((error: unknown) => {
              setLinkStatus(vaultErrorMessage(error));
            });
        },
        openLink: () => {
          openAddress(commandArgument.current?.trim() ?? "");
        },
        followLink: () => {
          const current = activeNoteRef.current;
          const editor = noteEditorRef.current;
          if (!current || !editor) {
            setLinkStatus("Open a note before following a link.");
            return;
          }
          const source = current.path;
          const text = current.text;
          const head = editor.selection().head;
          void resolveVaultWikilink(source, text, head)
            .then((resolved) => {
              if (resolved.heading || resolved.block) {
                pendingHeading.current = {
                  path: resolved.path,
                  heading: resolved.heading,
                  block: resolved.block,
                };
                setHeadingRequest((current) => current + 1);
              } else {
                pendingHeading.current = null;
              }
              if (resolved.path !== source) {
                const name = resolved.path.split("/").pop() ?? resolved.path;
                notes.openMarkdown({ path: resolved.path, name, kind: "file" });
              }
              setLinkStatus(null);
            })
            .catch((error: unknown) => {
              const message = vaultErrorMessage(error);
              if (message === "No link at the cursor.") {
                const found = markdownLinkAt(text, head);
                if (found) {
                  openAddress(found.url);
                  return;
                }
              }
              setLinkStatus(message);
            });
        },
        revealHeading: () => {
          const editor = noteEditorRef.current;
          const offset = Number(commandArgument.current);
          if (!editor || !Number.isInteger(offset) || offset < 0) {
            return;
          }
          editor.select(offset);
        },
        openEntry: () => {
          const current = explorer.getSelection();
          if (current?.kind === "file") {
            notes.openMarkdown(current);
          }
        },
        nextExplorer: () => treeHandle.current?.next(),
        previousExplorer: () => treeHandle.current?.previous(),
        expandExplorer: () => treeHandle.current?.expand(),
        collapseExplorer: () => treeHandle.current?.collapse(),
        activateExplorer: () => treeHandle.current?.activate(),
        cutNote: () => {
          const editor = noteEditorRef.current;
          if (!editor || !notes.group.activeTabId) {
            return;
          }
          const { from, to } = editor.selection();
          void navigator.clipboard.writeText(editor.text().slice(from, to));
          editor.replace(from, to, "");
        },
        copyNote: () => {
          const editor = noteEditorRef.current;
          if (!editor) {
            return;
          }
          const { from, to } = editor.selection();
          void navigator.clipboard.writeText(editor.text().slice(from, to));
        },
        pasteNote: () => {
          const editor = noteEditorRef.current;
          if (!editor || !notes.group.activeTabId) {
            return;
          }
          const { from, to } = editor.selection();
          void navigator.clipboard
            .readText()
            .then((text) => {
              editor.replace(from, to, text);
            })
            .catch(() => undefined);
        },
        selectAllNote: () => {
          const editor = noteEditorRef.current;
          if (!editor) {
            return;
          }
          editor.select(0, editor.text().length);
        },
        hideToolbarButton: () => {
          const id = commandArgument.current;
          if (!id || !toolbarButtons.some((button) => button.commandId === id)) {
            return;
          }
          setHiddenToolbar((current) => (current.includes(id) ? current : [...current, id]));
        },
        showToolbarButton: () => {
          const id = commandArgument.current;
          if (!id) {
            return;
          }
          setHiddenToolbar((current) => current.filter((item) => item !== id));
        },
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
      explorer.getSelection,
      notes.setGroup,
      notes.requestClose,
      notes.saveActive,
      notes.openMarkdown,
      notes.edit,
      notes.activeBuffer?.path,
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

  const noteText = notes.activeBuffer?.text ?? null;
  const activeNotePath = notes.activeBuffer?.path ?? null;
  useEffect(() => {
    setLinkStatus(null);
  }, [noteText, activeNotePath]);

  useEffect(() => {
    const pending = pendingHeading.current;
    const buffer = notes.activeBuffer;
    if (!pending || !buffer || buffer.path !== pending.path) {
      return;
    }
    const heading = pending.heading;
    const block = pending.block;
    pendingHeading.current = null;
    if (block) {
      void noteBlockOffset(buffer.text, block).then((offset) => {
        if (offset == null) {
          setLinkStatus("No block matches that link.");
          return;
        }
        commandArgument.current = String(offset);
        commands.find((command) => command.id === "note.revealHeading")?.run();
        commandArgument.current = null;
      });
      return;
    }
    if (!heading) {
      return;
    }
    void noteOutline(buffer.text).then((items) => {
      const found = items.find((item) => item.text === heading);
      if (!found) {
        setLinkStatus("No heading matches that link.");
        return;
      }
      commandArgument.current = String(found.offset);
      commands.find((command) => command.id === "note.revealHeading")?.run();
      commandArgument.current = null;
    });
  }, [headingRequest, notes.activeBuffer, commands]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (picker) {
        return;
      }
      const target = event.target;
      const inReading = target instanceof Element && target.closest("#note-reading");
      const inFormField =
        target instanceof HTMLInputElement ||
        (target instanceof HTMLTextAreaElement && target.dataset.noteEditor !== "true");
      if (inFormField && !inReading) {
        return;
      }
      const shortcut = shortcutFromEvent(event);
      if (!shortcut) {
        return;
      }
      const now = Date.now();
      const pending = chordRef.current;
      const match = matchKeybinding(
        defaultKeybindings,
        keyContext(target),
        pending?.keys ?? [],
        pending?.at ?? null,
        now,
        shortcut,
      );
      if (match.type === "prefix") {
        event.preventDefault();
        event.stopPropagation();
        chordRef.current = { keys: match.keys, at: now };
        return;
      }
      chordRef.current = null;
      if (match.type === "none") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      commands.find((command) => command.id === match.commandId)?.run();
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [commands, picker]);

  useEffect(() => {
    if (!picker) {
      return;
    }
    if (!vault) {
      setPickerNotes([]);
      setPickerError("No vault is open");
      setPickerReady(true);
      return;
    }
    let cancelled = false;
    void listVaultNotes()
      .then((found) => {
        if (!cancelled) {
          setPickerNotes(found);
          setPickerError(null);
          setPickerReady(true);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setPickerNotes([]);
          setPickerError(vaultErrorMessage(cause));
          setPickerReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [picker?.token, refreshToken, vault]);

  const openMenu = useCallback((x: number, y: number, items: ContextMenuItem[]) => {
    if (items.length === 0) {
      return;
    }
    setMenu({ x, y, items });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  function runMenuItem(index: number) {
    const item = menu?.items[index];
    setMenu(null);
    if (!item) {
      return;
    }
    const command = commands.find((entry) => entry.id === item.commandId);
    if (!command) {
      return;
    }
    commandArgument.current = item.argument ?? null;
    command.run();
    commandArgument.current = null;
  }

  return (
    <div
      className={styles.workbench}
      onContextMenu={(event) => event.preventDefault()}
    >
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
              hiddenToolbarButtons={hiddenToolbar}
              treeHandle={treeHandle}
              onOpenVault={openSelectedVault}
              onOpenNote={notes.openMarkdown}
              onOpenMenu={openMenu}
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
              onActivate={(tabId) => {
                commandArgument.current = tabId;
                commands.find((command) => command.id === "tab.activate")?.run();
                commandArgument.current = null;
              }}
              onClose={notes.requestClose}
              onChange={(text) => {
                if (notes.group.activeTabId) {
                  notes.edit(notes.group.activeTabId, text);
                }
              }}
              onSaveClose={notes.confirmSave}
              onDiscardClose={notes.discard}
              onCancelClose={notes.cancelClose}
              editorRef={noteEditorRef}
              onFollowLink={() => {
                commands.find((command) => command.id === "note.followLink")?.run();
              }}
              onToggleTask={(offset) => {
                commandArgument.current = String(offset);
                commands.find((command) => command.id === "note.toggleTask")?.run();
                commandArgument.current = null;
              }}
              onOpenLink={(url) => {
                commandArgument.current = url;
                commands.find((command) => command.id === "note.openLink")?.run();
                commandArgument.current = null;
              }}
              onOpenEmbed={(body) => {
                commandArgument.current = body;
                commands.find((command) => command.id === "note.openEmbed")?.run();
                commandArgument.current = null;
              }}
              onToggleCallout={(offset) => {
                commandArgument.current = String(offset);
                commands.find((command) => command.id === "note.toggleCallout")?.run();
                commandArgument.current = null;
              }}
              loadEmbed={loadEmbed}
              reading={notes.group.activeTabId ? readingTabs.has(notes.group.activeTabId) : false}
              source={notes.group.activeTabId ? sourceTabs.has(notes.group.activeTabId) : false}
              onFollowWikilink={(offset) => {
                noteEditorRef.current?.select(offset);
                commands.find((command) => command.id === "note.followLink")?.run();
              }}
              onOpenMenu={(x, y) =>
                openMenu(x, y, [
                  { commandId: "note.cut" },
                  { commandId: "note.copy" },
                  { commandId: "note.paste" },
                  { commandId: "note.selectAll" },
                  { commandId: "note.followLink" },
                ])
              }
            />
          </EditorArea>
          {layout.bottomPanelVisible && <BottomPanel />}
        </div>
        {layout.contextSidebarVisible && (
          <ContextSidebar
            noteText={notes.activeBuffer ? notes.activeBuffer.text : null}
            targetPath={notes.activeBuffer?.path ?? null}
            refreshToken={refreshToken}
            openNotes={notes.openNoteTexts}
            onOpen={notes.openMarkdown}
            onRevealHeading={(offset) => {
              commandArgument.current = String(offset);
              commands.find((command) => command.id === "note.revealHeading")?.run();
              commandArgument.current = null;
            }}
          />
        )}
      </div>
      <StatusBar
        vaultName={vault?.name ?? null}
        vaultPath={vault?.path ?? null}
        noteStatus={notes.noteStatus}
        linkStatus={linkStatus}
      />
      {picker && (
        <QuickOpen
          queryToken={picker.token}
          initialQuery={picker.query}
          notes={pickerNotes}
          notesReady={pickerReady}
          noteError={pickerError}
          counts={vault ? readOpenCounts(vault.path) : {}}
          commands={commands}
          onClose={() => setPicker(null)}
          onOpenNote={(note) => {
            setPicker(null);
            notes.openMarkdown({ path: note.path, name: note.name, kind: "file" });
          }}
          onRunCommand={(commandId) => {
            const command = commands.find((entry) => entry.id === commandId);
            if (!command) {
              return;
            }
            if (commandId !== "note.find" && commandId !== "palette.open") {
              setPicker(null);
            }
            command.run();
          }}
        />
      )}
      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          entries={menu.items.map((item) => ({
            label: item.label ?? commandTitle(commands, item.commandId),
            shortcut: labelForCommand(item.commandId),
          }))}
          onSelect={runMenuItem}
          onClose={closeMenu}
        />
      ) : null}
    </div>
  );
}

function commandTitle(commands: Command[], commandId: string): string {
  return commands.find((command) => command.id === commandId)?.title ?? commandId;
}

function keyContext(target: EventTarget | null): KeyContext {
  if (!(target instanceof Element)) {
    return "global";
  }
  if (target.closest("[data-key-context='explorer']")) {
    return "explorer";
  }
  if (target.closest("[data-key-context='editor']")) {
    return "editor";
  }
  return "global";
}
