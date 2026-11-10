use std::path::Path;
use std::sync::Mutex;

use amethyst_core::vault::{DirectoryEntry, Vault, VaultError, VaultInfo};
use amethyst_core::watch::VaultWatcher;
use tauri::{AppHandle, Emitter, State};

struct VaultState {
    vault: Option<Vault>,
    watcher: Option<VaultWatcher>,
}

struct VaultSession(Mutex<VaultState>);

fn lock_session(session: &VaultSession) -> Result<std::sync::MutexGuard<'_, VaultState>, String> {
    session
        .0
        .lock()
        .map_err(|_| "Vault state is unavailable".to_string())
}

fn with_vault<T>(
    session: &VaultSession,
    operation: impl FnOnce(&Vault) -> Result<T, VaultError>,
) -> Result<T, String> {
    let guard = lock_session(session)?;
    let vault = guard.vault.as_ref().ok_or("No vault is open")?;
    operation(vault).map_err(|error| error.to_string())
}

fn watch_vault(app: &AppHandle, vault: &Vault) -> Result<VaultWatcher, String> {
    let app = app.clone();
    vault
        .watch(move || {
            let _ = app.emit("vault-changed", ());
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn core_status() -> String {
    format!(
        "{} {}",
        amethyst_core::application_name(),
        amethyst_core::version()
    )
}

#[tauri::command]
fn open_vault(
    app: AppHandle,
    session: State<VaultSession>,
    path: String,
) -> Result<VaultInfo, String> {
    let vault = Vault::open(Path::new(&path)).map_err(|error| error.to_string())?;
    let info = vault.info();
    let watcher = watch_vault(&app, &vault)?;
    let mut guard = lock_session(&session)?;
    guard.watcher = Some(watcher);
    guard.vault = Some(vault);
    Ok(info)
}

#[tauri::command]
fn close_vault(session: State<VaultSession>) -> Result<(), String> {
    let mut guard = lock_session(&session)?;
    guard.watcher = None;
    guard.vault = None;
    Ok(())
}

#[tauri::command]
fn vault_info(session: State<VaultSession>) -> Result<Option<VaultInfo>, String> {
    let guard = lock_session(&session)?;
    Ok(guard.vault.as_ref().map(Vault::info))
}

#[tauri::command]
fn list_vault_directory(
    session: State<VaultSession>,
    relative_path: String,
) -> Result<Vec<DirectoryEntry>, String> {
    with_vault(&session, |vault| vault.list(&relative_path))
}

#[tauri::command]
fn create_vault_file(
    session: State<VaultSession>,
    parent: String,
    name: String,
) -> Result<(), String> {
    with_vault(&session, |vault| vault.create_file(&parent, &name))
}

#[tauri::command]
fn create_vault_directory(
    session: State<VaultSession>,
    parent: String,
    name: String,
) -> Result<(), String> {
    with_vault(&session, |vault| vault.create_directory(&parent, &name))
}

#[tauri::command]
fn rename_vault_entry(
    session: State<VaultSession>,
    relative_path: String,
    new_name: String,
) -> Result<(), String> {
    with_vault(&session, |vault| {
        vault.rename_entry(&relative_path, &new_name)
    })
}

#[tauri::command]
fn move_vault_entry(
    session: State<VaultSession>,
    relative_path: String,
    destination_directory: String,
) -> Result<(), String> {
    with_vault(&session, |vault| {
        vault.move_entry(&relative_path, &destination_directory)
    })
}

#[tauri::command]
fn trash_vault_entry(session: State<VaultSession>, relative_path: String) -> Result<(), String> {
    with_vault(&session, |vault| vault.trash(&relative_path))
}

#[tauri::command]
fn read_vault_note(session: State<VaultSession>, relative_path: String) -> Result<String, String> {
    with_vault(&session, |vault| vault.read_note(&relative_path))
}

#[tauri::command]
fn write_vault_note(
    session: State<VaultSession>,
    relative_path: String,
    original: String,
    content: String,
) -> Result<(), String> {
    with_vault(&session, |vault| {
        vault.write_note(&relative_path, &original, &content)
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(VaultSession(Mutex::new(VaultState {
            vault: None,
            watcher: None,
        })))
        .invoke_handler(tauri::generate_handler![
            core_status,
            open_vault,
            close_vault,
            vault_info,
            list_vault_directory,
            create_vault_file,
            create_vault_directory,
            rename_vault_entry,
            move_vault_entry,
            trash_vault_entry,
            read_vault_note,
            write_vault_note
        ])
        .run(tauri::generate_context!())
        // The process cannot continue if the Tauri event loop fails to start.
        .expect("error while running tauri application");
}
