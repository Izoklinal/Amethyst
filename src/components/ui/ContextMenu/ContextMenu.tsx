import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
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
  icon?: ReactNode;
  submenu?: ContextMenuEntry[];
};

type ContextMenuProps = {
  x: number;
  y: number;
  entries: ContextMenuEntry[];
  onSelect: (index: number) => void;
  onSelectChild?: (index: number, childIndex: number) => void;
  onClose: () => void;
};

export function ContextMenu({ x, y, entries, onSelect, onSelectChild, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [flipSubmenu, setFlipSubmenu] = useState(false);
  const submenuRef = useRef<HTMLDivElement>(null);

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

  useLayoutEffect(() => {
    const submenu = submenuRef.current;
    if (!submenu) {
      return;
    }
    setFlipSubmenu(submenu.getBoundingClientRect().right > window.innerWidth);
  }, [openIndex, entries]);

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
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !menuRef.current) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    const level = target.dataset.level;
    if (event.key === "ArrowRight" && level === "0" && target.dataset.submenu === "true") {
      event.preventDefault();
      event.stopPropagation();
      const child = target.parentElement?.querySelector("button[data-level='1']");
      if (child instanceof HTMLButtonElement) {
        child.focus();
      }
      return;
    }
    if (event.key === "ArrowLeft" && level === "1") {
      event.preventDefault();
      event.stopPropagation();
      const parent = target.closest("[data-entry]")?.querySelector("button[data-level='0']");
      if (parent instanceof HTMLButtonElement) {
        parent.focus();
      }
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const group =
      level === "1"
        ? Array.from(target.parentElement?.querySelectorAll("button[data-level='1']") ?? [])
        : Array.from(menuRef.current.querySelectorAll("button[data-level='0']"));
    const buttons = group.filter((node): node is HTMLButtonElement => node instanceof HTMLButtonElement);
    const index = buttons.indexOf(target);
    if (buttons.length === 0 || index === -1) {
      return;
    }
    const next =
      event.key === "ArrowDown" ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
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
        <div
          key={`${entry.label}-${index}`}
          className={styles.entry}
          data-entry=""
          onMouseEnter={() => setOpenIndex(entry.submenu ? index : null)}
        >
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            data-level="0"
            data-submenu={entry.submenu ? "true" : "false"}
            aria-haspopup={entry.submenu ? "menu" : undefined}
            onFocus={() => {
              if (entry.submenu) {
                setOpenIndex(index);
              }
            }}
            onClick={() => {
              if (!entry.submenu) {
                onSelect(index);
              }
            }}
          >
            <span className={styles.label}>
              {entry.icon}
              <span>{entry.label}</span>
            </span>
            {entry.submenu ? <span aria-hidden="true">›</span> : null}
            {entry.shortcut ? <span className={styles.shortcut}>{entry.shortcut}</span> : null}
          </button>
          {openIndex === index && entry.submenu ? (
            <div
              ref={submenuRef}
              className={flipSubmenu ? `${styles.submenu} ${styles.submenuFlip}` : styles.submenu}
              role="menu"
            >
              {entry.submenu.map((child, childIndex) => (
                <button
                  key={`${child.label}-${childIndex}`}
                  type="button"
                  role="menuitem"
                  className={styles.item}
                  data-level="1"
                  onClick={() => onSelectChild?.(index, childIndex)}
                >
                  <span className={styles.label}>
                    {child.icon}
                    <span>{child.label}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>,
    document.body,
  );
}
