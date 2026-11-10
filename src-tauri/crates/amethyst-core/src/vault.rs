use std::cmp::Ordering;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

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
}

impl std::fmt::Display for VaultError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::NotFound => "Folder not found",
            Self::NotADirectory => "Path is not a folder",
            Self::NotAccessible => "Folder is not accessible",
            Self::OutsideVault => "Path is outside the vault",
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

fn map_io(error: io::Error) -> VaultError {
    match error.kind() {
        io::ErrorKind::NotFound => VaultError::NotFound,
        _ => VaultError::NotAccessible,
    }
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
