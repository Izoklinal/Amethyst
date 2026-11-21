import type { MouseEvent } from "react";
import type { VaultInfo } from "../../../api/vault";
import type { ToolId } from "../../../workspace/layoutState";
import { toolbarButtons } from "../../../workspace/toolbarState";
import type { ContextMenuItem } from "../../ui/ContextMenu/ContextMenu";
import { IconButton } from "../../ui/IconButton/IconButton";
import { Tooltip } from "../../ui/Tooltip/Tooltip";
import { CheckIcon, CloseIcon, NewFolderIcon, NewNoteIcon } from "../../ui/icons";
import { VaultTree, type ExplorerTreeHandle } from "../VaultTree/VaultTree";
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
  hiddenToolbarButtons: readonly string[];
  treeHandle: { current: ExplorerTreeHandle | null };
  onOpenVault: () => void;
  onOpenNote: (entry: SelectedEntry) => void;
  onOpenMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
};

export function PrimarySidebar({
  tool,
  width,
  vault,
  vaultError,
  refreshToken,
  explorer,
  hiddenToolbarButtons,
  treeHandle,
  onOpenVault,
  onOpenNote,
  onOpenMenu,
}: PrimarySidebarProps) {
  const visibleTools = toolbarButtons.filter(
    (button) => !hiddenToolbarButtons.includes(button.commandId),
  );

  function openBackgroundMenu(event: MouseEvent) {
    event.preventDefault();
    if (!vault) {
      return;
    }
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("input, textarea, [data-toolbar-button], [data-tree-path]")
    ) {
      return;
    }
    const items: ContextMenuItem[] = [
      { commandId: "explorer.newNote" },
      { commandId: "explorer.newFolder" },
      ...hiddenToolbarButtons.flatMap((commandId) => {
        const button = toolbarButtons.find((item) => item.commandId === commandId);
        return button
          ? [{ commandId: "toolbar.show", argument: commandId, label: `Show ${button.label}` }]
          : [];
      }),
    ];
    onOpenMenu(event.clientX, event.clientY, items);
  }
  return (
    <aside
      id={tool === "explorer" ? "explorer-sidebar" : undefined}
      className={styles.sidebar}
      style={{ width }}
      tabIndex={-1}
      aria-label={tool === "explorer" ? "Explorer" : "Search"}
      onContextMenu={tool === "explorer" ? openBackgroundMenu : undefined}
    >
      {tool === "explorer" ? (
        <>
          <div className={styles.heading}>
            <h2 className={styles.title}>Explorer</h2>
            {vault ? (
              <div className={styles.actions}>
                {visibleTools.map((button) => (
                  <Tooltip key={button.commandId} label={button.label}>
                    <button
                      type="button"
                      className={styles.tool}
                      data-toolbar-button={button.commandId}
                      aria-label={button.label}
                      disabled={explorer.busy}
                      onClick={
                        button.commandId === "explorer.newNote"
                          ? explorer.newNote
                          : explorer.newFolder
                      }
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onOpenMenu(event.clientX, event.clientY, [
                          {
                            commandId: "toolbar.hide",
                            argument: button.commandId,
                            label: "Hide",
                          },
                        ]);
                      }}
                    >
                      {button.commandId === "explorer.newNote" ? <NewNoteIcon /> : <NewFolderIcon />}
                    </button>
                  </Tooltip>
                ))}
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
                treeHandle={treeHandle}
                onOpenMenu={onOpenMenu}
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
