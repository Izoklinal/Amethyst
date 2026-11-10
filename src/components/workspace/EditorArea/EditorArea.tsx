import type { ReactNode } from "react";
import styles from "./EditorArea.module.css";

type EditorAreaProps = {
  children: ReactNode;
};

export function EditorArea({ children }: EditorAreaProps) {
  return (
    <div
      id="editor-area"
      className={styles.area}
      tabIndex={-1}
      aria-label="Editor"
    >
      {children}
    </div>
  );
}
