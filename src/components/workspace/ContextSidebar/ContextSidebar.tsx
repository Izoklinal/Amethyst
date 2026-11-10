import styles from "./ContextSidebar.module.css";

export function ContextSidebar() {
  return (
    <aside className={styles.sidebar} aria-label="Note context">
      <section>
        <h2 className={styles.title}>Outline</h2>
        <p className={styles.message}>Outline appears with a note.</p>
      </section>
      <section>
        <h2 className={styles.title}>Backlinks</h2>
        <p className={styles.message}>Backlinks appear with a note.</p>
      </section>
    </aside>
  );
}
