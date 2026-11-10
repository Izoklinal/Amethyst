import { useCallback, useEffect, useRef, useState } from "react";
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

export function useOpenNotes(
  vaultPath: string | null,
  refreshToken: number,
  onNoteClosed?: (path: string) => void,
) {
  const [group, setGroup] = useState<EditorGroup>(() => createInitialGroup());
  const [buffers, setBuffers] = useState<Record<string, NoteBuffer>>({});
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const groupRef = useRef(group);
  const buffersRef = useRef(buffers);
  const onNoteClosedRef = useRef(onNoteClosed);
  groupRef.current = group;
  buffersRef.current = buffers;
  onNoteClosedRef.current = onNoteClosed;

  useEffect(() => {
    setGroup(createInitialGroup());
    setBuffers({});
    setPendingCloseId(null);
    setOpenError(null);
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
      setGroup((current) => activateTab(current, existing.id));
      setOpenError(null);
      return;
    }
    const id = crypto.randomUUID();
    void readVaultNote(entry.path)
      .then((text) => {
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
      })
      .catch((cause: unknown) => {
        setOpenError(vaultErrorMessage(cause));
      });
  }, []);

  const edit = useCallback((tabId: string, text: string) => {
    setBuffers((current) => {
      const buffer = current[tabId];
      if (!buffer) {
        return current;
      }
      return { ...current, [tabId]: { ...buffer, text, error: null } };
    });
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
        setBuffers((current) => {
          const latest = current[tabId];
          if (!latest) {
            return current;
          }
          return {
            ...current,
            [tabId]: { ...latest, savedText: written, error: null },
          };
        });
        return true;
      })
      .catch((cause: unknown) => {
        setBuffers((current) => {
          const latest = current[tabId];
          if (!latest) {
            return current;
          }
          return {
            ...current,
            [tabId]: { ...latest, error: vaultErrorMessage(cause) },
          };
        });
        return false;
      });
  }, []);

  const closeNow = useCallback((tabId: string) => {
    const path =
      buffersRef.current[tabId]?.path ??
      groupRef.current.tabs.find((tab) => tab.id === tabId)?.path;
    setGroup((current) => closeTab(current, tabId));
    setBuffers((current) => {
      const next = { ...current };
      delete next[tabId];
      return next;
    });
    setPendingCloseId((current) => (current === tabId ? null : current));
    if (path) {
      onNoteClosedRef.current?.(path);
    }
  }, []);

  const requestClose = useCallback(
    (tabId: string) => {
      const buffer = buffersRef.current[tabId];
      if (buffer && buffer.text !== buffer.savedText) {
        setGroup((current) => activateTab(current, tabId));
        setPendingCloseId(tabId);
        return;
      }
      closeNow(tabId);
    },
    [closeNow],
  );

  const confirmSave = useCallback(() => {
    if (!pendingCloseId) {
      return;
    }
    const tabId = pendingCloseId;
    void save(tabId).then((saved) => {
      if (saved) {
        closeNow(tabId);
      }
    });
  }, [closeNow, pendingCloseId, save]);

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
    if (activeId) {
      void save(activeId);
    }
  }, [save]);

  const active = group.tabs.find((tab) => tab.id === group.activeTabId) ?? null;
  const activeBuffer = active ? buffers[active.id] : undefined;
  const pendingTab = group.tabs.find((tab) => tab.id === pendingCloseId) ?? null;
  let noteStatus = "No note";
  if (activeBuffer?.error) {
    noteStatus = activeBuffer.error;
  } else if (activeBuffer && activeBuffer.text !== activeBuffer.savedText) {
    noteStatus = "Unsaved";
  } else if (activeBuffer) {
    noteStatus = "Saved";
  } else if (openError) {
    noteStatus = openError;
  }

  const dirtyTabIds = new Set(
    group.tabs
      .filter((tab) => {
        const buffer = buffers[tab.id];
        return buffer !== undefined && buffer.text !== buffer.savedText;
      })
      .map((tab) => tab.id),
  );

  return {
    group,
    setGroup,
    activeBuffer,
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
