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
  out?: string;
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

function configureRenderCommand(cmd: Command, requireOut: boolean): void {
  cmd.option("--in <file>", "从文件读取文本（不传则从 stdin 读取）");
  cmd.option("--encoding <name>", "输入编码（默认 auto，可显式指定 utf-8、utf-16le、gb18030 等）", "auto");
  if (requireOut) {
    cmd.requiredOption("--out <path>", "输出文件路径或前缀（支持多页 name-001.ext）");
  } else {
    cmd.option("--out <path>", "输出文件路径或前缀（支持多页 name-001.ext）");
  }
  cmd
    .option("--format <png|jpg>", "输出格式", "png")
    .option("--theme <terminal|paper>", "主题", "terminal")
    .option("--cols <number>", "最大列宽（字符数）", "100")
    .option("--rows <number>", "每页最大行数", "40")
    .option("--font-size <number>", "字体大小（px）", "16")
    .option("--line-height <number>", "行高倍数（例如 1.35）", "1.35")
    .option("--margin <number>", "边距（px）", "24")
    .option("--tab-stop <number>", "tab 展开到的空格列宽", "4")
    .option("--jpg-quality <number>", "JPG 质量（1~100）", "90")
    .action(async (options: CliOptions, command: Command) => {
      if (!options.out) {
        command.error(`required option '--out <path>' not specified`);
      }
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
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("clishot")
    .usage("[options]")
    .description("Render-only: 纯文本 → 图片（PNG/JPG）")
    .version("0.0.0")
    .enablePositionalOptions()
    .showHelpAfterError()
    .showSuggestionAfterError();

  configureRenderCommand(program, false);

  const renderCmd = program.command("render").description("从 stdin 或文件读取文本并渲染为图片");
  renderCmd.showHelpAfterError().showSuggestionAfterError();
  configureRenderCommand(renderCmd, true);

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
