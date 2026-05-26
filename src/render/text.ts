export type CleanTextOptions = {
  tabStop: number;
};

export type ColorSpec =
  | { type: "default" }
  | { type: "ansi16"; index: number }
  | { type: "ansi256"; index: number };

export type TextStyle = {
  bold: boolean;
  underline: boolean;
  fg: ColorSpec;
  bg: ColorSpec | null;
};

export type StyledSegment = {
  text: string;
  style: TextStyle;
};

export type StyledLine = StyledSegment[];

export type StyledPage = StyledLine[];

export function cleanTextForRender(input: string, options: CleanTextOptions): string {
  const normalized = normalizeNewlines(input);
  const crApplied = applyCarriageReturnOverwrites(normalized);
  const stripped = stripControlCharacters(crApplied);
  return expandTabs(stripped, options.tabStop);
}

export function parseStyledTextForRender(input: string, options: CleanTextOptions): StyledLine[] {
  const normalized = normalizeNewlines(input);

  type Cell = { ch: string; style: TextStyle };

  const lines: StyledLine[] = [];
  let cells: Cell[] = [];
  let cursor = 0;
  let style: TextStyle = defaultTextStyle();

  const flushLine = () => {
    lines.push(cellsToSegments(cells));
    cells = [];
    cursor = 0;
  };

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i]!;

    if (ch === "\n") {
      flushLine();
      continue;
    }

    if (ch === "\r") {
      cursor = 0;
      continue;
    }

    if (ch === "\t") {
      const spaces = options.tabStop - (cursor % options.tabStop);
      for (let s = 0; s < spaces; s += 1) {
        writeCell(cells, cursor, { ch: " ", style });
        cursor += 1;
      }
      continue;
    }

    if (ch === "\u001b") {
      const parsed = tryParseSgrCsi(normalized, i);
      if (parsed) {
        style = applySgrParams(style, parsed.params);
        i += parsed.consumed - 1;
        continue;
      }
    }

    const code = ch.codePointAt(0) ?? 0;
    const isC0 = code >= 0x00 && code <= 0x1f;
    const isDel = code === 0x7f;
    if (isC0 || isDel) {
      continue;
    }

    writeCell(cells, cursor, { ch, style });
    cursor += 1;
  }

  flushLine();
  return lines;
}

export function normalizeNewlines(input: string): string {
  return input.replaceAll("\r\n", "\n");
}

export function applyCarriageReturnOverwrites(input: string): string {
  const lines: string[] = [];
  let current: string[] = [];
  let cursor = 0;

  const flushLine = () => {
    lines.push(current.join(""));
    current = [];
    cursor = 0;
  };

  for (const ch of input) {
    if (ch === "\n") {
      flushLine();
      continue;
    }

    if (ch === "\r") {
      cursor = 0;
      continue;
    }

    while (cursor > current.length) {
      current.push(" ");
    }

    if (cursor === current.length) {
      current.push(ch);
    } else {
      current[cursor] = ch;
    }
    cursor += 1;
  }

  lines.push(current.join(""));
  return lines.join("\n");
}

export function stripControlCharacters(input: string): string {
  let out = "";
  for (const ch of input) {
    if (ch === "\n" || ch === "\t") {
      out += ch;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    const isC0 = code >= 0x00 && code <= 0x1f;
    const isDel = code === 0x7f;
    if (isC0 || isDel) {
      continue;
    }
    out += ch;
  }
  return out;
}

export function expandTabs(input: string, tabStop: number): string {
  const rawLines = input.split("\n");
  const expandedLines = rawLines.map((line) => {
    let out = "";
    let col = 0;

    for (const ch of line) {
      if (ch === "\t") {
        const spaces = tabStop - (col % tabStop);
        out += " ".repeat(spaces);
        col += spaces;
        continue;
      }

      out += ch;
      col += 1;
    }

    return out;
  });

  return expandedLines.join("\n");
}

function defaultTextStyle(): TextStyle {
  return { bold: false, underline: false, fg: { type: "default" }, bg: null };
}

function writeCell<T extends { ch: string; style: TextStyle }>(cells: T[], cursor: number, cell: T): void {
  if (cursor === cells.length) {
    cells.push(cell);
    return;
  }
  if (cursor < cells.length) {
    cells[cursor] = cell;
  }
}

function cellsToSegments(cells: Array<{ ch: string; style: TextStyle }>): StyledLine {
  const out: StyledLine = [];
  for (const cell of cells) {
    const last = out[out.length - 1];
    if (last && isSameStyle(last.style, cell.style)) {
      last.text += cell.ch;
      continue;
    }
    out.push({ text: cell.ch, style: cell.style });
  }
  return out;
}

function isSameStyle(a: TextStyle, b: TextStyle): boolean {
  return (
    a.bold === b.bold &&
    a.underline === b.underline &&
    isSameColorSpec(a.fg, b.fg) &&
    isSameColorSpecNullable(a.bg, b.bg)
  );
}

function isSameColorSpecNullable(a: ColorSpec | null, b: ColorSpec | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return isSameColorSpec(a, b);
}

function isSameColorSpec(a: ColorSpec, b: ColorSpec): boolean {
  if (a.type !== b.type) {
    return false;
  }
  if (a.type === "default") {
    return true;
  }
  return a.index === (b as { index: number }).index;
}

function tryParseSgrCsi(input: string, escIndex: number): { consumed: number; params: number[] } | null {
  if (input[escIndex] !== "\u001b") {
    return null;
  }
  if (input[escIndex + 1] !== "[") {
    return null;
  }

  let end = -1;
  for (let i = escIndex + 2; i < input.length; i += 1) {
    const ch = input[i]!;
    if (ch === "m") {
      end = i;
      break;
    }
    const code = ch.codePointAt(0) ?? 0;
    const isDigit = code >= 0x30 && code <= 0x39;
    if (!isDigit && ch !== ";") {
      return null;
    }
  }

  if (end === -1) {
    return null;
  }

  const body = input.slice(escIndex + 2, end);
  const parts = body.length === 0 ? ["0"] : body.split(";");
  const params: number[] = [];
  for (const part of parts) {
    if (part.length === 0) {
      params.push(0);
      continue;
    }
    const n = Number(part);
    if (!Number.isFinite(n)) {
      continue;
    }
    params.push(n);
  }

  return { consumed: end - escIndex + 1, params };
}

function applySgrParams(style: TextStyle, params: number[]): TextStyle {
  const effective = params.length === 0 ? [0] : params;
  let next = style;

  for (let i = 0; i < effective.length; i += 1) {
    const p = effective[i]!;

    if (p === 0) {
      next = defaultTextStyle();
      continue;
    }

    if (p === 1) {
      next = { ...next, bold: true };
      continue;
    }

    if (p === 22) {
      next = { ...next, bold: false };
      continue;
    }

    if (p === 4) {
      next = { ...next, underline: true };
      continue;
    }

    if (p === 24) {
      next = { ...next, underline: false };
      continue;
    }

    if (p === 39) {
      next = { ...next, fg: { type: "default" } };
      continue;
    }

    if (p === 49) {
      next = { ...next, bg: null };
      continue;
    }

    if (p >= 30 && p <= 37) {
      next = { ...next, fg: { type: "ansi16", index: p - 30 } };
      continue;
    }

    if (p >= 90 && p <= 97) {
      next = { ...next, fg: { type: "ansi16", index: p - 90 + 8 } };
      continue;
    }

    if (p >= 40 && p <= 47) {
      next = { ...next, bg: { type: "ansi16", index: p - 40 } };
      continue;
    }

    if (p >= 100 && p <= 107) {
      next = { ...next, bg: { type: "ansi16", index: p - 100 + 8 } };
      continue;
    }

    if (p === 38) {
      const mode = effective[i + 1];
      const n = effective[i + 2];
      if (mode === 5 && typeof n === "number" && n >= 0 && n <= 255) {
        next = { ...next, fg: { type: "ansi256", index: n } };
        i += 2;
      }
      continue;
    }

    if (p === 48) {
      const mode = effective[i + 1];
      const n = effective[i + 2];
      if (mode === 5 && typeof n === "number" && n >= 0 && n <= 255) {
        next = { ...next, bg: { type: "ansi256", index: n } };
        i += 2;
      }
      continue;
    }
  }

  return next;
}
