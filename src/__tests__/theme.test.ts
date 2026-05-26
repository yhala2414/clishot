import assert from "node:assert/strict";
import { test } from "node:test";
import { ansi256ToRgbHex, getTheme, XTERM_ANSI16_PALETTE } from "../render/theme";

test("theme: exposes xterm ansi16 palette", () => {
  assert.deepEqual(getTheme("terminal").ansi16Palette, XTERM_ANSI16_PALETTE);
  assert.deepEqual(getTheme("paper").ansi16Palette, XTERM_ANSI16_PALETTE);
});

test("ansi256ToRgbHex: returns undefined for invalid indexes", () => {
  assert.equal(ansi256ToRgbHex(-1, XTERM_ANSI16_PALETTE), undefined);
  assert.equal(ansi256ToRgbHex(256, XTERM_ANSI16_PALETTE), undefined);
  assert.equal(ansi256ToRgbHex(1.2, XTERM_ANSI16_PALETTE), undefined);
  assert.equal(ansi256ToRgbHex(Number.NaN, XTERM_ANSI16_PALETTE), undefined);
  assert.equal(ansi256ToRgbHex(Number.POSITIVE_INFINITY, XTERM_ANSI16_PALETTE), undefined);
});

test("ansi256ToRgbHex: maps 0-15 to ansi16 palette", () => {
  for (let i = 0; i < 16; i += 1) {
    assert.equal(ansi256ToRgbHex(i, XTERM_ANSI16_PALETTE), XTERM_ANSI16_PALETTE[i]);
  }
});

test("ansi256ToRgbHex: maps color cube endpoints deterministically", () => {
  assert.equal(ansi256ToRgbHex(16, XTERM_ANSI16_PALETTE), "#000000");
  assert.equal(ansi256ToRgbHex(21, XTERM_ANSI16_PALETTE), "#0000ff");
  assert.equal(ansi256ToRgbHex(231, XTERM_ANSI16_PALETTE), "#ffffff");
});

test("ansi256ToRgbHex: maps grayscale endpoints deterministically", () => {
  assert.equal(ansi256ToRgbHex(232, XTERM_ANSI16_PALETTE), "#080808");
  assert.equal(ansi256ToRgbHex(255, XTERM_ANSI16_PALETTE), "#eeeeee");
});

