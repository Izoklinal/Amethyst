import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Command } from "../../../workspace/commands";
import { labelForCommand } from "../../../workspace/keybindings";
import { pickerItems, type QuickNote, type QuickOpenItem } from "../../../workspace/quickOpen";
import palette from "../CommandPalette/CommandPalette.module.css";
import styles from "./QuickOpen.module.css";

type QuickOpenProps = {
  queryToken: number;
  initialQuery: string;
  notes: QuickNote[];
  notesReady: boolean;
  noteError: string | null;
  counts: Record<string, number>;
  commands: Command[];
  onOpenNote: (note: QuickNote) => void;
  onRunCommand: (commandId: string) => void;
  onClose: () => void;
};

export function QuickOpen({
  queryToken,
  initialQuery,
  notes,
  notesReady,
  noteError,
  counts,
  commands,
  onOpenNote,
  onRunCommand,
  onClose,
}: QuickOpenProps) {
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setQuery(initialQuery);
    inputRef.current?.focus();
  }, [queryToken, initialQuery]);

  const items = useMemo(
    () => pickerItems(query, notes, commands, counts),
    [query, notes, commands, counts],
  );
  const commandMode = query.startsWith(">");

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !option) {
      return;
    }
    const listRect = list.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    if (optionRect.top < listRect.top) {
      list.scrollTop -= listRect.top - optionRect.top;
    } else if (optionRect.bottom > listRect.bottom) {
      list.scrollTop += optionRect.bottom - listRect.bottom;
    }
  }, [activeIndex, items]);

  function choose(index: number) {
    const item = items[index];
    if (!item) {
      return;
    }
    if (item.kind === "note") {
      onOpenNote(item.note);
      return;
    }
    onRunCommand(item.command.id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.code === "KeyP" && event.ctrlKey && !event.altKey) {
      event.preventDefault();
      setQuery(event.shiftKey ? ">" : "");
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (items.length === 0 ? 0 : (index + 1) % items.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (items.length === 0 ? 0 : (index - 1 + items.length) % items.length));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(activeIndex);
    }
  }

  const message =
    items.length === 0
      ? commandMode
        ? "No matching commands."
        : !notesReady
        ? null
        : (noteError ?? "No matching notes.")
      : null;

  return (
    <div className={palette.backdrop} onMouseDown={onClose}>
      <div
        className={palette.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Quick open"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className={palette.input}
          value={query}
          aria-controls="quick-open-list"
          aria-activedescendant={activeDescendant(items[activeIndex])}
          placeholder="Find a note"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <ul id="quick-open-list" ref={listRef} className={palette.list} role="listbox">
          {message ? (
            <li className={palette.empty}>{message}</li>
          ) : (
            items.map((item, index) => {
              const id = itemId(item);
              const selected = index === activeIndex;
              return (
                <li key={id}>
                  <button
                    id={id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={selected ? palette.optionActive : palette.option}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(index)}
                  >
                    {item.kind === "note" ? (
                      <>
                        <span className={styles.name}>{item.note.name}</span>
                        <span className={styles.path}>{item.note.path}</span>
                      </>
                    ) : (
                      <>
                        <span className={styles.name}>{item.command.title}</span>
                        {labelForCommand(item.command.id) ? (
                          <span className={palette.shortcut}>{labelForCommand(item.command.id)}</span>
                        ) : null}
                      </>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

function itemId(item: QuickOpenItem | undefined): string {
  if (!item) {
    return "";
  }
  return item.kind === "note" ? `quick-note-${item.note.path}` : `quick-command-${item.command.id}`;
}

function activeDescendant(item: QuickOpenItem | undefined): string | undefined {
  const id = itemId(item);
  return id || undefined;
}
