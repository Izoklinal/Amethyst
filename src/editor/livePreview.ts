import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder, type EditorState, type Extension } from "@codemirror/state";
import type { SyntaxNodeRef } from "@lezer/common";

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

export function livePreview(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = previewDecorations(view.state);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
          this.decorations = previewDecorations(update.state);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

export function previewDecorations(state: EditorState): DecorationSet {
  const tree = ensureSyntaxTree(state, state.doc.length) ?? syntaxTree(state);
  const pieces: Piece[] = [];
  const lineClasses = new Map<number, string[]>();
  tree.iterate({
    enter(node) {
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
      if (node.name === "QuoteMark") {
        decorateQuote(state, node, pieces, lineClasses);
        return false;
      }
      return undefined;
    },
  });
  for (const [from, classes] of lineClasses) {
    pieces.push({
      from,
      to: from,
      decoration: Decoration.line({ class: classes.join(" ") }),
    });
  }
  pieces.sort((left, right) => left.from - right.from || left.to - right.to);
  const builder = new RangeSetBuilder<Decoration>();
  for (const piece of pieces) {
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
  if (overlaps(state, line.from, line.to)) {
    return;
  }
  pieces.push({
    from: node.from,
    to: node.to,
    decoration: Decoration.replace({ widget: bulletWidget }),
  });
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
