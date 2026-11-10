import { IconButton } from "../../ui/IconButton/IconButton";
import { CloseIcon } from "../../ui/icons";
import type { EditorTab as EditorTabModel } from "../../../workspace/editorGroup";
import styles from "./EditorTab.module.css";

type EditorTabProps = {
  tab: EditorTabModel;
  active: boolean;
  dirty: boolean;
  onActivate: () => void;
  onClose: () => void;
};

export function EditorTab({ tab, active, dirty, onActivate, onClose }: EditorTabProps) {
  return (
    <div className={active ? styles.active : styles.tab}>
      <button type="button" className={styles.label} onClick={onActivate}>
        {dirty ? <span className={styles.dirty} aria-hidden="true" /> : null}
        {tab.title}
      </button>
      <IconButton
        label={`Close ${tab.title}`}
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <CloseIcon />
      </IconButton>
    </div>
  );
}
