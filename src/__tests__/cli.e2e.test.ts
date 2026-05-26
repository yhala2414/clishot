import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { inflateSync } from "node:zlib";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { layoutStyledTextToPages } from "../render/layout";
import { renderPageToCanvas, encodeCanvasToBuffer } from "../render/raster";
import { getTheme, type ThemeName } from "../render/theme";
import { parseStyledTextForRender } from "../render/text";
import { ensureFontReady } from "../render/typography";

type CliRunResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

type DecodedPng = {
  width: number;
  height: number;
  rgba: Uint8Array;
};

function parsePngSize(buf: Buffer): { width: number; height: number } {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(buf.subarray(0, 8).equals(signature), true);
  const type = buf.subarray(12, 16).toString("ascii");
  assert.equal(type, "IHDR");
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function decodePngRgba(buf: Buffer): DecodedPng {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(buf.subarray(0, 8).equals(signature), true);

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    assert.equal(dataEnd + 4 <= buf.length, true);

    if (type === "IHDR") {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf[dataStart + 8]!;
      colorType = buf[dataStart + 9]!;
      interlace = buf[dataStart + 12]!;
    } else if (type === "IDAT") {
      idat.push(buf.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  assert.equal(bitDepth, 8);
  assert.equal(colorType, 6);
  assert.equal(interlace, 0);
  assert.equal(idat.length > 0, true);

  const inflated = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  const row = new Uint8Array(stride);

  let p = 0;
  let out = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[p]!;
    p += 1;
    row.set(inflated.subarray(p, p + stride));
    p += stride;

    unfilterRow(filter, row, prev, 4);
    rgba.set(row, out);
    out += stride;
    prev.set(row);
  }

  return { width, height, rgba };
}

function unfilterRow(filter: number, row: Uint8Array, prev: Uint8Array, bpp: number): void {
  if (filter === 0) {
    return;
  }

  if (filter === 1) {
    for (let i = 0; i < row.length; i += 1) {
      const left = i >= bpp ? row[i - bpp]! : 0;
      row[i] = (row[i]! + left) & 0xff;
    }
    return;
  }

  if (filter === 2) {
    for (let i = 0; i < row.length; i += 1) {
      row[i] = (row[i]! + prev[i]!) & 0xff;
    }
    return;
  }

  if (filter === 3) {
    for (let i = 0; i < row.length; i += 1) {
      const left = i >= bpp ? row[i - bpp]! : 0;
      const up = prev[i]!;
      row[i] = (row[i]! + Math.floor((left + up) / 2)) & 0xff;
    }
    return;
  }

  if (filter === 4) {
    for (let i = 0; i < row.length; i += 1) {
      const a = i >= bpp ? row[i - bpp]! : 0;
      const b = prev[i]!;
      const c = i >= bpp ? prev[i - bpp]! : 0;
      row[i] = (row[i]! + paethPredictor(a, b, c)) & 0xff;
    }
    return;
  }

  throw new Error(`Unsupported PNG filter: ${filter}`);
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  if (pb <= pc) {
    return b;
  }
  return c;
}

function getPixel(decoded: DecodedPng, x: number, y: number): { r: number; g: number; b: number; a: number } {
  assert.equal(x >= 0 && x < decoded.width, true);
  assert.equal(y >= 0 && y < decoded.height, true);
  const idx = (y * decoded.width + x) * 4;
  return {
    r: decoded.rgba[idx]!,
    g: decoded.rgba[idx + 1]!,
    b: decoded.rgba[idx + 2]!,
    a: decoded.rgba[idx + 3]!
  };
}

function assertRedDominant(p: { r: number; g: number; b: number; a: number }): void {
  assert.equal(p.a, 255);
  assert.equal(p.r > 180, true);
  assert.equal(p.r > p.g + 120, true);
  assert.equal(p.r > p.b + 120, true);
}

function assertGreenDominant(p: { r: number; g: number; b: number; a: number }): void {
  assert.equal(p.a, 255);
  assert.equal(p.g > 180, true);
  assert.equal(p.g > p.r + 120, true);
  assert.equal(p.g > p.b + 120, true);
}

function parseJpegSize(buf: Buffer): { width: number; height: number } {
  assert.equal(buf[0], 0xff);
  assert.equal(buf[1], 0xd8);
  let offset = 2;
  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1]!;
    offset += 2;
    if (marker === 0xd9) {
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    const length = buf.readUInt16BE(offset);
    const segmentStart = offset + 2;
    if (marker === 0xc0 || marker === 0xc2) {
      const height = buf.readUInt16BE(segmentStart + 1);
      const width = buf.readUInt16BE(segmentStart + 3);
      return { width, height };
    }
    offset = offset + length;
  }
  throw new Error("JPEG size not found");
}

async function expectedCanvasSize(options: {
  cols: number;
  rows: number;
  fontSize: number;
  lineHeight: number;
  margin: number;
}): Promise<{ width: number; height: number }> {
  const typography = await ensureFontReady();
  const metricsCanvas = createCanvas(1, 1);
  const metricsCtx = metricsCanvas.getContext("2d");
  metricsCtx.font = `${options.fontSize}px ${typography.fontFamilyCss}`;
  const charWidth = metricsCtx.measureText("M").width;
  const lineHeightPx = Math.round(options.fontSize * options.lineHeight);
  const width = Math.ceil(options.margin * 2 + charWidth * options.cols);
  const height = Math.ceil(options.margin * 2 + lineHeightPx * options.rows);
  return { width, height };
}

async function runCli(args: string[], stdinText?: string): Promise<CliRunResult> {
  const cliPath = path.resolve(__dirname, "..", "cli.js");
  const child = spawn(process.execPath, [cliPath, ...args], { stdio: "pipe" });

  let stdout = "";
  let stderr = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  if (stdinText !== undefined) {
    child.stdin.end(stdinText, "utf8");
  } else {
    child.stdin.end();
  }

  const code = await new Promise<number | null>((resolve) => {
    child.on("close", (c) => resolve(c));
  });

  return { code, stdout, stderr };
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function parseOutputPaths(stdout: string): string[] {
  return stdout
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function renderTextHash(options: {
  text: string;
  theme: ThemeName;
  fontFamilyCss?: string;
}): Promise<string> {
  const typography = await ensureFontReady();
  const style = { bold: false, underline: false, fg: { type: "default" as const }, bg: null };
  const canvas = renderPageToCanvas({
    lines: [[{ text: options.text, style }]],
    cols: Math.max(4, options.text.length * 2),
    rows: 1,
    theme: getTheme(options.theme),
    typography: {
      fontFamilyCss: options.fontFamilyCss ?? typography.fontFamilyCss
    },
    fontSize: 32,
    lineHeight: 1.35,
    margin: 16
  });

  const png = await encodeCanvasToBuffer(canvas, { format: "png", jpgQuality: 85 });
  return sha256(png);
}

async function renderFirstPagePngHash(options: {
  inputText: string;
  theme: ThemeName;
  cols: number;
  rows: number;
  fontSize?: number;
  lineHeight?: number;
  margin?: number;
  tabStop?: number;
}): Promise<string> {
  const fontSize = options.fontSize ?? 16;
  const lineHeight = options.lineHeight ?? 1.35;
  const margin = options.margin ?? 24;
  const tabStop = options.tabStop ?? 4;
  const typography = await ensureFontReady();
  const styledLines = parseStyledTextForRender(options.inputText, { tabStop });
  const pages = layoutStyledTextToPages(styledLines, { cols: options.cols, rows: options.rows });
  assert.equal(pages.length, 1, "测试样本应控制为单页，避免哈希对比掺入分页差异");

  const canvas = renderPageToCanvas({
    lines: pages[0]!,
    cols: options.cols,
    rows: options.rows,
    theme: getTheme(options.theme),
    typography,
    fontSize,
    lineHeight,
    margin
  });
  const png = await encodeCanvasToBuffer(canvas, { format: "png", jpgQuality: 85 });
  return sha256(png);
}

test("CLI E2E: stdin -> 输出 PNG 文件存在且尺寸正确", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clishot-"));
  const outFile = path.join(dir, "stdin.png");

  const cols = 20;
  const rows = 10;
  const fontSize = 16;
  const lineHeight = 1.35;
  const margin = 24;

  const result = await runCli(
    [
      "render",
      "--out",
      outFile,
      "--format",
      "png",
      "--theme",
      "terminal",
      "--cols",
      String(cols),
      "--rows",
      String(rows),
      "--font-size",
      String(fontSize),
      "--line-height",
      String(lineHeight),
      "--margin",
      String(margin)
    ],
    "Hello\nWorld\n"
  );

  assert.equal(result.code, 0, result.stderr);

  const outputs = parseOutputPaths(result.stdout);
  assert.equal(outputs.length, 1);
  assert.equal(path.normalize(outputs[0]!), path.normalize(outFile));

  const buf = await readFile(outFile);
  const size = parsePngSize(buf);
  const expected = await expectedCanvasSize({ cols, rows, fontSize, lineHeight, margin });
  assert.deepEqual(size, expected);
});

test("CLI E2E: stdin -> 输出 JPG 文件存在且尺寸正确", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clishot-"));
  const outFile = path.join(dir, "stdin.jpg");

  const cols = 18;
  const rows = 8;
  const fontSize = 16;
  const lineHeight = 1.35;
  const margin = 24;

  const result = await runCli(
    [
      "render",
      "--out",
      outFile,
      "--format",
      "jpg",
      "--theme",
      "paper",
      "--cols",
      String(cols),
      "--rows",
      String(rows),
      "--font-size",
      String(fontSize),
      "--line-height",
      String(lineHeight),
      "--margin",
      String(margin),
      "--jpg-quality",
      "85"
    ],
    "Hello\nWorld\n"
  );

  assert.equal(result.code, 0, result.stderr);

  const outputs = parseOutputPaths(result.stdout);
  assert.equal(outputs.length, 1);
  assert.equal(path.normalize(outputs[0]!), path.normalize(outFile));

  const buf = await readFile(outFile);
  const size = parseJpegSize(buf);
  const expected = await expectedCanvasSize({ cols, rows, fontSize, lineHeight, margin });
  assert.deepEqual(size, expected);
});

test("CLI E2E: ANSI 背景色区域像素按通道占优阈值断言（红/绿）", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clishot-"));
  const outFile = path.join(dir, "ansi-bg.png");

  const cols = 4;
  const rows = 2;
  const fontSize = 32;
  const lineHeight = 1.2;
  const margin = 12;

  const inputText = "\u001b[101m  \u001b[0m\n\u001b[102m  \u001b[0m";

  const result = await runCli(
    [
      "render",
      "--out",
      outFile,
      "--format",
      "png",
      "--theme",
      "terminal",
      "--cols",
      String(cols),
      "--rows",
      String(rows),
      "--font-size",
      String(fontSize),
      "--line-height",
      String(lineHeight),
      "--margin",
      String(margin)
    ],
    inputText
  );

  assert.equal(result.code, 0, result.stderr);

  const outputs = parseOutputPaths(result.stdout);
  assert.equal(outputs.length, 1);
  assert.equal(path.normalize(outputs[0]!), path.normalize(outFile));

  const buf = await readFile(outFile);
  const decoded = decodePngRgba(buf);

  const typography = await ensureFontReady();
  const metricsCanvas = createCanvas(1, 1);
  const metricsCtx = metricsCanvas.getContext("2d");
  metricsCtx.font = `${fontSize}px ${typography.fontFamilyCss}`;
  const charWidth = metricsCtx.measureText("M").width;
  const lineHeightPx = Math.round(fontSize * lineHeight);

  const x = Math.round(margin + charWidth * 0.5);
  const yRed = Math.round(margin + lineHeightPx * 0.5);
  const yGreen = Math.round(margin + lineHeightPx * 1.5);

  assertRedDominant(getPixel(decoded, x, yRed));
  assertGreenDominant(getPixel(decoded, x, yGreen));
});

test("CLI E2E: --in 文件 -> 多页命名正确且页数符合预期", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clishot-"));
  const inFile = path.join(dir, "input.txt");
  const outPrefix = path.join(dir, "pages");

  const rows = 20;
  const lineCount = 45;
  const lines = Array.from({ length: lineCount }, (_, i) => `L${String(i + 1).padStart(2, "0")}`);
  await writeFile(inFile, lines.join("\n") + "\n", "utf8");

  const result = await runCli([
    "render",
    "--in",
    inFile,
    "--out",
    outPrefix,
    "--format",
    "png",
    "--theme",
    "terminal",
    "--cols",
    "80",
    "--rows",
    String(rows)
  ]);

  assert.equal(result.code, 0, result.stderr);

  const outputs = parseOutputPaths(result.stdout);

  assert.equal(outputs.length, 3);

  const expectedFiles = ["pages-001.png", "pages-002.png", "pages-003.png"].map((name) =>
    path.join(dir, name)
  );
  assert.deepEqual(
    outputs.map((p) => path.normalize(p)),
    expectedFiles.map((p) => path.normalize(p))
  );

  for (const f of expectedFiles) {
    const buf = await readFile(f);
    const size = parsePngSize(buf);
    assert.equal(size.width > 0, true);
    assert.equal(size.height > 0, true);
  }
});

test("CLI E2E: 中文字体回退在 terminal/paper 主题下可区分真实中文 glyph", async () => {
  for (const theme of ["terminal", "paper"] as const) {
    const replacementHash = await renderTextHash({ text: "�", theme });
    const middleHash = await renderTextHash({ text: "中", theme });
    const textHash = await renderTextHash({ text: "文", theme });

    assert.notEqual(middleHash, replacementHash, `${theme} 主题下“中”仍退化为缺字 glyph`);
    assert.notEqual(textHash, replacementHash, `${theme} 主题下“文”仍退化为缺字 glyph`);
    assert.notEqual(middleHash, textHash, `${theme} 主题下中文字符仍被渲染成相同 glyph`);
  }
});

test("CLI E2E: 英文仍优先使用 JetBrains Mono", async () => {
  const typography = await ensureFontReady();
  assert.match(typography.fontFamilyCss, /^"JetBrains Mono"/);
  assert.equal(GlobalFonts.has("JetBrains Mono"), true);

  const fullChainHash = await renderTextHash({
    text: "Hello, clishot 123",
    theme: "terminal"
  });
  const jetbrainsHash = await renderTextHash({
    text: "Hello, clishot 123",
    theme: "terminal",
    fontFamilyCss: `"JetBrains Mono"`
  });

  assert.equal(fullChainHash, jetbrainsHash);
});

test("CLI E2E: UTF-8 中文文件输入可按原文渲染", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clishot-"));
  const inFile = path.join(dir, "utf8-chinese.txt");
  const outFile = path.join(dir, "utf8-chinese.png");
  const inputText = "中文输入验证\n第二行 mixed 123\n";
  const cols = 24;
  const rows = 6;
  await writeFile(inFile, inputText, "utf8");

  const result = await runCli([
    "render",
    "--in",
    inFile,
    "--out",
    outFile,
    "--format",
    "png",
    "--theme",
    "terminal",
    "--cols",
    String(cols),
    "--rows",
    String(rows)
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(parseOutputPaths(result.stdout).map((p) => path.normalize(p)), [
    path.normalize(outFile)
  ]);

  const expectedHash = await renderFirstPagePngHash({
    inputText,
    theme: "terminal",
    cols,
    rows
  });
  const actualHash = sha256(await readFile(outFile));
  assert.equal(actualHash, expectedHash, "UTF-8 中文文件渲染结果与原文基线不一致");
});

test("CLI E2E: PowerShell 5 常见 UTF-16LE 重定向文件可自动识别", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clishot-"));
  const inFile = path.join(dir, "utf16le-bom.txt");
  const outFile = path.join(dir, "utf16le-bom.png");
  const inputText = "PowerShell 5 重定向\n中文 UTF-16LE\n";
  const cols = 24;
  const rows = 6;
  const bom = Buffer.from([0xff, 0xfe]);
  const body = Buffer.from(inputText, "utf16le");
  await writeFile(inFile, Buffer.concat([bom, body]));

  const result = await runCli([
    "render",
    "--in",
    inFile,
    "--out",
    outFile,
    "--format",
    "png",
    "--theme",
    "terminal",
    "--cols",
    String(cols),
    "--rows",
    String(rows)
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(parseOutputPaths(result.stdout).map((p) => path.normalize(p)), [
    path.normalize(outFile)
  ]);

  const expectedHash = await renderFirstPagePngHash({
    inputText,
    theme: "terminal",
    cols,
    rows
  });
  const actualHash = sha256(await readFile(outFile));
  assert.equal(actualHash, expectedHash, "UTF-16LE 自动识别后的渲染结果与原文基线不一致");
});

test("CLI E2E: --encoding utf-16le 可显式读取无 BOM 文件", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clishot-"));
  const inFile = path.join(dir, "utf16le-no-bom.txt");
  const outFile = path.join(dir, "utf16le-no-bom.png");
  await writeFile(inFile, Buffer.from("中文测试\n", "utf16le"));

  const result = await runCli([
    "render",
    "--in",
    inFile,
    "--encoding",
    "utf-16le",
    "--out",
    outFile,
    "--format",
    "png",
    "--theme",
    "terminal",
    "--cols",
    "20",
    "--rows",
    "4"
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(path.normalize(result.stdout.trim()), path.normalize(outFile));
});

test("CLI E2E: 非法 --encoding 返回可读错误", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clishot-"));
  const inFile = path.join(dir, "input.txt");
  const outFile = path.join(dir, "invalid-encoding.png");
  await writeFile(inFile, "中文测试\n", "utf8");

  const result = await runCli([
    "render",
    "--in",
    inFile,
    "--encoding",
    "not-a-real-encoding",
    "--out",
    outFile
  ]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /--encoding "not-a-real-encoding" 无效/);
});

test("CLI E2E: 解码失败时返回可读错误", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clishot-"));
  const inFile = path.join(dir, "invalid-utf8.bin");
  const outFile = path.join(dir, "decode-error.png");
  await writeFile(inFile, Buffer.from([0xff, 0xfe, 0x87, 0x65, 0x4b, 0x6d, 0xd5]));

  const result = await runCli([
    "render",
    "--in",
    inFile,
    "--encoding",
    "utf-8",
    "--out",
    outFile
  ]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /无法按 utf-8 解码输入文件/);
  assert.match(result.stderr, /可用示例：utf-8、utf-16le、gb18030/);
});
