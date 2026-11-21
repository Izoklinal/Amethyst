import assert from "node:assert/strict";
import { test } from "node:test";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import {
  calloutLine,
  markdownLinkParts,
  previewDecorations,
  taskOnLine,
  visibleWikilinkLabel,
} from "./livePreview.ts";

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

test("a task marker is a checkbox until the cursor is on its line", () => {
  assert.deepEqual(taskOnLine("- [ ] item"), { from: 0, to: 5, boxFrom: 2, checked: false });
  assert.deepEqual(taskOnLine("- [x] item"), { from: 0, to: 5, boxFrom: 2, checked: true });
  assert.equal(taskOnLine("- item"), null);
  const doc = "- [ ] item\n\nafter";
  assert.deepEqual(hiddenRanges(previewDecorations(stateFor(doc, doc.length))), [[0, 5]]);
  assert.deepEqual(hiddenRanges(previewDecorations(stateFor(doc, 2))), []);
  const fenced = "```\n- [ ] hidden\n```\n";
  const open = fenced.indexOf("- [ ]");
  const hidden = hiddenRanges(previewDecorations(stateFor(fenced, fenced.length)));
  assert.equal(
    hidden.some(([from, to]) => open >= from && open < to),
    false,
  );
});

test("a markdown link hides its address until the cursor is inside it", () => {
  assert.deepEqual(markdownLinkParts("[Текст](https://example.com)"), {
    label: "Текст",
    url: "https://example.com",
  });
  const doc = "See [Текст](https://example.com) now";
  const open = doc.indexOf("[");
  const close = doc.indexOf(")") + 1;
  assert.deepEqual(hiddenRanges(previewDecorations(stateFor(doc, 0))), [[open, close]]);
  assert.deepEqual(hiddenRanges(previewDecorations(stateFor(doc, open + 1))), []);
  const fenced = "```\n[Hidden](https://example.com)\n```\n";
  const inside = fenced.indexOf("[");
  const hidden = hiddenRanges(previewDecorations(stateFor(fenced, 0)));
  assert.equal(
    hidden.some(([from, to]) => inside >= from && inside < to),
    false,
  );
});

test("a callout hides its marks until the cursor is inside the block", () => {
  assert.equal(calloutLine("> [!warning]- Title")?.type, "warning");
  assert.equal(calloutLine("> [!warning]- Title")?.fold, "-");
  assert.equal(calloutLine("> said"), null);
  const doc = "> [!warning] Title\n> body\n\nafter";
  const hidden = hiddenRanges(previewDecorations(stateFor(doc, doc.length)));
  assert.equal(hidden.some(([from]) => from === 0), true);
  assert.equal(hidden.some(([from]) => from === doc.indexOf("> body")), true);
  assert.deepEqual(hiddenRanges(previewDecorations(stateFor(doc, 4))), []);
  const fenced = "```\n> [!warning] Title\n```\n";
  const inside = fenced.indexOf(">");
  const fencedHidden = hiddenRanges(previewDecorations(stateFor(fenced, fenced.length)));
  assert.equal(
    fencedHidden.some(([from, to]) => inside >= from && inside < to),
    false,
  );
});

test("an embed is hidden until the cursor is inside it", () => {
  const doc = "See ![[Заметка#Глава]] now";
  const open = doc.indexOf("![[");
  const close = doc.indexOf("]]") + 2;
  assert.deepEqual(hiddenRanges(previewDecorations(stateFor(doc, 0))), [[open, close]]);
  assert.deepEqual(hiddenRanges(previewDecorations(stateFor(doc, open + 3))), []);
  const fenced = "```\n![[Hidden]]\n```\n";
  const inside = fenced.indexOf("![[");
  const hidden = hiddenRanges(previewDecorations(stateFor(fenced, 0)));
  assert.equal(
    hidden.some(([from, to]) => inside >= from && inside < to),
    false,
  );
});

test("a wikilink shows its alias, or the target when the alias is missing", () => {
  assert.equal(visibleWikilinkLabel("[[Файл#Глава|Имя]]"), "Имя");
  assert.equal(visibleWikilinkLabel("[[Файл#Глава]]"), "Файл#Глава");
  assert.equal(visibleWikilinkLabel("[[Файл#Глава|]]"), "Файл#Глава");
  assert.equal(visibleWikilinkLabel("[[|только подпись]]"), null);
});

test("a wikilink is hidden until the cursor is inside it", () => {
  const doc = "See [[Файл#Глава|Имя]] now";
  const open = doc.indexOf("[[");
  const close = doc.indexOf("]]") + 2;
  assert.deepEqual(hiddenRanges(previewDecorations(stateFor(doc, 0))), [[open, close]]);
  assert.deepEqual(hiddenRanges(previewDecorations(stateFor(doc, open + 2))), []);
});

test("a wikilink inside code is left unchanged", () => {
  const fenced = "```\n[[Hidden]]\n```\n";
  const inline = "before `[[Hidden]]` after";
  for (const doc of [fenced, inline]) {
    const open = doc.indexOf("[[");
    const hidden = hiddenRanges(previewDecorations(stateFor(doc, 0)));
    assert.equal(
      hidden.some(([from, to]) => open >= from && open < to),
      false,
    );
  }
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
