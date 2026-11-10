import type { EditorGroup as EditorGroupModel } from "../../../workspace/editorGroup";
import { EditorTab } from "../EditorTab/EditorTab";
import styles from "./EditorGroup.module.css";

type EditorGroupProps = {
  group: EditorGroupModel;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
};

export function EditorGroup({ group, onActivate, onClose }: EditorGroupProps) {
  return (
    <section className={styles.group} aria-label="Editor group">
      <div className={styles.tabs} role="tablist" aria-label="Open notes">
        {group.tabs.map((tab) => (
          <EditorTab
            key={tab.id}
            tab={tab}
            active={tab.id === group.activeTabId}
            onActivate={() => onActivate(tab.id)}
            onClose={() => onClose(tab.id)}
          />
        ))}
      </div>
      <div className={styles.body}>
        <p className={styles.empty}>No note open.</p>
      </div>
    </section>
  );
}
