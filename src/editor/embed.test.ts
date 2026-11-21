import assert from "node:assert/strict";
import { test } from "node:test";
import { embedLabel, headingSection } from "./embed.ts";

test("an embed label keeps the file and heading and drops the alias", () => {
  assert.equal(embedLabel("Заметка#Глава|100"), "Заметка#Глава");
  assert.equal(embedLabel("картинка.png"), "картинка.png");
  assert.equal(embedLabel("|только подпись"), null);
});

test("a heading section stops at the next heading of the same level", () => {
  const text = "# One\nalpha\n## Two\nbeta\n# Three\nend";
  const headings = [
    { level: 1, text: "One", offset: 0 },
    { level: 2, text: "Two", offset: text.indexOf("##") },
    { level: 1, text: "Three", offset: text.indexOf("# Three") },
  ];
  assert.equal(headingSection(text, headings, "Two"), "## Two\nbeta\n");
  assert.equal(headingSection(text, headings, "Missing"), null);
});
