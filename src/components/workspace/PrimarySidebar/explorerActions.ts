import { useCallback, useEffect, useState } from "react";
import {
  createVaultDirectory,
  createVaultFile,
  moveVaultEntry,
  renameVaultEntry,
  trashVaultEntry,
  vaultErrorMessage,
  type VaultEntry,
} from "../../../api/vault";

export type SelectedEntry = {
  path: string;
  name: string;
  kind: VaultEntry["kind"];
};

export type ExplorerFormAction = "new-note" | "new-folder" | "rename" | "move";

export type ExplorerForm = {
  action: ExplorerFormAction;
  label: string;
  value: string;
};

const FORM_LABELS: Record<ExplorerFormAction, string> = {
  "new-note": "Note name",
  "new-folder": "Folder name",
  rename: "New name",
  move: "Destination folder",
};

function parentPath(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

function joinPath(parent: string, name: string): string {
  return parent.length === 0 ? name : `${parent}/${name}`;
}

function targetDirectory(selection: SelectedEntry | null): string {
  if (!selection || selection.kind === "file") {
    return selection ? parentPath(selection.path) : "";
  }
  return selection.path;
}

export function useExplorerActions(vaultPath: string | null, onRefresh: () => void) {
  const [selection, setSelection] = useState<SelectedEntry | null>(null);
  const [form, setForm] = useState<ExplorerForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelection(null);
    setForm(null);
    setError(null);
  }, [vaultPath]);

  const openForm = useCallback((action: ExplorerFormAction, value: string) => {
    setError(null);
    setForm({ action, label: FORM_LABELS[action], value });
  }, []);

  const requireVault = useCallback((): boolean => {
    if (vaultPath) {
      return true;
    }
    setError("No vault is open.");
    return false;
  }, [vaultPath]);

  const requireSelection = useCallback((): SelectedEntry | null => {
    if (!requireVault()) {
      return null;
    }
    if (!selection) {
      setError("Select a file or folder.");
      return null;
    }
    return selection;
  }, [requireVault, selection]);

  const newNote = useCallback(() => {
    if (requireVault()) {
      openForm("new-note", "");
    }
  }, [openForm, requireVault]);

  const newFolder = useCallback(() => {
    if (requireVault()) {
      openForm("new-folder", "");
    }
  }, [openForm, requireVault]);

  const rename = useCallback(() => {
    const current = requireSelection();
    if (current) {
      openForm("rename", current.name);
    }
  }, [openForm, requireSelection]);

  const move = useCallback(() => {
    const current = requireSelection();
    if (current) {
      openForm("move", parentPath(current.path));
    }
  }, [openForm, requireSelection]);

  const remove = useCallback(() => {
    const current = requireSelection();
    if (!current || busy) {
      return;
    }
    const confirmed = window.confirm(
      `Move "${current.name}" to the vault trash? You can move it back from .trash.`,
    );
    if (!confirmed) {
      return;
    }
    setBusy(true);
    setError(null);
    void trashVaultEntry(current.path)
      .then(() => {
        setSelection(null);
        setForm(null);
        onRefresh();
      })
      .catch((cause: unknown) => {
        setError(vaultErrorMessage(cause));
      })
      .finally(() => {
        setBusy(false);
      });
  }, [busy, onRefresh, requireSelection]);

  const cancel = useCallback(() => {
    setForm(null);
  }, []);

  const setFormValue = useCallback((value: string) => {
    setForm((current) => (current ? { ...current, value } : current));
  }, []);

  const submit = useCallback(() => {
    if (!form || !vaultPath || busy) {
      return;
    }
    const value = form.value;
    const current = selection;
    setBusy(true);
    setError(null);

    let task: Promise<void>;
    if (form.action === "new-note") {
      task = createVaultFile(targetDirectory(current), value);
    } else if (form.action === "new-folder") {
      task = createVaultDirectory(targetDirectory(current), value);
    } else if (!current) {
      setBusy(false);
      setError("Select a file or folder.");
      return;
    } else if (form.action === "rename") {
      task = renameVaultEntry(current.path, value).then(() => {
        setSelection({
          ...current,
          name: value,
          path: joinPath(parentPath(current.path), value),
        });
      });
    } else {
      task = moveVaultEntry(current.path, value).then(() => {
        setSelection({
          ...current,
          path: joinPath(value, current.name),
        });
      });
    }

    void task
      .then(() => {
        setForm(null);
        onRefresh();
      })
      .catch((cause: unknown) => {
        setError(vaultErrorMessage(cause));
      })
      .finally(() => {
        setBusy(false);
      });
  }, [busy, form, onRefresh, selection, vaultPath]);

  return {
    selection,
    setSelection,
    form,
    error,
    busy,
    newNote,
    newFolder,
    rename,
    move,
    remove,
    cancel,
    setFormValue,
    submit,
  };
}
