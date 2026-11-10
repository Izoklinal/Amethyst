import { invoke } from "@tauri-apps/api/core";

export function coreStatus(): Promise<string> {
  return invoke<string>("core_status");
}
