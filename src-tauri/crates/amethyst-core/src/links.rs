use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::vault::{EntryKind, Vault, VaultError};

/// Why a wikilink under the cursor cannot open a note.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LinkError {
    NoLink,
    SameNote,
    NotFound,
    Ambiguous,
    NotANote,
    Vault(VaultError),
}

impl std::fmt::Display for LinkError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NoLink => formatter.write_str("No link at the cursor."),
            Self::SameNote => formatter.write_str("This link stays in the current note."),
            Self::NotFound => formatter.write_str("No note matches that link."),
            Self::Ambiguous => formatter.write_str("More than one note matches that link."),
            Self::NotANote => formatter.write_str("Attachments cannot be opened as notes."),
            Self::Vault(error) => error.fmt(formatter),
        }
    }
}

/// A Markdown file that links to the requested note.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Backlink {
    pub path: String,
    pub name: String,
}

/// Editor text that replaces the copy of a note currently stored on disk.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenNote {
    pub path: String,
    pub text: String,
}

/// An existing note selected by a wikilink, plus an optional heading fragment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedLink {
    pub path: String,
    pub heading: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Wikilink {
    SameNote {
        heading: Option<String>,
    },
    Note {
        file: String,
        heading: Option<String>,
    },
}

/// Resolves the wikilink at a textarea cursor. `offset` counts UTF-16 code units.
///
/// The note text comes from the editor. This function does not read or write files
/// until it searches the vault for an existing Markdown target.
pub fn resolve_editor_link(
    vault: &Vault,
    source: &str,
    text: &str,
    offset: usize,
) -> Result<ResolvedLink, LinkError> {
    let link = wikilink_at(text, offset).ok_or(LinkError::NoLink)?;
    let (file, heading) = match link {
        Wikilink::SameNote { heading } => {
            let Some(heading) = heading else {
                return Err(LinkError::SameNote);
            };
            return Ok(ResolvedLink {
                path: source.replace('\\', "/"),
                heading: Some(heading),
            });
        }
        Wikilink::Note { file, heading } => (file, heading),
    };
    if is_attachment(&file) {
        return Err(LinkError::NotANote);
    }
    let files = markdown_files(vault)?;
    let path = if file.contains('/') || file.contains('\\') {
        resolve_path(&files, &file)?
    } else {
        resolve_name(&files, source, &file)?
    };
    Ok(ResolvedLink { path, heading })
}

/// What an embed displays. A file that is not a note or an image is named only.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EmbedKind {
    Note,
    Image,
    File,
}

/// A vault file selected by an embed, plus an optional heading fragment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedEmbed {
    pub path: String,
    pub kind: EmbedKind,
    pub heading: Option<String>,
}

/// Resolves the inside of `![[...]]`. This does not read or write the target.
pub fn resolve_embed(
    vault: &Vault,
    source: &str,
    body: &str,
) -> Result<ResolvedEmbed, LinkError> {
    let (file, heading) = split_embed(body).ok_or(LinkError::NoLink)?;
    if file.is_empty() {
        return Ok(ResolvedEmbed {
            path: source.replace('\\', "/"),
            kind: EmbedKind::Note,
            heading,
        });
    }
    let kind = embed_kind(&file);
    let files = without_trash(match kind {
        EmbedKind::Note => markdown_files(vault)?,
        EmbedKind::Image | EmbedKind::File => all_files(vault)?,
    });
    let path = if file.contains('/') || file.contains('\\') {
        resolve_path(&files, &file)?
    } else {
        resolve_name(&files, source, &file)?
    };
    Ok(ResolvedEmbed { path, kind, heading })
}

fn split_embed(body: &str) -> Option<(String, Option<String>)> {
    let main = body.split('|').next()?.trim();
    if main.is_empty() {
        return None;
    }
    let (file, heading) = match main.split_once('#') {
        Some((file, heading)) => (file.trim().to_string(), heading_text(heading)),
        None => (
            main.split('^').next().unwrap_or("").trim().to_string(),
            None,
        ),
    };
    if file.is_empty() && heading.is_none() {
        return None;
    }
    Some((file, heading))
}

fn embed_kind(file: &str) -> EmbedKind {
    match Path::new(file)
        .extension()
        .and_then(|extension| extension.to_str())
    {
        Some(extension) if is_image_extension(extension) => EmbedKind::Image,
        Some(extension) if !extension.eq_ignore_ascii_case("md") && !extension.is_empty() => {
            EmbedKind::File
        }
        _ => EmbedKind::Note,
    }
}

fn is_image_extension(extension: &str) -> bool {
    matches!(
        extension.to_ascii_lowercase().as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp"
    )
}

fn without_trash(files: Vec<String>) -> Vec<String> {
    files
        .into_iter()
        .filter(|path| !path.split('/').any(|part| part == ".trash"))
        .collect()
}

fn all_files(vault: &Vault) -> Result<Vec<String>, LinkError> {
    let mut files = Vec::new();
    collect_all(vault, "", &mut files)?;
    Ok(files)
}

fn collect_all(vault: &Vault, directory: &str, files: &mut Vec<String>) -> Result<(), LinkError> {
    let entries = vault.list(directory).map_err(LinkError::Vault)?;
    for entry in entries {
        if entry.kind == EntryKind::Directory && entry.name == ".trash" {
            continue;
        }
        let path = if directory.is_empty() {
            entry.name
        } else {
            format!("{directory}/{}", entry.name)
        };
        match entry.kind {
            EntryKind::Directory => collect_all(vault, &path, files)?,
            EntryKind::File => files.push(path),
        }
    }
    Ok(())
}

/// Notes that link to `target`. Reads files and does not write to the vault.
pub fn backlinks_to(
    vault: &Vault,
    target: &str,
    open_notes: &[OpenNote],
) -> Result<Vec<Backlink>, LinkError> {
    let files = markdown_files(vault)?;
    let Some(target_path) = canonical_note(&files, target).cloned() else {
        return Ok(Vec::new());
    };
    let mut found = Vec::new();
    for path in &files {
        if same_path(path, &target_path) {
            continue;
        }
        let Some(text) = note_text(vault, open_notes, path)? else {
            continue;
        };
        if !links_to(&files, path, &text, &target_path) {
            continue;
        }
        found.push(Backlink {
            name: path.rsplit('/').next().unwrap_or(path).to_string(),
            path: path.clone(),
        });
    }
    found.sort_by(|left, right| {
        left.name
            .to_lowercase()
            .cmp(&right.name.to_lowercase())
            .then_with(|| left.path.cmp(&right.path))
    });
    Ok(found)
}

fn note_text(
    vault: &Vault,
    open_notes: &[OpenNote],
    path: &str,
) -> Result<Option<String>, LinkError> {
    if let Some(open) = open_notes.iter().find(|note| same_path(&note.path, path)) {
        return Ok(Some(open.text.clone()));
    }
    match vault.read_note(path) {
        Ok(text) => Ok(Some(text)),
        Err(
            VaultError::NotFound
            | VaultError::NotAccessible
            | VaultError::NotUtf8
            | VaultError::TooLarge,
        ) => Ok(None),
        Err(error) => Err(LinkError::Vault(error)),
    }
}

fn links_to(files: &[String], source: &str, text: &str, target: &str) -> bool {
    find_wikilinks(text).into_iter().any(|found| {
        let Wikilink::Note { file, .. } = found.link else {
            return false;
        };
        if is_attachment(&file) {
            return false;
        }
        let resolved = if file.contains('/') || file.contains('\\') {
            resolve_path(files, &file)
        } else {
            resolve_name(files, source, &file)
        };
        matches!(resolved, Ok(path) if same_path(&path, target))
    })
}

fn canonical_note<'a>(files: &'a [String], target: &str) -> Option<&'a String> {
    files
        .iter()
        .find(|path| path.as_str() == target)
        .or_else(|| files.iter().find(|path| same_path(path, target)))
}

fn same_path(left: &str, right: &str) -> bool {
    left == right || left.to_lowercase() == right.to_lowercase()
}

struct FoundLink {
    from: usize,
    to: usize,
    link: Wikilink,
}

fn find_wikilinks(text: &str) -> Vec<FoundLink> {
    let units = code_units(text);
    let mut found = Vec::new();
    let mut index = 0;
    while index < units.len() {
        if units[index].code || units[index].ch != '[' {
            index += 1;
            continue;
        }
        if index + 1 >= units.len() || units[index + 1].code || units[index + 1].ch != '[' {
            index += 1;
            continue;
        }
        let start = if index > 0 && !units[index - 1].code && units[index - 1].ch == '!' {
            index - 1
        } else {
            index
        };
        let mut end = index + 2;
        let mut closed = None;
        while end + 1 < units.len() {
            if units[end].ch == '\n' || units[end].code {
                break;
            }
            if units[end].ch == ']' && !units[end + 1].code && units[end + 1].ch == ']' {
                closed = Some(end + 2);
                break;
            }
            end += 1;
        }
        let Some(close) = closed else {
            index += 1;
            continue;
        };
        let body: String = units[index + 2..close - 2]
            .iter()
            .map(|unit| unit.ch)
            .collect();
        if let Some(link) = classify(&body) {
            found.push(FoundLink {
                from: units[start].utf16,
                to: units[close - 1].utf16 + units[close - 1].ch.len_utf16(),
                link,
            });
        }
        index = close;
    }
    found
}

fn wikilink_at(text: &str, offset: usize) -> Option<Wikilink> {
    find_wikilinks(text)
        .into_iter()
        .find(|link| offset > link.from && offset <= link.to)
        .map(|link| link.link)
}

fn classify(body: &str) -> Option<Wikilink> {
    let target = body.split('|').next().unwrap_or("").trim();
    if target.is_empty() {
        return None;
    }
    let (file_and_block, heading) = match target.split_once('#') {
        Some((file, rest)) => (file, heading_text(rest)),
        None => (target, None),
    };
    let file = file_and_block
        .split('^')
        .next()
        .unwrap_or("")
        .trim()
        .replace('\\', "/");
    if file.is_empty() {
        Some(Wikilink::SameNote { heading })
    } else {
        Some(Wikilink::Note { file, heading })
    }
}

fn heading_text(rest: &str) -> Option<String> {
    let heading = rest.split('^').next().unwrap_or("").trim();
    if heading.is_empty() {
        None
    } else {
        Some(heading.to_string())
    }
}

pub(crate) struct Unit {
    pub(crate) ch: char,
    pub(crate) utf16: usize,
    pub(crate) code: bool,
}

pub(crate) fn code_units(text: &str) -> Vec<Unit> {
    let mut units = Vec::new();
    let mut utf16 = 0;
    for ch in text.chars() {
        units.push(Unit {
            ch,
            utf16,
            code: false,
        });
        utf16 += ch.len_utf16();
    }
    mark_fences(&mut units);
    mark_inline_code(&mut units);
    units
}

fn mark_fences(units: &mut [Unit]) {
    let mut line_start = 0;
    let mut index = 0;
    let mut fence: Option<(char, usize)> = None;
    while index <= units.len() {
        let at_end = index == units.len() || units[index].ch == '\n';
        if at_end {
            let (inside_fence, closes, opens) = {
                let line = &units[line_start..index];
                if let Some((marker, length)) = fence {
                    (true, closes_fence(line, marker, length), None)
                } else {
                    (false, false, opens_fence(line))
                }
            };
            if inside_fence || opens.is_some() {
                mark_range(units, line_start, index);
            }
            if closes {
                fence = None;
            } else if let Some(opened) = opens {
                fence = Some(opened);
            }
            line_start = index + 1;
        }
        index += 1;
    }
}

fn opens_fence(line: &[Unit]) -> Option<(char, usize)> {
    let trimmed = trim_units(line);
    let marker = trimmed.first()?.ch;
    if marker != '`' && marker != '~' {
        return None;
    }
    let length = trimmed.iter().take_while(|unit| unit.ch == marker).count();
    if length >= 3 {
        Some((marker, length))
    } else {
        None
    }
}

fn closes_fence(line: &[Unit], marker: char, length: usize) -> bool {
    let trimmed = trim_units(line);
    if trimmed.is_empty() || trimmed[0].ch != marker {
        return false;
    }
    let marks = trimmed.iter().take_while(|unit| unit.ch == marker).count();
    marks >= length && trimmed.iter().skip(marks).all(|unit| unit.ch == ' ')
}

fn trim_units(line: &[Unit]) -> &[Unit] {
    let start = line
        .iter()
        .position(|unit| unit.ch != ' ')
        .unwrap_or(line.len());
    let end = line
        .iter()
        .rposition(|unit| unit.ch != ' ')
        .map(|index| index + 1)
        .unwrap_or(start);
    &line[start..end]
}

fn mark_range(units: &mut [Unit], start: usize, end: usize) {
    let end = end.min(units.len());
    for unit in &mut units[start..end] {
        unit.code = true;
    }
}

fn mark_inline_code(units: &mut [Unit]) {
    let mut index = 0;
    while index < units.len() {
        if units[index].code || units[index].ch != '`' {
            index += 1;
            continue;
        }
        let length = units[index..]
            .iter()
            .take_while(|unit| !unit.code && unit.ch == '`')
            .count();
        if let Some(close) = find_backticks(units, index + length, length) {
            mark_range(units, index, close + length);
            index = close + length;
        } else {
            index += length;
        }
    }
}

fn find_backticks(units: &[Unit], from: usize, length: usize) -> Option<usize> {
    let mut index = from;
    while index < units.len() {
        if units[index].code || units[index].ch != '`' {
            index += 1;
            continue;
        }
        let run = units[index..]
            .iter()
            .take_while(|unit| !unit.code && unit.ch == '`')
            .count();
        if run == length {
            return Some(index);
        }
        index += run;
    }
    None
}

fn markdown_files(vault: &Vault) -> Result<Vec<String>, LinkError> {
    let mut files = Vec::new();
    collect(vault, "", &mut files)?;
    Ok(files)
}

fn collect(vault: &Vault, directory: &str, files: &mut Vec<String>) -> Result<(), LinkError> {
    let entries = vault.list(directory).map_err(LinkError::Vault)?;
    for entry in entries {
        let path = if directory.is_empty() {
            entry.name
        } else {
            format!("{directory}/{}", entry.name)
        };
        match entry.kind {
            EntryKind::Directory => collect(vault, &path, files)?,
            EntryKind::File if is_markdown_name(&path) => files.push(path),
            EntryKind::File => {}
        }
    }
    Ok(())
}

fn resolve_path(files: &[String], target: &str) -> Result<String, LinkError> {
    let wanted = normalize_note_path(target);
    choose_matches(files, "", &wanted, true)
}

fn resolve_name(files: &[String], source: &str, target: &str) -> Result<String, LinkError> {
    let wanted = strip_markdown_extension(target.trim());
    if wanted.is_empty() || wanted.contains('/') {
        return Err(LinkError::NotFound);
    }
    choose_matches(files, parent_directory(source), &wanted, false)
}

fn choose_matches(
    files: &[String],
    source_directory: &str,
    wanted: &str,
    full_path: bool,
) -> Result<String, LinkError> {
    let comparable: Vec<(&String, String)> = files
        .iter()
        .map(|path| {
            let key = if full_path {
                strip_markdown_extension(path)
            } else {
                file_stem(path)
            };
            (path, key)
        })
        .collect();
    let exact: Vec<&String> = comparable
        .iter()
        .filter(|(_, key)| key == wanted)
        .map(|(path, _)| *path)
        .collect();
    let matched: Vec<&String> = if !exact.is_empty() {
        exact
    } else {
        let folded = wanted.to_lowercase();
        comparable
            .iter()
            .filter(|(_, key)| key.to_lowercase() == folded)
            .map(|(path, _)| *path)
            .collect()
    };
    let mut pool: Vec<&String> = if full_path {
        matched
    } else {
        let same: Vec<&String> = matched
            .iter()
            .copied()
            .filter(|path| parent_directory(path) == source_directory)
            .collect();
        if same.is_empty() { matched } else { same }
    };
    if pool.is_empty() {
        return Err(LinkError::NotFound);
    }
    let shortest = pool
        .iter()
        .map(|path| path.matches('/').count())
        .min()
        .unwrap_or(0);
    pool.retain(|path| path.matches('/').count() == shortest);
    match pool.as_slice() {
        [only] => Ok((*only).clone()),
        _ => Err(LinkError::Ambiguous),
    }
}

fn normalize_note_path(target: &str) -> String {
    let path = target.trim().trim_start_matches("./").replace('\\', "/");
    strip_markdown_extension(&path)
}

fn is_attachment(target: &str) -> bool {
    let name = target.rsplit(['/', '\\']).next().unwrap_or(target).trim();
    Path::new(name)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| !extension.eq_ignore_ascii_case("md"))
}

fn is_markdown_name(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
}

fn strip_markdown_extension(path: &str) -> String {
    let lower_len = path.len();
    if path
        .get(lower_len.saturating_sub(3)..)
        .is_some_and(|suffix| suffix.eq_ignore_ascii_case(".md"))
    {
        path[..path.len() - 3].to_string()
    } else {
        path.to_string()
    }
}

fn file_stem(path: &str) -> String {
    let name = path.rsplit('/').next().unwrap_or(path);
    strip_markdown_extension(name)
}

fn parent_directory(path: &str) -> &str {
    match path.rfind('/') {
        Some(index) => &path[..index],
        None => "",
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

    struct TempVault {
        path: PathBuf,
    }

    impl TempVault {
        fn new() -> Self {
            let unique = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
            let nanos = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "amethyst-link-test-{}-{unique}-{nanos}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("temp vault");
            Self { path }
        }
    }

    impl Drop for TempVault {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn cursor_after(text: &str, needle: &str) -> usize {
        let start = text.find(needle).expect("needle");
        utf16_len(&text[..start + needle.len()])
    }

    fn utf16_len(text: &str) -> usize {
        text.encode_utf16().count()
    }

    #[test]
    fn link_at_cursor_drops_alias_heading_and_embed_marker() {
        let text = "See [[Note|label]] and [[Folder/Other#Head^block]] plus ![[Embed]].";
        assert_eq!(
            wikilink_at(text, cursor_after(text, "[[Note")),
            Some(Wikilink::Note {
                file: "Note".to_string(),
                heading: None,
            })
        );
        assert_eq!(
            wikilink_at(text, cursor_after(text, "[[Folder/Other")),
            Some(Wikilink::Note {
                file: "Folder/Other".to_string(),
                heading: Some("Head".to_string()),
            })
        );
        assert_eq!(
            wikilink_at(text, cursor_after(text, "![[Embed")),
            Some(Wikilink::Note {
                file: "Embed".to_string(),
                heading: None,
            })
        );
    }

    #[test]
    fn heading_in_the_same_note_and_code_are_not_files() {
        let text = "[[#Heading]]\n`[[Hidden]]`\n```\n[[Fenced]]\n```\n";
        assert_eq!(
            wikilink_at(text, cursor_after(text, "[[#Heading")),
            Some(Wikilink::SameNote {
                heading: Some("Heading".to_string()),
            })
        );
        assert_eq!(wikilink_at(text, cursor_after(text, "`[[Hidden")), None);
        assert_eq!(wikilink_at(text, cursor_after(text, "[[Fenced")), None);
    }

    #[test]
    fn resolve_prefers_the_same_folder_then_the_shortest_path() {
        let temp = TempVault::new();
        fs::create_dir_all(temp.path.join("Notes")).expect("notes");
        fs::create_dir_all(temp.path.join("Other")).expect("other");
        fs::write(temp.path.join("Notes").join("Target.md"), "same").expect("same");
        fs::write(temp.path.join("Other").join("Target.md"), "other").expect("other");
        fs::write(temp.path.join("Short.md"), "short").expect("short");
        fs::create_dir_all(temp.path.join("Deep").join("Nested")).expect("deep");
        fs::write(
            temp.path.join("Deep").join("Nested").join("Short.md"),
            "long",
        )
        .expect("long");
        fs::write(temp.path.join("pic.png"), "image").expect("image");
        let before = fs::read_dir(&temp.path).expect("read").count();
        let vault = Vault::open(&temp.path).expect("open");

        let same = resolve_editor_link(
            &vault,
            "Notes/Current.md",
            "Go [[Target]]",
            cursor_after("Go [[Target]]", "[[Target"),
        )
        .expect("same folder");
        assert_eq!(
            same,
            ResolvedLink {
                path: "Notes/Target.md".to_string(),
                heading: None,
            }
        );
        let short = resolve_editor_link(
            &vault,
            "Notes/Current.md",
            "Go [[Short]]",
            cursor_after("Go [[Short]]", "[[Short"),
        )
        .expect("shortest");
        assert_eq!(
            short,
            ResolvedLink {
                path: "Short.md".to_string(),
                heading: None,
            }
        );
        let missing = resolve_editor_link(&vault, "Notes/Current.md", "Go [[Missing]]", 4);
        assert_eq!(missing, Err(LinkError::NotFound));
        let attachment = resolve_editor_link(
            &vault,
            "Notes/Current.md",
            "Go ![[pic.png]]",
            cursor_after("Go ![[pic.png]]", "![[pic"),
        );
        assert_eq!(attachment, Err(LinkError::NotANote));
        assert_eq!(fs::read_dir(&temp.path).expect("read").count(), before);
    }

    #[test]
    fn resolve_embed_finds_a_note_a_heading_and_an_image() {
        let temp = TempVault::new();
        fs::write(temp.path.join("Note.md"), "# Head\n\nbody").expect("note");
        fs::write(temp.path.join("pic.png"), [0x89, b'P', b'N', b'G']).expect("image");
        fs::create_dir_all(temp.path.join(".trash")).expect("trash");
        fs::write(temp.path.join(".trash").join("pic.png"), b"gone").expect("trashed");
        let vault = Vault::open(&temp.path).expect("open");
        assert_eq!(
            resolve_embed(&vault, "Other.md", "Note#Head").expect("note"),
            ResolvedEmbed {
                path: "Note.md".to_string(),
                kind: EmbedKind::Note,
                heading: Some("Head".to_string()),
            }
        );
        let image = resolve_embed(&vault, "Other.md", "pic.png|100").expect("image");
        assert_eq!(
            image,
            ResolvedEmbed {
                path: "pic.png".to_string(),
                kind: EmbedKind::Image,
                heading: None,
            }
        );
        assert_eq!(vault.read_image(&image.path).expect("bytes"), b"\x89PNG");
        assert!(vault.read_image("Note.md").is_err());
        assert_eq!(
            resolve_embed(&vault, "Other.md", "|alias"),
            Err(LinkError::NoLink)
        );
        assert!(vault.absolute_path("../pic.png").is_err());
    }

    #[test]
    fn explicit_path_and_ambiguous_names_do_not_guess() {
        let temp = TempVault::new();
        fs::create_dir_all(temp.path.join("Alpha")).expect("alpha");
        fs::create_dir_all(temp.path.join("Beta")).expect("beta");
        fs::write(temp.path.join("Alpha").join("Twin.md"), "a").expect("a");
        fs::write(temp.path.join("Beta").join("Twin.md"), "b").expect("b");
        fs::write(temp.path.join("Alpha").join("Exact.md"), "exact").expect("exact");
        let vault = Vault::open(&temp.path).expect("open");
        let text = "[[Twin]] [[Alpha/Exact]]";
        assert_eq!(
            resolve_editor_link(
                &vault,
                "Notes/Current.md",
                text,
                cursor_after(text, "[[Twin")
            ),
            Err(LinkError::Ambiguous)
        );
        assert_eq!(
            resolve_editor_link(
                &vault,
                "Notes/Current.md",
                text,
                cursor_after(text, "[[Alpha/Exact")
            ),
            Ok(ResolvedLink {
                path: "Alpha/Exact.md".to_string(),
                heading: None,
            })
        );
    }

    #[test]
    fn case_insensitive_match_is_used_only_when_it_is_unique() {
        let temp = TempVault::new();
        fs::write(temp.path.join("Заметка.md"), "text").expect("note");
        let vault = Vault::open(&temp.path).expect("open");
        let text = "[[заметка]]";
        assert_eq!(
            resolve_editor_link(&vault, "Current.md", text, cursor_after(text, "[[заметка")),
            Ok(ResolvedLink {
                path: "Заметка.md".to_string(),
                heading: None,
            })
        );
    }

    #[test]
    fn resolve_keeps_a_heading_and_stays_in_the_same_note() {
        let temp = TempVault::new();
        fs::write(temp.path.join("Note.md"), "# Head\n").expect("note");
        let before = fs::read_dir(&temp.path).expect("read").count();
        let vault = Vault::open(&temp.path).expect("open");
        let same = "[[#Head]]";
        assert_eq!(
            resolve_editor_link(&vault, "Note.md", same, cursor_after(same, "[[#Head")),
            Ok(ResolvedLink {
                path: "Note.md".to_string(),
                heading: Some("Head".to_string()),
            })
        );
        let other = "[[Note#Head^block]]";
        assert_eq!(
            resolve_editor_link(
                &vault,
                "Current.md",
                other,
                cursor_after(other, "[[Note#Head")
            ),
            Ok(ResolvedLink {
                path: "Note.md".to_string(),
                heading: Some("Head".to_string()),
            })
        );
        let plain = "[[Note]]";
        assert_eq!(
            resolve_editor_link(&vault, "Current.md", plain, cursor_after(plain, "[[Note")),
            Ok(ResolvedLink {
                path: "Note.md".to_string(),
                heading: None,
            })
        );
        assert_eq!(
            resolve_editor_link(&vault, "Note.md", "[[#]]", cursor_after("[[#]]", "[[#")),
            Err(LinkError::SameNote)
        );
        assert_eq!(fs::read_dir(&temp.path).expect("read").count(), before);
    }

    #[test]
    fn backlinks_skip_code_and_ambiguous_names_and_use_open_text() {
        let temp = TempVault::new();
        fs::create_dir_all(temp.path.join("Notes")).expect("notes");
        fs::create_dir_all(temp.path.join("Alpha")).expect("alpha");
        fs::create_dir_all(temp.path.join("Beta")).expect("beta");
        fs::write(temp.path.join("Notes").join("Target.md"), "current").expect("target");
        fs::write(temp.path.join("Linked.md"), "See [[Target]]").expect("linked");
        fs::write(temp.path.join("Coded.md"), "```\n[[Target]]\n```").expect("coded");
        fs::write(temp.path.join("Path.md"), "See [[Notes/Target]]").expect("path");
        fs::write(temp.path.join("Alpha").join("Twin.md"), "a").expect("a");
        fs::write(temp.path.join("Beta").join("Twin.md"), "b").expect("b");
        fs::write(temp.path.join("Guess.md"), "[[Twin]]").expect("guess");
        fs::write(temp.path.join("Draft.md"), "old").expect("draft");
        let before = fs::read_dir(&temp.path).expect("read").count();
        let vault = Vault::open(&temp.path).expect("open");

        let links = backlinks_to(
            &vault,
            "Notes/Target.md",
            &[OpenNote {
                path: "Draft.md".to_string(),
                text: "unsaved [[Target]]".to_string(),
            }],
        )
        .expect("backlinks");
        let paths: Vec<&str> = links.iter().map(|link| link.path.as_str()).collect();
        assert_eq!(paths, vec!["Draft.md", "Linked.md", "Path.md"]);
        assert!(
            paths
                .iter()
                .all(|path| *path != "Coded.md" && *path != "Guess.md")
        );

        let twins = backlinks_to(&vault, "Alpha/Twin.md", &[]).expect("twins");
        assert!(twins.iter().all(|link| link.path != "Guess.md"));
        assert_eq!(fs::read_dir(&temp.path).expect("read").count(), before);
    }
}
