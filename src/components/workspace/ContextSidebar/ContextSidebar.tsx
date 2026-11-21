import { useEffect, useState, type CSSProperties } from "react";
import {
  noteOutline,
  vaultBacklinks,
  vaultErrorMessage,
  type Backlink,
  type Heading,
  type OpenNoteText,
} from "../../../api/vault";
import type { SelectedEntry } from "../PrimarySidebar/explorerActions";
import styles from "./ContextSidebar.module.css";

type ContextSidebarProps = {
  noteText: string | null;
  targetPath: string | null;
  refreshToken: number;
  openNotes: OpenNoteText[];
  onOpen: (entry: SelectedEntry) => void;
  onRevealHeading: (offset: number) => void;
};

function outlineIndent(level: number): CSSProperties {
  return { "--outline-level": String(level - 1) } as CSSProperties;
}

export function ContextSidebar({
  noteText,
  targetPath,
  refreshToken,
  openNotes,
  onOpen,
  onRevealHeading,
}: ContextSidebarProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [outlineReady, setOutlineReady] = useState(false);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [readyPath, setReadyPath] = useState<string | null>(null);

  useEffect(() => {
    if (noteText === null) {
      setHeadings([]);
      setOutlineReady(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void noteOutline(noteText)
        .then((items) => {
          if (!cancelled) {
            setHeadings(items);
            setOutlineReady(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setHeadings([]);
            setOutlineReady(true);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [noteText]);

  useEffect(() => {
    if (!targetPath) {
      setBacklinks([]);
      setError(null);
      setReadyPath(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void vaultBacklinks(targetPath, openNotes)
        .then((links) => {
          if (!cancelled) {
            setBacklinks(links);
            setError(null);
            setReadyPath(targetPath);
          }
        })
        .catch((cause: unknown) => {
          if (!cancelled) {
            setBacklinks([]);
            setError(vaultErrorMessage(cause));
            setReadyPath(targetPath);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [targetPath, refreshToken, openNotes]);

  return (
    <aside className={styles.sidebar} aria-label="Note context">
      <section>
        <h2 className={styles.title}>Outline</h2>
        {noteText === null ? (
          <p className={styles.message}>Outline appears with a note.</p>
        ) : null}
        {noteText !== null && outlineReady && headings.length === 0 ? (
          <p className={styles.message}>No headings.</p>
        ) : null}
        {headings.length > 0 ? (
          <ul className={styles.list}>
            {headings.map((heading) => (
              <li key={`${heading.offset}-${heading.text}`}>
                <button
                  type="button"
                  className={styles.outline}
                  style={outlineIndent(heading.level)}
                  onClick={() => onRevealHeading(heading.offset)}
                >
                  {heading.text}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section>
        <h2 className={styles.title}>Backlinks</h2>
        {error ? <p className={styles.message}>{error}</p> : null}
        {!targetPath ? (
          <p className={styles.message}>Backlinks appear with a note.</p>
        ) : null}
        {targetPath && readyPath === targetPath && !error && backlinks.length === 0 ? (
          <p className={styles.message}>No backlinks.</p>
        ) : null}
        {backlinks.length > 0 ? (
          <ul className={styles.list}>
            {backlinks.map((link) => (
              <li key={link.path}>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => onOpen({ path: link.path, name: link.name, kind: "file" })}
                >
                  {link.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </aside>
  );
}
