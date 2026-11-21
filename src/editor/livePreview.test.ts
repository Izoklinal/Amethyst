import assert from "node:assert/strict";
import { test } from "node:test";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { previewDecorations } from "./livePreview.ts";

function hiddenRanges(decorations: DecorationSet): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  decorations.between(0, 1_000_000, (from, to, decoration) => {
    if (to > from && !decoration.spec.class) {
      ranges.push([from, to]);
    }
  });
  return ranges;
}

function stateFor(doc: string, anchor: number): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor },
    extensions: [markdown()],
  });
}

test("a heading mark is hidden until the cursor is on its line", () => {
  const doc = "# Title\n\nbody";
  const away = previewDecorations(stateFor(doc, doc.length));
  assert.deepEqual(hiddenRanges(away), [[0, 1]]);
  const onHeading = previewDecorations(stateFor(doc, 2));
  assert.deepEqual(hiddenRanges(onHeading), []);
});

test("emphasis marks are hidden while the cursor is outside them", () => {
  const doc = "say *word* please";
  const hidden = hiddenRanges(previewDecorations(stateFor(doc, 0)));
  assert.deepEqual(hidden, [
    [doc.indexOf("*"), doc.indexOf("*") + 1],
    [doc.lastIndexOf("*"), doc.lastIndexOf("*") + 1],
  ]);
});

test("a bullet marker is replaced until the cursor is on its line", () => {
  const doc = "- item\n\nafter";
  assert.deepEqual(hiddenRanges(previewDecorations(stateFor(doc, doc.length))), [[0, 1]]);
  assert.deepEqual(hiddenRanges(previewDecorations(stateFor(doc, 2))), []);
});

test("a quote mark is hidden until the cursor is on its line", () => {
  const doc = "> said\n\nafter";
  assert.deepEqual(hiddenRanges(previewDecorations(stateFor(doc, doc.length))), [[0, 1]]);
  assert.deepEqual(hiddenRanges(previewDecorations(stateFor(doc, 2))), []);
});

test("inline code marks are hidden while the cursor is outside them", () => {
  const doc = "say `code` please";
  const hidden = hiddenRanges(previewDecorations(stateFor(doc, 0)));
  assert.deepEqual(hidden, [
    [doc.indexOf("`"), doc.indexOf("`") + 1],
    [doc.lastIndexOf("`"), doc.lastIndexOf("`") + 1],
  ]);
});

test("an ordered list marker stays visible", () => {
  const doc = "1. item\n\nafter";
  const hidden = hiddenRanges(previewDecorations(stateFor(doc, doc.length)));
  assert.equal(
    hidden.some(([from, to]) => from === 0 && to > 0),
    false,
  );
});

test("a hash inside code is not treated as a heading mark", () => {
  const doc = "```\n# Hidden\n```\n";
  const hash = doc.indexOf("#");
  const hidden = hiddenRanges(previewDecorations(stateFor(doc, doc.length)));
  assert.equal(
    hidden.some(([from, to]) => hash >= from && hash < to),
    false,
  );
});
