import assert from "node:assert/strict";
import { test } from "node:test";
import { noteLinkPath } from "./noteLink.ts";

test("a markdown link target becomes a vault note path", () => {
  assert.equal(noteLinkPath("Notes/A.md", "B.md"), "Notes/B.md");
  assert.equal(noteLinkPath("Notes/A.md", "../Other"), "Other.md");
  assert.equal(noteLinkPath("A.md", "/Vault/Note.md"), "Vault/Note.md");
  assert.equal(noteLinkPath("A.md", "https://example.com"), null);
  assert.equal(noteLinkPath("A.md", "../.."), null);
});
