import { parser } from "@lezer/markdown";
import type { SyntaxNode } from "@lezer/common";
import { embedLabel } from "./embed.ts";
import { frontmatterRange } from "./frontmatter.ts";
import { blockIdOnLine, calloutLine, taskOnLine, visibleWikilinkLabel } from "./livePreview.ts";

export { frontmatterRange };

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "emphasis"; text: string }
  | { kind: "link"; label: string; url: string }
  | { kind: "wikilink"; label: string; at: number }
  | { kind: "embed"; body: string; label: string }
  | { kind: "blockId"; id: string };

export type ReadingBlock =
  | { kind: "frontmatter"; text: string }
  | { kind: "heading"; level: number; text: string; blockId?: string }
  | { kind: "paragraph"; inlines: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "list"; items: ReadingItem[] }
  | { kind: "quote"; blocks: ReadingBlock[] }
  | {
      kind: "callout";
      type: string;
      title: string;
      fold: "" | "+" | "-";
      brace: number;
      blocks: ReadingBlock[];
    };

export type ReadingItem = {
  task: { checked: boolean; at: number } | null;
  inlines: Inline[];
};

/** A read-only structure of the note. It does not change the source text. */
export function readDocument(text: string): ReadingBlock[] {
  const blocks: ReadingBlock[] = [];
  const frontmatter = frontmatterRange(text);
  if (frontmatter) {
    blocks.push({ kind: "frontmatter", text: text.slice(frontmatter.from, frontmatter.to).trimEnd() });
  }
  const tree = parser.parse(text);
  let child = tree.topNode.firstChild;
  while (child) {
    if (!frontmatter || child.from >= frontmatter.to) {
      const block = readBlock(text, child);
      if (block) {
        blocks.push(block);
      }
    }
    child = child.nextSibling;
  }
  return blocks;
}

function readBlock(text: string, node: SyntaxNode): ReadingBlock | null {
  if (/^ATXHeading[1-6]$/.test(node.name) || /^SetextHeading[12]$/.test(node.name)) {
    const heading = headingText(text, node);
    const blockId = blockIdOnLine(heading);
    return {
      kind: "heading",
      level: Number(node.name.slice(-1)),
      text: blockId ? heading.slice(0, blockId.from).replace(/[ \t]+$/u, "") : heading,
      blockId: blockId?.id,
    };
  }
  if (node.name === "FencedCode" || node.name === "CodeBlock") {
    return { kind: "code", text: codeText(text, node) };
  }
  if (node.name === "BulletList" || node.name === "OrderedList") {
    return { kind: "list", items: listItems(text, node) };
  }
  if (node.name === "Blockquote") {
    return readQuote(text, node);
  }
  if (node.name === "Paragraph") {
    const source = text.slice(node.from, node.to).trim();
    const embed = /^!\[\[([\s\S]*)\]\]$/.exec(source);
    const embedText = embed?.[1];
    const label = embedText ? embedLabel(embedText) : null;
    if (embedText && label) {
      return { kind: "paragraph", inlines: [{ kind: "embed", body: embedText, label }] };
    }
    return { kind: "paragraph", inlines: inlinesOf(text, node) };
  }
  return null;
}

function readQuote(text: string, node: SyntaxNode): ReadingBlock {
  const raw = text.slice(node.from, node.to);
  const newline = raw.indexOf("\n");
  const first = newline === -1 ? raw : raw.slice(0, newline);
  const parsed = calloutLine(first);
  if (!parsed) {
    return { kind: "quote", blocks: quoteBlocks(text, node) };
  }
  const body = newline === -1 ? "" : raw.slice(newline + 1).replace(/^> ?/gm, "").trim();
  return {
    kind: "callout",
    type: parsed.type,
    title: parsed.title,
    fold: parsed.fold,
    brace: node.from + parsed.brace,
    blocks:
      parsed.fold === "-" || !body
        ? []
        : [{ kind: "paragraph", inlines: [{ kind: "text", text: body }] }],
  };
}

function quoteBlocks(text: string, node: SyntaxNode): ReadingBlock[] {
  const blocks: ReadingBlock[] = [];
  let child = node.firstChild;
  while (child) {
    const block = readBlock(text, child);
    if (block) {
      blocks.push(block);
    }
    child = child.nextSibling;
  }
  return blocks;
}

function listItems(text: string, node: SyntaxNode): ReadingItem[] {
  const items: ReadingItem[] = [];
  let child = node.firstChild;
  while (child) {
    if (child.name === "ListItem") {
      const line = text.slice(child.from, child.to).split("\n")[0] ?? "";
      const task = taskOnLine(line);
      items.push({
        task: task ? { checked: task.checked, at: child.from + task.boxFrom } : null,
        inlines: itemInlines(text, child, task ? task.to : 0),
      });
    }
    child = child.nextSibling;
  }
  return items;
}

function itemInlines(text: string, node: SyntaxNode, skip: number): Inline[] {
  let child = node.firstChild;
  while (child) {
    if (child.name === "Paragraph" || /^ATXHeading[1-6]$/.test(child.name)) {
      return inlinesOf(text, child, Math.max(child.from, node.from + skip));
    }
    child = child.nextSibling;
  }
  const source = text.slice(node.from + skip, node.to).trim();
  return source ? splitEmbeds(source, node.from + skip) : [];
}

function inlinesOf(text: string, node: SyntaxNode, start = node.from): Inline[] {
  const inlines: Inline[] = [];
  let cursor = start;
  let child = node.firstChild;
  while (child && child.to <= start) {
    child = child.nextSibling;
  }
  while (child) {
    if (child.from > cursor) {
      inlines.push(...splitEmbeds(text.slice(cursor, child.from), cursor));
    }
    let next = child.to;
    if (child.name === "InlineCode") {
      inlines.push({ kind: "code", text: innerText(text, child, "CodeMark") });
    } else if (child.name === "Emphasis") {
      inlines.push({ kind: "emphasis", text: innerText(text, child, "EmphasisMark") });
    } else if (child.name === "StrongEmphasis") {
      inlines.push({ kind: "strong", text: innerText(text, child, "EmphasisMark") });
    } else if (child.name === "Link") {
      const source = text.slice(child.from, child.to);
      const parts = linkFromSource(source);
      const wikilink =
        !parts && text[child.from - 1] === "[" && text[child.to] === "]"
          ? visibleWikilinkLabel(`[${source}]`)
          : null;
      if (parts) {
        inlines.push(parts);
      } else if (wikilink) {
        const last = inlines[inlines.length - 1];
        if (last?.kind === "text" && last.text.endsWith("[")) {
          last.text = last.text.slice(0, -1);
          if (!last.text) {
            inlines.pop();
          }
        }
        inlines.push({ kind: "wikilink", label: wikilink, at: child.from });
        next = child.to + 1;
      } else if (child.from >= start) {
        inlines.push(...splitEmbeds(source, child.from));
      }
    } else if (child.name !== "LinkMark" && child.name !== "EmphasisMark" && child.name !== "CodeMark") {
      inlines.push(...splitEmbeds(text.slice(Math.max(child.from, start), child.to), Math.max(child.from, start)));
    }
    cursor = Math.max(cursor, next);
    child = child.nextSibling;
  }
  if (cursor < node.to) {
    inlines.push(...splitEmbeds(text.slice(cursor, node.to), cursor));
  }
  return attachBlockId(inlines.filter((inline) => inline.kind !== "text" || inline.text.length > 0));
}

function attachBlockId(inlines: Inline[]): Inline[] {
  const last = inlines[inlines.length - 1];
  if (!last || last.kind !== "text") {
    return inlines;
  }
  const found = blockIdOnLine(last.text);
  if (!found) {
    return inlines;
  }
  const text = last.text.slice(0, found.from).replace(/[ \t]+$/u, "");
  const head = text ? [...inlines.slice(0, -1), { kind: "text" as const, text }] : inlines.slice(0, -1);
  return [...head, { kind: "blockId", id: found.id }];
}

function splitEmbeds(source: string, from: number): Inline[] {
  const inlines: Inline[] = [];
  const pattern = /!\[\[([^[\]]*)\]\]|\[\[([^[\]]*)\]\]/g;
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) {
      inlines.push({ kind: "text", text: source.slice(last, index) });
    }
    if (match[0].startsWith("!")) {
      const body = match[1] ?? "";
      const label = embedLabel(body);
      if (label) {
        inlines.push({ kind: "embed", body, label });
      } else {
        inlines.push({ kind: "text", text: match[0] });
      }
    } else {
      const body = match[2] ?? "";
      const label = visibleWikilinkLabel(`[[${body}]]`);
      if (label) {
        inlines.push({ kind: "wikilink", label, at: from + index + 2 });
      } else {
        inlines.push({ kind: "text", text: match[0] });
      }
    }
    last = index + match[0].length;
  }
  if (last < source.length) {
    inlines.push({ kind: "text", text: source.slice(last) });
  }
  return inlines;
}

function linkFromSource(source: string): Inline | null {
  const split = source.indexOf("](");
  if (!source.startsWith("[") || split <= 1 || !source.endsWith(")")) {
    return null;
  }
  let url = source.slice(split + 2, -1).trim();
  const title = url.search(/\s+["']/);
  if (title !== -1) {
    url = url.slice(0, title).trim();
  }
  const label = source.slice(1, split);
  if (!label.trim() || !url) {
    return null;
  }
  return { kind: "link", label, url };
}

function headingText(text: string, node: SyntaxNode): string {
  return textWithout(text, node, new Set(["HeaderMark"]))
    .replace(/\s+#+\s*$/, "")
    .trim();
}

function innerText(text: string, node: SyntaxNode, mark: string): string {
  return textWithout(text, node, new Set([mark]));
}

function textWithout(text: string, node: SyntaxNode, marks: Set<string>): string {
  const ranges: Array<[number, number]> = [];
  let child = node.firstChild;
  while (child) {
    if (marks.has(child.name)) {
      ranges.push([child.from, child.to]);
    }
    child = child.nextSibling;
  }
  let result = "";
  let cursor = node.from;
  for (const [from, to] of ranges) {
    if (from > cursor) {
      result += text.slice(cursor, from);
    }
    cursor = Math.max(cursor, to);
  }
  result += text.slice(cursor, node.to);
  return result;
}

function codeText(text: string, node: SyntaxNode): string {
  let result = "";
  let child = node.firstChild;
  while (child) {
    if (child.name === "CodeText") {
      result += text.slice(child.from, child.to);
    }
    child = child.nextSibling;
  }
  if (result) {
    return result.replace(/\n$/, "");
  }
  return text.slice(node.from, node.to);
}
