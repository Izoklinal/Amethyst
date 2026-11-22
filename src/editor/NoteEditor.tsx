import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Properties } from "../components/workspace/Properties/Properties";
import type { EmbedLoader } from "./livePreview";
import { exitEmptyTask, livePreview, setEmbedLoader, setPropertiesHost } from "./livePreview";
import { frontmatterRange } from "./frontmatter.ts";

function initialAnchor(text: string, source: boolean): number {
  const span = frontmatterRange(text);
  if (!source && span) {
    return span.to;
  }
  return 0;
}

function mappedAnchor(previous: string, next: string, head: number): number {
  const oldEnd = frontmatterRange(previous)?.to ?? 0;
  const newEnd = frontmatterRange(next)?.to ?? 0;
  if (head >= oldEnd) {
    return Math.min(next.length, Math.max(0, head - oldEnd + newEnd));
  }
  return Math.min(head, newEnd);
}

export type NoteEditorHandle = {
  focus: () => void;
  text: () => string;
  selection: () => { from: number; to: number; head: number };
  select: (anchor: number, head?: number) => void;
  replace: (from: number, to: number, insert: string) => void;
  edit: (from: number, to: number, insert: string) => void;
};

type NoteEditorProps = {
  text: string;
  onChange: (text: string) => void;
  onContextMenu: (x: number, y: number) => void;
  onFollowLink: () => void;
  onToggleTask: (offset: number) => void;
  onOpenLink: (url: string) => void;
  onOpenEmbed: (body: string) => void;
  onToggleCallout: (offset: number) => void;
  loadEmbed: EmbedLoader;
  source: boolean;
  reading: boolean;
};

const previewCompartment = new Compartment();

const noteExtensions = [
  history(),
  Prec.high(keymap.of([{ key: "Enter", run: exitEmptyTask }])),
  keymap.of([...defaultKeymap, ...historyKeymap]),
  markdown(),
  EditorView.lineWrapping,
  previewCompartment.of(livePreview()),
  EditorView.contentAttributes.of({
    spellcheck: "false",
    "aria-label": "Note text",
  }),
];

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
  {
    text,
    onChange,
    onContextMenu,
    onFollowLink,
    onToggleTask,
    onOpenLink,
    onOpenEmbed,
    onToggleCallout,
    loadEmbed,
    source,
    reading,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onFollowRef = useRef(onFollowLink);
  const onToggleTaskRef = useRef(onToggleTask);
  const onOpenLinkRef = useRef(onOpenLink);
  const onOpenEmbedRef = useRef(onOpenEmbed);
  const onToggleCalloutRef = useRef(onToggleCallout);
  const loadEmbedRef = useRef(loadEmbed);
  const syncing = useRef(false);
  const initialText = useRef(text);
  const sourceRef = useRef(source);
  const [propertiesHost, setPropertiesElement] = useState<HTMLElement | null>(null);
  sourceRef.current = source;
  onChangeRef.current = onChange;
  onFollowRef.current = onFollowLink;
  onToggleTaskRef.current = onToggleTask;
  onOpenLinkRef.current = onOpenLink;
  onOpenEmbedRef.current = onOpenEmbed;
  onToggleCalloutRef.current = onToggleCallout;
  loadEmbedRef.current = loadEmbed;
  setEmbedLoader((body) => loadEmbedRef.current(body));

  useEffect(() => {
    const parent = hostRef.current;
    if (!parent) {
      return;
    }
    setPropertiesHost((element) => setPropertiesElement(element));
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: initialText.current,
        selection: { anchor: initialAnchor(initialText.current, sourceRef.current) },
        extensions: [
          ...noteExtensions.slice(0, 5),
          previewCompartment.of(sourceRef.current ? [] : livePreview()),
          ...noteExtensions.slice(6),
          EditorView.domEventHandlers({
            mousedown(event, view) {
              const target = event.target;
              if (!(target instanceof Element)) {
                return false;
              }
              const callout = target.closest(".cm-callout-label");
              if (callout instanceof HTMLElement && view.dom.contains(callout)) {
                const at = Number(callout.dataset.calloutAt);
                if (!Number.isInteger(at)) {
                  return false;
                }
                event.preventDefault();
                onToggleCalloutRef.current(at);
                return true;
              }
              const embed = target.closest(".cm-embed");
              if (embed instanceof HTMLElement && view.dom.contains(embed)) {
                const body = embed.dataset.embedBody;
                if (!body) {
                  return false;
                }
                event.preventDefault();
                onOpenEmbedRef.current(body);
                return true;
              }
              const markdownLink = target.closest(".cm-md-link");
              if (markdownLink instanceof HTMLElement && view.dom.contains(markdownLink)) {
                const url = markdownLink.dataset.linkUrl;
                if (!url) {
                  return false;
                }
                event.preventDefault();
                onOpenLinkRef.current(url);
                return true;
              }
              const task = target.closest(".cm-task");
              if (task instanceof HTMLElement && view.dom.contains(task)) {
                const taskFrom = Number(task.dataset.taskFrom);
                if (!Number.isInteger(taskFrom)) {
                  return false;
                }
                event.preventDefault();
                onToggleTaskRef.current(taskFrom);
                return true;
              }
              const blockId = target.closest(".cm-block-id");
              if (blockId instanceof HTMLElement && view.dom.contains(blockId)) {
                const at = Number(blockId.dataset.blockFrom);
                if (!Number.isInteger(at)) {
                  return false;
                }
                event.preventDefault();
                view.dispatch({ selection: { anchor: at } });
                return true;
              }
              const link = target.closest(".cm-wikilink");
              if (!(link instanceof HTMLElement) || !view.dom.contains(link)) {
                return false;
              }
              const position = Number(link.dataset.wikilinkFrom);
              if (!Number.isInteger(position)) {
                return false;
              }
              event.preventDefault();
              view.dispatch({ selection: { anchor: position + 2 } });
              onFollowRef.current();
              return true;
            },
          }),
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
      setEmbedLoader(null);
      setPropertiesHost(null);
      setPropertiesElement(null);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: previewCompartment.reconfigure(source ? [] : livePreview()),
    });
  }, [source]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current === text) {
      return;
    }
    const head = view.state.selection.main.head;
    syncing.current = true;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: text },
      selection: { anchor: mappedAnchor(current, text, head) },
    });
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
      edit(from: number, to: number, insert: string) {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        view.dispatch({ changes: { from, to, insert } });
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
    >
      {propertiesHost && !source && !reading
        ? createPortal(<Properties text={text} onChange={onChange} />, propertiesHost)
        : null}
    </div>
  );
});
