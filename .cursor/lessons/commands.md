# Commands are the application

Every interface action is a command: an `id`, a `title`, and `run`. A shortcut is not part of the command. It is a separate row in the keybinding table that points at a command id.

The table uses the physical `KeyboardEvent.code` and the exact ctrl, alt, and shift state, so the binding does not depend on the keyboard layout. One command may have several rows. A button, a context menu, and the command palette all call that same `run`.

Do not implement a new behavior only as a key listener inside a component. Add the command first, then add or change its binding in the table. That is what keeps the shortcuts replaceable.

Focus commands are global, so they work while the note editor is focused. Explorer movement keys stay in the `explorer` context, so arrows still move the caret in the note.
