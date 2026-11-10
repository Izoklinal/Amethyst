import { useRef, type PointerEvent } from "react";
import styles from "./Resizer.module.css";

type ResizerProps = {
  label: string;
  onDrag: (deltaX: number) => void;
  onDragEnd: () => void;
};

export function Resizer({ label, onDrag, onDragEnd }: ResizerProps) {
  const lastX = useRef(0);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    lastX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }
    const delta = event.clientX - lastX.current;
    lastX.current = event.clientX;
    if (delta !== 0) {
      onDrag(delta);
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    onDragEnd();
  }

  return (
    <div
      className={styles.resizer}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}
