# ANSI SGR StyledSegment + 可见字符布局 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成 Task1+Task2：解析 `\x1b[...m` 为 `StyledSegment` 并保留 `\r` 覆盖 / `\t` 展开语义；新增基于可见字符计数的 styled 布局 API（换行/分页），并保持现有 string API 兼容。

**Architecture:** 在 `src/render/text.ts` 新增一条“解析 ANSI + 控制语义处理”的 styled 管道（cell 缓冲按列覆盖），输出 `StyledLine[]`；在 `src/render/layout.ts` 新增 `layoutStyledTextToPages` 等 API，对 `StyledLine[]` 做按可见字符的换行与分页，segment 在断点处可拆分并延续样式。

**Tech Stack:** TypeScript（node:test 单测）

---

### Task 1: ANSI SGR 解析 + `\r`/`\t` 语义保留（输出 styled 结构）

**Files:**
- Modify: `f:/clishot/src/render/text.ts`
- Test: `f:/clishot/src/__tests__/text.test.ts`

**Step 1: 写失败单测（styled 解析 + \r 覆盖 + \t 展开）**

在 `text.test.ts` 新增测试，覆盖：
- SGR 序列不出现在可见文本里（不会被当作字符）
- `\r` 覆盖发生时，被覆盖区域的样式以“写入时的样式”为准
- `\t` 展开为空格，空格继承当时样式，列数按 `tabStop` 对齐

示例断言（伪码，具体以最终导出函数为准）：

```ts
import { parseStyledTextForRender } from "../render/text";

test("parseStyledTextForRender: supports SGR + CR overwrite + tab expansion", () => {
  const input = "\x1b[31mAB\tC\r\x1b[32mZ";
  const lines = parseStyledTextForRender(input, { tabStop: 4 });
  // 断言：只有一行；行内 segments 能表达 Z 覆盖行首且为绿色，后续字符保持原样式/文本位置正确
});
```

**Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- --runInBand
```

Expected: 新增测试 FAIL（函数未实现或断言不满足）

**Step 3: 在 text.ts 增加类型与解析实现（最小实现先过测试）**

实现内容：
- 新增类型：
  - `export type ColorSpec = { type: "default" } | { type: "ansi16"; index: number } | { type: "ansi256"; index: number }`
  - `export type TextStyle = { bold: boolean; underline: boolean; fg: ColorSpec; bg: ColorSpec | null }`
  - `export type StyledSegment = { text: string; style: TextStyle }`
  - `export type StyledLine = StyledSegment[]`
  - `export type StyledPage = StyledLine[]`
- 新增导出函数：
  - `export function parseStyledTextForRender(input: string, options: CleanTextOptions): StyledLine[]`
    - 先 `normalizeNewlines`
    - 单遍扫描，按“cell 缓冲区”建模一行：
      - `cells: Array<{ ch: string; style: TextStyle }>`
      - `cursor` 表示当前可见列
      - `\n` flush：把 cells 压缩合并为 `StyledSegment[]`
      - `\r`：`cursor = 0`
      - `\t`：计算 `spaces = tabStop - (cursor % tabStop)`，写入 spaces 个 `" "`（覆盖或追加），每个 cell 样式为当前 style
      - C0/DEL（除 `\n\r\t`）：丢弃
      - `\x1b[` 开始的 CSI：仅解析到 `m` 的 SGR 子集，更新当前 style；非法/截断序列按“忽略 ESC”策略（不崩溃、不输出）
      - 其他字符：写入 cells[cursor]，`cursor++`
    - 文件尾 flush 最后一行
- 兼容：保留 `cleanTextForRender` 的现有行为不变（Task4 再切渲染链路）；必要时新增辅助函数把 `StyledLine[]` 还原为 string，但不改变当前渲染路径。

**Step 4: 运行测试确认通过**

Run:

```powershell
npm test -- --runInBand
```

Expected: 所有 text 相关测试 PASS

---

### Task 2: styled 布局（按可见字符换行/分页，segment 断点可拆分且延续样式）

**Files:**
- Modify: `f:/clishot/src/render/layout.ts`
- Test: `f:/clishot/src/__tests__/layout.test.ts`

**Step 1: 写失败单测（styled wrap + paginate）**

在 `layout.test.ts` 新增测试，覆盖：
- styled 换行按可见字符计数（segment.text 的字符数）
- segment 在断点处拆分，并且后续行仍保留相同 style
- styled 分页按 rows 切片，行为与 string paginate 一致

示例断言（伪码）：

```ts
import { wrapStyledLinesByColumns, paginateStyledLines } from "../render/layout";
import type { StyledLine, TextStyle } from "../render/text";

test("wrapStyledLinesByColumns: splits segment and preserves style", () => {
  const s: TextStyle = { bold: false, underline: false, fg: { type: "default" }, bg: null };
  const line: StyledLine = [{ text: "abcd", style: s }];
  const out = wrapStyledLinesByColumns([line], 3);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], [{ text: "abc", style: s }]);
  assert.deepEqual(out[1], [{ text: "d", style: s }]);
});
```

**Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- --runInBand
```

Expected: 新增 styled layout 测试 FAIL（函数未实现）

**Step 3: 在 layout.ts 新增 styled API（最小实现）**

新增导出：
- `export function wrapStyledLinesByColumns(lines: StyledLine[], cols: number): StyledLine[]`
  - 对每一行逐 segment 扫描，累计列数
  - 超过 cols 时在字符边界拆分当前 segment：
    - 前半段留在当前行
    - 后半段作为下一行的起始 segment（同 style）
  - 空行保持为空 `[]`（或 `[ {text:"",...} ]`），测试里固定一种约定并保持一致
- `export function paginateStyledLines(lines: StyledLine[], rows: number): StyledPage[]`
  - 行数组按 rows 分页
  - 0 行输入返回单页且包含 1 空行（与 string paginate 的 `[[ ""]]` 对齐，styled 对应为 `[[[]]]` 或 `[[[{text:"",style:default}]]]`，需与测试约定一致）
- `export function layoutStyledTextToPages(lines: StyledLine[], options: LayoutOptions): StyledPage[]`
  - `wrapStyledLinesByColumns` -> `paginateStyledLines`

注意：
- 不修改现有 string API（`layoutTextToPages/wrapTextByColumns/paginateLines` 仍保持原样）

**Step 4: 运行测试确认通过**

Run:

```powershell
npm test -- --runInBand
```

Expected: 所有 layout 相关测试 PASS

---

### Task 3: 勾选 tasks.md 的 Task1/Task2

**Files:**
- Modify: `f:/clishot/.trae/specs/add-ansi-sgr-style-support/tasks.md`

**Step 1: 修改 tasks.md 勾选 Task 1/2**

将：
- `- [ ] Task 1 ...` 改为 `- [x] Task 1 ...`
- `- [ ] Task 2 ...` 改为 `- [x] Task 2 ...`

**Step 2: 运行全量测试**

Run:

```powershell
npm test -- --runInBand
```

Expected: PASS

