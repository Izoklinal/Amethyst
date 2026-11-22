use std::path::Path;
use std::sync::Mutex;

use amethyst_core::links::{
    backlinks_to, block_offset, resolve_editor_link, resolve_embed, Backlink, OpenNote,
    ResolvedEmbed, ResolvedLink,
};
use amethyst_core::outline::{outline_of, Heading};
use amethyst_core::properties::{apply_property, read_properties, NoteProperties, PropertyChange};
use amethyst_core::vault::{DirectoryEntry, NoteMatch, Vault, VaultError, VaultInfo};
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
fn list_vault_notes(session: State<VaultSession>) -> Result<Vec<NoteMatch>, String> {
    with_vault(&session, |vault| vault.list_markdown_notes())
}

#[tauri::command]
fn note_outline(text: String) -> Vec<Heading> {
    outline_of(&text)
}

#[tauri::command]
fn note_block_offset(text: String, block: String) -> Option<usize> {
    block_offset(&text, &block)
}

#[tauri::command]
fn note_properties(text: String) -> NoteProperties {
    read_properties(&text)
}

#[tauri::command]
fn note_apply_property(text: String, change: PropertyChange) -> String {
    apply_property(&text, &change)
}

#[tauri::command]
fn vault_backlinks(
    session: State<VaultSession>,
    target: String,
    open_notes: Vec<OpenNote>,
) -> Result<Vec<Backlink>, String> {
    let guard = lock_session(&session)?;
    let vault = guard.vault.as_ref().ok_or("No vault is open")?;
    backlinks_to(vault, &target, &open_notes).map_err(|error| error.to_string())
}

#[tauri::command]
fn resolve_vault_wikilink(
    session: State<VaultSession>,
    source: String,
    text: String,
    offset: usize,
) -> Result<ResolvedLink, String> {
    let guard = lock_session(&session)?;
    let vault = guard.vault.as_ref().ok_or("No vault is open")?;
    resolve_editor_link(vault, &source, &text, offset).map_err(|error| error.to_string())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultImage {
    media_type: String,
    base64: String,
}

#[tauri::command]
fn resolve_vault_embed(
    session: State<VaultSession>,
    source: String,
    body: String,
) -> Result<ResolvedEmbed, String> {
    let guard = lock_session(&session)?;
    let vault = guard.vault.as_ref().ok_or("No vault is open")?;
    resolve_embed(vault, &source, &body).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_vault_image(
    session: State<VaultSession>,
    relative_path: String,
) -> Result<VaultImage, String> {
    with_vault(&session, |vault| {
        let bytes = vault.read_image(&relative_path)?;
        let media_type = image_media_type(&relative_path).ok_or(VaultError::InvalidName)?;
        Ok(VaultImage {
            media_type: media_type.to_string(),
            base64: base64_encode(&bytes),
        })
    })
}

#[tauri::command]
fn vault_absolute_path(
    session: State<VaultSession>,
    relative_path: String,
) -> Result<String, String> {
    with_vault(&session, |vault| vault.absolute_path(&relative_path))
}

fn image_media_type(path: &str) -> Option<&'static str> {
    let extension = Path::new(path).extension()?.to_str()?;
    match extension.to_ascii_lowercase().as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut encoded = String::new();
    let mut index = 0;
    while index + 3 <= bytes.len() {
        let chunk = u32::from(bytes[index]) << 16
            | u32::from(bytes[index + 1]) << 8
            | u32::from(bytes[index + 2]);
        encoded.push(TABLE[((chunk >> 18) & 63) as usize] as char);
        encoded.push(TABLE[((chunk >> 12) & 63) as usize] as char);
        encoded.push(TABLE[((chunk >> 6) & 63) as usize] as char);
        encoded.push(TABLE[(chunk & 63) as usize] as char);
        index += 3;
    }
    if index < bytes.len() {
        let first = bytes[index];
        encoded.push(TABLE[(first >> 2) as usize] as char);
        if index + 1 < bytes.len() {
            let second = bytes[index + 1];
            encoded.push(TABLE[(((first & 0x03) << 4) | (second >> 4)) as usize] as char);
            encoded.push(TABLE[((second & 0x0f) << 2) as usize] as char);
        } else {
            encoded.push(TABLE[((first & 0x03) << 4) as usize] as char);
            encoded.push('=');
        }
        encoded.push('=');
    }
    encoded
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
            list_vault_notes,
            note_outline,
            note_block_offset,
            note_properties,
            note_apply_property,
            vault_backlinks,
            resolve_vault_wikilink,
            resolve_vault_embed,
            read_vault_image,
            vault_absolute_path,
            read_vault_note,
            write_vault_note
        ])
        .run(tauri::generate_context!())
        // The process cannot continue if the Tauri event loop fails to start.
        .expect("error while running tauri application");
}
