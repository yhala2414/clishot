export type ThemeName = "terminal" | "paper";

export const XTERM_ANSI16_PALETTE = [
  "#000000",
  "#800000",
  "#008000",
  "#808000",
  "#000080",
  "#800080",
  "#008080",
  "#c0c0c0",
  "#808080",
  "#ff0000",
  "#00ff00",
  "#ffff00",
  "#0000ff",
  "#ff00ff",
  "#00ffff",
  "#ffffff"
] as const;

export type Theme = {
  name: ThemeName;
  background: string;
  foreground: string;
  ansi16Palette: readonly string[];
};

const THEMES: Record<ThemeName, Theme> = {
  terminal: {
    name: "terminal",
    background: "#0c0c0c",
    foreground: "#f2f2f2",
    ansi16Palette: XTERM_ANSI16_PALETTE
  },
  paper: {
    name: "paper",
    background: "#ffffff",
    foreground: "#111111",
    ansi16Palette: XTERM_ANSI16_PALETTE
  }
};

export function getTheme(name: ThemeName): Theme {
  return THEMES[name];
}

export function ansi256ToRgbHex(index: number, palette: readonly string[]): string | undefined {
  if (!Number.isInteger(index) || index < 0 || index > 255) {
    return undefined;
  }

  if (index <= 15) {
    return palette[index];
  }

  if (index <= 231) {
    const n = index - 16;
    const r = Math.floor(n / 36);
    const g = Math.floor((n % 36) / 6);
    const b = n % 6;

    const levels = [0, 95, 135, 175, 215, 255];
    return rgbToHex(levels[r]!, levels[g]!, levels[b]!);
  }

  const gray = 8 + (index - 232) * 10;
  return rgbToHex(gray, gray, gray);
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

function toHexByte(n: number): string {
  return n.toString(16).padStart(2, "0");
}
