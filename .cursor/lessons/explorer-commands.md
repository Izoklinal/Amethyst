# Explorer commands and chrome

## Commands and shortcuts are separate

A command is `id`, `title`, and `run`. A keybinding points at a command id, names the focus context (`global`, `explorer`, or `editor`), and stores a list of physical shortcuts. The list can be longer than one key so a sequence can be added by editing the table. The default table uses single keys.

Matching uses `KeyboardEvent.code` plus the exact ctrl, alt, and shift state. A focused context wins over `global` for the same keys. A sequence prefix is kept for one second and must be swallowed so it is not typed into a field. Arrow keys for the explorer are bound only in the `explorer` context, so they still move the caret in the note.

Do not put a shortcut back onto the command object. The palette and the context menu read the label from the keybinding table.

## Tooltips cannot live inside overflow

A `::after` tooltip is clipped by any ancestor with `overflow` other than `visible`. The editor and the sidebar both clip. `z-index` does not escape that. Render the tooltip with a portal to `document.body`, `position: fixed`, and `--z-tooltip`.

## The browser menu and text selection

The workbench is an application shell. Call `preventDefault` on `contextmenu` for the shell and open `ContextMenu` with command ids for the place that was clicked. The note editor still needs Cut, Copy, Paste, and Select All, because the browser menu is gone.

`user-select: none` belongs on the shell. Put `user-select: text` back on the note textarea, text inputs, and error text. Otherwise the note cannot be selected.

## Long explorer names

The sidebar must not scroll horizontally. Keep `overflow-x: hidden`, `min-width: 0`, and one-line `text-overflow: ellipsis` on each row. The user widens the sidebar to read a deeply nested name. Vertical scrolling stays.

## Toolbar buttons are optional views

Hiding New Note or New Folder stores the command id in `localStorage` under `amethyst-toolbar-hidden`. It does not remove the command. The command stays in the palette and in the folder menu. Right-click a button to hide it. Right-click empty explorer space to show it again.
