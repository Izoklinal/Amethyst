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
