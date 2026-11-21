export type EmbedTarget = {
  file: string;
  heading: string | null;
};

/** Inside of `![[...]]`, or null when the target before `|` is empty. */
export function embedTarget(body: string): EmbedTarget | null {
  const main = body.split("|")[0]?.trim() ?? "";
  if (!main) {
    return null;
  }
  const hash = main.indexOf("#");
  const file = (hash === -1 ? main : main.slice(0, hash)).split("^")[0]?.trim() ?? "";
  const heading = hash === -1 ? "" : main.slice(hash + 1).split("^")[0]?.trim() ?? "";
  if (!file && !heading) {
    return null;
  }
  return { file, heading: heading || null };
}

export function embedLabel(body: string): string | null {
  const target = embedTarget(body);
  if (!target) {
    return null;
  }
  if (target.file && target.heading) {
    return `${target.file}#${target.heading}`;
  }
  return target.file || target.heading;
}

type SectionHeading = {
  level: number;
  text: string;
  offset: number;
};

/** Text from the first matching heading through the next heading of the same or higher level. */
export function headingSection(
  text: string,
  headings: SectionHeading[],
  title: string,
): string | null {
  const index = headings.findIndex((heading) => heading.text === title);
  if (index === -1) {
    return null;
  }
  const start = headings[index];
  const next = headings.slice(index + 1).find((heading) => heading.level <= start.level);
  return text.slice(start.offset, next ? next.offset : text.length);
}
