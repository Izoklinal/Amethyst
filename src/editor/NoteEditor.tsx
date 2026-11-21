import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { livePreview } from "./livePreview";

export type NoteEditorHandle = {
  focus: () => void;
  text: () => string;
  selection: () => { from: number; to: number; head: number };
  select: (anchor: number, head?: number) => void;
  replace: (from: number, to: number, insert: string) => void;
};

type NoteEditorProps = {
  text: string;
  onChange: (text: string) => void;
  onContextMenu: (x: number, y: number) => void;
};

const noteExtensions = [
  history(),
  keymap.of([...defaultKeymap, ...historyKeymap]),
  markdown(),
  EditorView.lineWrapping,
  livePreview(),
  EditorView.contentAttributes.of({
    spellcheck: "false",
    "aria-label": "Note text",
  }),
];

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
  { text, onChange, onContextMenu },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const syncing = useRef(false);
  const initialText = useRef(text);
  onChangeRef.current = onChange;

  useEffect(() => {
    const parent = hostRef.current;
    if (!parent) {
      return;
    }
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: initialText.current,
        extensions: [
          ...noteExtensions,
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !syncing.current) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current === text) {
      return;
    }
    syncing.current = true;
    view.dispatch({ changes: { from: 0, to: current.length, insert: text } });
    syncing.current = false;
  }, [text]);

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        viewRef.current?.focus();
      },
      text() {
        return viewRef.current?.state.doc.toString() ?? "";
      },
      selection() {
        const main = viewRef.current?.state.selection.main;
        return { from: main?.from ?? 0, to: main?.to ?? 0, head: main?.head ?? 0 };
      },
      select(anchor: number, head = anchor) {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        view.focus();
        view.dispatch({ selection: { anchor, head } });
      },
      replace(from: number, to: number, insert: string) {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        view.dispatch({
          changes: { from, to, insert },
          selection: { anchor: from + insert.length },
        });
      },
    }),
    [],
  );

  return (
    <div
      ref={hostRef}
      className="note-editor-host"
      data-note-editor="true"
      data-key-context="editor"
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu(event.clientX, event.clientY);
      }}
    />
  );
});
