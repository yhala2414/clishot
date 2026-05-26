import type { StyledLine, StyledPage } from "./text";

export type LayoutOptions = {
  cols: number;
  rows: number;
};

export function layoutTextToPages(text: string, options: LayoutOptions): string[][] {
  const wrappedLines = wrapTextByColumns(text, options.cols);
  return paginateLines(wrappedLines, options.rows);
}

export function wrapTextByColumns(text: string, cols: number): string[] {
  const rawLines = text.split("\n");
  const out: string[] = [];

  for (const raw of rawLines) {
    if (raw.length === 0) {
      out.push("");
      continue;
    }

    let current = "";
    let currentCols = 0;
    for (const ch of raw) {
      if (currentCols >= cols) {
        out.push(current);
        current = "";
        currentCols = 0;
      }
      current += ch;
      currentCols += 1;
    }

    out.push(current);
  }

  return out;
}

export function paginateLines(lines: string[], rows: number): string[][] {
  if (lines.length === 0) {
    return [[""]];
  }

  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += rows) {
    pages.push(lines.slice(i, i + rows));
  }
  return pages;
}

export function layoutStyledTextToPages(lines: StyledLine[], options: LayoutOptions): StyledPage[] {
  const wrappedLines = wrapStyledLinesByColumns(lines, options.cols);
  return paginateStyledLines(wrappedLines, options.rows);
}

export function wrapStyledLinesByColumns(lines: StyledLine[], cols: number): StyledLine[] {
  const out: StyledLine[] = [];

  for (const rawLine of lines) {
    if (rawLine.length === 0) {
      out.push([]);
      continue;
    }

    let current: StyledLine = [];
    let currentCols = 0;

    for (const seg of rawLine) {
      const text = seg.text;
      let offset = 0;

      while (offset < text.length) {
        if (currentCols >= cols) {
          out.push(current);
          current = [];
          currentCols = 0;
        }

        const remaining = cols - currentCols;
        const take = Math.min(remaining, text.length - offset);
        const part = text.slice(offset, offset + take);
        pushStyledSegment(current, { text: part, style: seg.style });
        currentCols += take;
        offset += take;
      }
    }

    out.push(current);
  }

  return out;
}

export function paginateStyledLines(lines: StyledLine[], rows: number): StyledPage[] {
  if (lines.length === 0) {
    return [[[]]];
  }

  const pages: StyledPage[] = [];
  for (let i = 0; i < lines.length; i += rows) {
    pages.push(lines.slice(i, i + rows));
  }
  return pages;
}

function pushStyledSegment(line: StyledLine, seg: { text: string; style: StyledLine[number]["style"] }): void {
  if (seg.text.length === 0) {
    return;
  }
  const last = line[line.length - 1];
  if (last && last.style === seg.style) {
    last.text += seg.text;
    return;
  }
  line.push(seg);
}
