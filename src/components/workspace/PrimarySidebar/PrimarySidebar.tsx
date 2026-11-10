import type { VaultInfo } from "../../../api/vault";
import type { ToolId } from "../../../workspace/layoutState";
import { IconButton } from "../../ui/IconButton/IconButton";
import { CheckIcon, CloseIcon, NewFolderIcon, NewNoteIcon } from "../../ui/icons";
import { VaultTree } from "../VaultTree/VaultTree";
import type { SelectedEntry, useExplorerActions } from "./explorerActions";
import styles from "./PrimarySidebar.module.css";

type ExplorerActions = ReturnType<typeof useExplorerActions>;

type PrimarySidebarProps = {
  tool: ToolId;
  width: number;
  vault: VaultInfo | null;
  vaultError: string | null;
  refreshToken: number;
  explorer: ExplorerActions;
  onOpenVault: () => void;
  onOpenNote: (entry: SelectedEntry) => void;
};

export function PrimarySidebar({
  tool,
  width,
  vault,
  vaultError,
  refreshToken,
  explorer,
  onOpenVault,
  onOpenNote,
}: PrimarySidebarProps) {
  return (
    <aside
      className={styles.sidebar}
      style={{ width }}
      aria-label={tool === "explorer" ? "Explorer" : "Search"}
    >
      {tool === "explorer" ? (
        <>
          <div className={styles.heading}>
            <h2 className={styles.title}>Explorer</h2>
            {vault ? (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.tool}
                  data-label="New Note"
                  aria-label="New Note"
                  disabled={explorer.busy}
                  onClick={explorer.newNote}
                >
                  <NewNoteIcon />
                </button>
                <button
                  type="button"
                  className={styles.tool}
                  data-label="New Folder"
                  aria-label="New Folder"
                  disabled={explorer.busy}
                  onClick={explorer.newFolder}
                >
                  <NewFolderIcon />
                </button>
              </div>
            ) : null}
          </div>
          {vault ? (
            <>
              {explorer.form ? (
                <form
                  className={styles.form}
                  key={explorer.form.action}
                  onSubmit={(event) => {
                    event.preventDefault();
                    explorer.submit();
                  }}
                >
                  <input
                    className={styles.field}
                    value={explorer.form.value}
                    aria-label={explorer.form.label}
                    autoFocus
                    onChange={(event) => explorer.setFormValue(event.target.value)}
                  />
                  <IconButton type="submit" label="Confirm" disabled={explorer.busy}>
                    <CheckIcon />
                  </IconButton>
                  <IconButton label="Cancel" onClick={explorer.cancel} disabled={explorer.busy}>
                    <CloseIcon />
                  </IconButton>
                </form>
              ) : null}
              {vaultError ? <p className={styles.message}>{vaultError}</p> : null}
              {explorer.error ? <p className={styles.message}>{explorer.error}</p> : null}
              <VaultTree
                key={vault.path}
                vaultPath={vault.path}
                refreshToken={refreshToken}
                selectedPath={explorer.selection?.path ?? null}
                onSelect={explorer.setSelection}
                onOpen={onOpenNote}
              />
            </>
          ) : (
            <>
              <p className={styles.message}>{vaultError ?? explorer.error ?? "No vault open."}</p>
              <button type="button" className={styles.open} onClick={onOpenVault}>
                Open Vault
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <h2 className={styles.title}>Search</h2>
          <p className={styles.message}>Search is not available yet.</p>
        </>
      )}
    </aside>
  );
}
