import assert from "node:assert/strict";
import { test } from "node:test";
import { readDocument } from "./reading.ts";

test("reading keeps frontmatter, headings, tasks, links, embeds and callouts", () => {
  const text = [
    "---",
    "title: Keep",
    "---",
    "",
    "# Title",
    "",
    "- [x] Done [[Note|Alias]]",
    "",
    "[Site](https://example.com)",
    "",
    "![[Picture.png]]",
    "",
    "> [!tip] Look",
    "> inside",
    "",
    "```",
    "code",
    "```",
    "",
  ].join("\n");
  const blocks = readDocument(text);
  assert.equal(blocks[0]?.kind, "frontmatter");
  if (blocks[0]?.kind === "frontmatter") {
    assert.match(blocks[0].text, /title: Keep/);
  }
  assert.equal(blocks[1]?.kind, "heading");
  const list = blocks.find((block) => block.kind === "list");
  assert.ok(list && list.kind === "list");
  if (list?.kind === "list") {
    assert.equal(list.items[0]?.task?.checked, true);
    assert.equal(text[list.items[0]?.task?.at ?? 0], "[");
    assert.equal(list.items[0]?.inlines.some((inline) => inline.kind === "wikilink" && inline.label === "Alias"), true);
  }
  const paragraph = blocks.find((block) => block.kind === "paragraph");
  assert.ok(paragraph && paragraph.kind === "paragraph");
  if (paragraph?.kind === "paragraph") {
    assert.deepEqual(paragraph.inlines[0], { kind: "link", label: "Site", url: "https://example.com" });
  }
  const callout = blocks.find((block) => block.kind === "callout");
  assert.ok(callout && callout.kind === "callout");
  if (callout?.kind === "callout") {
    assert.equal(callout.type, "tip");
    assert.equal(callout.title, "Look");
    assert.equal(text[callout.brace], "]");
  }
  const code = blocks.find((block) => block.kind === "code");
  assert.ok(code && code.kind === "code" && code.text === "code");
  assert.equal(
    blocks.some((block) => block.kind === "paragraph" && block.inlines.some((inline) => inline.kind === "embed")),
    true,
  );
});

test("a trailing block id is a separate label", () => {
  const blocks = readDocument("текст ^идея\n\n# Title ^idea\n");
  const paragraph = blocks.find((block) => block.kind === "paragraph");
  assert.ok(paragraph && paragraph.kind === "paragraph");
  if (paragraph?.kind === "paragraph") {
    assert.deepEqual(paragraph.inlines, [
      { kind: "text", text: "текст" },
      { kind: "blockId", id: "идея" },
    ]);
  }
  const heading = blocks.find((block) => block.kind === "heading");
  assert.ok(heading && heading.kind === "heading");
  if (heading?.kind === "heading") {
    assert.equal(heading.text, "Title");
    assert.equal(heading.blockId, "idea");
  }
});
