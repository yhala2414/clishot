import { writeFile } from "node:fs/promises";
import path from "node:path";
import { layoutStyledTextToPages } from "./layout";
import { encodeCanvasToBuffer, renderPageToCanvas } from "./raster";
import { parseStyledTextForRender } from "./text";
import { resolveOutputPaths, validateOutputDirectory } from "./output";
import { getTheme } from "./theme";
import { ensureFontReady } from "./typography";

export type RenderOptions = {
  inputText: string;
  outPath: string;
  format: "png" | "jpg";
  theme: "terminal" | "paper";
  cols: number;
  rows: number;
  fontSize: number;
  lineHeight: number;
  margin: number;
  tabStop: number;
  jpgQuality: number;
};

export async function renderTextToImages(options: RenderOptions): Promise<string[]> {
  await validateOutputDirectory(options.outPath);

  const theme = getTheme(options.theme);
  const typography = await ensureFontReady();

  const styledLines = parseStyledTextForRender(options.inputText, { tabStop: options.tabStop });
  const pages = layoutStyledTextToPages(styledLines, { cols: options.cols, rows: options.rows });

  const outputs = resolveOutputPaths(options.outPath, {
    format: options.format,
    pageCount: pages.length
  });

  for (let i = 0; i < pages.length; i++) {
    const canvas = renderPageToCanvas({
      lines: pages[i]!,
      cols: options.cols,
      rows: options.rows,
      theme,
      typography,
      fontSize: options.fontSize,
      lineHeight: options.lineHeight,
      margin: options.margin
    });

    const buffer = await encodeCanvasToBuffer(canvas, {
      format: options.format,
      jpgQuality: options.jpgQuality
    });

    const outFile = path.resolve(process.cwd(), outputs[i]!);
    await writeFile(outFile, buffer);
  }

  return outputs.map((p) => path.resolve(process.cwd(), p));
}
