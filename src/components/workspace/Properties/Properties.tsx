import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  noteApplyProperty,
  noteProperties,
  type NoteProperties,
  type NoteProperty,
  type PropertyChange,
  type PropertyValue,
} from "../../../api/vault";
import styles from "./Properties.module.css";

type PropertiesProps = {
  text: string;
  onChange: (text: string) => void;
};

const TYPES: Array<PropertyValue["type"]> = ["text", "number", "boolean", "date", "list", "tags", "coordinates"];

export function Properties({ text, onChange }: PropertiesProps) {
  const [model, setModel] = useState<NoteProperties | null>(null);
  const [failed, setFailed] = useState(false);
  const textRef = useRef(text);
  const chain = useRef(Promise.resolve());
  textRef.current = text;

  useEffect(() => {
    let cancelled = false;
    noteProperties(text)
      .then((next) => {
        if (!cancelled) {
          setModel(next);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  function commit(change: PropertyChange) {
    const job = chain.current.then(async () => {
      const current = textRef.current;
      let next = await noteApplyProperty(current, change);
      if (textRef.current !== current && textRef.current !== next) {
        next = await noteApplyProperty(textRef.current, change);
      }
      if (next !== textRef.current) {
        onChange(next);
      }
    });
    chain.current = job.then(
      () => undefined,
      () => undefined,
    );
  }

  return (
    <section className={styles.properties} aria-label="Properties">
      <h2 className={styles.heading}>Properties</h2>
      {failed ? <p className={styles.note}>Properties could not be read.</p> : null}
      {model && !model.valid ? (
        <>
          <p className={styles.note}>This frontmatter could not be edited.</p>
          <pre className={styles.raw}>{model.raw}</pre>
        </>
      ) : null}
      {model?.valid ? (
        <>
          <ul className={styles.list}>
            {model.properties.map((property) => (
              <li key={property.key} className={styles.row}>
                <PropertyRow property={property} onChange={commit} />
              </li>
            ))}
          </ul>
          <AddProperty onAdd={commit} />
        </>
      ) : null}
    </section>
  );
}

function PropertyRow({
  property,
  onChange,
}: {
  property: NoteProperty;
  onChange: (change: PropertyChange) => void;
}) {
  const unknown = property.value.type === "unknown";
  return (
    <>
      {unknown ? (
        <span className={styles.key}>{property.key}</span>
      ) : (
        <KeyField
          name={property.key}
          onRename={(to) => onChange({ kind: "rename", from: property.key, to })}
        />
      )}
      <div className={styles.value}>
        <ValueEditor
          property={property}
          onSet={(value) => onChange({ kind: "set", key: property.key, value })}
        />
      </div>
      <button type="button" className={styles.remove} onClick={() => onChange({ kind: "delete", key: property.key })}>
        Remove
      </button>
    </>
  );
}

function KeyField({ name, onRename }: { name: string; onRename: (next: string) => void }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => {
    setDraft(name);
  }, [name]);
  return (
    <input
      className={styles.key}
      aria-label="Property name"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== name && draft.trim() === draft && draft.length > 0 && !draft.includes(":")) {
          onRename(draft);
        } else {
          setDraft(name);
        }
      }}
    />
  );
}

function ValueEditor({
  property,
  onSet,
}: {
  property: NoteProperty;
  onSet: (value: PropertyValue) => void;
}) {
  const value = property.value;
  if (value.type === "unknown") {
    return <pre className={styles.raw}>{value.value}</pre>;
  }
  return (
    <>
      <select
        className={styles.type}
        aria-label={`Type of ${property.key}`}
        value={value.type}
        onChange={(event) => {
          const next = converted(value, event.target.value as PropertyValue["type"]);
          if (next) {
            onSet(next);
          }
        }}
      >
        {TYPES.map((type) => (
          <option key={type} value={type}>
            {typeLabel(type)}
          </option>
        ))}
      </select>
      <ValueControl value={value} onSet={onSet} />
    </>
  );
}

function ValueControl({ value, onSet }: { value: PropertyValue; onSet: (value: PropertyValue) => void }) {
  if (value.type === "text") {
    return <TextValue label="Text" value={value.value} onCommit={(text) => onSet({ type: "text", value: text })} />;
  }
  if (value.type === "number") {
    return (
      <TextValue
        label="Number"
        value={String(value.value)}
        onCommit={(text) => {
          const number = Number(text);
          if (text.trim() && Number.isFinite(number)) {
            onSet({ type: "number", value: number });
          }
        }}
      />
    );
  }
  if (value.type === "boolean") {
    return (
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={value.value}
          onChange={(event) => onSet({ type: "boolean", value: event.target.checked })}
        />
        {value.value ? "True" : "False"}
      </label>
    );
  }
  if (value.type === "date") {
    return (
      <input
        className={styles.input}
        aria-label="Date"
        type="date"
        value={value.value}
        onChange={(event) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) {
            onSet({ type: "date", value: event.target.value });
          }
        }}
      />
    );
  }
  if (value.type === "list" || value.type === "tags") {
    return <ListValue items={value.value} tags={value.type === "tags"} onSet={onSet} />;
  }
  if (value.type === "coordinates") {
    return <CoordinateValue lat={value.value.lat} lng={value.value.lng} onSet={onSet} />;
  }
  return null;
}

function TextValue({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  return (
    <input
      className={styles.input}
      aria-label={label}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== value) {
          onCommit(draft);
        }
      }}
    />
  );
}

function ListValue({
  items,
  tags,
  onSet,
}: {
  items: string[];
  tags: boolean;
  onSet: (value: PropertyValue) => void;
}) {
  const [draft, setDraft] = useState(items);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) {
      setDraft(items);
    }
  }, [items, focused]);

  function commit(next: string[]) {
    onSet(tags ? { type: "tags", value: next } : { type: "list", value: next });
  }

  return (
    <div className={styles.items} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      {draft.map((item, index) => (
        <span key={index} className={styles.item}>
          <input
            className={styles.input}
            aria-label={tags ? "Tag" : "List item"}
            value={item}
            onChange={(event) => {
              const next = draft.slice();
              next[index] = event.target.value;
              setDraft(next);
            }}
            onBlur={() => commit(draft)}
          />
          <button
            type="button"
            className={styles.remove}
            onClick={() => {
              const next = draft.filter((_, itemIndex) => itemIndex !== index);
              setDraft(next);
              commit(next);
            }}
          >
            Remove
          </button>
        </span>
      ))}
      <button
        type="button"
        className={styles.add}
        onClick={() => {
          const next = [...draft, ""];
          setDraft(next);
          commit(next);
        }}
      >
        Add item
      </button>
    </div>
  );
}

function CoordinateValue({
  lat,
  lng,
  onSet,
}: {
  lat: number;
  lng: number;
  onSet: (value: PropertyValue) => void;
}) {
  function commit(nextLat: number, nextLng: number) {
    if (Number.isFinite(nextLat) && Number.isFinite(nextLng)) {
      onSet({
        type: "coordinates",
        value: { lat: clamp(nextLat, -90, 90), lng: clamp(nextLng, -180, 180) },
      });
    }
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    commit(round(90 - y * 180), round(-180 + x * 360));
  }

  return (
    <div className={styles.coordinates}>
      <div
        className={styles.plane}
        role="application"
        aria-label="Set coordinates"
        tabIndex={0}
        onPointerDown={move}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 1;
          if (event.key === "ArrowLeft") {
            commit(lat, lng - step);
          } else if (event.key === "ArrowRight") {
            commit(lat, lng + step);
          } else if (event.key === "ArrowUp") {
            commit(lat + step, lng);
          } else if (event.key === "ArrowDown") {
            commit(lat - step, lng);
          } else {
            return;
          }
          event.preventDefault();
        }}
      >
        <span
          className={styles.point}
          style={{ left: `${((lng + 180) / 360) * 100}%`, top: `${((90 - lat) / 180) * 100}%` }}
        />
      </div>
      <TextValue label="Latitude" value={String(lat)} onCommit={(text) => commit(Number(text), lng)} />
      <TextValue label="Longitude" value={String(lng)} onCommit={(text) => commit(lat, Number(text))} />
    </div>
  );
}

function AddProperty({ onAdd }: { onAdd: (change: PropertyChange) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PropertyValue["type"]>("text");
  return (
    <form
      className={styles.addRow}
      onSubmit={(event) => {
        event.preventDefault();
        const key = name.trim();
        if (!key || key !== name || key.includes(":") || key === "---") {
          return;
        }
        onAdd({ kind: "add", key, value: emptyValue(type) });
        setName("");
        setType("text");
      }}
    >
      <input
        className={styles.key}
        aria-label="New property name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <select className={styles.type} aria-label="New property type" value={type} onChange={(event) => setType(event.target.value as PropertyValue["type"])}>
        {TYPES.map((item) => (
          <option key={item} value={item}>
            {typeLabel(item)}
          </option>
        ))}
      </select>
      <button type="submit" className={styles.add}>
        Add property
      </button>
    </form>
  );
}

function converted(value: PropertyValue, type: PropertyValue["type"]): PropertyValue | null {
  if (value.type === type) {
    return value;
  }
  if (value.type === "unknown") {
    return null;
  }
  if (type === "text") {
    if (value.type === "list" || value.type === "tags" || value.type === "coordinates") {
      return null;
    }
    if (value.type === "number") {
      return { type: "text", value: String(value.value) };
    }
    if (value.type === "boolean") {
      return { type: "text", value: value.value ? "true" : "false" };
    }
    if (value.type === "date") {
      return { type: "text", value: value.value };
    }
    return { type: "text", value: value.value };
  }
  if (type === "number" && value.type === "text" && value.value.trim() && Number.isFinite(Number(value.value))) {
    return { type: "number", value: Number(value.value) };
  }
  if (type === "boolean" && value.type === "text" && (value.value === "true" || value.value === "false")) {
    return { type: "boolean", value: value.value === "true" };
  }
  if (type === "date" && value.type === "text" && /^\d{4}-\d{2}-\d{2}$/.test(value.value)) {
    return { type: "date", value: value.value };
  }
  if (type === "list" && (value.type === "list" || value.type === "tags")) {
    return { type: "list", value: value.value };
  }
  if (type === "list" && value.type === "text") {
    return { type: "list", value: value.value ? [value.value] : [] };
  }
  if (type === "tags" && (value.type === "tags" || value.type === "list")) {
    return { type: "tags", value: value.value.map((item) => item.trim().replace(/^#/u, "")) };
  }
  if (type === "tags" && value.type === "text") {
    return { type: "tags", value: value.value ? [value.value.trim().replace(/^#/u, "")] : [] };
  }
  return null;
}

function emptyValue(type: PropertyValue["type"]): PropertyValue {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  switch (type) {
    case "text":
      return { type: "text", value: "" };
    case "number":
      return { type: "number", value: 0 };
    case "boolean":
      return { type: "boolean", value: false };
    case "date":
      return { type: "date", value: `${now.getFullYear()}-${month}-${day}` };
    case "list":
      return { type: "list", value: [] };
    case "tags":
      return { type: "tags", value: [] };
    case "coordinates":
      return { type: "coordinates", value: { lat: 0, lng: 0 } };
    case "unknown":
      return { type: "text", value: "" };
  }
}

function typeLabel(type: PropertyValue["type"]): string {
  switch (type) {
    case "text":
      return "Text";
    case "number":
      return "Number";
    case "boolean":
      return "Checkbox";
    case "date":
      return "Date";
    case "list":
      return "List";
    case "tags":
      return "Tags";
    case "coordinates":
      return "Coordinates";
    case "unknown":
      return "Unsupported";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
