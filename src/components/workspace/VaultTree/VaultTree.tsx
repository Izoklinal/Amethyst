import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  listVaultDirectory,
  vaultErrorMessage,
  type VaultEntry,
} from "../../../api/vault";
import type { SelectedEntry } from "../PrimarySidebar/explorerActions";
import styles from "./VaultTree.module.css";

type NodeState = {
  open: boolean;
  status: "loading" | "ready" | "error";
  entries: VaultEntry[];
  error: string | null;
};

type VaultTreeProps = {
  vaultPath: string;
  refreshToken: number;
  selectedPath: string | null;
  onSelect: (entry: SelectedEntry) => void;
  onOpen: (entry: SelectedEntry) => void;
};

type EntryListProps = {
  entries: VaultEntry[];
  parent: string;
  depth: number;
  nodes: Record<string, NodeState>;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (entry: SelectedEntry) => void;
  onOpen: (entry: SelectedEntry) => void;
};

function depthStyle(depth: number): CSSProperties {
  return { "--tree-depth": String(depth) } as CSSProperties;
}

function childPath(parent: string, name: string): string {
  return parent.length === 0 ? name : `${parent}/${name}`;
}

function EntryList({
  entries,
  parent,
  depth,
  nodes,
  selectedPath,
  onToggle,
  onSelect,
  onOpen,
}: EntryListProps) {
  return (
    <ul className={styles.tree}>
      {entries.map((entry) => {
        const path = childPath(parent, entry.name);
        const selected = path === selectedPath;
        if (entry.kind === "file") {
          return (
            <li key={path}>
              <button
                type="button"
                className={selected ? `${styles.file} ${styles.selected}` : styles.file}
                style={depthStyle(depth)}
                aria-current={selected ? "true" : undefined}
                onClick={() => {
                  const chosen = { path, name: entry.name, kind: entry.kind };
                  onSelect(chosen);
                  onOpen(chosen);
                }}
              >
                {entry.name}
              </button>
            </li>
          );
        }

        const node = nodes[path];
        const open = node?.open ?? false;
        return (
          <li key={path}>
            <button
              type="button"
              className={
                selected ? `${styles.directory} ${styles.selected}` : styles.directory
              }
              style={depthStyle(depth)}
              aria-expanded={open}
              aria-current={selected ? "true" : undefined}
              onClick={() => {
                onSelect({ path, name: entry.name, kind: entry.kind });
                onToggle(path);
              }}
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
                selectedPath={selectedPath}
                onToggle={onToggle}
                onSelect={onSelect}
                onOpen={onOpen}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function VaultTree({
  vaultPath,
  refreshToken,
  selectedPath,
  onSelect,
  onOpen,
}: VaultTreeProps) {
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

    const openPaths = Object.entries(nodesRef.current)
      .filter(([, node]) => node.open)
      .map(([path]) => path);
    for (const path of openPaths) {
      listVaultDirectory(path)
        .then((entries) => {
          if (cancelled) {
            return;
          }
          setNodes((state) => {
            const current = state[path];
            if (!current?.open) {
              return state;
            }
            return {
              ...state,
              [path]: { ...current, status: "ready", entries, error: null },
            };
          });
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }
          setNodes((state) => {
            const current = state[path];
            if (!current) {
              return state;
            }
            return {
              ...state,
              [path]: {
                ...current,
                status: "error",
                error: vaultErrorMessage(error),
              },
            };
          });
        });
    }

    return () => {
      cancelled = true;
    };
  }, [vaultPath, refreshToken]);

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
          selectedPath={selectedPath}
          onToggle={toggle}
          onSelect={onSelect}
          onOpen={onOpen}
        />
      ) : null}
      {root.status === "ready" && root.entries.length === 0 ? (
        <p className={styles.message}>Empty folder.</p>
      ) : null}
    </>
  );
}
