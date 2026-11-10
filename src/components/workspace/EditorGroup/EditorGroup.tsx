import type { EditorGroup as EditorGroupModel } from "../../../workspace/editorGroup";
import { IconButton } from "../../ui/IconButton/IconButton";
import { CheckIcon, CloseIcon, DiscardIcon } from "../../ui/icons";
import { EditorTab } from "../EditorTab/EditorTab";
import styles from "./EditorGroup.module.css";

type EditorGroupProps = {
  group: EditorGroupModel;
  text: string | null;
  dirtyTabIds: ReadonlySet<string>;
  pendingTitle: string | null;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onChange: (text: string) => void;
  onSaveClose: () => void;
  onDiscardClose: () => void;
  onCancelClose: () => void;
};

export function EditorGroup({
  group,
  text,
  dirtyTabIds,
  pendingTitle,
  onActivate,
  onClose,
  onChange,
  onSaveClose,
  onDiscardClose,
  onCancelClose,
}: EditorGroupProps) {
  return (
    <section className={styles.group} aria-label="Editor group">
      <div className={styles.tabs} role="tablist" aria-label="Open notes">
        {group.tabs.map((tab) => (
          <EditorTab
            key={tab.id}
            tab={tab}
            active={tab.id === group.activeTabId}
            dirty={dirtyTabIds.has(tab.id)}
            onActivate={() => onActivate(tab.id)}
            onClose={() => onClose(tab.id)}
          />
        ))}
      </div>
      {pendingTitle ? (
        <div className={styles.confirm} role="alertdialog" aria-label="Unsaved changes">
          <p className={styles.confirmText}>Save changes to {pendingTitle}?</p>
          <div className={styles.confirmActions}>
            <IconButton label="Save" onClick={onSaveClose}>
              <CheckIcon />
            </IconButton>
            <IconButton label="Don't save" onClick={onDiscardClose}>
              <DiscardIcon />
            </IconButton>
            <IconButton label="Cancel" onClick={onCancelClose}>
              <CloseIcon />
            </IconButton>
          </div>
        </div>
      ) : null}
      <div className={styles.body}>
        {text === null ? (
          <p className={styles.empty}>No note open.</p>
        ) : (
          <textarea
            className={styles.editor}
            value={text}
            spellCheck={false}
            aria-label="Note text"
            data-note-editor="true"
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </div>
    </section>
  );
}
