import { useEffect, useState } from "react";
import { coreStatus } from "../../../api/core";
import styles from "./StatusBar.module.css";

type StatusBarProps = {
  vaultName: string | null;
  vaultPath: string | null;
  noteStatus: string;
  linkStatus: string | null;
};

export function StatusBar({ vaultName, vaultPath, noteStatus, linkStatus }: StatusBarProps) {
  const [message, setMessage] = useState("Connecting to Amethyst Core…");

  useEffect(() => {
    let cancelled = false;
    coreStatus()
      .then((status) => {
        if (!cancelled) {
          setMessage(status);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const detail = error instanceof Error ? error.message : String(error);
          setMessage(`Core unavailable: ${detail}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className={styles.bar}>
      <span>{message}</span>
      <span>{linkStatus ?? noteStatus}</span>
      <span title={vaultPath ?? undefined}>{vaultName ?? "No vault"}</span>
    </footer>
  );
}
