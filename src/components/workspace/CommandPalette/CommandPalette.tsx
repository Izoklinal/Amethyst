import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  shortcutLabel,
  type Command,
} from "../../../workspace/commands";
import styles from "./CommandPalette.module.css";

type CommandPaletteProps = {
  commands: Command[];
  onClose: () => void;
};

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return commands;
    }
    return commands.filter((command) =>
      command.title.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
  }, [activeIndex, matches]);

  function run(command: Command | undefined) {
    if (!command) {
      return;
    }
    onClose();
    command.run();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        matches.length === 0 ? 0 : (index + 1) % matches.length,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        matches.length === 0 ? 0 : (index - 1 + matches.length) % matches.length,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      run(matches[activeIndex]);
    }
  }

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          aria-controls="command-palette-list"
          aria-activedescendant={
            matches[activeIndex]
              ? `command-${matches[activeIndex].id}`
              : undefined
          }
          placeholder="Type a command"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <ul
          id="command-palette-list"
          ref={listRef}
          className={styles.list}
          role="listbox"
        >
          {matches.length === 0 ? (
            <li className={styles.empty}>No matching commands.</li>
          ) : (
            matches.map((command, index) => (
              <li key={command.id}>
                <button
                  id={`command-${command.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={
                    index === activeIndex ? styles.optionActive : styles.option
                  }
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => run(command)}
                >
                  <span>{command.title}</span>
                  {command.shortcut ? (
                    <span className={styles.shortcut}>
                      {shortcutLabel(command.shortcut)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
