import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

type IconButtonProps = {
  label: string;
  pressed?: boolean;
  current?: boolean;
  children: ReactNode;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "onClick">;

export function IconButton({
  label,
  pressed,
  current = false,
  onClick,
  children,
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={current || pressed ? styles.active : styles.button}
      aria-label={label}
      aria-pressed={pressed}
      aria-current={current ? "page" : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
