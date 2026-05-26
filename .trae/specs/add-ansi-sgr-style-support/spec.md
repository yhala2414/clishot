# ANSI 颜色与 SGR 样式支持 Spec

## Why
当前文本清洗会剥离 ANSI ESC 序列，导致 `git diff --color` 等彩色输出在图片中丢失关键信息（新增/删除行不可快速区分）。

## What Changes
- 文本处理管道在剥离控制字符之前解析 ANSI SGR（Select Graphic Rendition）序列，并将可见文本与样式信息保留下来。
- 引入样式化文本数据结构（StyledSegment / StyledLine / StyledPage）用于布局与栅格化渲染。
- 栅格渲染支持：前景色、背景色、粗体、下划线；并支持 ANSI 16 色与 256 色（`38;5;n`/`48;5;n`）。
- 其余 ANSI 控制序列（光标移动、清屏等）保持“不可见控制”语义：不影响可见文本，最终不出现在渲染结果中。

## Impact
- Affected specs: 文本清洗、换行与分页、渲染主题、E2E 验证（彩色 diff）。
- Affected code:
  - `src/render/text.ts`：清洗流程拆分为“解析 ANSI + 规范化”与“纯文本回退”两条路径。
  - `src/render/layout.ts`：从 `string` 布局扩展到“样式化文本”布局（ANSI 不计入列宽）。
  - `src/render/raster.ts`：按 segment 渲染，并根据样式设置 canvas 的 fillStyle/font/underline。
  - `src/render/theme.ts`：扩展主题以提供 ANSI 调色板与 256 色映射。
  - `src/__tests__/*`：新增/更新单测与 E2E 断言。

## ADDED Requirements
### Requirement: ANSI SGR 样式保留
系统 SHALL 在渲染前解析输入中的 ANSI SGR 序列，并将其映射为可渲染的样式属性（foreground/background/bold/underline）。

#### Scenario: 基础 SGR 属性解析
- **WHEN** 输入文本包含 `\x1b[...m` 形式的 SGR 序列
- **THEN** 系统将其解析为样式状态变更
- **AND** SGR 序列本身不计入可见字符，不参与换行/分页列宽计算
- **AND** 非 SGR 的 C0/DEL 控制字符仍按既有策略剥离（保留 `\n` 与 `\t` 的既有语义）

#### Scenario: 支持的 SGR 子集
- **WHEN** 输入包含下列 SGR 指令
- **THEN** 系统 SHALL 支持：
  - Reset：`0`
  - Bold：`1` / `22`（关闭粗体）
  - Underline：`4` / `24`（关闭下划线）
  - ANSI 16 色前景：`30-37`、`90-97`
  - ANSI 16 色背景：`40-47`、`100-107`
  - ANSI 256 色：`38;5;n`（前景）、`48;5;n`（背景），其中 `n` 为 `0-255`
- **AND** 不在支持范围内的 SGR 参数（例如 truecolor `38;2;r;g;b`）SHALL 被忽略且不导致崩溃

### Requirement: 样式化文本中间表示
系统 SHALL 引入样式化文本中间表示，并在布局与渲染阶段使用。

#### Scenario: Segment 结构
- **WHEN** 解析 ANSI 后生成样式化片段
- **THEN** 每个片段 SHALL 表达为 `StyledSegment`：
  - `text: string`
  - `bold: boolean`
  - `underline: boolean`
  - `foreground: string`（CSS 颜色字符串，如 `#rrggbb`）
  - `background: string | null`

### Requirement: 布局对 ANSI 不敏感
系统 SHALL 基于“可见字符”进行按列换行与分页，ANSI SGR 序列不应影响列宽计算。

#### Scenario: SGR 不计入列宽
- **WHEN** 输入包含 ANSI SGR 序列且 `cols` 限制触发换行
- **THEN** 换行位置仅由可见字符决定
- **AND** 换行切分后的后续行延续切分点的样式状态

### Requirement: 栅格渲染样式一致且确定性
系统 SHALL 将样式化文本确定性渲染到 Canvas：
- 前景色：segment 的 foreground
- 背景色：segment 的 background（若不为 null，则在文本区域绘制背景矩形）
- 粗体：使用 canvas font 的 `bold` 前缀（若字体不支持粗体，允许降级但不得崩溃）
- 下划线：在文本基线下方绘制 1px（或随字体大小按比例）线条

#### Scenario: 彩色 diff 可辨别
- **WHEN** 执行 `git diff --color | clishot render --out diff.png`（或等价命令）
- **THEN** 输出图片中新增行（绿色）与删除行（红色）可清晰辨别

## MODIFIED Requirements
### Requirement: 文本清洗与规范化（扩展）
系统 SHALL 在渲染前对文本做确定性清洗与规范化，并在该阶段保留可渲染的 ANSI SGR 样式信息。

## REMOVED Requirements
（无）

