import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import styles from "./ContextMenu.module.css";

export type ContextMenuItem = {
  commandId: string;
  label?: string;
  argument?: string;
};

export type ContextMenuEntry = {
  label: string;
  shortcut: string | null;
};

type ContextMenuProps = {
  x: number;
  y: number;
  entries: ContextMenuEntry[];
  onSelect: (index: number) => void;
  onClose: () => void;
};

export function ContextMenu({ x, y, entries, onSelect, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    const rect = menu.getBoundingClientRect();
    const left = x + rect.width > window.innerWidth ? Math.max(4, x - rect.width) : x;
    const top = y + rect.height > window.innerHeight ? Math.max(4, y - rect.height) : y;
    setPosition({ left, top });
  }, [x, y, entries]);

  useEffect(() => {
    menuRef.current?.querySelector("button")?.focus();
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [onClose]);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const buttons = menuRef.current
      ? Array.from(menuRef.current.querySelectorAll("button"))
      : [];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      if (buttons.length === 0) {
        return;
      }
      const next =
        event.key === "ArrowDown"
          ? (index + 1) % buttons.length
          : (index - 1 + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      role="menu"
      style={{ left: position.left, top: position.top }}
      onKeyDown={onKeyDown}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {entries.map((entry, index) => (
        <button
          key={`${entry.label}-${index}`}
          type="button"
          role="menuitem"
          className={styles.item}
          onClick={() => onSelect(index)}
        >
          <span>{entry.label}</span>
          {entry.shortcut ? <span className={styles.shortcut}>{entry.shortcut}</span> : null}
        </button>
      ))}
    </div>,
    document.body,
  );
}
