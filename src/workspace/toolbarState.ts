export const toolbarButtons = [
  { commandId: "explorer.newNote", label: "New Note" },
  { commandId: "explorer.newFolder", label: "New Folder" },
] as const;

const STORAGE_KEY = "amethyst-toolbar-hidden";

const knownIds = new Set<string>(toolbarButtons.map((button) => button.commandId));

export function readHiddenToolbarButtons(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is string => typeof id === "string" && knownIds.has(id));
  } catch {
    return [];
  }
}

export function writeHiddenToolbarButtons(ids: readonly string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}
