import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

const STORAGE_KEY = "amethyst-vault";

export type VaultInfo = {
  name: string;
  path: string;
};

export type VaultEntry = {
  name: string;
  kind: "file" | "directory";
};

export function pickVaultDirectory(): Promise<string | null> {
  return open({
    directory: true,
    multiple: false,
    recursive: true,
    title: "Open Vault",
  });
}

export function openVault(path: string): Promise<VaultInfo> {
  return invoke<VaultInfo>("open_vault", { path });
}

export function closeVault(): Promise<void> {
  return invoke("close_vault");
}

export type NoteMatch = {
  path: string;
  name: string;
};

export function listVaultNotes(): Promise<NoteMatch[]> {
  return invoke<NoteMatch[]>("list_vault_notes");
}

export function listVaultDirectory(relativePath: string): Promise<VaultEntry[]> {
  return invoke<VaultEntry[]>("list_vault_directory", { relativePath });
}

export function createVaultFile(parent: string, name: string): Promise<void> {
  return invoke("create_vault_file", { parent, name });
}

export function createVaultDirectory(parent: string, name: string): Promise<void> {
  return invoke("create_vault_directory", { parent, name });
}

export function renameVaultEntry(relativePath: string, newName: string): Promise<void> {
  return invoke("rename_vault_entry", { relativePath, newName });
}

export function moveVaultEntry(
  relativePath: string,
  destinationDirectory: string,
): Promise<void> {
  return invoke("move_vault_entry", { relativePath, destinationDirectory });
}

export function trashVaultEntry(relativePath: string): Promise<void> {
  return invoke("trash_vault_entry", { relativePath });
}

export type ResolvedLink = {
  path: string;
  heading: string | null;
  block: string | null;
};

export function noteBlockOffset(text: string, block: string): Promise<number | null> {
  return invoke<number | null>("note_block_offset", { text, block });
}

export type PropertyValue =
  | { type: "text"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "date"; value: string }
  | { type: "list"; value: string[] }
  | { type: "tags"; value: string[] }
  | { type: "coordinates"; value: { lat: number; lng: number } }
  | { type: "unknown"; value: string };

export type NoteProperty = {
  key: string;
  value: PropertyValue;
};

export type NoteProperties = {
  valid: boolean;
  raw: string | null;
  properties: NoteProperty[];
};

export type PropertyChange =
  | { kind: "set"; key: string; value: PropertyValue }
  | { kind: "rename"; from: string; to: string }
  | { kind: "delete"; key: string }
  | { kind: "add"; key: string; value: PropertyValue };

export function noteProperties(text: string): Promise<NoteProperties> {
  return invoke<NoteProperties>("note_properties", { text });
}

export function noteApplyProperty(text: string, change: PropertyChange): Promise<string> {
  return invoke<string>("note_apply_property", { text, change });
}

export function resolveVaultWikilink(
  source: string,
  text: string,
  offset: number,
): Promise<ResolvedLink> {
  return invoke<ResolvedLink>("resolve_vault_wikilink", { source, text, offset });
}

export type EmbedKind = "note" | "image" | "file";

export type ResolvedEmbed = {
  path: string;
  kind: EmbedKind;
  heading: string | null;
};

export type VaultImage = {
  mediaType: string;
  base64: string;
};

export function resolveVaultEmbed(source: string, body: string): Promise<ResolvedEmbed> {
  return invoke<ResolvedEmbed>("resolve_vault_embed", { source, body });
}

export function readVaultImage(relativePath: string): Promise<VaultImage> {
  return invoke<VaultImage>("read_vault_image", { relativePath });
}

export function vaultAbsolutePath(relativePath: string): Promise<string> {
  return invoke<string>("vault_absolute_path", { relativePath });
}

export type Backlink = {
  path: string;
  name: string;
};

export type OpenNoteText = {
  path: string;
  text: string;
};

export type Heading = {
  level: number;
  text: string;
  offset: number;
};

export function noteOutline(text: string): Promise<Heading[]> {
  return invoke<Heading[]>("note_outline", { text });
}

export function vaultBacklinks(
  target: string,
  openNotes: OpenNoteText[],
): Promise<Backlink[]> {
  return invoke<Backlink[]>("vault_backlinks", { target, openNotes });
}

export function readVaultNote(relativePath: string): Promise<string> {
  return invoke<string>("read_vault_note", { relativePath });
}

export function writeVaultNote(
  relativePath: string,
  original: string,
  content: string,
): Promise<void> {
  return invoke("write_vault_note", { relativePath, original, content });
}

export function onVaultChanged(handler: () => void): Promise<() => void> {
  return listen("vault-changed", () => {
    handler();
  });
}

export function readStoredVaultPath(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function writeStoredVaultPath(path: string): void {
  localStorage.setItem(STORAGE_KEY, path);
}

export function clearStoredVaultPath(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function vaultErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "The vault could not be opened";
}
