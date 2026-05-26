import { createCanvas } from "@napi-rs/canvas";
import type { Canvas } from "@napi-rs/canvas";
import { ansi256ToRgbHex, type Theme } from "./theme";
import type { ColorSpec, StyledLine, TextStyle } from "./text";
import type { Typography } from "./typography";

export function renderPageToCanvas(options: {
  lines: StyledLine[];
  cols: number;
  rows: number;
  theme: Theme;
  typography: Typography;
  fontSize: number;
  lineHeight: number;
  margin: number;
}): Canvas {
  const metricsCanvas = createCanvas(1, 1);
  const metricsCtx = metricsCanvas.getContext("2d");
  const baseFont = `${options.fontSize}px ${options.typography.fontFamilyCss}`;
  metricsCtx.font = baseFont;
  metricsCtx.textBaseline = "top";

  const charWidth = metricsCtx.measureText("M").width;
  const lineHeightPx = Math.round(options.fontSize * options.lineHeight);

  const width = Math.ceil(options.margin * 2 + charWidth * options.cols);
  const height = Math.ceil(options.margin * 2 + lineHeightPx * options.rows);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = options.theme.background;
  ctx.fillRect(0, 0, width, height);

  ctx.font = baseFont;
  ctx.textBaseline = "top";

  for (let i = 0; i < options.lines.length; i++) {
    const line = options.lines[i] ?? [];
    const y = options.margin + i * lineHeightPx;
    let x = options.margin;

    for (const seg of line) {
      const len = seg.text.length;
      if (len === 0) {
        continue;
      }

      const bg = resolveBgColor(seg.style, options.theme);
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(x, y, charWidth * len, lineHeightPx);
      }

      ctx.font = seg.style.bold ? `bold ${baseFont}` : baseFont;
      ctx.fillStyle = resolveFgColor(seg.style, options.theme);
      ctx.fillText(seg.text, x, y);

      if (seg.style.underline) {
        const underlineY = y + options.fontSize;
        ctx.fillRect(x, underlineY, charWidth * len, 1);
      }

      x += charWidth * len;
    }
  }

  return canvas;
}

function resolveFgColor(style: TextStyle, theme: Theme): string {
  return resolveColor(style.fg, theme, theme.foreground);
}

function resolveBgColor(style: TextStyle, theme: Theme): string | null {
  if (!style.bg) {
    return null;
  }
  return resolveColor(style.bg, theme, theme.background);
}

function resolveColor(spec: ColorSpec, theme: Theme, fallback: string): string {
  if (spec.type === "default") {
    return fallback;
  }
  if (spec.type === "ansi16") {
    return theme.ansi16Palette[spec.index] ?? fallback;
  }
  if (spec.type === "ansi256") {
    return ansi256ToRgbHex(spec.index, theme.ansi16Palette) ?? fallback;
  }
  return fallback;
}

export async function encodeCanvasToBuffer(
  canvas: Canvas,
  options: { format: "png" | "jpg"; jpgQuality: number }
): Promise<Buffer> {
  const anyCanvas = canvas as unknown as {
    encode?: (format: string, options?: unknown) => Promise<Buffer> | Buffer;
    toBuffer?: (mime?: string, options?: unknown) => Buffer;
  };

  if (typeof anyCanvas.encode === "function") {
    if (options.format === "png") {
      const out = anyCanvas.encode("png");
      return out instanceof Promise ? await out : out;
    }

    const out = anyCanvas.encode("jpeg", { quality: options.jpgQuality / 100 });
    return out instanceof Promise ? await out : out;
  }

  if (typeof anyCanvas.toBuffer === "function") {
    if (options.format === "png") {
      return anyCanvas.toBuffer("image/png");
    }
    return anyCanvas.toBuffer("image/jpeg", { quality: options.jpgQuality / 100 });
  }

  throw new Error(`当前渲染引擎不支持导出图片缓冲区`);
}
