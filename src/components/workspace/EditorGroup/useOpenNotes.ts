import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  readVaultNote,
  vaultErrorMessage,
  writeVaultNote,
} from "../../../api/vault";
import {
  activateTab,
  closeTab,
  createInitialGroup,
  openNoteTab,
  type EditorGroup,
} from "../../../workspace/editorGroup";
import { recordNoteOpen } from "../../../workspace/noteOpens";
import type { SelectedEntry } from "../PrimarySidebar/explorerActions";

type NoteBuffer = {
  path: string;
  text: string;
  savedText: string;
  error: string | null;
};

function isMarkdown(name: string): boolean {
  return name.toLowerCase().endsWith(".md");
}

const AUTOSAVE_DELAY_MS = 1000;

export function useOpenNotes(
  vaultPath: string | null,
  refreshToken: number,
  onNoteClosed?: (path: string) => void,
  onNoteOpened?: () => void,
) {
  const [group, setGroup] = useState<EditorGroup>(() => createInitialGroup());
  const [buffers, setBuffers] = useState<Record<string, NoteBuffer>>({});
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const groupRef = useRef(group);
  const buffersRef = useRef(buffers);
  const onNoteClosedRef = useRef(onNoteClosed);
  const onNoteOpenedRef = useRef(onNoteOpened);
  const saveTimers = useRef<Record<string, number>>({});
  const saveChains = useRef<Record<string, Promise<void>>>({});
  const saveBlocked = useRef<Set<string>>(new Set());
  onNoteOpenedRef.current = onNoteOpened;
  groupRef.current = group;
  buffersRef.current = buffers;
  onNoteClosedRef.current = onNoteClosed;

  useEffect(() => {
    setGroup(createInitialGroup());
    setBuffers({});
    setPendingCloseId(null);
    setOpenError(null);
    saveBlocked.current.clear();
    for (const timer of Object.values(saveTimers.current)) {
      window.clearTimeout(timer);
    }
    saveTimers.current = {};
  }, [vaultPath]);

  useEffect(() => {
    if (!vaultPath) {
      return;
    }
    let cancelled = false;
    for (const tab of groupRef.current.tabs) {
      const buffer = buffersRef.current[tab.id];
      if (!buffer || buffer.text !== buffer.savedText) {
        continue;
      }
      void readVaultNote(buffer.path)
        .then((text) => {
          if (cancelled) {
            return;
          }
          setBuffers((current) => {
            const latest = current[tab.id];
            if (!latest || latest.text !== latest.savedText || latest.savedText === text) {
              return current;
            }
            return {
              ...current,
              [tab.id]: { ...latest, text, savedText: text, error: null },
            };
          });
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [refreshToken, vaultPath]);

  const openMarkdown = useCallback((entry: SelectedEntry) => {
    if (entry.kind !== "file" || !isMarkdown(entry.name)) {
      return;
    }
    const existing = groupRef.current.tabs.find((tab) => tab.path === entry.path);
    if (existing) {
      if (vaultPath) {
        recordNoteOpen(vaultPath, entry.path);
      }
      setGroup((current) => activateTab(current, existing.id));
      setOpenError(null);
      onNoteOpenedRef.current?.();
      return;
    }
    const id = crypto.randomUUID();
    void readVaultNote(entry.path)
      .then((text) => {
        if (vaultPath) {
          recordNoteOpen(vaultPath, entry.path);
        }
        setOpenError(null);
        setGroup((current) => openNoteTab(current, entry.path, entry.name, id));
        setBuffers((current) => {
          if (current[id]) {
            return current;
          }
          return {
            ...current,
            [id]: { path: entry.path, text, savedText: text, error: null },
          };
        });
        onNoteOpenedRef.current?.();
      })
      .catch((cause: unknown) => {
        setOpenError(vaultErrorMessage(cause));
      });
  }, [vaultPath]);

  const edit = useCallback((tabId: string, text: string) => {
    const buffer = buffersRef.current[tabId];
    if (!buffer) {
      return;
    }
    const next = {
      ...buffersRef.current,
      [tabId]: { ...buffer, text, error: null },
    };
    buffersRef.current = next;
    setBuffers(next);
    saveBlocked.current.delete(tabId);
    window.clearTimeout(saveTimers.current[tabId]);
    saveTimers.current[tabId] = window.setTimeout(() => {
      delete saveTimers.current[tabId];
      void enqueueSave(tabId);
    }, AUTOSAVE_DELAY_MS);
  }, []);

  const save = useCallback((tabId: string): Promise<boolean> => {
    const buffer = buffersRef.current[tabId];
    if (!buffer) {
      return Promise.resolve(false);
    }
    if (buffer.text === buffer.savedText) {
      return Promise.resolve(true);
    }
    const written = buffer.text;
    return writeVaultNote(buffer.path, buffer.savedText, written)
      .then(() => {
        const latest = buffersRef.current[tabId];
        if (latest) {
          buffersRef.current = {
            ...buffersRef.current,
            [tabId]: { ...latest, savedText: written, error: null },
          };
        }
        setBuffers((current) => {
          const latestBuffer = current[tabId];
          if (!latestBuffer) {
            return current;
          }
          return {
            ...current,
            [tabId]: { ...latestBuffer, savedText: written, error: null },
          };
        });
        return true;
      })
      .catch((cause: unknown) => {
        const message = vaultErrorMessage(cause);
        const latest = buffersRef.current[tabId];
        if (latest) {
          buffersRef.current = {
            ...buffersRef.current,
            [tabId]: { ...latest, error: message },
          };
        }
        setBuffers((current) => {
          const latestBuffer = current[tabId];
          if (!latestBuffer) {
            return current;
          }
          return {
            ...current,
            [tabId]: { ...latestBuffer, error: message },
          };
        });
        return false;
      });
  }, []);

  const enqueueSave = useCallback((tabId: string): Promise<boolean> => {
    const previous = saveChains.current[tabId] ?? Promise.resolve();
    let saved = false;
    const run = previous.catch(() => undefined).then(async () => {
      if (saveBlocked.current.has(tabId)) {
        return;
      }
      saved = true;
      for (;;) {
        const buffer = buffersRef.current[tabId];
        if (!buffer || buffer.text === buffer.savedText) {
          return;
        }
        const ok = await save(tabId);
        if (!ok) {
          saveBlocked.current.add(tabId);
          saved = false;
          return;
        }
      }
    });
    saveChains.current[tabId] = run.then(() => undefined);
    return run.then(() => saved);
  }, [save]);

  const closeNow = useCallback((tabId: string) => {
    const path =
      buffersRef.current[tabId]?.path ??
      groupRef.current.tabs.find((tab) => tab.id === tabId)?.path;
    window.clearTimeout(saveTimers.current[tabId]);
    delete saveTimers.current[tabId];
    setGroup((current) => closeTab(current, tabId));
    const nextBuffers = { ...buffersRef.current };
    delete nextBuffers[tabId];
    buffersRef.current = nextBuffers;
    setBuffers(nextBuffers);
    setPendingCloseId((current) => (current === tabId ? null : current));
    if (path) {
      onNoteClosedRef.current?.(path);
    }
  }, []);

  const requestClose = useCallback(
    (tabId: string) => {
      window.clearTimeout(saveTimers.current[tabId]);
      delete saveTimers.current[tabId];
      void enqueueSave(tabId).then((saved) => {
        const buffer = buffersRef.current[tabId];
        if (saved && (!buffer || buffer.text === buffer.savedText)) {
          closeNow(tabId);
          return;
        }
        if (buffer && buffer.text !== buffer.savedText) {
          setGroup((current) => activateTab(current, tabId));
          setPendingCloseId(tabId);
          return;
        }
        closeNow(tabId);
      });
    },
    [closeNow, enqueueSave],
  );

  const confirmSave = useCallback(() => {
    if (!pendingCloseId) {
      return;
    }
    const tabId = pendingCloseId;
    saveBlocked.current.delete(tabId);
    void enqueueSave(tabId).then((saved) => {
      if (saved) {
        closeNow(tabId);
      }
    });
  }, [closeNow, enqueueSave, pendingCloseId]);

  const discard = useCallback(() => {
    if (pendingCloseId) {
      closeNow(pendingCloseId);
    }
  }, [closeNow, pendingCloseId]);

  const cancelClose = useCallback(() => {
    setPendingCloseId(null);
  }, []);

  const saveActive = useCallback(() => {
    const activeId = groupRef.current.activeTabId;
    if (!activeId) {
      return;
    }
    window.clearTimeout(saveTimers.current[activeId]);
    delete saveTimers.current[activeId];
    saveBlocked.current.delete(activeId);
    void enqueueSave(activeId);
  }, [enqueueSave]);

  const openNoteTexts = useMemo(
    () =>
      group.tabs.flatMap((tab) => {
        const buffer = buffers[tab.id];
        return buffer ? [{ path: buffer.path, text: buffer.text }] : [];
      }),
    [buffers, group.tabs],
  );

  const active = group.tabs.find((tab) => tab.id === group.activeTabId) ?? null;
  const activeBuffer = active ? buffers[active.id] : undefined;
  const pendingTab = group.tabs.find((tab) => tab.id === pendingCloseId) ?? null;
  let noteStatus = "No note";
  if (activeBuffer?.error) {
    noteStatus = activeBuffer.error;
  } else if (activeBuffer) {
    noteStatus = "Saved";
  } else if (openError) {
    noteStatus = openError;
  }

  const dirtyTabIds = new Set(
    group.tabs
      .filter((tab) => {
        const buffer = buffers[tab.id];
        return buffer?.error != null && buffer.text !== buffer.savedText;
      })
      .map((tab) => tab.id),
  );

  return {
    group,
    setGroup,
    activeBuffer,
    openNoteTexts,
    dirtyTabIds,
    pendingTab,
    noteStatus,
    openMarkdown,
    edit,
    requestClose,
    confirmSave,
    discard,
    cancelClose,
    saveActive,
  };
}
