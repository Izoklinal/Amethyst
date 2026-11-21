export type KeyContext = "global" | "explorer" | "editor";

export type Shortcut = {
  /** Physical key, such as "KeyP" or "Tab". Ignores the active keyboard layout. */
  code: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
};

/** One or more shortcuts. A list longer than one is a sequence. */
export type Keybinding = {
  commandId: string;
  when: KeyContext;
  keys: Shortcut[];
};

export type KeyMatch =
  | { type: "run"; commandId: string }
  | { type: "prefix"; keys: Shortcut[] }
  | { type: "none" };

export const CHORD_TIMEOUT_MS = 1000;

const plain = { ctrl: false, shift: false, alt: false };

export const defaultKeybindings: Keybinding[] = [
  {
    commandId: "palette.open",
    when: "global",
    keys: [{ code: "KeyP", ctrl: true, shift: true, alt: false }],
  },
  {
    commandId: "note.find",
    when: "global",
    keys: [{ code: "KeyP", ctrl: true, shift: false, alt: false }],
  },
  {
    commandId: "vault.open",
    when: "global",
    keys: [{ code: "KeyO", ctrl: true, shift: false, alt: false }],
  },
  {
    commandId: "note.save",
    when: "global",
    keys: [{ code: "KeyS", ctrl: true, shift: false, alt: false }],
  },
  {
    commandId: "note.followLink",
    when: "editor",
    keys: [{ code: "Enter", ctrl: true, shift: false, alt: false }],
  },
  {
    commandId: "sidebar.primary.toggle",
    when: "global",
    keys: [{ code: "KeyB", ctrl: true, shift: false, alt: false }],
  },
  {
    commandId: "explorer.focus",
    when: "global",
    keys: [{ code: "KeyE", ctrl: true, shift: true, alt: false }],
  },
  {
    commandId: "editor.focus",
    when: "global",
    keys: [{ code: "Digit1", ctrl: true, shift: false, alt: false }],
  },
  {
    commandId: "sidebar.context.toggle",
    when: "global",
    keys: [{ code: "KeyB", ctrl: true, shift: false, alt: true }],
  },
  {
    commandId: "panel.bottom.toggle",
    when: "global",
    keys: [{ code: "KeyJ", ctrl: true, shift: false, alt: false }],
  },
  {
    commandId: "tab.next",
    when: "global",
    keys: [{ code: "Tab", ctrl: true, shift: false, alt: false }],
  },
  {
    commandId: "tab.next",
    when: "global",
    keys: [{ code: "PageDown", ctrl: true, shift: false, alt: false }],
  },
  {
    commandId: "tab.previous",
    when: "global",
    keys: [{ code: "Tab", ctrl: true, shift: true, alt: false }],
  },
  {
    commandId: "tab.previous",
    when: "global",
    keys: [{ code: "PageUp", ctrl: true, shift: false, alt: false }],
  },
  {
    commandId: "tab.close",
    when: "global",
    keys: [{ code: "KeyW", ctrl: true, shift: false, alt: false }],
  },
  { commandId: "explorer.next", when: "explorer", keys: [{ code: "ArrowDown", ...plain }] },
  { commandId: "explorer.previous", when: "explorer", keys: [{ code: "ArrowUp", ...plain }] },
  { commandId: "explorer.expand", when: "explorer", keys: [{ code: "ArrowRight", ...plain }] },
  { commandId: "explorer.collapse", when: "explorer", keys: [{ code: "ArrowLeft", ...plain }] },
  { commandId: "explorer.activate", when: "explorer", keys: [{ code: "Enter", ...plain }] },
];

export function shortcutLabel(shortcut: Shortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrl) {
    parts.push("Ctrl");
  }
  if (shortcut.alt) {
    parts.push("Alt");
  }
  if (shortcut.shift) {
    parts.push("Shift");
  }
  parts.push(shortcutCodeLabel(shortcut.code));
  return parts.join("+");
}

export function bindingLabel(keys: readonly Shortcut[]): string {
  return keys.map(shortcutLabel).join(" ");
}

export function labelForCommand(
  commandId: string,
  bindings: readonly Keybinding[] = defaultKeybindings,
): string | null {
  const binding = bindings.find((item) => item.commandId === commandId);
  return binding ? bindingLabel(binding.keys) : null;
}

export function shortcutFromEvent(event: KeyboardEvent): Shortcut | null {
  if (
    event.code === "ControlLeft" ||
    event.code === "ControlRight" ||
    event.code === "ShiftLeft" ||
    event.code === "ShiftRight" ||
    event.code === "AltLeft" ||
    event.code === "AltRight" ||
    event.code === "MetaLeft" ||
    event.code === "MetaRight"
  ) {
    return null;
  }
  return {
    code: event.code,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
  };
}

export function matchKeybinding(
  bindings: readonly Keybinding[],
  context: KeyContext,
  pending: readonly Shortcut[],
  pendingAt: number | null,
  now: number,
  next: Shortcut,
): KeyMatch {
  const pendingActive =
    pendingAt !== null && now - pendingAt <= CHORD_TIMEOUT_MS ? pending : [];
  const sequence = [...pendingActive, next];
  const applicable = bindings.filter(
    (binding) => binding.when === context || binding.when === "global",
  );
  const exact = applicable.filter((binding) => keysEqual(binding.keys, sequence));
  const best = preferContext(exact, context);
  if (best) {
    return { type: "run", commandId: best.commandId };
  }
  const continues = applicable.some(
    (binding) =>
      binding.keys.length > sequence.length && startsWith(binding.keys, sequence),
  );
  if (continues) {
    return { type: "prefix", keys: sequence };
  }
  if (pendingActive.length > 0) {
    return matchKeybinding(bindings, context, [], null, now, next);
  }
  return { type: "none" };
}

function preferContext(bindings: Keybinding[], context: KeyContext): Keybinding | undefined {
  return bindings.find((binding) => binding.when === context) ?? bindings[0];
}

function keysEqual(left: readonly Shortcut[], right: readonly Shortcut[]): boolean {
  return left.length === right.length && left.every((shortcut, index) => sameShortcut(shortcut, right[index]));
}

function startsWith(keys: readonly Shortcut[], prefix: readonly Shortcut[]): boolean {
  return prefix.every((shortcut, index) => sameShortcut(shortcut, keys[index]));
}

function sameShortcut(left: Shortcut, right: Shortcut | undefined): boolean {
  return (
    right !== undefined &&
    left.code === right.code &&
    left.ctrl === right.ctrl &&
    left.alt === right.alt &&
    left.shift === right.shift
  );
}

function shortcutCodeLabel(code: string): string {
  if (code.startsWith("Key") && code.length === 4) {
    return code.slice(3);
  }
  if (code.startsWith("Digit") && code.length === 6) {
    return code.slice(5);
  }
  return code;
}
