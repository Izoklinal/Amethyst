export type QuickNote = {
  path: string;
  name: string;
};

export type QuickCommand = {
  id: string;
  title: string;
};

export type QuickOpenItem =
  | { kind: "note"; note: QuickNote }
  | { kind: "command"; command: QuickCommand };

const HIDDEN_COMMANDS = new Set(["palette.open", "note.revealHeading"]);

export function pickerItems(
  query: string,
  notes: QuickNote[],
  commands: QuickCommand[],
  counts: Record<string, number>,
): QuickOpenItem[] {
  if (query.startsWith(">")) {
    const needle = query.slice(1).trim().toLowerCase();
    return commands
      .filter((command) => !HIDDEN_COMMANDS.has(command.id) && !command.id.startsWith("toolbar."))
      .filter((command) => !needle || command.title.toLowerCase().includes(needle))
      .map((command) => ({ kind: "command", command }));
  }
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...notes]
      .sort((left, right) => compareFrequency(left, right, counts) || compareName(left, right))
      .map((note) => ({ kind: "note", note }));
  }
  return notes
    .flatMap((note) => {
      const rank = noteRank(needle, note);
      return rank === null ? [] : [{ note, rank }];
    })
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        compareFrequency(left.note, right.note, counts) ||
        left.note.path.length - right.note.path.length ||
        left.note.path.toLowerCase().localeCompare(right.note.path.toLowerCase()),
    )
    .map(({ note }) => ({ kind: "note", note }));
}

function noteRank(query: string, note: QuickNote): number | null {
  const stem = note.name.replace(/\.md$/i, "").toLowerCase();
  const path = note.path.toLowerCase();
  if (stem === query) {
    return 0;
  }
  if (stem.startsWith(query)) {
    return 1;
  }
  if (stem.includes(query)) {
    return 2;
  }
  if (path.includes(query)) {
    return 3;
  }
  return null;
}

function compareFrequency(
  left: QuickNote,
  right: QuickNote,
  counts: Record<string, number>,
): number {
  return (counts[right.path] ?? 0) - (counts[left.path] ?? 0);
}

function compareName(left: QuickNote, right: QuickNote): number {
  return left.name.toLowerCase().localeCompare(right.name.toLowerCase());
}
