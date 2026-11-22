export type Command = {
  id: string;
  title: string;
  run: () => void;
};

export type CommandActions = {
  togglePrimarySidebar: () => void;
  toggleContextSidebar: () => void;
  toggleBottomPanel: () => void;
  toggleTheme: () => void;
  focusEditor: () => void;
  focusExplorer: () => void;
  resetLayout: () => void;
  nextTab: () => void;
  previousTab: () => void;
  activateTab: () => void;
  closeTab: () => void;
  openPalette: () => void;
  findNote: () => void;
  openVault: () => void;
  closeVault: () => void;
  newNote: () => void;
  newFolder: () => void;
  renameEntry: () => void;
  moveEntry: () => void;
  deleteEntry: () => void;
  openEntry: () => void;
  nextExplorer: () => void;
  previousExplorer: () => void;
  expandExplorer: () => void;
  collapseExplorer: () => void;
  activateExplorer: () => void;
  saveNote: () => void;
  followLink: () => void;
  toggleTask: () => void;
  openLink: () => void;
  openEmbed: () => void;
  toggleCallout: () => void;
  toggleReading: () => void;
  toggleSource: () => void;
  revealHeading: () => void;
  cutNote: () => void;
  copyNote: () => void;
  pasteNote: () => void;
  selectAllNote: () => void;
  hideToolbarButton: () => void;
  showToolbarButton: () => void;
};

export function createCommands(actions: CommandActions): Command[] {
  return [
    { id: "palette.open", title: "Show Command Palette", run: actions.openPalette },
    { id: "note.find", title: "Find Note", run: actions.findNote },
    { id: "vault.open", title: "Open Vault", run: actions.openVault },
    { id: "vault.close", title: "Close Vault", run: actions.closeVault },
    { id: "explorer.newNote", title: "New Note", run: actions.newNote },
    { id: "explorer.newFolder", title: "New Folder", run: actions.newFolder },
    { id: "explorer.open", title: "Open", run: actions.openEntry },
    { id: "explorer.rename", title: "Rename", run: actions.renameEntry },
    { id: "explorer.move", title: "Move", run: actions.moveEntry },
    { id: "explorer.delete", title: "Delete", run: actions.deleteEntry },
    { id: "explorer.next", title: "Select Next", run: actions.nextExplorer },
    { id: "explorer.previous", title: "Select Previous", run: actions.previousExplorer },
    { id: "explorer.expand", title: "Expand Folder", run: actions.expandExplorer },
    { id: "explorer.collapse", title: "Collapse Folder", run: actions.collapseExplorer },
    { id: "explorer.activate", title: "Activate Explorer Item", run: actions.activateExplorer },
    { id: "explorer.focus", title: "Focus Explorer", run: actions.focusExplorer },
    { id: "note.save", title: "Save Note", run: actions.saveNote },
    { id: "note.followLink", title: "Follow Link", run: actions.followLink },
    { id: "note.toggleTask", title: "Toggle Task", run: actions.toggleTask },
    { id: "note.openLink", title: "Open Link", run: actions.openLink },
    { id: "note.openEmbed", title: "Open Embed", run: actions.openEmbed },
    { id: "note.toggleCallout", title: "Toggle Callout", run: actions.toggleCallout },
    { id: "note.toggleReading", title: "Toggle Reading Mode", run: actions.toggleReading },
    { id: "note.toggleSource", title: "Toggle Source Mode", run: actions.toggleSource },
    { id: "note.revealHeading", title: "Reveal Heading", run: actions.revealHeading },
    { id: "note.cut", title: "Cut", run: actions.cutNote },
    { id: "note.copy", title: "Copy", run: actions.copyNote },
    { id: "note.paste", title: "Paste", run: actions.pasteNote },
    { id: "note.selectAll", title: "Select All", run: actions.selectAllNote },
    { id: "toolbar.hide", title: "Hide", run: actions.hideToolbarButton },
    { id: "toolbar.show", title: "Show", run: actions.showToolbarButton },
    { id: "sidebar.primary.toggle", title: "Toggle Primary Sidebar", run: actions.togglePrimarySidebar },
    { id: "sidebar.context.toggle", title: "Toggle Context Sidebar", run: actions.toggleContextSidebar },
    { id: "panel.bottom.toggle", title: "Toggle Bottom Panel", run: actions.toggleBottomPanel },
    { id: "theme.toggle", title: "Toggle Theme", run: actions.toggleTheme },
    { id: "editor.focus", title: "Focus Editor", run: actions.focusEditor },
    { id: "layout.reset", title: "Reset Layout", run: actions.resetLayout },
    { id: "tab.next", title: "Next Tab", run: actions.nextTab },
    { id: "tab.previous", title: "Previous Tab", run: actions.previousTab },
    { id: "tab.activate", title: "Activate Tab", run: actions.activateTab },
    { id: "tab.close", title: "Close Tab", run: actions.closeTab },
  ];
}
