import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCarriageReturnOverwrites,
  cleanTextForRender,
  expandTabs,
  normalizeNewlines,
  parseStyledTextForRender,
  stripControlCharacters
} from "../render/text";

test("normalizeNewlines: CRLF -> LF", () => {
  assert.equal(normalizeNewlines("a\r\nb\nc\r"), "a\nb\nc\r");
});

test("applyCarriageReturnOverwrites: overwrite from start of line", () => {
  assert.equal(applyCarriageReturnOverwrites("abc\rZ"), "Zbc");
  assert.equal(applyCarriageReturnOverwrites("hello\rjello"), "jello");
});

test("applyCarriageReturnOverwrites: supports newline flush", () => {
  assert.equal(applyCarriageReturnOverwrites("ab\rZ\ncd"), "Zb\ncd");
});

test("stripControlCharacters: drops C0 and DEL but keeps tab/newline", () => {
  assert.equal(stripControlCharacters("a\u0007b\nc\td\u007fe"), "ab\nc\tde");
});

test("expandTabs: expands with deterministic tab stops", () => {
  assert.equal(expandTabs("a\tb", 4), "a   b");
  assert.equal(expandTabs("abc\t", 4), "abc ");
  assert.equal(expandTabs("\t", 4), "    ");
});

test("cleanTextForRender: normalizes newlines, applies CR, strips controls, expands tabs", () => {
  const input = "ab\r\n12\rZ\u0007\tX";
  const out = cleanTextForRender(input, { tabStop: 4 });
  assert.equal(out, "ab\nZ   X");
});

test("parseStyledTextForRender: supports SGR + CR overwrite + tab expansion", () => {
  const lines = parseStyledTextForRender("\x1b[31mAB\tC\r\x1b[32mZ", { tabStop: 4 });

  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0], [
    {
      text: "Z",
      style: { bold: false, underline: false, fg: { type: "ansi16", index: 2 }, bg: null }
    },
    {
      text: "B  C",
      style: { bold: false, underline: false, fg: { type: "ansi16", index: 1 }, bg: null }
    }
  ]);
});

test("parseStyledTextForRender: supports SGR reset 0 and default color fallback", () => {
  const lines = parseStyledTextForRender("\x1b[31mR\x1b[0mN", { tabStop: 4 });
  assert.deepEqual(lines, [
    [
      { text: "R", style: { bold: false, underline: false, fg: { type: "ansi16", index: 1 }, bg: null } },
      { text: "N", style: { bold: false, underline: false, fg: { type: "default" }, bg: null } }
    ]
  ]);
});

test("parseStyledTextForRender: supports bold/underline on/off", () => {
  const lines = parseStyledTextForRender("\x1b[1;4mA\x1b[22;24mB", { tabStop: 4 });
  assert.deepEqual(lines, [
    [
      { text: "A", style: { bold: true, underline: true, fg: { type: "default" }, bg: null } },
      { text: "B", style: { bold: false, underline: false, fg: { type: "default" }, bg: null } }
    ]
  ]);
});

test("parseStyledTextForRender: supports 256-color foreground/background", () => {
  const lines = parseStyledTextForRender("\x1b[38;5;196;48;5;22mX", { tabStop: 4 });
  assert.deepEqual(lines, [
    [
      {
        text: "X",
        style: { bold: false, underline: false, fg: { type: "ansi256", index: 196 }, bg: { type: "ansi256", index: 22 } }
      }
    ]
  ]);
});

test("parseStyledTextForRender: illegal CSI does not crash and does not apply style", () => {
  const lines = parseStyledTextForRender("\x1b[3xA\x1b[31mR", { tabStop: 4 });
  assert.deepEqual(lines, [
    [
      { text: "[3xA", style: { bold: false, underline: false, fg: { type: "default" }, bg: null } },
      { text: "R", style: { bold: false, underline: false, fg: { type: "ansi16", index: 1 }, bg: null } }
    ]
  ]);
});
