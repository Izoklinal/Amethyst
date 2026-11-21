import assert from "node:assert/strict";
import { test } from "node:test";
import { pickerItems, type QuickCommand, type QuickNote } from "./quickOpen.ts";

const notes: QuickNote[] = [
  { path: "Notes/Alpha.md", name: "Alpha.md" },
  { path: "Notes/Alpine.md", name: "Alpine.md" },
  { path: "Beta.md", name: "Beta.md" },
];

const commands: QuickCommand[] = [
  { id: "note.save", title: "Save Note" },
  { id: "palette.open", title: "Show Command Palette" },
  { id: "toolbar.hide", title: "Hide" },
  { id: "note.find", title: "Find Note" },
];

test("an empty query lists every note, frequent ones first", () => {
  const items = pickerItems("", notes, commands, { "Beta.md": 3, "Notes/Alpine.md": 1 });
  assert.deepEqual(
    items.map((item) => (item.kind === "note" ? item.note.path : item.command.id)),
    ["Beta.md", "Notes/Alpine.md", "Notes/Alpha.md"],
  );
});

test("a typed name keeps match order and uses frequency inside one rank", () => {
  const items = pickerItems("alp", notes, commands, { "Notes/Alpine.md": 4 });
  assert.deepEqual(
    items.map((item) => (item.kind === "note" ? item.note.path : "")),
    ["Notes/Alpine.md", "Notes/Alpha.md"],
  );
});

test("a leading > searches commands and hides internal ones", () => {
  const all = pickerItems(">", notes, commands, {});
  assert.deepEqual(
    all.map((item) => (item.kind === "command" ? item.command.title : item.note.path)),
    ["Save Note", "Find Note"],
  );
  const saved = pickerItems(">save", notes, commands, {});
  assert.deepEqual(
    saved.map((item) => (item.kind === "command" ? item.command.id : "")),
    ["note.save"],
  );
});
