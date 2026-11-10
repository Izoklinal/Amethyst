import type { VaultInfo } from "../../../api/vault";
import type { ToolId } from "../../../workspace/layoutState";
import { VaultTree } from "../VaultTree/VaultTree";
import styles from "./PrimarySidebar.module.css";

type PrimarySidebarProps = {
  tool: ToolId;
  width: number;
  vault: VaultInfo | null;
  vaultError: string | null;
  onOpenVault: () => void;
};

export function PrimarySidebar({
  tool,
  width,
  vault,
  vaultError,
  onOpenVault,
}: PrimarySidebarProps) {
  return (
    <aside className={styles.sidebar} style={{ width }} aria-label={tool === "explorer" ? "Explorer" : "Search"}>
      {tool === "explorer" ? (
        <>
          <h2 className={styles.title}>Explorer</h2>
          {vault ? (
            <>
              {vaultError ? <p className={styles.message}>{vaultError}</p> : null}
              <VaultTree key={vault.path} vaultPath={vault.path} />
            </>
          ) : (
            <>
              <p className={styles.message}>{vaultError ?? "No vault open."}</p>
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
