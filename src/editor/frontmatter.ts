/** The leading frontmatter block, including its closing fence and one following newline. */
export function frontmatterRange(text: string): { from: number; to: number } | null {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) {
    return null;
  }
  const newline = text.startsWith("---\r\n") ? "\r\n" : "\n";
  const restFrom = 3 + newline.length;
  const end = text.indexOf(`${newline}---`, restFrom);
  if (end === -1) {
    return null;
  }
  const to = end + newline.length + 3;
  const after = text.slice(to, to + newline.length);
  return { from: 0, to: after === newline ? to + newline.length : to };
}
