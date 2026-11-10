import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  listVaultDirectory,
  vaultErrorMessage,
  type VaultEntry,
} from "../../../api/vault";
import styles from "./VaultTree.module.css";

type NodeState = {
  open: boolean;
  status: "loading" | "ready" | "error";
  entries: VaultEntry[];
  error: string | null;
};

type VaultTreeProps = {
  vaultPath: string;
};

type EntryListProps = {
  entries: VaultEntry[];
  parent: string;
  depth: number;
  nodes: Record<string, NodeState>;
  onToggle: (path: string) => void;
};

function depthStyle(depth: number): CSSProperties {
  return { "--tree-depth": String(depth) } as CSSProperties;
}

function childPath(parent: string, name: string): string {
  return parent.length === 0 ? name : `${parent}/${name}`;
}

function EntryList({ entries, parent, depth, nodes, onToggle }: EntryListProps) {
  return (
    <ul className={styles.tree}>
      {entries.map((entry) => {
        const path = childPath(parent, entry.name);
        if (entry.kind === "file") {
          return (
            <li key={path}>
              <div className={styles.file} style={depthStyle(depth)}>
                {entry.name}
              </div>
            </li>
          );
        }

        const node = nodes[path];
        const open = node?.open ?? false;
        return (
          <li key={path}>
            <button
              type="button"
              className={styles.directory}
              style={depthStyle(depth)}
              aria-expanded={open}
              onClick={() => onToggle(path)}
            >
              {entry.name}
            </button>
            {open && node?.status === "loading" && node.entries.length === 0 ? (
              <p className={styles.message} style={depthStyle(depth + 1)}>
                Loading…
              </p>
            ) : null}
            {open && node?.error ? (
              <p className={styles.message} style={depthStyle(depth + 1)}>
                {node.error}
              </p>
            ) : null}
            {open && node?.status === "ready" && node.entries.length === 0 ? (
              <p className={styles.message} style={depthStyle(depth + 1)}>
                Empty folder.
              </p>
            ) : null}
            {open && node && node.entries.length > 0 ? (
              <EntryList
                entries={node.entries}
                parent={path}
                depth={depth + 1}
                nodes={nodes}
                onToggle={onToggle}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function VaultTree({ vaultPath }: VaultTreeProps) {
  const [root, setRoot] = useState<NodeState>({
    open: true,
    status: "loading",
    entries: [],
    error: null,
  });
  const [nodes, setNodes] = useState<Record<string, NodeState>>({});
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    let cancelled = false;
    listVaultDirectory("")
      .then((entries) => {
        if (!cancelled) {
          setRoot({ open: true, status: "ready", entries, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRoot((current) => ({
            open: true,
            status: "error",
            entries: current.entries,
            error: vaultErrorMessage(error),
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [vaultPath]);

  function toggle(path: string) {
    const current = nodesRef.current[path];
    if (current?.open) {
      setNodes((state) => ({
        ...state,
        [path]: { ...current, open: false },
      }));
      return;
    }
    if (current?.status === "ready") {
      setNodes((state) => ({
        ...state,
        [path]: { ...current, open: true },
      }));
      return;
    }
    if (current?.status === "loading") {
      return;
    }

    setNodes((state) => ({
      ...state,
      [path]: {
        open: true,
        status: "loading",
        entries: current?.entries ?? [],
        error: null,
      },
    }));

    listVaultDirectory(path)
      .then((entries) => {
        setNodes((state) => ({
          ...state,
          [path]: { open: true, status: "ready", entries, error: null },
        }));
      })
      .catch((error: unknown) => {
        setNodes((state) => ({
          ...state,
          [path]: {
            open: state[path]?.open ?? true,
            status: "error",
            entries: state[path]?.entries ?? [],
            error: vaultErrorMessage(error),
          },
        }));
      });
  }

  if (root.status === "loading" && root.entries.length === 0) {
    return <p className={styles.message}>Loading…</p>;
  }

  return (
    <>
      {root.error ? <p className={styles.message}>{root.error}</p> : null}
      {root.entries.length > 0 ? (
        <EntryList
          entries={root.entries}
          parent=""
          depth={0}
          nodes={nodes}
          onToggle={toggle}
        />
      ) : null}
      {root.status === "ready" && root.entries.length === 0 ? (
        <p className={styles.message}>Empty folder.</p>
      ) : null}
    </>
  );
}
