const STORAGE_KEY = "amethyst-note-opens";

type OpenStore = Record<string, Record<string, number>>;

function readStore(): OpenStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {};
    }
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed as OpenStore;
  } catch {
    return {};
  }
}

export function readOpenCounts(vaultPath: string): Record<string, number> {
  const counts = readStore()[vaultPath];
  if (!counts || typeof counts !== "object") {
    return {};
  }
  return counts;
}

export function recordNoteOpen(vaultPath: string, notePath: string): void {
  const store = readStore();
  const counts = { ...store[vaultPath] };
  counts[notePath] = (counts[notePath] ?? 0) + 1;
  store[vaultPath] = counts;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
