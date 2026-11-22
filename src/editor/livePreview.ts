import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder, StateField, type EditorState, type Extension } from "@codemirror/state";
import type { SyntaxNode, SyntaxNodeRef } from "@lezer/common";
import { embedLabel } from "./embed.ts";
import { frontmatterRange } from "./frontmatter.ts";

const BLOCK_CODE_NODES = new Set(["FencedCode", "CodeBlock"]);

type Piece = {
  from: number;
  to: number;
  decoration: Decoration;
};

class BulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const bullet = document.createElement("span");
    bullet.className = "cm-bullet";
    bullet.setAttribute("aria-hidden", "true");
    bullet.textContent = "•";
    return bullet;
  }

  ignoreEvent(): boolean {
    return true;
  }

  eq(): boolean {
    return true;
  }
}

const bulletWidget = new BulletWidget();

class TaskWidget extends WidgetType {
  checked: boolean;
  boxFrom: number;

  constructor(checked: boolean, boxFrom: number) {
    super();
    this.checked = checked;
    this.boxFrom = boxFrom;
  }

  toDOM(): HTMLElement {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "cm-task";
    box.checked = this.checked;
    box.dataset.taskFrom = String(this.boxFrom);
    box.setAttribute("aria-label", this.checked ? "Checked task" : "Unchecked task");
    return box;
  }

  ignoreEvent(): boolean {
    return true;
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof TaskWidget &&
      other.checked === this.checked &&
      other.boxFrom === this.boxFrom
    );
  }
}

/** Enter on an empty task line removes the marker and leaves the cursor there. */
export function exitEmptyTask({
  state,
  dispatch,
}: {
  state: EditorState;
  dispatch: (transaction: ReturnType<EditorState["update"]>) => void;
}): boolean {
  const range = state.selection.main;
  if (!range.empty) {
    return false;
  }
  const line = state.doc.lineAt(range.from);
  const task = taskOnLine(line.text);
  if (!task || line.text.slice(task.to).trim() !== "") {
    return false;
  }
  const from = line.from + task.from;
  dispatch(
    state.update({
      changes: { from, to: line.to, insert: "" },
      selection: { anchor: from },
      userEvent: "input",
    }),
  );
  return true;
}

/** A block id at the end of a line, or null. Offsets are within the line and cover `^` plus the id. */
export function blockIdOnLine(line: string): { from: number; to: number; id: string } | null {
  let end = line.length;
  while (end > 0 && (line[end - 1] === " " || line[end - 1] === "\t")) {
    end -= 1;
  }
  if (end === 0) {
    return null;
  }
  let token = end;
  while (token > 0 && line[token - 1] !== " " && line[token - 1] !== "\t") {
    token -= 1;
  }
  const caret = line.lastIndexOf("^", end - 1);
  if (caret < token || caret >= end - 1) {
    return null;
  }
  const id = line.slice(caret + 1, end);
  if (id.length === 0 || /\s/u.test(id)) {
    return null;
  }
  return { from: caret, to: end, id };
}

/** A `- [ ]` / `- [x]` marker at the start of a line, or null. Offsets are within the line. */
export function taskOnLine(line: string): {
  from: number;
  to: number;
  boxFrom: number;
  checked: boolean;
} | null {
  const match = /^(\s*)([-*+])(\s+)\[([ xX])\]/.exec(line);
  if (!match) {
    return null;
  }
  const from = match[1].length;
  const boxFrom = from + match[2].length + match[3].length;
  return { from, to: boxFrom + 3, boxFrom, checked: match[4] !== " " };
}

class WikilinkWidget extends WidgetType {
  label: string;
  linkFrom: number;

  constructor(label: string, linkFrom: number) {
    super();
    this.label = label;
    this.linkFrom = linkFrom;
  }

  toDOM(): HTMLElement {
    const link = document.createElement("span");
    link.className = "cm-wikilink";
    link.textContent = this.label;
    link.dataset.wikilinkFrom = String(this.linkFrom);
    return link;
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== "mousedown";
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof WikilinkWidget &&
      other.label === this.label &&
      other.linkFrom === this.linkFrom
    );
  }
}

class BlockIdWidget extends WidgetType {
  id: string;
  from: number;

  constructor(id: string, from: number) {
    super();
    this.id = id;
    this.from = from;
  }

  toDOM(): HTMLElement {
    const mark = document.createElement("span");
    mark.className = "cm-block-id";
    mark.textContent = this.id;
    mark.dataset.blockFrom = String(this.from);
    return mark;
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== "mousedown";
  }

  eq(other: WidgetType): boolean {
    return other instanceof BlockIdWidget && other.id === this.id && other.from === this.from;
  }
}

class MarkdownLinkWidget extends WidgetType {
  label: string;
  url: string;

  constructor(label: string, url: string) {
    super();
    this.label = label;
    this.url = url;
  }

  toDOM(): HTMLElement {
    const link = document.createElement("span");
    link.className = "cm-md-link";
    link.textContent = this.label;
    link.dataset.linkUrl = this.url;
    return link;
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== "mousedown";
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof MarkdownLinkWidget && other.label === this.label && other.url === this.url
    );
  }
}

/** The Markdown link containing `offset`, or null. A wikilink is not a match. */
export function markdownLinkAt(text: string, offset: number): { label: string; url: string } | null {
  const pattern = /\[([^\]\n]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  for (const match of text.matchAll(pattern)) {
    const from = match.index ?? 0;
    const to = from + match[0].length;
    if (offset >= from && offset <= to) {
      const label = match[1] ?? "";
      const url = match[2] ?? "";
      if (label.trim() && url) {
        return { label, url };
      }
    }
  }
  return null;
}

/** Label and address of `[label](url)`, or null when the source is not that link. */
export function markdownLinkParts(source: string): { label: string; url: string } | null {
  if (!source.startsWith("[") || !source.endsWith(")")) {
    return null;
  }
  const split = source.indexOf("](");
  if (split <= 1) {
    return null;
  }
  const label = source.slice(1, split);
  let url = source.slice(split + 2, -1).trim();
  const title = url.search(/\s+["']/);
  if (title !== -1) {
    url = url.slice(0, title).trim();
  }
  if (!label.trim() || !url) {
    return null;
  }
  return { label, url };
}

/** Visible text of a `[[...]]` link. An empty target is not a link. */
export function visibleWikilinkLabel(source: string): string | null {
  if (!source.startsWith("[[") || !source.endsWith("]]")) {
    return null;
  }
  const body = source.slice(2, -2);
  const pipe = body.indexOf("|");
  const target = (pipe === -1 ? body : body.slice(0, pipe)).trim();
  if (!target) {
    return null;
  }
  if (pipe === -1) {
    return target;
  }
  const alias = body.slice(pipe + 1).trim();
  return alias || target;
}

export function livePreview(): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildPreview(view.state);
        }

        update(update: ViewUpdate) {
          if (update.docChanged || update.selectionSet) {
            this.decorations = buildPreview(update.state);
          }
        }
      },
      { decorations: (value) => value.decorations },
    ),
    calloutFolds,
    frontmatterFolds,
  ];
}

/** Hidden frontmatter. A direct decoration set, so it may cover line breaks. */
export const frontmatterFolds = StateField.define<DecorationSet>({
  create(state) {
    return frontmatterDecorations(state);
  },
  update(folded, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return frontmatterDecorations(transaction.state);
    }
    return folded;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

function frontmatterDecorations(state: EditorState): DecorationSet {
  const span = frontmatterRange(state.doc.toString());
  if (!span) {
    return Decoration.set([
      Decoration.widget({ widget: propertiesHostWidget, block: true, side: -1 }).range(0),
    ]);
  }
  if (editingFrontmatter(state, span.from, span.to)) {
    return Decoration.none;
  }
  return Decoration.set([
    Decoration.replace({ widget: propertiesHostWidget, block: true }).range(span.from, span.to),
  ]);
}

function editingFrontmatter(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((range) => {
    if (range.empty) {
      return range.head >= from && range.head < to;
    }
    return range.from < to && range.to > from;
  });
}

/** Hidden callout bodies. A direct decoration set, so it may cover line breaks. */
export const calloutFolds = StateField.define<DecorationSet>({
  create(state) {
    return foldDecorations(state);
  },
  update(folded, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return foldDecorations(transaction.state);
    }
    return folded;
  },
  provide(field) {
    return [
      EditorView.decorations.from(field),
      EditorView.atomicRanges.of((view) => view.state.field(field)),
    ];
  },
});

export function previewDecorations(state: EditorState): DecorationSet {
  return buildPreview(state);
}

function foldDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const fold of foldedCalloutRanges(state)) {
    builder.add(fold.from, fold.to, Decoration.replace({}));
  }
  return builder.finish();
}

function foldedCalloutRanges(state: EditorState): Array<{ from: number; to: number }> {
  const tree = ensureSyntaxTree(state, state.doc.length) ?? syntaxTree(state);
  const folds: Array<{ from: number; to: number }> = [];
  tree.iterate({
    enter(node) {
      if (BLOCK_CODE_NODES.has(node.name)) {
        return false;
      }
      if (node.name !== "Blockquote") {
        return undefined;
      }
      const first = state.doc.lineAt(node.from);
      const parsed = calloutLine(first.text);
      if (!parsed || parsed.fold !== "-" || insideCode(state, node.from)) {
        return false;
      }
      const end = state.doc.lineAt(Math.max(node.from, node.to - 1));
      const bodyTo = calloutBodyEnd(state, first.number, end.number, node.to);
      if (bodyTo > first.to) {
        folds.push({ from: first.to, to: bodyTo });
      }
      return false;
    },
  });
  folds.sort((left, right) => left.from - right.from || left.to - right.to);
  return folds;
}

function buildPreview(state: EditorState): DecorationSet {
  const tree = ensureSyntaxTree(state, state.doc.length) ?? syntaxTree(state);
  const pieces: Piece[] = [];
  const folds = foldedCalloutRanges(state);
  const lineClasses = new Map<number, string[]>();
  const frontmatter = frontmatterRange(state.doc.toString());
  tree.iterate({
    enter(node) {
      if (frontmatter && node.from >= frontmatter.from && node.to <= frontmatter.to) {
        return false;
      }
      if (BLOCK_CODE_NODES.has(node.name)) {
        return false;
      }
      if (isHeading(node.name)) {
        decorateHeading(state, node, pieces, lineClasses);
        return false;
      }
      if (node.name === "Emphasis" || node.name === "StrongEmphasis") {
        decorateEmphasis(state, node, pieces);
        return false;
      }
      if (node.name === "InlineCode") {
        decorateInlineCode(state, node, pieces);
        return false;
      }
      if (node.name === "ListMark") {
        decorateBullet(state, node, pieces);
        return false;
      }
      if (node.name === "Blockquote" && decorateCallout(state, node, pieces, lineClasses)) {
        return false;
      }
      if (node.name === "QuoteMark") {
        decorateQuote(state, node, pieces, lineClasses);
        return false;
      }
      if (node.name === "Link") {
        decorateMarkdownLink(state, node, pieces);
      }
      return undefined;
    },
  });
  decorateWikilinks(state, pieces);
  decorateEmbeds(state, pieces);
  decorateTasks(state, pieces);
  decorateBlockIds(state, pieces);
  for (const [from, classes] of lineClasses) {
    pieces.push({
      from,
      to: from,
      decoration: Decoration.line({ class: classes.join(" ") }),
    });
  }
  const links = pieces.filter(
    (piece) =>
      piece.decoration.spec.widget instanceof WikilinkWidget ||
      piece.decoration.spec.widget instanceof MarkdownLinkWidget ||
      piece.decoration.spec.widget instanceof EmbedWidget ||
      piece.decoration.spec.widget instanceof CalloutWidget,
  );
  const visible = pieces.filter(
    (piece) =>
      !links.some(
        (link) => piece !== link && piece.from >= link.from && piece.to <= link.to,
      ) &&
      !folds.some(
        (fold) => piece.from < fold.to && piece.to > fold.from && (piece.from !== fold.from || piece.to !== fold.to),
      ),
  );
  visible.sort((left, right) => left.from - right.from || left.to - right.to);
  const builder = new RangeSetBuilder<Decoration>();
  for (const piece of visible) {
    builder.add(piece.from, piece.to, piece.decoration);
  }
  return builder.finish();
}

function decorateHeading(
  state: EditorState,
  node: SyntaxNodeRef,
  pieces: Piece[],
  lineClasses: Map<number, string[]>,
) {
  const level = Number(node.name.slice(-1));
  const start = state.doc.lineAt(node.from);
  const end = state.doc.lineAt(Math.max(node.from, node.to - 1));
  const active = overlaps(state, start.from, end.to);
  for (let number = start.number; number <= end.number; number += 1) {
    const line = state.doc.line(number);
    addLineClass(lineClasses, line.from, `cm-heading-${level}`);
  }
  if (active) {
    return;
  }
  eachChild(node, (child) => {
    if (child.name === "HeaderMark" && child.from < child.to) {
      pieces.push({
        from: child.from,
        to: child.to,
        decoration: Decoration.replace({}),
      });
    }
  });
}

function decorateEmphasis(state: EditorState, node: SyntaxNodeRef, pieces: Piece[]) {
  const active = overlaps(state, node.from, node.to);
  const marks = childRanges(node, "EmphasisMark");
  if (marks.length === 0) {
    return;
  }
  hideMarks(pieces, marks, !active);
  addInnerMark(
    pieces,
    marks,
    node.name === "StrongEmphasis" ? "cm-strong" : "cm-emphasis",
  );
}

function decorateInlineCode(state: EditorState, node: SyntaxNodeRef, pieces: Piece[]) {
  const active = overlaps(state, node.from, node.to);
  const marks = childRanges(node, "CodeMark");
  hideMarks(pieces, marks, !active);
  addInnerMark(pieces, marks, "cm-inline-code");
}

function decorateBullet(state: EditorState, node: SyntaxNodeRef, pieces: Piece[]) {
  const marker = state.doc.sliceString(node.from, node.to);
  if (!/^[-*+]$/.test(marker)) {
    return;
  }
  const line = state.doc.lineAt(node.from);
  const task = taskOnLine(line.text);
  if (task && line.from + task.from === node.from) {
    return;
  }
  if (overlaps(state, line.from, line.to)) {
    return;
  }
  pieces.push({
    from: node.from,
    to: node.to,
    decoration: Decoration.replace({ widget: bulletWidget }),
  });
}

function decorateMarkdownLink(state: EditorState, node: SyntaxNodeRef, pieces: Piece[]) {
  const parts = markdownLinkParts(state.doc.sliceString(node.from, node.to));
  if (!parts || overlaps(state, node.from, node.to)) {
    return;
  }
  pieces.push({
    from: node.from,
    to: node.to,
    decoration: Decoration.replace({ widget: new MarkdownLinkWidget(parts.label, parts.url) }),
  });
}

export type EmbedPaint = {
  kind: "note" | "image" | "file" | "missing";
  text: string;
  src: string;
  name: string;
};

export type EmbedLoader = (body: string) => Promise<EmbedPaint>;

let embedLoader: EmbedLoader | null = null;

export function setEmbedLoader(loader: EmbedLoader | null) {
  embedLoader = loader;
}

let propertiesHostListener: ((host: HTMLElement | null) => void) | null = null;

/** The editor calls this so the properties block can render inside the document. */
export function setPropertiesHost(listener: ((host: HTMLElement | null) => void) | null) {
  propertiesHostListener = listener;
}

class PropertiesHostWidget extends WidgetType {
  toDOM(): HTMLElement {
    const host = document.createElement("div");
    host.className = "cm-properties-host";
    propertiesHostListener?.(host);
    return host;
  }

  destroy(): void {
    propertiesHostListener?.(null);
  }

  ignoreEvent(): boolean {
    return true;
  }

  eq(): boolean {
    return true;
  }
}

const propertiesHostWidget = new PropertiesHostWidget();

class EmbedWidget extends WidgetType {
  body: string;
  label: string;

  constructor(body: string, label: string) {
    super();
    this.body = body;
    this.label = label;
  }

  toDOM(): HTMLElement {
    const host = document.createElement("span");
    host.className = "cm-embed";
    host.dataset.embedBody = this.body;
    host.textContent = this.label;
    const load = embedLoader;
    if (load) {
      void load(this.body).then((paint) => {
        if (!host.isConnected) {
          return;
        }
        host.replaceChildren();
        if (paint.kind === "image" && paint.src) {
          const image = document.createElement("img");
          image.className = "cm-embed-image";
          image.alt = this.label;
          image.src = paint.src;
          host.append(image);
          return;
        }
        if (paint.kind === "note") {
          const text = document.createElement("span");
          text.className = "cm-embed-text";
          text.textContent = paint.text;
          host.append(text);
          return;
        }
        host.textContent = paint.name || this.label;
      });
    }
    return host;
  }

  ignoreEvent(): boolean {
    return true;
  }

  eq(other: WidgetType): boolean {
    return other instanceof EmbedWidget && other.body === this.body;
  }
}

function decorateEmbeds(state: EditorState, pieces: Piece[]) {
  const text = state.doc.toString();
  let search = 0;
  while (search < text.length) {
    const open = text.indexOf("![[", search);
    if (open === -1) {
      return;
    }
    const close = text.indexOf("]]", open + 3);
    if (close === -1) {
      return;
    }
    const to = close + 2;
    const label = embedLabel(text.slice(open + 3, close));
    if (label !== null && !insideCode(state, open) && !overlaps(state, open, to)) {
      pieces.push({
        from: open,
        to,
        decoration: Decoration.replace({
          widget: new EmbedWidget(text.slice(open + 3, close), label),
        }),
      });
    }
    search = to;
  }
}

function decorateWikilinks(state: EditorState, pieces: Piece[]) {
  const text = state.doc.toString();
  let search = 0;
  while (search < text.length) {
    const open = text.indexOf("[[", search);
    if (open === -1) {
      return;
    }
    if (open > 0 && text[open - 1] === "!") {
      search = open + 2;
      continue;
    }
    const close = text.indexOf("]]", open + 2);
    if (close === -1) {
      return;
    }
    const to = close + 2;
    const label = visibleWikilinkLabel(text.slice(open, to));
    if (label !== null && !insideCode(state, open) && !overlaps(state, open, to)) {
      pieces.push({
        from: open,
        to,
        decoration: Decoration.replace({ widget: new WikilinkWidget(label, open) }),
      });
    }
    search = to;
  }
}

const CODE_NODES = new Set(["InlineCode", "FencedCode", "CodeBlock", "CodeText"]);

function insideCode(state: EditorState, position: number): boolean {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, 1);
  while (node) {
    if (CODE_NODES.has(node.name)) {
      return true;
    }
    node = node.parent;
  }
  return false;
}

function decorateBlockIds(state: EditorState, pieces: Piece[]) {
  for (let number = 1; number <= state.doc.lines; number += 1) {
    const line = state.doc.line(number);
    const block = blockIdOnLine(line.text);
    if (
      !block ||
      insideWikilink(line.text, block.from) ||
      overlaps(state, line.from + block.from, line.from + block.to) ||
      insideCode(state, line.from + block.from)
    ) {
      continue;
    }
    pieces.push({
      from: line.from + block.from,
      to: line.from + block.to,
      decoration: Decoration.replace({
        widget: new BlockIdWidget(block.id, line.from + block.from),
      }),
    });
  }
}

function insideWikilink(line: string, index: number): boolean {
  const open = line.lastIndexOf("[[", index);
  if (open === -1) {
    return false;
  }
  const close = line.indexOf("]]", open + 2);
  return close !== -1 && index < close + 2;
}

function decorateTasks(state: EditorState, pieces: Piece[]) {
  for (let number = 1; number <= state.doc.lines; number += 1) {
    const line = state.doc.line(number);
    const task = taskOnLine(line.text);
    if (!task || overlaps(state, line.from, line.to) || insideCode(state, line.from + task.from)) {
      continue;
    }
    pieces.push({
      from: line.from + task.from,
      to: line.from + task.to,
      decoration: Decoration.replace({
        widget: new TaskWidget(task.checked, line.from + task.boxFrom),
      }),
    });
  }
}

const CALLOUT_TYPES = new Set(["note", "info", "tip", "warning", "danger"]);

/** The opening line of a callout, or null. Offsets are within the line. */
export function calloutLine(line: string): {
  type: string;
  fold: "" | "+" | "-";
  title: string;
  brace: number;
} | null {
  const match = /^(>\s*)\[!([A-Za-z0-9_-]+)\]([+-])?(\s*)(.*)$/.exec(line);
  if (!match) {
    return null;
  }
  const fold = match[3] === "+" || match[3] === "-" ? match[3] : "";
  return {
    type: match[2],
    fold,
    title: match[5].trim(),
    brace: match[1].length + 2 + match[2].length,
  };
}

/** Visible heading: the written title, or the type when the title is empty. */
export function calloutHeading(type: string, title: string): string {
  return title || type;
}

class CalloutWidget extends WidgetType {
  type: string;
  title: string;
  brace: number;

  constructor(type: string, title: string, brace: number) {
    super();
    this.type = type;
    this.title = title;
    this.brace = brace;
  }

  toDOM(): HTMLElement {
    const label = document.createElement("span");
    label.className = "cm-callout-label";
    label.dataset.calloutAt = String(this.brace);
    label.textContent = calloutHeading(this.type, this.title);
    return label;
  }

  ignoreEvent(): boolean {
    return true;
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof CalloutWidget &&
      other.type === this.type &&
      other.title === this.title &&
      other.brace === this.brace
    );
  }
}

/** End of the last `>` line after the title. Lazy continuation stays outside the fold. */
function calloutBodyEnd(state: EditorState, firstNumber: number, endNumber: number, nodeTo: number): number {
  let end = state.doc.line(firstNumber).to;
  for (let number = firstNumber + 1; number <= endNumber; number += 1) {
    const line = state.doc.line(number);
    if (line.from >= nodeTo || !/^\s*>/.test(line.text)) {
      break;
    }
    end = line.to;
  }
  return end;
}

function decorateCallout(
  state: EditorState,
  node: SyntaxNodeRef,
  pieces: Piece[],
  lineClasses: Map<number, string[]>,
): boolean {
  const first = state.doc.lineAt(node.from);
  const parsed = calloutLine(first.text);
  if (!parsed || insideCode(state, node.from)) {
    return false;
  }
  const end = state.doc.lineAt(Math.max(node.from, node.to - 1));
  const type = parsed.type.toLowerCase();
  const variant = CALLOUT_TYPES.has(type) ? type : "default";
  if (parsed.fold === "-") {
    addLineClass(lineClasses, first.from, "cm-callout");
    addLineClass(lineClasses, first.from, `cm-callout-${variant}`);
    if (!overlaps(state, first.from, first.to)) {
      pieces.push({
        from: first.from,
        to: first.from + first.text.length,
        decoration: Decoration.replace({
          widget: new CalloutWidget(parsed.type, parsed.title, first.from + parsed.brace),
        }),
      });
    }
    return true;
  }
  const active = overlaps(state, first.from, end.to);
  for (let number = first.number; number <= end.number; number += 1) {
    const line = state.doc.line(number);
    if (line.from < node.from || line.from >= node.to) {
      continue;
    }
    addLineClass(lineClasses, line.from, "cm-callout");
    addLineClass(lineClasses, line.from, `cm-callout-${variant}`);
  }
  if (active) {
    return true;
  }
  pieces.push({
    from: first.from,
    to: first.from + first.text.length,
    decoration: Decoration.replace({
      widget: new CalloutWidget(parsed.type, parsed.title, first.from + parsed.brace),
    }),
  });
  for (let number = first.number + 1; number <= end.number; number += 1) {
    const line = state.doc.line(number);
    const mark = line.text.indexOf(">");
    if (mark === -1) {
      continue;
    }
    pieces.push({
      from: line.from + mark,
      to: line.from + mark + 1,
      decoration: Decoration.replace({}),
    });
  }
  return true;
}

function decorateQuote(
  state: EditorState,
  node: SyntaxNodeRef,
  pieces: Piece[],
  lineClasses: Map<number, string[]>,
) {
  const line = state.doc.lineAt(node.from);
  addLineClass(lineClasses, line.from, "cm-quote");
  if (overlaps(state, line.from, line.to) || node.from >= node.to) {
    return;
  }
  pieces.push({
    from: node.from,
    to: node.to,
    decoration: Decoration.replace({}),
  });
}

function childRanges(node: SyntaxNodeRef, name: string): Array<{ from: number; to: number }> {
  const marks: Array<{ from: number; to: number }> = [];
  eachChild(node, (child) => {
    if (child.name === name && child.from < child.to) {
      marks.push({ from: child.from, to: child.to });
    }
  });
  return marks;
}

function hideMarks(pieces: Piece[], marks: Array<{ from: number; to: number }>, hide: boolean) {
  if (!hide) {
    return;
  }
  for (const mark of marks) {
    pieces.push({ from: mark.from, to: mark.to, decoration: Decoration.replace({}) });
  }
}

function addInnerMark(pieces: Piece[], marks: Array<{ from: number; to: number }>, className: string) {
  if (marks.length === 0) {
    return;
  }
  const innerFrom = marks[0].to;
  const innerTo = marks[marks.length - 1].from;
  if (innerFrom >= innerTo) {
    return;
  }
  pieces.push({
    from: innerFrom,
    to: innerTo,
    decoration: Decoration.mark({ class: className }),
  });
}

function addLineClass(lineClasses: Map<number, string[]>, from: number, className: string) {
  const classes = lineClasses.get(from);
  if (!classes) {
    lineClasses.set(from, [className]);
    return;
  }
  if (!classes.includes(className)) {
    classes.push(className);
  }
}

function eachChild(node: SyntaxNodeRef, visit: (child: SyntaxNodeRef) => void) {
  const cursor = node.node.cursor();
  if (!cursor.firstChild()) {
    return;
  }
  do {
    visit(cursor);
  } while (cursor.nextSibling());
}

function overlaps(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}

function isHeading(name: string): boolean {
  return /^ATXHeading[1-6]$/.test(name) || /^SetextHeading[12]$/.test(name);
}
