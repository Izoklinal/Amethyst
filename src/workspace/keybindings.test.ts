import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultKeybindings,
  matchKeybinding,
  type Keybinding,
  type Shortcut,
} from "./keybindings.ts";

const closeTab: Shortcut = { code: "KeyW", ctrl: true, shift: false, alt: false };
const down: Shortcut = { code: "ArrowDown", ctrl: false, shift: false, alt: false };

test("matches the physical key and the exact modifiers", () => {
  const match = matchKeybinding(defaultKeybindings, "editor", [], null, 0, closeTab);
  assert.equal(match.type, "run");
  if (match.type === "run") {
    assert.equal(match.commandId, "tab.close");
  }
  const shifted = matchKeybinding(
    defaultKeybindings,
    "editor",
    [],
    null,
    0,
    { ...closeTab, shift: true },
  );
  assert.equal(shifted.type, "none");
});

test("a focused context wins over the same global shortcut", () => {
  const bindings: Keybinding[] = [
    { commandId: "global-down", when: "global", keys: [down] },
    { commandId: "explorer-down", when: "explorer", keys: [down] },
  ];
  const inExplorer = matchKeybinding(bindings, "explorer", [], null, 0, down);
  const inEditor = matchKeybinding(bindings, "editor", [], null, 0, down);
  assert.deepEqual(inExplorer, { type: "run", commandId: "explorer-down" });
  assert.deepEqual(inEditor, { type: "run", commandId: "global-down" });
});

test("explorer arrows do not match while the editor is focused", () => {
  const match = matchKeybinding(defaultKeybindings, "editor", [], null, 0, down);
  assert.equal(match.type, "none");
});

test("a key sequence stays pending and expires", () => {
  const first: Shortcut = { code: "KeyX", ctrl: true, shift: false, alt: false };
  const second: Shortcut = { code: "KeyF", ctrl: false, shift: false, alt: false };
  const bindings: Keybinding[] = [
    { commandId: "open-file", when: "global", keys: [first, second] },
  ];
  const prefix = matchKeybinding(bindings, "global", [], null, 0, first);
  assert.equal(prefix.type, "prefix");
  if (prefix.type !== "prefix") {
    return;
  }
  const completed = matchKeybinding(bindings, "global", prefix.keys, 0, 500, second);
  assert.deepEqual(completed, { type: "run", commandId: "open-file" });
  const expired = matchKeybinding(bindings, "global", prefix.keys, 0, 1001, second);
  assert.equal(expired.type, "none");
});
