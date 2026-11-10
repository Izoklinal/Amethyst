import { invoke } from "@tauri-apps/api/core";
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
