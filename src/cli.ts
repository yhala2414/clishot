#!/usr/bin/env node

import { Command } from "commander";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { decodeInputBuffer } from "./input/encoding";
import { renderTextToImages } from "./render/render";

type CliOptions = {
  in?: string;
  encoding: string;
  out: string;
  format: "png" | "jpg";
  theme: "terminal" | "paper";
  cols: string;
  rows: string;
  fontSize: string;
  lineHeight: string;
  margin: string;
  tabStop: string;
  jpgQuality: string;
};

async function readAllStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function parseIntOption(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} 必须是正整数`);
  }
  return parsed;
}

function parseFloatOption(value: string, name: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} 必须是正数`);
  }
  return parsed;
}

function parseJpgQuality(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    throw new Error(`--jpg-quality 必须在 1~100 之间`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("clishot")
    .description("将终端文本渲染为图片（PNG/JPG），支持管道输入和文件输入")
    .version("0.0.0")
    .addHelpText(
      "beforeAll",
      `将终端文本渲染为精美的图片，适合分享代码片段、日志、文档等。

用法概览:
  <命令> | clishot render --out <图片路径>
  clishot render --in <文本文件> --out <图片路径> [选项]

示例:
  echo "Hello World" | clishot render --out hello.png
  clishot render --in readme.txt --out output.png --format jpg --theme paper
  git diff | clishot render --out diff.png --cols 120
  cargo check 2>&1 | clishot render --out build-log.png --theme terminal

`,
    );

  program
    .command("render")
    .description("将文本渲染为图片（支持管道或 --in 文件输入）")
    .option("--in <file>", "从文件读取文本（不指定则从管道 stdin 读取）")
    .option("--encoding <name>", `输入编码 auto | utf-8 | utf-16le | gb18030 等`, "auto")
    .requiredOption("--out <path>", "输出路径（多页时自动添加 -001 后缀）")
    .option("--format <png|jpg>", "输出格式", "png")
    .option("--theme <terminal|paper>", "主题: terminal（深色终端风格）| paper（浅色纸张风格）", "terminal")
    .option("--cols <number>", "最大列宽（字符数，默认 100）", "100")
    .option("--rows <number>", "每页行数（超长文本自动分页，默认 40）", "40")
    .option("--font-size <number>", "字号（px，默认 16）", "16")
    .option("--line-height <number>", "行高倍数（默认 1.35）", "1.35")
    .option("--margin <number>", "图片边距（px，默认 24）", "24")
    .option("--tab-stop <number>", "Tab 展开宽度（空格数，默认 4）", "4")
    .option("--jpg-quality <number>", "JPG 图片质量 1-100（默认 90）", "90")
    .action(async (options: CliOptions) => {
      const outPath = options.out;

      const cols = parseIntOption(options.cols, "--cols");
      const rows = parseIntOption(options.rows, "--rows");
      const fontSize = parseIntOption(options.fontSize, "--font-size");
      const margin = parseIntOption(options.margin, "--margin");
      const tabStop = parseIntOption(options.tabStop, "--tab-stop");
      const lineHeight = parseFloatOption(options.lineHeight, "--line-height");
      const jpgQuality = parseJpgQuality(options.jpgQuality);

      if (options.format !== "png" && options.format !== "jpg") {
        throw new Error(`--format 仅支持 png|jpg`);
      }
      if (options.theme !== "terminal" && options.theme !== "paper") {
        throw new Error(`--theme 仅支持 terminal|paper`);
      }
      const format = options.format;
      const theme = options.theme;

      let inputText: string;
      if (options.in) {
        const absoluteIn = path.resolve(process.cwd(), options.in);
        const inputBuffer = await readFile(absoluteIn);
        inputText = decodeInputBuffer(inputBuffer, {
          encoding: options.encoding,
          sourceLabel: absoluteIn
        }).text;
      } else {
        if (process.stdin.isTTY) {
          throw new Error(`未提供输入：请使用管道输入或指定 --in <file>`);
        }
        const inputBuffer = await readAllStdin();
        inputText = decodeInputBuffer(inputBuffer, {
          encoding: options.encoding,
          sourceLabel: "stdin"
        }).text;
      }

      const outputs = await renderTextToImages({
        inputText,
        outPath,
        format,
        theme,
        cols,
        rows,
        fontSize,
        lineHeight,
        margin,
        tabStop,
        jpgQuality
      });

      for (const p of outputs) {
        process.stdout.write(`${p}\n`);
      }
    });

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
