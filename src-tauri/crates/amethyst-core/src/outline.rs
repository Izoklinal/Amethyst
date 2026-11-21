use serde::{Deserialize, Serialize};

use crate::links::{Unit, code_units};

/// One Markdown heading in editor text. `offset` counts UTF-16 code units.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Heading {
    pub level: u8,
    pub text: String,
    pub offset: usize,
}

/// Headings in `text`. Does not read or write files.
pub fn outline_of(text: &str) -> Vec<Heading> {
    let units = code_units(text);
    let lines = split_lines(&units);
    let mut headings = Vec::new();
    let mut index = 0;
    while index < lines.len() {
        let line = lines[index];
        if let Some((level, text, offset)) = atx_heading(line) {
            headings.push(Heading {
                level,
                text,
                offset,
            });
            index += 1;
            continue;
        }
        if index + 1 < lines.len()
            && let Some(level) = setext_level(lines[index + 1])
            && let Some((text, offset)) = setext_text(line)
        {
            headings.push(Heading {
                level,
                text,
                offset,
            });
            index += 2;
            continue;
        }
        index += 1;
    }
    headings
}

fn split_lines(units: &[Unit]) -> Vec<&[Unit]> {
    let mut lines = Vec::new();
    let mut start = 0;
    for (index, unit) in units.iter().enumerate() {
        if unit.ch == '\n' {
            lines.push(&units[start..index]);
            start = index + 1;
        }
    }
    lines.push(&units[start..]);
    lines
}

fn atx_heading(line: &[Unit]) -> Option<(u8, String, usize)> {
    let mut index = leading_spaces(line);
    if index >= line.len() || line[index].code || line[index].ch != '#' {
        return None;
    }
    let offset = line[index].utf16;
    let mut level = 0;
    while index < line.len() && !line[index].code && line[index].ch == '#' && level < 7 {
        level += 1;
        index += 1;
    }
    if !(1..=6).contains(&level) {
        return None;
    }
    if index < line.len() && !line[index].code && line[index].ch != ' ' && line[index].ch != '\t' {
        return None;
    }
    while index < line.len() && (line[index].ch == ' ' || line[index].ch == '\t') {
        index += 1;
    }
    let content: String = line[index..].iter().map(|unit| unit.ch).collect();
    let text = trim_closing_hashes(&content);
    if text.is_empty() {
        return None;
    }
    Some((level, text, offset))
}

fn setext_level(line: &[Unit]) -> Option<u8> {
    let start = leading_spaces(line);
    if start >= line.len() || line[start].code {
        return None;
    }
    let marker = line[start].ch;
    if marker != '=' && marker != '-' {
        return None;
    }
    let mut index = start;
    while index < line.len() && !line[index].code && line[index].ch == marker {
        index += 1;
    }
    if index == start {
        return None;
    }
    if line[index..]
        .iter()
        .any(|unit| unit.ch != ' ' && unit.ch != '\t')
    {
        return None;
    }
    Some(if marker == '=' { 1 } else { 2 })
}

fn setext_text(line: &[Unit]) -> Option<(String, usize)> {
    if line.is_empty() || atx_heading(line).is_some() {
        return None;
    }
    let start = leading_spaces(line);
    if start >= line.len() || line[start].code {
        return None;
    }
    let text: String = line.iter().map(|unit| unit.ch).collect();
    let text = text.trim().to_string();
    if text.is_empty() {
        return None;
    }
    Some((text, line[start].utf16))
}

fn leading_spaces(line: &[Unit]) -> usize {
    line.iter()
        .take(3)
        .take_while(|unit| !unit.code && unit.ch == ' ')
        .count()
}

fn trim_closing_hashes(content: &str) -> String {
    let trimmed = content.trim();
    let bytes = trimmed.as_bytes();
    let mut hash_start = bytes.len();
    while hash_start > 0 && bytes[hash_start - 1] == b'#' {
        hash_start -= 1;
    }
    if hash_start < bytes.len() && (hash_start == 0 || bytes[hash_start - 1].is_ascii_whitespace())
    {
        trimmed[..hash_start].trim().to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_atx_levels_and_strips_closing_hashes() {
        let headings = outline_of("# One\n## Two ##\n### Three\n");
        assert_eq!(
            headings,
            vec![
                Heading {
                    level: 1,
                    text: "One".to_string(),
                    offset: 0,
                },
                Heading {
                    level: 2,
                    text: "Two".to_string(),
                    offset: 6,
                },
                Heading {
                    level: 3,
                    text: "Three".to_string(),
                    offset: 16,
                },
            ]
        );
    }

    #[test]
    fn reads_setext_and_skips_code_and_empty_input() {
        let text = "Title\n====\n\n```\n# Hidden\n```\n`# also`\nй\n# Видно\n";
        let headings = outline_of(text);
        assert_eq!(headings[0].level, 1);
        assert_eq!(headings[0].text, "Title");
        assert_eq!(headings[0].offset, 0);
        assert_eq!(headings.len(), 2);
        assert_eq!(headings[1].text, "Видно");
        let prefix = "Title\n====\n\n```\n# Hidden\n```\n`# also`\nй\n";
        assert_eq!(headings[1].offset, prefix.encode_utf16().count());
        assert!(outline_of("").is_empty());
        assert!(outline_of("##\n## ###\n").is_empty());
    }
}
