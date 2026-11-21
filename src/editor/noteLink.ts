/** Vault-relative note path for a Markdown link target, or null when it is not a note. */
export function noteLinkPath(source: string, url: string): string | null {
  let target = url.trim();
  const hash = target.indexOf("#");
  if (hash !== -1) {
    target = target.slice(0, hash);
  }
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) {
    return null;
  }
  try {
    target = decodeURIComponent(target);
  } catch {
    return null;
  }
  target = target.replace(/\\/g, "/");
  if (target.startsWith("/")) {
    target = target.slice(1);
  } else {
    const slash = source.lastIndexOf("/");
    const directory = slash === -1 ? "" : source.slice(0, slash + 1);
    target = directory + target;
  }
  const parts: string[] = [];
  for (const part of target.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      if (parts.length === 0) {
        return null;
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  let path = parts.join("/");
  if (!path || path.endsWith("/")) {
    return null;
  }
  if (!path.toLowerCase().endsWith(".md")) {
    path += ".md";
  }
  return path;
}
