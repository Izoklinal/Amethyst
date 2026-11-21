import {
  cloneElement,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import styles from "./Tooltip.module.css";

type TooltipChildProps = {
  onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (event: MouseEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
};

type TooltipProps = {
  label: string;
  children: ReactElement<TooltipChildProps>;
};

const HOVER_DELAY_MS = 400;

export function Tooltip({ label, children }: TooltipProps) {
  const [box, setBox] = useState<DOMRect | null>(null);
  const timer = useRef<number | null>(null);

  function show(target: HTMLElement) {
    clearTimer();
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : HOVER_DELAY_MS;
    timer.current = window.setTimeout(() => {
      setBox(target.getBoundingClientRect());
    }, delay);
  }

  function hide() {
    clearTimer();
    setBox(null);
  }

  function clearTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  const placeBelow = box ? box.bottom + 32 < window.innerHeight : true;
  const center = box ? box.left + box.width / 2 : 0;
  const left = Math.min(Math.max(center, 8), window.innerWidth - 8);

  return (
    <>
      {cloneElement(children, {
        onMouseEnter: (event) => {
          children.props.onMouseEnter?.(event);
          show(event.currentTarget);
        },
        onMouseLeave: (event) => {
          children.props.onMouseLeave?.(event);
          hide();
        },
        onFocus: (event) => {
          children.props.onFocus?.(event);
          show(event.currentTarget);
        },
        onBlur: (event) => {
          children.props.onBlur?.(event);
          hide();
        },
      })}
      {box
        ? createPortal(
            <div
              className={styles.tooltip}
              role="tooltip"
              style={{
                left,
                top: placeBelow ? box.bottom + 4 : box.top - 4,
                transform: placeBelow ? "translateX(-50%)" : "translate(-50%, -100%)",
              }}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
