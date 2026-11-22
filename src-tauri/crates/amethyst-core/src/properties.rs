use serde::{Deserialize, Serialize};

/// Properties read from a note. `raw` is set only when the frontmatter cannot be edited safely.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteProperties {
    pub valid: bool,
    pub raw: Option<String>,
    pub properties: Vec<Property>,
}

/// One frontmatter key and the value the editor can show.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Property {
    pub key: String,
    pub value: PropertyValue,
}

/// A supported value, or the original fragment when the value is not one of those shapes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
pub enum PropertyValue {
    Text(String),
    Number(f64),
    Boolean(bool),
    Date(String),
    List(Vec<String>),
    Tags(Vec<String>),
    Coordinates(Coordinates),
    Unknown(String),
}

/// A geographic point stored as `lat` and `lng`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Coordinates {
    pub lat: f64,
    pub lng: f64,
}

/// One edit of a single key. The rest of the note stays untouched.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PropertyChange {
    Set { key: String, value: PropertyValue },
    Rename { from: String, to: String },
    Delete { key: String },
    Add { key: String, value: PropertyValue },
}

struct OwnedProperty {
    key: String,
    value: PropertyValue,
    start: usize,
    end: usize,
}

struct Document {
    valid: bool,
    raw: Option<String>,
    close_fence: Option<usize>,
    properties: Vec<OwnedProperty>,
}

/// Read the frontmatter of `text`. Does not write.
pub fn read_properties(text: &str) -> NoteProperties {
    let document = parse_document(text);
    NoteProperties {
        valid: document.valid,
        raw: document.raw,
        properties: document
            .properties
            .into_iter()
            .map(|property| Property {
                key: property.key,
                value: property.value,
            })
            .collect(),
    }
}

/// Apply one property change. Invalid frontmatter and rejected edits return `text` unchanged.
pub fn apply_property(text: &str, change: &PropertyChange) -> String {
    let document = parse_document(text);
    if !document.valid {
        return text.to_string();
    }
    let newline = if text.contains("\r\n") { "\r\n" } else { "\n" };
    match change {
        PropertyChange::Set { key, value } => set_property(text, &document, key, value, newline),
        PropertyChange::Rename { from, to } => rename_property(text, &document, from, to),
        PropertyChange::Delete { key } => delete_property(text, &document, key),
        PropertyChange::Add { key, value } => add_property(text, &document, key, value, newline),
    }
}

fn parse_document(text: &str) -> Document {
    let Some(span) = frontmatter_span(text) else {
        return Document {
            valid: true,
            raw: None,
            close_fence: None,
            properties: Vec::new(),
        };
    };
    let mut properties: Vec<OwnedProperty> = Vec::new();
    let mut cursor = span.content_start;
    while cursor < span.close_fence {
        let (line_end, next) = split_line(text, cursor, span.close_fence);
        let line = &text[cursor..line_end];
        if line.trim().is_empty() || line.trim_start().starts_with('#') {
            cursor = next;
            continue;
        }
        let Some((key, rest)) = split_key(line) else {
            return invalid(text, span.block_end);
        };
        if key.is_empty() || properties.iter().any(|item| item.key == key) {
            return invalid(text, span.block_end);
        }
        let start = cursor;
        let mut end = next;
        let mut continuation = Vec::new();
        cursor = next;
        while cursor < span.close_fence {
            let (child_end, child_next) = split_line(text, cursor, span.close_fence);
            let child = &text[cursor..child_end];
            if child.is_empty() || !child.starts_with([' ', '\t']) {
                break;
            }
            continuation.push(child);
            end = child_next;
            cursor = child_next;
        }
        let raw = text[start..end].trim_end_matches(['\r', '\n']).to_string();
        properties.push(OwnedProperty {
            key,
            value: parse_value(rest, &continuation, &raw),
            start,
            end,
        });
    }
    Document {
        valid: true,
        raw: None,
        close_fence: Some(span.close_fence),
        properties,
    }
}

struct Span {
    content_start: usize,
    close_fence: usize,
    block_end: usize,
}

fn frontmatter_span(text: &str) -> Option<Span> {
    let newline = if text.starts_with("---\r\n") {
        "\r\n"
    } else if text.starts_with("---\n") {
        "\n"
    } else {
        return None;
    };
    let content_start = 3 + newline.len();
    let close_fence = if text[content_start..].starts_with("---")
        && (text.len() == content_start + 3
            || text.as_bytes().get(content_start + 3).is_some_and(|byte| *byte == b'\n' || *byte == b'\r'))
    {
        content_start
    } else {
        let marker = format!("{newline}---");
        let relative = text[content_start..].find(&marker)?;
        content_start + relative + newline.len()
    };
    let after = close_fence + 3;
    let block_end = if text[after..].starts_with("\r\n") {
        after + 2
    } else if text[after..].starts_with('\n') {
        after + 1
    } else {
        after
    };
    Some(Span {
        content_start,
        close_fence,
        block_end,
    })
}

fn invalid(text: &str, block_end: usize) -> Document {
    Document {
        valid: false,
        raw: Some(text[..block_end].trim_end().to_string()),
        close_fence: None,
        properties: Vec::new(),
    }
}

fn split_line(text: &str, from: usize, until: usize) -> (usize, usize) {
    let rest = &text[from..until];
    match rest.find('\n') {
        Some(index) => {
            let newline = from + index;
            let line_end = if newline > from && text.as_bytes()[newline - 1] == b'\r' {
                newline - 1
            } else {
                newline
            };
            (line_end, newline + 1)
        }
        None => (until, until),
    }
}

fn split_key(line: &str) -> Option<(String, &str)> {
    if line.starts_with([' ', '\t', '#', '-']) {
        return None;
    }
    let colon = line.find(':')?;
    let raw_key = &line[..colon];
    let key = unquote_key(raw_key)?.trim().to_string();
    if key.is_empty() || key.contains(['\n', '\r', ':']) {
        return None;
    }
    Some((key, line[colon + 1..].trim()))
}

fn unquote_key(raw: &str) -> Option<&str> {
    let raw = raw.trim();
    if raw.len() >= 2 && raw.starts_with('"') && raw.ends_with('"') && !raw[1..raw.len() - 1].contains('"') {
        Some(&raw[1..raw.len() - 1])
    } else {
        Some(raw)
    }
}

fn parse_value(rest: &str, continuation: &[&str], raw: &str) -> PropertyValue {
    let key = raw.split(':').next().unwrap_or("").trim();
    let key = unquote_key(key).unwrap_or(key);
    if continuation.is_empty() {
        return classify_scalar(key, rest).unwrap_or_else(|| PropertyValue::Unknown(raw.to_string()));
    }
    if !rest.is_empty() {
        return PropertyValue::Unknown(raw.to_string());
    }
    if let Some(coordinates) = parse_coordinates(continuation) {
        return PropertyValue::Coordinates(coordinates);
    }
    if let Some(items) = parse_list(continuation) {
        if key == "tags" {
            return PropertyValue::Tags(items.into_iter().map(|item| strip_tag(&item)).collect());
        }
        return PropertyValue::List(items);
    }
    PropertyValue::Unknown(raw.to_string())
}

fn classify_scalar(key: &str, rest: &str) -> Option<PropertyValue> {
    if rest.is_empty() {
        return Some(if key == "tags" {
            PropertyValue::Tags(Vec::new())
        } else {
            PropertyValue::Text(String::new())
        });
    }
    if rest.starts_with(['|', '>', '{']) || rest == "null" || rest == "~" || rest.eq_ignore_ascii_case("null") {
        return None;
    }
    if rest.starts_with('[') {
        let items = parse_flow(rest)?;
        return Some(if key == "tags" {
            PropertyValue::Tags(items.into_iter().map(|item| strip_tag(&item)).collect())
        } else {
            PropertyValue::List(items)
        });
    }
    if let Some(text) = unquote_scalar(rest) {
        return Some(if key == "tags" {
            PropertyValue::Tags(vec![strip_tag(&text)])
        } else {
            PropertyValue::Text(text)
        });
    }
    if rest == "true" {
        return Some(PropertyValue::Boolean(true));
    }
    if rest == "false" {
        return Some(PropertyValue::Boolean(false));
    }
    if is_date(rest) {
        return Some(PropertyValue::Date(rest.to_string()));
    }
    if let Some(number) = parse_number(rest) {
        return Some(PropertyValue::Number(number));
    }
    if rest.chars().any(char::is_control) {
        return None;
    }
    Some(if key == "tags" {
        PropertyValue::Tags(vec![strip_tag(rest)])
    } else {
        PropertyValue::Text(rest.to_string())
    })
}

fn parse_flow(value: &str) -> Option<Vec<String>> {
    if !value.ends_with(']') {
        return None;
    }
    let inner = &value[1..value.len() - 1];
    if inner.trim().is_empty() {
        return Some(Vec::new());
    }
    let mut items = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    for ch in inner.chars() {
        if ch == '"' && !quoted {
            quoted = true;
            current.push(ch);
        } else if ch == '"' && quoted {
            quoted = false;
            current.push(ch);
        } else if ch == ',' && !quoted {
            items.push(plain_item(current.trim())?);
            current.clear();
        } else {
            current.push(ch);
        }
    }
    if quoted {
        return None;
    }
    items.push(plain_item(current.trim())?);
    Some(items)
}

fn plain_item(value: &str) -> Option<String> {
    if value.is_empty() || value.starts_with(['{', '[']) {
        return None;
    }
    unquote_scalar(value).or_else(|| {
        if value.contains(':') {
            None
        } else {
            Some(value.to_string())
        }
    })
}

fn unquote_scalar(value: &str) -> Option<String> {
    if value.len() >= 2 && value.starts_with('"') && value.ends_with('"') {
        let inner = &value[1..value.len() - 1];
        if inner.contains('\n') {
            return None;
        }
        return Some(unescape(inner));
    }
    if value.len() >= 2 && value.starts_with('\'') && value.ends_with('\'') && !value[1..value.len() - 1].contains('\'')
    {
        return Some(value[1..value.len() - 1].to_string());
    }
    None
}

fn unescape(value: &str) -> String {
    let mut result = String::new();
    let mut escaped = false;
    for ch in value.chars() {
        if escaped {
            result.push(match ch {
                'n' => '\n',
                'r' => '\r',
                other => other,
            });
            escaped = false;
        } else if ch == '\\' {
            escaped = true;
        } else {
            result.push(ch);
        }
    }
    if escaped {
        result.push('\\');
    }
    result
}

fn parse_list(lines: &[&str]) -> Option<Vec<String>> {
    if lines.is_empty() {
        return None;
    }
    let mut items = Vec::new();
    for line in lines {
        let trimmed = line.trim();
        let value = if trimmed == "-" {
            ""
        } else if let Some(rest) = trimmed.strip_prefix("- ") {
            rest.trim()
        } else {
            return None;
        };
        items.push(plain_item(value)?);
    }
    Some(items)
}

fn parse_coordinates(lines: &[&str]) -> Option<Coordinates> {
    if lines.len() != 2 {
        return None;
    }
    let mut lat = None;
    let mut lng = None;
    for line in lines {
        let (key, value) = split_key(line.trim())?;
        let number = parse_number(value)?;
        match key.as_str() {
            "lat" if lat.is_none() => lat = Some(number),
            "lng" if lng.is_none() => lng = Some(number),
            _ => return None,
        }
    }
    Some(Coordinates {
        lat: lat?,
        lng: lng?,
    })
}

fn parse_number(value: &str) -> Option<f64> {
    if !is_number(value) {
        return None;
    }
    value.parse().ok().filter(|number: &f64| number.is_finite())
}

fn is_number(value: &str) -> bool {
    let digits = value.strip_prefix('-').unwrap_or(value);
    let mut parts = digits.split('.');
    let whole = parts.next().unwrap_or("");
    let fraction = parts.next();
    if parts.next().is_some() || whole.is_empty() || !whole.chars().all(|ch| ch.is_ascii_digit()) {
        return false;
    }
    if whole.len() > 1 && whole.starts_with('0') {
        return false;
    }
    fraction.is_none_or(|part| !part.is_empty() && part.chars().all(|ch| ch.is_ascii_digit()))
}

fn is_date(value: &str) -> bool {
    let mut parts = value.split('-');
    let year = parts.next().unwrap_or("");
    let month = parts.next().unwrap_or("");
    let day = parts.next().unwrap_or("");
    if parts.next().is_some() || year.len() != 4 || month.len() != 2 || day.len() != 2 {
        return false;
    }
    let Ok(month) = month.parse::<u8>() else {
        return false;
    };
    let Ok(day) = day.parse::<u8>() else {
        return false;
    };
    year.chars().all(|ch| ch.is_ascii_digit()) && (1..=12).contains(&month) && (1..=31).contains(&day)
}

fn strip_tag(value: &str) -> String {
    value.trim().strip_prefix('#').unwrap_or(value.trim()).to_string()
}

fn set_property(text: &str, document: &Document, key: &str, value: &PropertyValue, newline: &str) -> String {
    let Some(property) = document.properties.iter().find(|item| item.key == key) else {
        return text.to_string();
    };
    if matches!(property.value, PropertyValue::Unknown(_)) || matches!(value, PropertyValue::Unknown(_)) {
        return text.to_string();
    }
    let Some(rendered) = render_property(key, value, newline) else {
        return text.to_string();
    };
    splice(text, property.start, property.end, &rendered)
}

fn rename_property(text: &str, document: &Document, from: &str, to: &str) -> String {
    if from == to || !valid_key(to) || document.properties.iter().any(|item| item.key == to) {
        return text.to_string();
    }
    let Some(property) = document.properties.iter().find(|item| item.key == from) else {
        return text.to_string();
    };
    if matches!(property.value, PropertyValue::Unknown(_)) {
        return text.to_string();
    }
    let line = &text[property.start..];
    if !line.starts_with(from) || !line[from.len()..].starts_with(':') {
        return text.to_string();
    }
    splice(text, property.start, property.start + from.len(), &render_key(to))
}

fn delete_property(text: &str, document: &Document, key: &str) -> String {
    let Some(property) = document.properties.iter().find(|item| item.key == key) else {
        return text.to_string();
    };
    let removed = splice(text, property.start, property.end, "");
    if let Some(span) = frontmatter_span(&removed) {
        if removed[span.content_start..span.close_fence].trim().is_empty() {
            return removed[span.block_end..].to_string();
        }
    }
    removed
}

fn add_property(text: &str, document: &Document, key: &str, value: &PropertyValue, newline: &str) -> String {
    if !valid_key(key) || document.properties.iter().any(|item| item.key == key) || matches!(value, PropertyValue::Unknown(_))
    {
        return text.to_string();
    }
    let Some(rendered) = render_property(key, value, newline) else {
        return text.to_string();
    };
    match document.close_fence {
        Some(close) => splice(text, close, close, &rendered),
        None => format!("---{newline}{rendered}---{newline}{text}"),
    }
}

fn valid_key(key: &str) -> bool {
    !key.is_empty()
        && key.trim() == key
        && !key.contains(['\n', '\r', ':'])
        && key != "---"
}

fn splice(text: &str, start: usize, end: usize, insert: &str) -> String {
    let mut next = String::with_capacity(text.len() - (end - start) + insert.len());
    next.push_str(&text[..start]);
    next.push_str(insert);
    next.push_str(&text[end..]);
    next
}

fn render_property(key: &str, value: &PropertyValue, newline: &str) -> Option<String> {
    let key = render_key(key);
    let body = match value {
        PropertyValue::Text(text) => format!("{key}: {}{newline}", render_scalar(text)),
        PropertyValue::Number(number) => format!("{key}: {}{newline}", format_number(*number)?),
        PropertyValue::Boolean(checked) => format!("{key}: {}{newline}", if *checked { "true" } else { "false" }),
        PropertyValue::Date(date) if is_date(date) => format!("{key}: {date}{newline}"),
        PropertyValue::Date(_) => return None,
        PropertyValue::List(items) => render_sequence(&key, items, newline),
        PropertyValue::Tags(items) => render_sequence(&key, &items.iter().map(|item| strip_tag(item)).collect::<Vec<_>>(), newline),
        PropertyValue::Coordinates(coordinates) => format!(
            "{key}:{newline}  lat: {}{newline}  lng: {}{newline}",
            format_number(coordinates.lat)?,
            format_number(coordinates.lng)?
        ),
        PropertyValue::Unknown(_) => return None,
    };
    Some(body)
}

fn render_sequence(key: &str, items: &[String], newline: &str) -> String {
    if items.is_empty() {
        return format!("{key}: []{newline}");
    }
    let mut body = format!("{key}:{newline}");
    for item in items {
        body.push_str("  - ");
        body.push_str(&render_scalar(item));
        body.push_str(newline);
    }
    body
}

fn render_key(key: &str) -> String {
    if valid_key(key) && !key.chars().any(|ch| "#{}[],&*!|>'\"%@`".contains(ch)) && !key.starts_with(['-', '?', '&']) {
        key.to_string()
    } else {
        quote(key)
    }
}

fn render_scalar(text: &str) -> String {
    if text.is_empty()
        || text != text.trim()
        || text == "true"
        || text == "false"
        || text == "null"
        || text == "~"
        || is_date(text)
        || is_number(text)
        || text.starts_with(['-', '?', '&', '*', '!', '|', '>', '%', '@', '`', '{', '[', '\'', '"'])
        || text.contains([':', '#', '{', '}', '[', ']', ',', '&', '*', '!', '|', '>', '\'', '"', '%', '@', '`', '\n', '\r'])
    {
        quote(text)
    } else {
        text.to_string()
    }
}

fn quote(text: &str) -> String {
    let mut quoted = String::from("\"");
    for ch in text.chars() {
        match ch {
            '\\' => quoted.push_str("\\\\"),
            '"' => quoted.push_str("\\\""),
            '\n' => quoted.push_str("\\n"),
            '\r' => quoted.push_str("\\r"),
            _ => quoted.push(ch),
        }
    }
    quoted.push('"');
    quoted
}

fn format_number(value: f64) -> Option<String> {
    if !value.is_finite() {
        return None;
    }
    let mut text = format!("{value:.10}");
    if text.contains('.') {
        while text.ends_with('0') {
            text.pop();
        }
        if text.ends_with('.') {
            text.pop();
        }
    }
    if text == "-0" {
        text = "0".to_string();
    }
    Some(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note() -> &'static str {
        "---\n# keep\ntitle: Hello\n# mid\ncount: 1\n---\nBody\n"
    }

    #[test]
    fn reads_supported_values_and_keeps_unknown_fragments() {
        let text = "---\ntitle: Hello\ncount: 1\ndone: true\nwhen: 2024-01-02\nnames:\n  - Ada\n  - Grace\ntags:\n  - \"#project/work\"\nplace:\n  lng: 37.6\n  lat: 55.7\nnested:\n  left: 1\n  right: 2\n---\n";
        let parsed = read_properties(text);
        assert!(parsed.valid);
        assert_eq!(parsed.properties[0].value, PropertyValue::Text("Hello".to_string()));
        assert_eq!(parsed.properties[1].value, PropertyValue::Number(1.0));
        assert_eq!(parsed.properties[2].value, PropertyValue::Boolean(true));
        assert_eq!(parsed.properties[3].value, PropertyValue::Date("2024-01-02".to_string()));
        assert_eq!(
            parsed.properties[4].value,
            PropertyValue::List(vec!["Ada".to_string(), "Grace".to_string()])
        );
        assert_eq!(parsed.properties[5].value, PropertyValue::Tags(vec!["project/work".to_string()]));
        assert_eq!(
            parsed.properties[6].value,
            PropertyValue::Coordinates(Coordinates { lat: 55.7, lng: 37.6 })
        );
        assert_eq!(
            parsed.properties[7].value,
            PropertyValue::Unknown("nested:\n  left: 1\n  right: 2".to_string())
        );
    }

    #[test]
    fn editing_one_key_leaves_the_rest_unchanged() {
        let changed = apply_property(
            note(),
            &PropertyChange::Set {
                key: "count".to_string(),
                value: PropertyValue::Number(2.0),
            },
        );
        assert_eq!(changed, "---\n# keep\ntitle: Hello\n# mid\ncount: 2\n---\nBody\n");
    }

    #[test]
    fn unknown_nesting_survives_a_neighbor_edit() {
        let text = "---\ntitle: Hello\nnested:\n  left: 1\n---\nBody\n";
        let changed = apply_property(
            text,
            &PropertyChange::Set {
                key: "title".to_string(),
                value: PropertyValue::Text("Next".to_string()),
            },
        );
        assert_eq!(changed, "---\ntitle: Next\nnested:\n  left: 1\n---\nBody\n");
        let refused = apply_property(
            text,
            &PropertyChange::Set {
                key: "nested".to_string(),
                value: PropertyValue::Text("no".to_string()),
            },
        );
        assert_eq!(refused, text);
    }

    #[test]
    fn adding_the_first_frontmatter_and_removing_the_last_key() {
        let added = apply_property(
            "Body\n",
            &PropertyChange::Add {
                key: "title".to_string(),
                value: PropertyValue::Text("Hello".to_string()),
            },
        );
        assert_eq!(added, "---\ntitle: Hello\n---\nBody\n");
        let removed = apply_property(
            &added,
            &PropertyChange::Delete {
                key: "title".to_string(),
            },
        );
        assert_eq!(removed, "Body\n");
    }

    #[test]
    fn broken_frontmatter_is_not_rewritten() {
        let text = "---\n: bad\n---\nBody\n";
        let parsed = read_properties(text);
        assert!(!parsed.valid);
        assert_eq!(parsed.raw.as_deref(), Some("---\n: bad\n---"));
        let changed = apply_property(
            text,
            &PropertyChange::Add {
                key: "title".to_string(),
                value: PropertyValue::Text("Hello".to_string()),
            },
        );
        assert_eq!(changed, text);
    }
}
