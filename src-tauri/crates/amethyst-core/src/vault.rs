use std::cmp::Ordering;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

use serde::{Deserialize, Serialize};

/// An opened vault. The root is a canonical directory path.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Vault {
    root: PathBuf,
}

/// Folder name and canonical path returned to the application layer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultInfo {
    pub name: String,
    pub path: String,
}

/// One child of a vault directory. Contents of the child are not read.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    pub name: String,
    pub kind: EntryKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Directory,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VaultError {
    NotFound,
    NotADirectory,
    NotAccessible,
    OutsideVault,
    AlreadyExists,
    InvalidName,
    Conflict,
    NotUtf8,
    TooLarge,
}

const TRASH_DIRECTORY: &str = ".trash";
const MAX_NAME_LEN: usize = 255;
const MAX_NOTE_BYTES: u64 = 8 * 1024 * 1024;
static WRITE_COUNTER: AtomicU64 = AtomicU64::new(0);

impl std::fmt::Display for VaultError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::NotFound => "Folder not found",
            Self::NotADirectory => "Path is not a folder",
            Self::NotAccessible => "Folder is not accessible",
            Self::OutsideVault => "Path is outside the vault",
            Self::AlreadyExists => "An item with that name already exists",
            Self::InvalidName => "The name is not valid",
            Self::Conflict => "The note changed on disk",
            Self::NotUtf8 => "The note is not UTF-8 text",
            Self::TooLarge => "The note is too large to open",
        })
    }
}

impl std::error::Error for VaultError {}

impl Vault {
    /// Opens an existing directory. Does not create files or require `.obsidian`.
    pub fn open(path: &Path) -> Result<Self, VaultError> {
        let root = path.canonicalize().map_err(map_io)?;
        if !root.is_dir() {
            return Err(VaultError::NotADirectory);
        }
        Ok(Self { root })
    }

    pub fn info(&self) -> VaultInfo {
        VaultInfo {
            name: folder_name(&self.root),
            path: display_path(&self.root),
        }
    }

    pub(crate) fn root(&self) -> &Path {
        &self.root
    }

    /// Lists one directory level. `relative_path` is empty for the vault root.
    pub fn list(&self, relative_path: &str) -> Result<Vec<DirectoryEntry>, VaultError> {
        let directory = self.resolve(relative_path)?;
        if !directory.is_dir() {
            return Err(VaultError::NotADirectory);
        }

        let mut entries = Vec::new();
        let children = fs::read_dir(&directory).map_err(map_io)?;
        for child in children {
            let child = child.map_err(map_io)?;
            let name = child.file_name();
            if name.is_empty() {
                continue;
            }
            let canonical = match child.path().canonicalize() {
                Ok(path) => path,
                Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
                Err(error) => return Err(map_io(error)),
            };
            if !canonical.starts_with(&self.root) {
                continue;
            }
            let kind = if canonical.is_dir() {
                EntryKind::Directory
            } else {
                EntryKind::File
            };
            entries.push(DirectoryEntry {
                name: name.to_string_lossy().into_owned(),
                kind,
            });
        }

        entries.sort_by(compare_entries);
        Ok(entries)
    }

    /// Creates an empty file. A name without an extension becomes a Markdown file.
    pub fn create_file(&self, parent: &str, name: &str) -> Result<(), VaultError> {
        let name = file_name_with_extension(name)?;
        let directory = self.resolve_directory(parent)?;
        let target = child_path(&directory, &name)?;
        if target.exists() {
            return Err(VaultError::AlreadyExists);
        }
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
            .map_err(map_io)?;
        Ok(())
    }

    /// Creates one directory in an existing parent. Missing parents are not created.
    pub fn create_directory(&self, parent: &str, name: &str) -> Result<(), VaultError> {
        validate_entry_name(name)?;
        let directory = self.resolve_directory(parent)?;
        let target = child_path(&directory, name)?;
        fs::create_dir(&target).map_err(map_io)
    }

    /// Renames one file or folder inside its current parent.
    pub fn rename_entry(&self, relative_path: &str, new_name: &str) -> Result<(), VaultError> {
        validate_entry_name(new_name)?;
        let source = self.resolve_entry(relative_path)?;
        let current_name = entry_name(&source)?;
        if current_name == new_name {
            return Ok(());
        }
        let parent = source.parent().ok_or(VaultError::InvalidName)?;
        let target = child_path(parent, new_name)?;
        if target.exists() {
            return Err(VaultError::AlreadyExists);
        }
        fs::rename(&source, &target).map_err(map_io)
    }

    /// Moves one file or folder into another directory of this vault.
    pub fn move_entry(
        &self,
        relative_path: &str,
        destination_directory: &str,
    ) -> Result<(), VaultError> {
        let source = self.resolve_entry(relative_path)?;
        let destination = self.resolve_directory(destination_directory)?;
        if source.is_dir() && (destination == source || destination.starts_with(&source)) {
            return Err(VaultError::InvalidName);
        }
        let target = join_existing_name(&destination, &entry_name(&source)?)?;
        if target == source {
            return Ok(());
        }
        if target.exists() {
            return Err(VaultError::AlreadyExists);
        }
        fs::rename(&source, &target).map_err(map_io)
    }

    /// Moves one file or folder into `.trash`, keeping its relative path.
    pub fn trash(&self, relative_path: &str) -> Result<(), VaultError> {
        if is_under_trash(relative_path) {
            return Err(VaultError::InvalidName);
        }
        let source = self.resolve_entry(relative_path)?;
        let trash_root = self.ensure_trash_directory()?;
        if source.starts_with(&trash_root) {
            return Err(VaultError::InvalidName);
        }
        let relative = source
            .strip_prefix(&self.root)
            .map_err(|_| VaultError::OutsideVault)?;
        let name = entry_name(&source)?;
        let parent = relative.parent().unwrap_or(Path::new(""));
        let destination_parent = trash_root.join(parent);
        fs::create_dir_all(&destination_parent).map_err(map_io)?;
        let destination_parent = destination_parent.canonicalize().map_err(map_io)?;
        if !destination_parent.starts_with(&trash_root) {
            return Err(VaultError::OutsideVault);
        }
        let destination = unique_trash_path(&destination_parent, &name)?;
        fs::rename(&source, &destination).map_err(map_io)
    }

    /// Reads one Markdown note without changing it.
    pub fn read_note(&self, relative_path: &str) -> Result<String, VaultError> {
        let path = self.resolve_entry(relative_path)?;
        read_markdown_file(&path)
    }

    /// Replaces a Markdown note only when its current text still matches `original`.
    pub fn write_note(
        &self,
        relative_path: &str,
        original: &str,
        updated: &str,
    ) -> Result<(), VaultError> {
        let path = self.resolve_entry(relative_path)?;
        let current = read_markdown_file(&path)?;
        if current != original {
            return Err(VaultError::Conflict);
        }
        if current == updated {
            return Ok(());
        }
        let parent = path.parent().ok_or(VaultError::InvalidName)?;
        let temporary = temporary_write_path(parent);
        if let Err(error) = write_new_file(&temporary, updated) {
            let _ = fs::remove_file(&temporary);
            return Err(error);
        }
        if let Err(error) = replace_file(&temporary, &path) {
            let _ = fs::remove_file(&temporary);
            return Err(map_io(error));
        }
        Ok(())
    }

    fn resolve_directory(&self, relative_path: &str) -> Result<PathBuf, VaultError> {
        let path = self.resolve(relative_path)?;
        if !path.is_dir() {
            return Err(VaultError::NotADirectory);
        }
        Ok(path)
    }

    fn resolve_entry(&self, relative_path: &str) -> Result<PathBuf, VaultError> {
        if relative_path.is_empty() {
            return Err(VaultError::InvalidName);
        }
        self.resolve(relative_path)
    }

    fn ensure_trash_directory(&self) -> Result<PathBuf, VaultError> {
        let path = self.root.join(TRASH_DIRECTORY);
        if path.is_file() {
            return Err(VaultError::AlreadyExists);
        }
        if !path.exists() {
            fs::create_dir(&path).map_err(map_io)?;
        }
        let canonical = path.canonicalize().map_err(map_io)?;
        if !canonical.is_dir() || !canonical.starts_with(&self.root) || canonical == self.root {
            return Err(VaultError::OutsideVault);
        }
        Ok(canonical)
    }

    fn resolve(&self, relative_path: &str) -> Result<PathBuf, VaultError> {
        if relative_path.is_empty() {
            return Ok(self.root.clone());
        }

        let relative = Path::new(relative_path);
        if relative.is_absolute() {
            return Err(VaultError::OutsideVault);
        }
        for component in relative.components() {
            match component {
                Component::Normal(_) | Component::CurDir => {}
                Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                    return Err(VaultError::OutsideVault);
                }
            }
        }

        let canonical = self.root.join(relative).canonicalize().map_err(map_io)?;
        if !canonical.starts_with(&self.root) {
            return Err(VaultError::OutsideVault);
        }
        Ok(canonical)
    }
}

fn compare_entries(left: &DirectoryEntry, right: &DirectoryEntry) -> Ordering {
    kind_rank(left.kind)
        .cmp(&kind_rank(right.kind))
        .then_with(|| {
            left.name
                .to_lowercase()
                .cmp(&right.name.to_lowercase())
                .then_with(|| left.name.cmp(&right.name))
        })
}

fn kind_rank(kind: EntryKind) -> u8 {
    match kind {
        EntryKind::Directory => 0,
        EntryKind::File => 1,
    }
}

fn folder_name(path: &Path) -> String {
    match path.file_name() {
        Some(name) => name.to_string_lossy().into_owned(),
        None => display_path(path),
    }
}

fn display_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    text.strip_prefix(r"\\?\")
        .unwrap_or(text.as_ref())
        .to_string()
}

fn read_markdown_file(path: &Path) -> Result<String, VaultError> {
    if !path.is_file() {
        return Err(VaultError::InvalidName);
    }
    let name = entry_name(path)?;
    if !is_markdown_name(&name) {
        return Err(VaultError::InvalidName);
    }
    let metadata = fs::metadata(path).map_err(map_io)?;
    if metadata.len() > MAX_NOTE_BYTES {
        return Err(VaultError::TooLarge);
    }
    let bytes = fs::read(path).map_err(map_io)?;
    String::from_utf8(bytes).map_err(|_| VaultError::NotUtf8)
}

fn is_markdown_name(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
}

fn temporary_write_path(directory: &Path) -> PathBuf {
    let id = WRITE_COUNTER.fetch_add(1, AtomicOrdering::Relaxed);
    directory.join(format!(".amethyst-write-{}-{id}.tmp", std::process::id()))
}

fn write_new_file(path: &Path, content: &str) -> Result<(), VaultError> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(map_io)?;
    file.write_all(content.as_bytes()).map_err(map_io)?;
    file.sync_all().map_err(map_io)?;
    Ok(())
}

fn replace_file(temporary: &Path, target: &Path) -> io::Result<()> {
    #[cfg(windows)]
    {
        replace_file_windows(temporary, target)
    }
    #[cfg(not(windows))]
    {
        fs::rename(temporary, target)
    }
}

#[cfg(windows)]
fn replace_file_windows(temporary: &Path, target: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;

    let source: Vec<u16> = temporary
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let destination: Vec<u16> = target
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    const MOVEFILE_REPLACE_EXISTING: u32 = 1;
    const MOVEFILE_WRITE_THROUGH: u32 = 8;
    // SAFETY: both pointers refer to null-terminated UTF-16 paths that outlive the call.
    let replaced = unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if replaced == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(windows)]
#[link(name = "kernel32")]
unsafe extern "system" {
    fn MoveFileExW(existing: *const u16, new: *const u16, flags: u32) -> i32;
}

fn map_io(error: io::Error) -> VaultError {
    match error.kind() {
        io::ErrorKind::NotFound => VaultError::NotFound,
        io::ErrorKind::AlreadyExists => VaultError::AlreadyExists,
        _ => VaultError::NotAccessible,
    }
}

fn file_name_with_extension(name: &str) -> Result<String, VaultError> {
    validate_entry_name(name)?;
    if Path::new(name)
        .extension()
        .is_some_and(|extension| !extension.is_empty())
    {
        return Ok(name.to_string());
    }
    let with_extension = format!("{name}.md");
    validate_entry_name(&with_extension)?;
    Ok(with_extension)
}

fn validate_entry_name(name: &str) -> Result<(), VaultError> {
    if name.is_empty()
        || name.chars().count() > MAX_NAME_LEN
        || name == "."
        || name == ".."
        || name.ends_with(' ')
        || name.ends_with('.')
    {
        return Err(VaultError::InvalidName);
    }
    if name.chars().any(is_forbidden_name_char) || is_windows_device_name(name) {
        return Err(VaultError::InvalidName);
    }
    Ok(())
}

fn is_forbidden_name_char(character: char) -> bool {
    character.is_control()
        || matches!(
            character,
            '<' | '>' | ':' | '"' | '|' | '?' | '*' | '/' | '\\'
        )
}

fn is_windows_device_name(name: &str) -> bool {
    let base = match name.split_once('.') {
        Some((base, extension)) if !base.is_empty() && !extension.is_empty() => base,
        _ => name,
    };
    let upper = base.to_ascii_uppercase();
    if matches!(upper.as_str(), "CON" | "PRN" | "AUX" | "NUL") {
        return true;
    }
    let bytes = upper.as_bytes();
    bytes.len() == 4
        && (bytes.starts_with(b"COM") || bytes.starts_with(b"LPT"))
        && bytes[3].is_ascii_digit()
        && bytes[3] != b'0'
}

fn join_existing_name(directory: &Path, name: &str) -> Result<PathBuf, VaultError> {
    if name.is_empty() || name == "." || name == ".." || name.contains(['/', '\\']) {
        return Err(VaultError::InvalidName);
    }
    let child = directory.join(name);
    if !child.starts_with(directory) {
        return Err(VaultError::OutsideVault);
    }
    Ok(child)
}

fn child_path(directory: &Path, name: &str) -> Result<PathBuf, VaultError> {
    validate_entry_name(name)?;
    let child = directory.join(name);
    if !child.starts_with(directory) {
        return Err(VaultError::OutsideVault);
    }
    Ok(child)
}

fn entry_name(path: &Path) -> Result<String, VaultError> {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(ToString::to_string)
        .ok_or(VaultError::InvalidName)
}

fn is_under_trash(relative_path: &str) -> bool {
    Path::new(relative_path).components().next().is_some_and(
        |component| matches!(component, Component::Normal(name) if name == TRASH_DIRECTORY),
    )
}

fn unique_trash_path(directory: &Path, name: &str) -> Result<PathBuf, VaultError> {
    let direct = directory.join(name);
    if !direct.exists() {
        return Ok(direct);
    }
    let path = Path::new(name);
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or(VaultError::InvalidName)?;
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .filter(|extension| !extension.is_empty());
    for index in 2..10_000 {
        let candidate_name = match extension {
            Some(extension) => format!("{stem} ({index}).{extension}"),
            None => format!("{stem} ({index})"),
        };
        let candidate = directory.join(&candidate_name);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(VaultError::AlreadyExists)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;

    static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

    struct TempWorkspace {
        path: PathBuf,
    }

    impl TempWorkspace {
        fn new() -> Self {
            let unique = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
            let nanos = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock should be after the unix epoch")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "amethyst-vault-test-{}-{unique}-{nanos}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("temporary directory should be created");
            Self { path }
        }
    }

    impl Drop for TempWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn names(entries: &[DirectoryEntry]) -> Vec<&str> {
        entries.iter().map(|entry| entry.name.as_str()).collect()
    }

    #[test]
    fn lists_one_level_and_preserves_hidden_and_unicode_names() {
        let workspace = TempWorkspace::new();
        let root = workspace.path.join("Vault");
        fs::create_dir_all(root.join("Notes").join("вложенная")).expect("nested folder");
        fs::create_dir_all(root.join(".obsidian")).expect("hidden folder");
        fs::create_dir_all(root.join("beta")).expect("folder");
        fs::create_dir_all(root.join("M")).expect("folder");
        fs::write(root.join("readme.md"), "hello").expect("file");
        fs::write(root.join("A.md"), "a").expect("file");
        fs::write(root.join("b.md"), "b").expect("file");
        fs::write(root.join("Notes").join("заметка.md"), "текст").expect("unicode file");

        let before = fs::read_dir(&root).expect("read root").count();
        let vault = Vault::open(&root).expect("open vault");
        let after = fs::read_dir(&root).expect("read root").count();
        assert_eq!(before, after);
        assert_eq!(vault.info().name, "Vault");

        let listed = vault.list("").expect("list root");
        assert_eq!(
            names(&listed),
            vec![
                ".obsidian",
                "beta",
                "M",
                "Notes",
                "A.md",
                "b.md",
                "readme.md"
            ]
        );
        assert!(listed.iter().all(|entry| entry.name != "заметка.md"));

        let notes = vault.list("Notes").expect("list notes");
        assert_eq!(
            notes,
            vec![
                DirectoryEntry {
                    name: "вложенная".to_string(),
                    kind: EntryKind::Directory,
                },
                DirectoryEntry {
                    name: "заметка.md".to_string(),
                    kind: EntryKind::File,
                },
            ]
        );
    }

    #[test]
    fn rejects_missing_file_and_escaping_paths() {
        let workspace = TempWorkspace::new();
        let root = workspace.path.join("Vault");
        let outside = workspace.path.join("outside");
        fs::create_dir_all(&root).expect("vault");
        fs::create_dir_all(&outside).expect("outside");
        fs::write(root.join("note.md"), "note").expect("note");
        fs::write(outside.join("secret.md"), "secret").expect("secret");

        let missing = workspace.path.join("missing");
        assert_eq!(Vault::open(&missing), Err(VaultError::NotFound));
        assert_eq!(
            Vault::open(&root.join("note.md")),
            Err(VaultError::NotADirectory)
        );

        let vault = Vault::open(&root).expect("open vault");
        assert_eq!(vault.list("note.md"), Err(VaultError::NotADirectory));
        assert_eq!(vault.list("missing"), Err(VaultError::NotFound));
        assert_eq!(vault.list(".."), Err(VaultError::OutsideVault));
        assert_eq!(vault.list(r"../outside"), Err(VaultError::OutsideVault));
        assert_eq!(
            vault.list(outside.to_str().expect("outside path is unicode")),
            Err(VaultError::OutsideVault)
        );
    }

    #[test]
    fn permission_denied_is_not_accessible() {
        let error = io::Error::new(io::ErrorKind::PermissionDenied, "denied");
        assert_eq!(map_io(error), VaultError::NotAccessible);
    }

    #[test]
    fn hides_symlink_that_points_outside_the_vault() {
        let workspace = TempWorkspace::new();
        let root = workspace.path.join("Vault");
        let outside = workspace.path.join("outside");
        fs::create_dir_all(&root).expect("vault");
        fs::create_dir_all(&outside).expect("outside");
        fs::write(root.join("inside.md"), "inside").expect("inside");
        fs::write(outside.join("secret.md"), "secret").expect("secret");

        let link = root.join("escape");
        if make_directory_link(&outside, &link).is_err() {
            return;
        }

        let vault = Vault::open(&root).expect("open vault");
        let listed = vault.list("").expect("list root");
        assert!(listed.iter().all(|entry| entry.name != "escape"));
        assert!(listed.iter().any(|entry| entry.name == "inside.md"));
        assert_eq!(vault.list("escape"), Err(VaultError::OutsideVault));
    }

    #[test]
    fn creates_renames_and_moves_without_overwriting() {
        let workspace = TempWorkspace::new();
        let root = workspace.path.join("Vault");
        fs::create_dir_all(root.join("Notes")).expect("notes");
        fs::write(root.join("keep.md"), "keep").expect("keep");
        let vault = Vault::open(&root).expect("open");

        vault.create_file("", "заметка").expect("create note");
        vault
            .create_file("Notes", "image.png")
            .expect("create image");
        vault
            .create_directory("", "вложенная")
            .expect("create folder");
        assert_eq!(fs::read(root.join("заметка.md")).expect("read"), b"");
        assert_eq!(
            fs::read(root.join("Notes").join("image.png")).expect("read"),
            b""
        );
        assert!(root.join("вложенная").is_dir());
        assert_eq!(fs::read(root.join("keep.md")).expect("keep"), b"keep");

        assert_eq!(
            vault.create_file("", "заметка"),
            Err(VaultError::AlreadyExists)
        );
        assert_eq!(fs::read(root.join("заметка.md")).expect("read"), b"");
        assert_eq!(
            vault.create_directory("missing", "child"),
            Err(VaultError::NotFound)
        );
        assert_eq!(vault.create_file("..", "x"), Err(VaultError::OutsideVault));
        assert_eq!(
            vault.create_directory("", "a/b"),
            Err(VaultError::InvalidName)
        );
        assert_eq!(vault.create_file("", "CON"), Err(VaultError::InvalidName));
        assert_eq!(
            vault.create_file("", "com1.txt"),
            Err(VaultError::InvalidName)
        );
        assert_eq!(
            vault.create_directory("", "trailing."),
            Err(VaultError::InvalidName)
        );
        assert_eq!(
            vault.create_directory("", &"a".repeat(256)),
            Err(VaultError::InvalidName)
        );

        vault
            .rename_entry("заметка.md", "переименована.md")
            .expect("rename");
        assert!(!root.join("заметка.md").exists());
        assert!(root.join("переименована.md").is_file());
        vault
            .rename_entry("переименована.md", "переименована.md")
            .expect("same name");
        fs::write(root.join("keep.md"), "keep").expect("keep");
        assert_eq!(
            vault.rename_entry("переименована.md", "keep.md"),
            Err(VaultError::AlreadyExists)
        );
        assert_eq!(fs::read(root.join("keep.md")).expect("keep"), b"keep");
        assert!(root.join("переименована.md").is_file());

        vault.move_entry("переименована.md", "Notes").expect("move");
        assert_eq!(
            fs::read(root.join("Notes").join("переименована.md")).expect("moved"),
            b""
        );
        assert!(!root.join("переименована.md").exists());
        fs::create_dir_all(root.join("Notes").join("sub")).expect("sub");
        assert_eq!(
            vault.move_entry("Notes", "Notes/sub"),
            Err(VaultError::InvalidName)
        );
        assert!(root.join("Notes").join("переименована.md").is_file());
        assert!(root.join("Notes").join("sub").is_dir());
        vault
            .move_entry("Notes/image.png", "")
            .expect("move to root");
        assert!(root.join("image.png").is_file());
    }

    #[test]
    fn trash_preserves_bytes_and_refuses_a_second_delete() {
        let workspace = TempWorkspace::new();
        let root = workspace.path.join("Vault");
        fs::create_dir_all(root.join("Notes")).expect("notes");
        fs::write(root.join("Notes").join("a.md"), "one").expect("first");
        fs::write(root.join("sibling.md"), "sibling").expect("sibling");
        let vault = Vault::open(&root).expect("open");
        assert!(!root.join(".trash").exists());

        vault.trash("Notes/a.md").expect("trash");
        assert!(!root.join("Notes").join("a.md").exists());
        assert_eq!(
            fs::read(root.join(".trash").join("Notes").join("a.md")).expect("trashed"),
            b"one"
        );
        assert_eq!(
            fs::read(root.join("sibling.md")).expect("sibling"),
            b"sibling"
        );

        fs::write(root.join("Notes").join("a.md"), "two").expect("second");
        vault.trash("Notes/a.md").expect("trash again");
        assert_eq!(
            fs::read(root.join(".trash").join("Notes").join("a.md")).expect("first copy"),
            b"one"
        );
        assert_eq!(
            fs::read(root.join(".trash").join("Notes").join("a (2).md")).expect("second copy"),
            b"two"
        );
        assert!(!root.join("Notes").join("a.md").exists());

        assert_eq!(vault.trash(".trash"), Err(VaultError::InvalidName));
        assert_eq!(
            vault.trash(".trash/Notes/a.md"),
            Err(VaultError::InvalidName)
        );
        assert!(root.join(".trash").join("Notes").join("a.md").is_file());
        vault
            .move_entry(".trash/Notes/a.md", "Notes")
            .expect("restore");
        assert_eq!(
            fs::read(root.join("Notes").join("a.md")).expect("restored"),
            b"one"
        );
    }

    #[test]
    fn write_note_preserves_text_and_refuses_a_stale_save() {
        let workspace = TempWorkspace::new();
        let root = workspace.path.join("Vault");
        fs::create_dir_all(root.join("Notes")).expect("notes");
        fs::write(root.join("Notes").join("заметка.md"), "один\r\n").expect("note");
        fs::write(root.join("Notes").join("image.png"), [0x89, 0x50]).expect("image");
        fs::write(root.join("sibling.md"), "sibling").expect("sibling");
        let vault = Vault::open(&root).expect("open");

        assert_eq!(
            vault.read_note("Notes/заметка.md").expect("read"),
            "один\r\n"
        );
        vault
            .write_note("Notes/заметка.md", "один\r\n", "два\r\n")
            .expect("save");
        assert_eq!(
            fs::read(root.join("Notes").join("заметка.md")).expect("saved"),
            "два\r\n".as_bytes()
        );
        assert_eq!(
            fs::read(root.join("sibling.md")).expect("sibling"),
            b"sibling"
        );
        assert!(
            fs::read_dir(&root)
                .expect("root")
                .filter_map(Result::ok)
                .all(|entry| !entry
                    .file_name()
                    .to_string_lossy()
                    .contains("amethyst-write"))
        );

        fs::write(root.join("Notes").join("заметка.md"), "снаружи").expect("external");
        assert_eq!(
            vault.write_note("Notes/заметка.md", "два\r\n", "из редактора"),
            Err(VaultError::Conflict)
        );
        assert_eq!(
            fs::read(root.join("Notes").join("заметка.md")).expect("unchanged"),
            "снаружи".as_bytes()
        );
        assert_eq!(
            vault.read_note("Notes/image.png"),
            Err(VaultError::InvalidName)
        );
        assert_eq!(
            fs::read(root.join("Notes").join("image.png")).expect("image"),
            [0x89, 0x50]
        );
        fs::write(root.join("binary.md"), [0xff, 0xfe]).expect("binary");
        assert_eq!(vault.read_note("binary.md"), Err(VaultError::NotUtf8));
        assert_eq!(
            fs::read(root.join("binary.md")).expect("binary"),
            [0xff, 0xfe]
        );
        assert_eq!(vault.read_note(".."), Err(VaultError::OutsideVault));
    }

    fn make_directory_link(target: &Path, link: &Path) -> io::Result<()> {
        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_dir(target, link)
        }
        #[cfg(not(windows))]
        {
            std::os::unix::fs::symlink(target, link)
        }
    }
}
