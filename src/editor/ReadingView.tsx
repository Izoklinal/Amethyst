import { useEffect, useMemo, useState } from "react";
import { Properties } from "../components/workspace/Properties/Properties";
import { calloutHeading, type EmbedLoader, type EmbedPaint } from "./livePreview";
import { readDocument, type Inline, type ReadingBlock, type ReadingItem } from "./reading";
import styles from "./ReadingView.module.css";

type ReadingViewProps = {
  text: string;
  onChange: (text: string) => void;
  onToggleTask: (offset: number) => void;
  onOpenLink: (url: string) => void;
  onFollowWikilink: (offset: number) => void;
  onOpenEmbed: (body: string) => void;
  onToggleCallout: (offset: number) => void;
  loadEmbed: EmbedLoader;
};

export function ReadingView({
  text,
  onChange,
  onToggleTask,
  onOpenLink,
  onFollowWikilink,
  onOpenEmbed,
  onToggleCallout,
  loadEmbed,
}: ReadingViewProps) {
  const blocks = useMemo(() => readDocument(text), [text]);
  return (
    <div className={styles.reading} id="note-reading" tabIndex={-1}>
      <Properties text={text} onChange={onChange} inset={false} />
      {blocks.map((block, index) => (
        <Block
          key={index}
          block={block}
          onToggleTask={onToggleTask}
          onOpenLink={onOpenLink}
          onFollowWikilink={onFollowWikilink}
          onOpenEmbed={onOpenEmbed}
          onToggleCallout={onToggleCallout}
          loadEmbed={loadEmbed}
        />
      ))}
    </div>
  );
}

function Block(props: { block: ReadingBlock } & Omit<ReadingViewProps, "text" | "onChange">) {
  const { block } = props;
  if (block.kind === "frontmatter") {
    return null;
  }
  if (block.kind === "heading") {
    const Tag = `h${block.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    return (
      <Tag className={styles.heading}>
        {block.text}
        {block.blockId ? <span className={styles.blockId}>{block.blockId}</span> : null}
      </Tag>
    );
  }
  if (block.kind === "code") {
    return <pre className={styles.code}>{block.text}</pre>;
  }
  if (block.kind === "paragraph") {
    return (
      <p>
        <Inlines {...props} inlines={block.inlines} />
      </p>
    );
  }
  if (block.kind === "list") {
    return (
      <ul className={styles.list}>
        {block.items.map((item, index) => (
          <li key={index}>
            <Item item={item} {...props} />
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === "quote") {
    return (
      <blockquote className={styles.quote}>
        {block.blocks.map((child, index) => (
          <Block key={index} {...props} block={child} />
        ))}
      </blockquote>
    );
  }
  const variant = block.type.toLowerCase();
  const tone =
    variant === "note"
      ? styles.note
      : variant === "info"
        ? styles.info
        : variant === "tip"
          ? styles.tip
          : variant === "warning"
            ? styles.warning
            : variant === "danger"
              ? styles.danger
              : undefined;
  return (
    <aside className={tone ? `${styles.callout} ${tone}` : styles.callout}>
      <button type="button" className={styles.calloutTitle} onClick={() => props.onToggleCallout(block.brace)}>
        {calloutHeading(block.type, block.title)}
      </button>
      {block.blocks.map((child, index) => (
        <Block key={index} {...props} block={child} />
      ))}
    </aside>
  );
}

function Item({ item, ...props }: { item: ReadingItem } & Omit<ReadingViewProps, "text" | "onChange">) {
  return (
    <>
      {item.task ? (
        <input
          type="checkbox"
          className={styles.task}
          checked={item.task.checked}
          aria-label={item.task.checked ? "Checked task" : "Unchecked task"}
          onChange={() => props.onToggleTask(item.task?.at ?? 0)}
        />
      ) : null}
      <Inlines {...props} inlines={item.inlines} />
    </>
  );
}

function Inlines({ inlines, ...props }: { inlines: Inline[] } & Omit<ReadingViewProps, "text" | "onChange">) {
  return (
    <>
      {inlines.map((inline, index) => {
        if (inline.kind === "text") {
          return <span key={index}>{inline.text}</span>;
        }
        if (inline.kind === "code") {
          return (
            <code key={index} className={styles.inlineCode}>
              {inline.text}
            </code>
          );
        }
        if (inline.kind === "strong") {
          return <strong key={index}>{inline.text}</strong>;
        }
        if (inline.kind === "emphasis") {
          return <em key={index}>{inline.text}</em>;
        }
        if (inline.kind === "link") {
          return (
            <button key={index} type="button" className={styles.link} onClick={() => props.onOpenLink(inline.url)}>
              {inline.label}
            </button>
          );
        }
        if (inline.kind === "blockId") {
          return (
            <span key={index} className={styles.blockId}>
              {inline.id}
            </span>
          );
        }
        if (inline.kind === "wikilink") {
          return (
            <button
              key={index}
              type="button"
              className={styles.link}
              onClick={() => props.onFollowWikilink(inline.at)}
            >
              {inline.label}
            </button>
          );
        }
        return (
          <EmbedBlock
            key={index}
            body={inline.body}
            label={inline.label}
            loadEmbed={props.loadEmbed}
            onOpenEmbed={props.onOpenEmbed}
          />
        );
      })}
    </>
  );
}

function EmbedBlock({
  body,
  label,
  loadEmbed,
  onOpenEmbed,
}: {
  body: string;
  label: string;
  loadEmbed: EmbedLoader;
  onOpenEmbed: (body: string) => void;
}) {
  const [paint, setPaint] = useState<EmbedPaint | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadEmbed(body).then((next) => {
      if (!cancelled) {
        setPaint(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [body, loadEmbed]);
  return (
    <button type="button" className={styles.embed} onClick={() => onOpenEmbed(body)}>
      {paint?.kind === "image" && paint.src ? (
        <img className={styles.image} alt={label} src={paint.src} />
      ) : paint?.kind === "note" ? (
        paint.text
      ) : (
        paint?.name || label
      )}
    </button>
  );
}
