import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

type IconButtonProps = {
  label: string;
  pressed?: boolean;
  current?: boolean;
  children: ReactNode;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled" | "type">;

export function IconButton({
  label,
  pressed,
  current = false,
  onClick,
  disabled = false,
  type = "button",
  children,
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={current || pressed ? styles.active : styles.button}
      aria-label={label}
      aria-pressed={pressed}
      aria-current={current ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
