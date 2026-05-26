# ANSI Theme 16/256 色映射（Task3）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成 Task3：为主题新增 xterm ANSI16 调色板，并提供 ANSI256 → RGB 的确定性映射函数（含默认回退策略约定）；补齐单测；更新 tasks.md 勾选 Task3。

**Architecture:** 在 `src/render/theme.ts` 扩展 `Theme` 增加 `ansi16Palette`（xterm 16 色，terminal/paper 共用）；新增纯函数 `ansi256ToRgbHex(index, palette)` 返回 `#rrggbb` 或 `undefined`。回退策略由调用方决定：当样式颜色为 default/未设置时，继续使用 `theme.foreground/background`。

**Tech Stack:** TypeScript（node:test 单测）

---

### Task 1: 写失败单测（ANSI16 调色板 + ANSI256 映射）

**Files:**
- Create: `f:/clishot/src/__tests__/theme.test.ts`
- Modify: `f:/clishot/package.json`

**Step 1: 添加 `theme.test.ts`（先写断言，再实现）**

新增测试覆盖：
- `getTheme("terminal")/getTheme("paper")` 均含 `ansi16Palette`，并且 palette 等于 xterm 16 色
- `ansi256ToRgbHex(0..15)` 返回对应 palette
- `ansi256ToRgbHex(16)`、`ansi256ToRgbHex(231)` 覆盖色立方边界
- `ansi256ToRgbHex(232)`、`ansi256ToRgbHex(255)` 覆盖灰阶边界
- 非法 index（负数、>255、非整数、NaN/Infinity）返回 `undefined`

示例断言（以最终导出为准）：

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { ansi256ToRgbHex, getTheme, XTERM_ANSI16_PALETTE } from "../render/theme";

test("theme: exposes xterm ansi16 palette", () => {
  assert.deepEqual(getTheme("terminal").ansi16Palette, XTERM_ANSI16_PALETTE);
  assert.deepEqual(getTheme("paper").ansi16Palette, XTERM_ANSI16_PALETTE);
});

test("ansi256ToRgbHex: cube + grayscale mapping is deterministic", () => {
  assert.equal(ansi256ToRgbHex(16, XTERM_ANSI16_PALETTE), "#000000");
  assert.equal(ansi256ToRgbHex(231, XTERM_ANSI16_PALETTE), "#ffffff");
  assert.equal(ansi256ToRgbHex(232, XTERM_ANSI16_PALETTE), "#080808");
  assert.equal(ansi256ToRgbHex(255, XTERM_ANSI16_PALETTE), "#eeeeee");
});
```

**Step 2: 更新 test 脚本包含新测试文件**

将 `package.json` 的 `test` 脚本追加 `dist/__tests__/theme.test.js`。

**Step 3: 运行测试确认失败**

Run:

```powershell
npm test
```

Expected: FAIL（theme 未导出相关成员 / 映射函数未实现 / Theme 类型不匹配）

---

### Task 2: 实现 Theme 扩展 + ANSI16/256 映射（最小实现）

**Files:**
- Modify: `f:/clishot/src/render/theme.ts`

**Step 1: 在 theme.ts 增加 xterm ANSI16 palette**

新增导出常量（全小写 `#rrggbb`，保证确定性）：

```ts
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
```

**Step 2: 扩展 Theme 类型并给两个主题注入 palette**

把 `Theme` 扩展为包含：

```ts
ansi16Palette: readonly string[];
```

并确保 `terminal/paper` 共用 `XTERM_ANSI16_PALETTE`。

**Step 3: 新增 `ansi256ToRgbHex(index, palette)`**

要求：
- 非法 index：返回 `undefined`
- 0~15：直接返回 `palette[index]`
- 16~231：色立方（levels = `[0,95,135,175,215,255]`）
- 232~255：灰阶（`level = 8 + (index - 232) * 10`）
- 返回值一律 `#rrggbb` 小写

**Step 4: 运行测试确认通过**

Run:

```powershell
npm test
```

Expected: PASS

---

### Task 3: 更新 tasks.md 勾选 Task3

**Files:**
- Modify: `f:/clishot/.trae/specs/add-ansi-sgr-style-support/tasks.md`

**Step 1: 勾选 Task3 及其子项**

将 Task3 与 3 个子项（ANSI16 palette / ANSI256 映射 / 默认回退策略）改为勾选状态。

**Step 2: 运行全量测试**

Run:

```powershell
npm test
```

Expected: PASS

