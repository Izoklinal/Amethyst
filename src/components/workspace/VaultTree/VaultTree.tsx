import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import {
  listVaultDirectory,
  vaultErrorMessage,
  type VaultEntry,
} from "../../../api/vault";
import type { ContextMenuItem } from "../../ui/ContextMenu/ContextMenu";
import type { SelectedEntry } from "../PrimarySidebar/explorerActions";
import styles from "./VaultTree.module.css";

export type ExplorerTreeHandle = {
  focus: () => void;
  next: () => void;
  previous: () => void;
  expand: () => void;
  collapse: () => void;
  activate: () => void;
};

type TreeRow = {
  path: string;
  name: string;
  kind: VaultEntry["kind"];
  depth: number;
  open: boolean;
};

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
  treeHandle: { current: ExplorerTreeHandle | null };
  onOpenMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
};

type EntryListProps = {
  entries: VaultEntry[];
  parent: string;
  depth: number;
  nodes: Record<string, NodeState>;
  selectedPath: string | null;
  tabPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (entry: SelectedEntry) => void;
  onOpen: (entry: SelectedEntry) => void;
  onRowMenu: (event: MouseEvent, entry: SelectedEntry) => void;
};

function depthStyle(depth: number): CSSProperties {
  return { "--tree-depth": String(depth) } as CSSProperties;
}

function childPath(parent: string, name: string): string {
  return parent.length === 0 ? name : `${parent}/${name}`;
}

function visibleRows(
  entries: VaultEntry[],
  nodes: Record<string, NodeState>,
  parent: string,
  depth: number,
): TreeRow[] {
  const rows: TreeRow[] = [];
  for (const entry of entries) {
    const path = childPath(parent, entry.name);
    const open = entry.kind === "directory" && (nodes[path]?.open ?? false);
    rows.push({ path, name: entry.name, kind: entry.kind, depth, open });
    const node = nodes[path];
    if (open && node && node.entries.length > 0) {
      rows.push(...visibleRows(node.entries, nodes, path, depth + 1));
    }
  }
  return rows;
}

function parentPath(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

function focusRow(path: string) {
  const node = document.querySelector(`[data-tree-path="${CSS.escape(path)}"]`);
  if (node instanceof HTMLElement) {
    node.focus();
    node.scrollIntoView({ block: "nearest" });
  }
}

function EntryList({
  entries,
  parent,
  depth,
  nodes,
  selectedPath,
  tabPath,
  onToggle,
  onSelect,
  onOpen,
  onRowMenu,
}: EntryListProps) {
  return (
    <ul className={styles.tree} role="group">
      {entries.map((entry) => {
        const path = childPath(parent, entry.name);
        const selected = path === selectedPath;
        const chosen = { path, name: entry.name, kind: entry.kind };
        if (entry.kind === "file") {
          return (
            <li key={path}>
              <button
                type="button"
                role="treeitem"
                data-tree-path={path}
                tabIndex={path === tabPath ? 0 : -1}
                className={selected ? `${styles.file} ${styles.selected}` : styles.file}
                style={depthStyle(depth)}
                aria-current={selected ? "true" : undefined}
                onClick={() => {
                  onSelect(chosen);
                  onOpen(chosen);
                }}
                onContextMenu={(event) => onRowMenu(event, chosen)}
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
              role="treeitem"
              data-tree-path={path}
              tabIndex={path === tabPath ? 0 : -1}
              className={
                selected ? `${styles.directory} ${styles.selected}` : styles.directory
              }
              style={depthStyle(depth)}
              aria-expanded={open}
              aria-current={selected ? "true" : undefined}
              onClick={() => {
                onSelect(chosen);
                onToggle(path);
              }}
              onContextMenu={(event) => onRowMenu(event, chosen)}
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
                tabPath={tabPath}
                onToggle={onToggle}
                onSelect={onSelect}
                onOpen={onOpen}
                onRowMenu={onRowMenu}
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
  treeHandle,
  onOpenMenu,
}: VaultTreeProps) {
  const [root, setRoot] = useState<NodeState>({
    open: true,
    status: "loading",
    entries: [],
    error: null,
  });
  const [nodes, setNodes] = useState<Record<string, NodeState>>({});
  const nodesRef = useRef(nodes);
  const rootRef = useRef(root);
  const selectedRef = useRef(selectedPath);
  nodesRef.current = nodes;
  rootRef.current = root;
  selectedRef.current = selectedPath;

  function rowsNow(): TreeRow[] {
    return visibleRows(rootRef.current.entries, nodesRef.current, "", 0);
  }

  function choose(row: TreeRow, focus: boolean) {
    onSelect({ path: row.path, name: row.name, kind: row.kind });
    if (focus) {
      requestAnimationFrame(() => focusRow(row.path));
    }
  }

  const handle: ExplorerTreeHandle = {
    focus() {
      const rows = rowsNow();
      const selected = rows.find((row) => row.path === selectedRef.current);
      const row = selected ?? rows[0];
      if (!row) {
        return;
      }
      if (selected) {
        requestAnimationFrame(() => focusRow(row.path));
        return;
      }
      choose(row, true);
    },
    next() {
      const rows = rowsNow();
      const index = rows.findIndex((row) => row.path === selectedRef.current);
      const next = rows[index < 0 ? 0 : Math.min(rows.length - 1, index + 1)];
      if (next) {
        choose(next, true);
      }
    },
    previous() {
      const rows = rowsNow();
      const index = rows.findIndex((row) => row.path === selectedRef.current);
      const previous = rows[index <= 0 ? 0 : index - 1];
      if (previous) {
        choose(previous, true);
      }
    },
    expand() {
      const rows = rowsNow();
      const index = rows.findIndex((row) => row.path === selectedRef.current);
      const row = rows[index];
      if (!row || row.kind !== "directory") {
        return;
      }
      if (!row.open) {
        toggle(row.path);
        return;
      }
      const child = rows[index + 1];
      if (child && child.depth > row.depth) {
        choose(child, true);
      }
    },
    collapse() {
      const rows = rowsNow();
      const row = rows.find((item) => item.path === selectedRef.current);
      if (!row) {
        return;
      }
      if (row.kind === "directory" && row.open) {
        toggle(row.path);
        return;
      }
      const parent = parentPath(row.path);
      const parentRow = rows.find((item) => item.path === parent);
      if (parent.length > 0 && parentRow) {
        choose(parentRow, true);
      }
    },
    activate() {
      const rows = rowsNow();
      const row = rows.find((item) => item.path === selectedRef.current) ?? rows[0];
      if (!row) {
        return;
      }
      const chosen = { path: row.path, name: row.name, kind: row.kind };
      onSelect(chosen);
      if (row.kind === "file") {
        onOpen(chosen);
        return;
      }
      toggle(row.path);
    },
  };
  treeHandle.current = handle;

  function onRowMenu(event: MouseEvent, entry: SelectedEntry) {
    event.preventDefault();
    event.stopPropagation();
    onSelect(entry);
    const items: ContextMenuItem[] =
      entry.kind === "file"
        ? [
            { commandId: "explorer.open" },
            { commandId: "explorer.rename" },
            { commandId: "explorer.move" },
            { commandId: "explorer.delete" },
          ]
        : [
            { commandId: "explorer.newNote" },
            { commandId: "explorer.newFolder" },
            { commandId: "explorer.rename" },
            { commandId: "explorer.move" },
            { commandId: "explorer.delete" },
          ];
    onOpenMenu(event.clientX, event.clientY, items);
  }

  useEffect(() => {
    treeHandle.current = handle;
    return () => {
      if (treeHandle.current === handle) {
        treeHandle.current = null;
      }
    };
  });

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

  const rows = visibleRows(root.entries, nodes, "", 0);
  const tabPath =
    selectedPath && rows.some((row) => row.path === selectedPath)
      ? selectedPath
      : (rows[0]?.path ?? null);

  if (root.status === "loading" && root.entries.length === 0) {
    return <p className={styles.message}>Loading…</p>;
  }

  return (
    <div className={styles.root} role="tree" aria-label="Vault files" data-key-context="explorer">
      {root.error ? <p className={styles.message}>{root.error}</p> : null}
      {root.entries.length > 0 ? (
        <EntryList
          entries={root.entries}
          parent=""
          depth={0}
          nodes={nodes}
          selectedPath={selectedPath}
          tabPath={tabPath}
          onToggle={toggle}
          onSelect={onSelect}
          onOpen={onOpen}
          onRowMenu={onRowMenu}
        />
      ) : null}
      {root.status === "ready" && root.entries.length === 0 ? (
        <p className={styles.message}>Empty folder.</p>
      ) : null}
    </div>
  );
}
