import styles from "./BottomPanel.module.css";

export function BottomPanel() {
  return (
    <section className={styles.panel} aria-label="Panel">
      <p className={styles.message}>No messages.</p>
    </section>
  );
}
