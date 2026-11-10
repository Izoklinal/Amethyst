use std::path::Path;
use std::sync::Mutex;

use amethyst_core::vault::{DirectoryEntry, Vault, VaultInfo};
use tauri::State;

struct VaultSession(Mutex<Option<Vault>>);

#[tauri::command]
fn core_status() -> String {
    format!(
        "{} {}",
        amethyst_core::application_name(),
        amethyst_core::version()
    )
}

#[tauri::command]
fn open_vault(session: State<VaultSession>, path: String) -> Result<VaultInfo, String> {
    let vault = Vault::open(Path::new(&path)).map_err(|error| error.to_string())?;
    let info = vault.info();
    let mut guard = session
        .0
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    *guard = Some(vault);
    Ok(info)
}

#[tauri::command]
fn close_vault(session: State<VaultSession>) -> Result<(), String> {
    let mut guard = session
        .0
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    *guard = None;
    Ok(())
}

#[tauri::command]
fn vault_info(session: State<VaultSession>) -> Result<Option<VaultInfo>, String> {
    let guard = session
        .0
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    Ok(guard.as_ref().map(Vault::info))
}

#[tauri::command]
fn list_vault_directory(
    session: State<VaultSession>,
    relative_path: String,
) -> Result<Vec<DirectoryEntry>, String> {
    let guard = session
        .0
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())?;
    let vault = guard.as_ref().ok_or("No vault is open")?;
    vault
        .list(&relative_path)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(VaultSession(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            core_status,
            open_vault,
            close_vault,
            vault_info,
            list_vault_directory
        ])
        .run(tauri::generate_context!())
        // The process cannot continue if the Tauri event loop fails to start.
        .expect("error while running tauri application");
}
