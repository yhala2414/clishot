import assert from "node:assert/strict";
import { test } from "node:test";
import type { TextStyle, StyledLine } from "../render/text";
import { parseStyledTextForRender } from "../render/text";
import {
  layoutStyledTextToPages,
  layoutTextToPages,
  paginateLines,
  paginateStyledLines,
  wrapStyledLinesByColumns,
  wrapTextByColumns
} from "../render/layout";

test("wrapTextByColumns: wraps by fixed column count", () => {
  assert.deepEqual(wrapTextByColumns("abcdef", 3), ["abc", "def"]);
});

test("wrapTextByColumns: preserves empty lines", () => {
  assert.deepEqual(wrapTextByColumns("\n", 10), ["", ""]);
});

test("paginateLines: splits into pages by row count", () => {
  assert.deepEqual(paginateLines(["1", "2", "3", "4", "5"], 2), [["1", "2"], ["3", "4"], ["5"]]);
});

test("paginateLines: empty input returns single empty page", () => {
  assert.deepEqual(paginateLines([], 10), [[""]]);
});

test("layoutTextToPages: wraps then paginates deterministically", () => {
  const pages = layoutTextToPages("abcd\nef", { cols: 3, rows: 2 });
  assert.deepEqual(pages, [["abc", "d"], ["ef"]]);
});

test("wrapStyledLinesByColumns: splits segment and preserves style", () => {
  const s: TextStyle = { bold: false, underline: false, fg: { type: "default" }, bg: null };
  const line: StyledLine = [{ text: "abcd", style: s }];

  const out = wrapStyledLinesByColumns([line], 3);

  assert.equal(out.length, 2);
  assert.deepEqual(out[0], [{ text: "abc", style: s }]);
  assert.deepEqual(out[1], [{ text: "d", style: s }]);
});

test("wrapStyledLinesByColumns: splits inside later segments", () => {
  const s1: TextStyle = { bold: false, underline: false, fg: { type: "default" }, bg: null };
  const s2: TextStyle = { bold: false, underline: false, fg: { type: "ansi16", index: 1 }, bg: null };
  const line: StyledLine = [
    { text: "ab", style: s1 },
    { text: "cde", style: s2 }
  ];

  const out = wrapStyledLinesByColumns([line], 3);

  assert.equal(out.length, 2);
  assert.deepEqual(out[0], [
    { text: "ab", style: s1 },
    { text: "c", style: s2 }
  ]);
  assert.deepEqual(out[1], [{ text: "de", style: s2 }]);
});

test("paginateStyledLines: splits into pages by row count", () => {
  const s: TextStyle = { bold: false, underline: false, fg: { type: "default" }, bg: null };
  const l = (t: string): StyledLine => [{ text: t, style: s }];

  assert.deepEqual(paginateStyledLines([l("1"), l("2"), l("3")], 2), [[l("1"), l("2")], [l("3")]]);
});

test("paginateStyledLines: empty input returns single empty page", () => {
  assert.deepEqual(paginateStyledLines([], 2), [[[]]]);
});

test("layoutStyledTextToPages: wraps then paginates deterministically", () => {
  const s: TextStyle = { bold: false, underline: false, fg: { type: "default" }, bg: null };
  const pages = layoutStyledTextToPages([[{ text: "abcd", style: s }]], { cols: 3, rows: 2 });
  assert.deepEqual(pages, [[[{ text: "abc", style: s }], [{ text: "d", style: s }]]]);
});

test("layoutStyledTextToPages: wrap counts visible chars only and preserves segment styles", () => {
  const lines = parseStyledTextForRender("\x1b[31mabcd\x1b[0mef", { tabStop: 4 });
  const pages = layoutStyledTextToPages(lines, { cols: 3, rows: 10 });
  assert.deepEqual(pages, [
    [
      [{ text: "abc", style: { bold: false, underline: false, fg: { type: "ansi16", index: 1 }, bg: null } }],
      [
        { text: "d", style: { bold: false, underline: false, fg: { type: "ansi16", index: 1 }, bg: null } },
        { text: "ef", style: { bold: false, underline: false, fg: { type: "default" }, bg: null } }
      ]
    ]
  ]);
});
