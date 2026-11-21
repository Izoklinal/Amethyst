import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder, type EditorState, type Extension } from "@codemirror/state";
import type { SyntaxNodeRef } from "@lezer/common";

const CODE_NODES = new Set(["FencedCode", "CodeBlock", "InlineCode"]);

type Piece = {
  from: number;
  to: number;
  decoration: Decoration;
};

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
  tree.iterate({
    enter(node) {
      if (CODE_NODES.has(node.name)) {
        return false;
      }
      if (isHeading(node.name)) {
        decorateHeading(state, node, pieces);
        return false;
      }
      if (node.name === "Emphasis" || node.name === "StrongEmphasis") {
        decorateEmphasis(state, node, pieces);
        return false;
      }
      return undefined;
    },
  });
  pieces.sort((left, right) => left.from - right.from || left.to - right.to);
  const builder = new RangeSetBuilder<Decoration>();
  for (const piece of pieces) {
    builder.add(piece.from, piece.to, piece.decoration);
  }
  return builder.finish();
}

function decorateHeading(state: EditorState, node: SyntaxNodeRef, pieces: Piece[]) {
  const level = Number(node.name.slice(-1));
  const start = state.doc.lineAt(node.from);
  const end = state.doc.lineAt(Math.max(node.from, node.to - 1));
  const active = overlaps(state, start.from, end.to);
  for (let number = start.number; number <= end.number; number += 1) {
    const line = state.doc.line(number);
    pieces.push({
      from: line.from,
      to: line.from,
      decoration: Decoration.line({ class: `cm-heading-${level}` }),
    });
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
  const marks: { from: number; to: number }[] = [];
  eachChild(node, (child) => {
    if (child.name === "EmphasisMark" && child.from < child.to) {
      marks.push({ from: child.from, to: child.to });
    }
  });
  if (marks.length === 0) {
    return;
  }
  const innerFrom = marks[0].to;
  const innerTo = marks[marks.length - 1].from;
  const style = node.name === "StrongEmphasis" ? "cm-strong" : "cm-emphasis";
  if (!active) {
    for (const mark of marks) {
      pieces.push({ from: mark.from, to: mark.to, decoration: Decoration.replace({}) });
    }
  }
  if (innerFrom < innerTo) {
    pieces.push({
      from: innerFrom,
      to: innerTo,
      decoration: Decoration.mark({ class: style }),
    });
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
