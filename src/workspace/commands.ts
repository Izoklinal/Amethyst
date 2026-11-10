export type Shortcut = {
  /** Physical key, such as "KeyP" or "Tab". Ignores the active keyboard layout. */
  code: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
};

export type Command = {
  id: string;
  title: string;
  shortcut?: Shortcut;
  run: () => void;
};

export type CommandActions = {
  togglePrimarySidebar: () => void;
  toggleContextSidebar: () => void;
  toggleBottomPanel: () => void;
  toggleTheme: () => void;
  focusEditor: () => void;
  resetLayout: () => void;
  nextTab: () => void;
  previousTab: () => void;
  closeTab: () => void;
  openPalette: () => void;
  openVault: () => void;
  closeVault: () => void;
  newNote: () => void;
  newFolder: () => void;
  renameEntry: () => void;
  moveEntry: () => void;
  deleteEntry: () => void;
  saveNote: () => void;
};

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

function shortcutCodeLabel(code: string): string {
  if (code.startsWith("Key") && code.length === 4) {
    return code.slice(3);
  }
  if (code.startsWith("Digit") && code.length === 6) {
    return code.slice(5);
  }
  return code;
}

export function eventMatchesShortcut(
  event: KeyboardEvent,
  shortcut: Shortcut,
): boolean {
  return (
    event.code === shortcut.code &&
    event.ctrlKey === shortcut.ctrl &&
    event.altKey === shortcut.alt &&
    event.shiftKey === shortcut.shift
  );
}

export function createCommands(actions: CommandActions): Command[] {
  return [
    {
      id: "palette.open",
      title: "Show Command Palette",
      shortcut: { code: "KeyP", ctrl: true, shift: true, alt: false },
      run: actions.openPalette,
    },
    {
      id: "vault.open",
      title: "Open Vault",
      shortcut: { code: "KeyO", ctrl: true, shift: false, alt: false },
      run: actions.openVault,
    },
    {
      id: "vault.close",
      title: "Close Vault",
      run: actions.closeVault,
    },
    {
      id: "explorer.newNote",
      title: "New Note",
      run: actions.newNote,
    },
    {
      id: "explorer.newFolder",
      title: "New Folder",
      run: actions.newFolder,
    },
    {
      id: "explorer.rename",
      title: "Rename",
      run: actions.renameEntry,
    },
    {
      id: "explorer.move",
      title: "Move",
      run: actions.moveEntry,
    },
    {
      id: "explorer.delete",
      title: "Delete",
      run: actions.deleteEntry,
    },
    {
      id: "note.save",
      title: "Save Note",
      shortcut: { code: "KeyS", ctrl: true, shift: false, alt: false },
      run: actions.saveNote,
    },
    {
      id: "sidebar.primary.toggle",
      title: "Toggle Primary Sidebar",
      shortcut: { code: "KeyB", ctrl: true, shift: false, alt: false },
      run: actions.togglePrimarySidebar,
    },
    {
      id: "sidebar.context.toggle",
      title: "Toggle Context Sidebar",
      shortcut: { code: "KeyB", ctrl: true, shift: false, alt: true },
      run: actions.toggleContextSidebar,
    },
    {
      id: "panel.bottom.toggle",
      title: "Toggle Bottom Panel",
      shortcut: { code: "KeyJ", ctrl: true, shift: false, alt: false },
      run: actions.toggleBottomPanel,
    },
    {
      id: "theme.toggle",
      title: "Toggle Theme",
      run: actions.toggleTheme,
    },
    {
      id: "editor.focus",
      title: "Focus Editor",
      run: actions.focusEditor,
    },
    {
      id: "layout.reset",
      title: "Reset Layout",
      run: actions.resetLayout,
    },
    {
      id: "tab.next",
      title: "Next Tab",
      shortcut: { code: "Tab", ctrl: true, shift: false, alt: false },
      run: actions.nextTab,
    },
    {
      id: "tab.previous",
      title: "Previous Tab",
      shortcut: { code: "Tab", ctrl: true, shift: true, alt: false },
      run: actions.previousTab,
    },
    {
      id: "tab.close",
      title: "Close Tab",
      shortcut: { code: "KeyW", ctrl: true, shift: false, alt: false },
      run: actions.closeTab,
    },
  ];
}
