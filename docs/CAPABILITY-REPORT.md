# clishot 功能全景报告

> 本报告梳理 clishot 项目的功能现状、待完成项及拓展方向，为后续开发路线提供系统性参考。
>
> 报告日期：2026-05-26
> 报告基于版本：v0.0.0（MVP）

***

## 一、产品定位与架构

### 1.1 核心问题解决

clishot 解决两类痛点：

**场景一：实验报告截图**

- 写实验报告时，最繁琐的不是实验本身，而是截图操作
- 终端窗口大小不统一，截图高矮胖瘦各不同
- 换台电脑主题变了，截图风格前后不一致
- 长输出要截好几张还要手动拼接
- 中文显示乱码或字体发虚
- AI Agent 无法自动完成，需要频繁手动操作

**场景二：终端内容分享**

- 技术博客、命令行技巧分享需要"终端截图"
- 希望风格统一、清晰美观

### 1.2 目标用户

- 需要写实验报告的学生和研究人员
- 使用 AI Agent 辅助完成自动化文档工作的开发者
- 需要生成统一风格终端截图的技术博主

### 1.3 架构概述：CLI + Skill 双层形态

```
┌─────────────────────────────────────────────┐
│              AI Agent / 用户                 │
├─────────────────────────────────────────────┤
│              Skill 层（第二阶段）             │
│  负责：指令引导、参数协商、结果解析            │
├─────────────────────────────────────────────┤
│              CLI 层（第一阶段）               │
│  负责：文本读取、渲染引擎、图片生成            │
├─────────────────────────────────────────────┤
│              渲染后端 (@napi-rs/canvas)      │
└─────────────────────────────────────────────┘
```

**第一阶段（当前）**：完善 CLI 工具，补全渲染能力
**第二阶段**：封装 Skill 层，打通 AI Agent 联动

### 1.4 当前产品状态

- MVP 版本已完成
- 核心渲染链路已打通（文本 → 图片）
- 仅适配两种基础主题：terminal（深色）、paper（浅色）
- 暂不支持 ANSI 彩色输出
- 多平台终端风格（macOS/Windows CMD/Linux）均在路线图中

***

## 二、已实现功能完整盘点

### 2.1 渲染核心能力

| 功能        |  完成度 | 代码位置                                                                |       测试覆盖       | 说明                       |
| :-------- | :--: | :------------------------------------------------------------------ | :--------------: | :----------------------- |
| 纯文本渲染为图片  | 100% | [raster.ts#L13-50](file:///f:/clishot/src/render/raster.ts#L13-L50) |       ✅ e2e      | 使用 @napi-rs/canvas 实现    |
| 多页自动分页    | 100% | [layout.ts#L35-52](file:///f:/clishot/src/render/layout.ts#L35-L52) | ✅ layout.test.ts | 按 `--rows` 自动分页          |
| 自动列宽换行    | 100% | [layout.ts#L14-33](file:///f:/clishot/src/render/layout.ts#L14-L33) | ✅ layout.test.ts | 按 `--cols` 硬换行（非智能断词）    |
| PNG 输出    | 100% | [raster.ts#L52-60](file:///f:/clishot/src/render/raster.ts#L52-L60) |       ✅ e2e      | 默认格式                     |
| JPG 输出    | 100% | [raster.ts#L62-66](file:///f:/clishot/src/render/raster.ts#L62-L66) |       ✅ e2e      | 支持 `--jpg-quality` 参数    |
| Tab 展开    | 100% | [text.ts#L70-92](file:///f:/clishot/src/render/text.ts#L70-L92)     |  ✅ text.test.ts  | 可配置 tabStop（默认4）         |
| CR 回车符处理  | 100% | [text.ts#L23-38](file:///f:/clishot/src/render/text.ts#L23-L38)     |  ✅ text.test.ts  | 模拟终端回车覆盖效果               |
| C0 控制字符剥离 | 100% | [text.ts#L40-55](file:///f:/clishot/src/render/text.ts#L40-L55)     |  ✅ text.test.ts  | 保留 \n 和 \t，剥离其他 C0 + DEL |
| 文本规范化     | 100% | [text.ts#L1-22](file:///f:/clishot/src/render/text.ts#L1-L22)       |  ✅ text.test.ts  | CRLF → LF 统一换行符          |

### 2.2 样式与主题能力

| 功能            |  完成度 | 代码位置                                                              |  测试覆盖 | 说明                    |
| :------------ | :--: | :---------------------------------------------------------------- | :---: | :-------------------- |
| Terminal 深色主题 | 100% | [theme.ts#L10-13](file:///f:/clishot/src/render/theme.ts#L10-L13) | ✅ e2e | 背景 #0c0c0c，前景 #f2f2f2 |
| Paper 浅色主题    | 100% | [theme.ts#L14-17](file:///f:/clishot/src/render/theme.ts#L14-L17) | ✅ e2e | 背景 #ffffff，前景 #111111 |
| 字体大小自定义       | 100% | [cli.ts#L68](file:///f:/clishot/src/cli.ts#L68)                   | ✅ e2e | `--font-size` 参数      |
| 行高自定义         | 100% | [cli.ts#L69](file:///f:/clishot/src/cli.ts#L69)                   | ✅ e2e | `--line-height` 参数    |
| 边距自定义         | 100% | [cli.ts#L70](file:///f:/clishot/src/cli.ts#L70)                   | ✅ e2e | `--margin` 参数         |
| 自定义前景/背景色     |  0%  | —                                                                 |   ❌   | 路线图中有计划               |

### 2.3 字体与排版能力

| 功能                  |  完成度 | 代码位置                                                                        | 测试覆盖 | 说明                             |
| :------------------ | :--: | :-------------------------------------------------------------------------- | :--: | :----------------------------- |
| JetBrains Mono 内嵌字体 | 100% | [typography.ts#L60-80](file:///f:/clishot/src/render/typography.ts#L60-L80) |   ❌  | @fontsource/jetbrains-mono     |
| Windows 等宽字体回退      | 100% | [typography.ts#L22-30](file:///f:/clishot/src/render/typography.ts#L22-L30) |   ❌  | Cascadia Mono/Consolas/Menlo 等 |
| Windows 中文字体回退      | 100% | [typography.ts#L32-38](file:///f:/clishot/src/render/typography.ts#L32-L38) |   ❌  | 微软雅黑/ DengXian / SimSun 等      |
| macOS 中文字体回退        | 100% | [typography.ts#L39-44](file:///f:/clishot/src/render/typography.ts#L39-L44) |   ❌  | 苹方/ Hiragino Sans GB 等         |
| Linux 中文字体回退        | 100% | [typography.ts#L45-50](file:///f:/clishot/src/render/typography.ts#L45-L50) |   ❌  | Noto Sans CJK / WenQuanYi 等    |
| 自定义字体指定             |  0%  | —                                                                           |   ❌  | 路线图中有计划                        |

### 2.4 输入与输出能力

| 功能                  |  完成度 | 代码位置                                                                   |  测试覆盖 | 说明                      |
| :------------------ | :--: | :--------------------------------------------------------------------- | :---: | :---------------------- |
| 文件输入（`--in <file>`） | 100% | [cli.ts#L88-93](file:///f:/clishot/src/cli.ts#L88-L93)                 | ✅ e2e | <br />                  |
| stdin 管道输入          | 100% | [cli.ts#L21-28](file:///f:/clishot/src/cli.ts#L21-L28)                 | ✅ e2e | <br />                  |
| 编码自动检测              | 100% | [encoding.ts#L47-90](file:///f:/clishot/src/input/encoding.ts#L47-L90) | ✅ e2e | UTF-8/UTF-16LE/UTF-16BE |
| 显式编码指定              | 100% | [encoding.ts#L15-45](file:///f:/clishot/src/input/encoding.ts#L15-L45) | ✅ e2e | `--encoding` 参数         |
| GB18030 显式支持        | 100% | [encoding.ts](file:///f:/clishot/src/input/encoding.ts)                |   ❌   | 需显式指定，不自动检测             |
| 多页输出命名              | 100% | [output.ts#L35-48](file:///f:/clishot/src/render/output.ts#L35-L48)    | ✅ e2e | `name-001.png` 递增格式     |
| 输出目录验证              | 100% | [output.ts#L7-30](file:///f:/clishot/src/render/output.ts#L7-L30)      | ✅ e2e | 目录存在性和可写性检查             |
| 列数控制                | 100% | [cli.ts#L67](file:///f:/clishot/src/cli.ts#L67)                        | ✅ e2e | `--cols` 参数             |
| 行数/页数控制             | 100% | [cli.ts#L67](file:///f:/clishot/src/cli.ts#L67)                        | ✅ e2e | `--rows` 参数             |

### 2.5 测试覆盖

| 测试类型      | 覆盖文件                                                                             | 说明                   |
| :-------- | :------------------------------------------------------------------------------- | :------------------- |
| 单元测试：文本处理 | [text.test.ts](file:///f:/clishot/src/__tests__/text.test.ts)                    | 换行、CR处理、Tab展开、控制字符剥离 |
| 单元测试：布局分页 | [layout.test.ts](file:///f:/clishot/src/__tests__/layout.test.ts)                | 列换行、页分页              |
| E2E 测试    | [cli.e2e.test.ts](file:///f:/clishot/src/__tests__/cli.e2e.test.ts)              | CLI 完整路径测试，含中文编码场景   |
| 人工验收基线    | [test-artifacts-baseline.md](file:///f:/clishot/docs/test-artifacts-baseline.md) | 6个场景的截图基线记录          |

***

## 三、CLI 待完成功能与优先级

> 结合项目定位（CLI 优先，Skill 第二阶段），按高/中/低三档排列。

### 3.1 高优先级（CLI 核心能力补全，影响基础体验）

#### P0-1：ANSI 颜色与 SGR 样式支持

**现状：** [text.ts#L57-68](file:///f:/clishot/src/render/text.ts#L57-L68) 的 `stripControlCharacters` 将所有 C0 控制字符剥离，包括 ANSI ESC 序列（`0x1b` 开头），导致 `git diff --color` 等彩色输出无法保留颜色。

**实现思路：**

1. 修改文本处理管道，在 stripping 之前先解析 ANSI SGR（Select Graphic Rendition）序列
2. 建立 `StyledSegment` 数据结构：`{ text: string, bold: bool, underline: bool, foreground: string, background: string }`
3. 在 [raster.ts](file:///f:/clishot/src/render/raster.ts) 的 `renderPageToCanvas` 中，根据每段的样式设置 Canvas fillStyle 和 font 样式
4. 支持常见的 16 色（ANSI 16）和 256 色模式

**验收标准：** `git diff --color | clishot --out diff.png` 输出图片中新增的绿色行和删除的红色行可辨别。

***

#### P0-2：配置文件系统（.clishotrc）

**现状：** 所有参数通过 CLI 显式传递，长命令难以记忆。

**实现思路：**

1. 支持 `clishot.config.json` 或 `.clishotrc.json` 放在项目根目录或用户 home 目录
2. 支持 YAML 格式 `clishot.config.yaml`
3. CLI 参数覆盖配置文件（CLI 优先级高于配置文件）
4. 预置主题命名：`--theme powershell` 直接引用预定义 PowerShell 7 风格配置

**验收标准：** 用户可以只写 `clishot --in a.txt --out b.png` 而无需指定 cols/rows/font-size，配置文件提供合理的默认值。

***

#### P0-3：Windows PowerShell 7 风格细化

**现状：** README 称"仅适配 Windows PowerShell 终端风格"，但 [theme.ts](file:///f:/clishot/src/render/theme.ts) 只有 generic terminal/paper 两种，没有 PowerShell 特定的蓝色背景风格。

**实现思路：**

1. 新增 `powershell` 主题：背景 `#012456`（PowerShell 7 默认蓝），前景 `#f2f2f2`
2. 新增 `powershell5` 主题：背景 `#0c0c0c`（PowerShell 5 黑色风格）
3. 可在配置文件中预设不同 PowerShell 版本的主题

**验收标准：** `--theme powershell` 生成的图片背景为蓝色，与 PowerShell 7 终端外观一致。

***

### 3.2 中优先级（平台扩展与功能增强）

#### P1-1：多平台终端风格支持

| 终端风格                 |    背景色    |   前景色   | 字体建议               | 优先级 |
| :------------------- | :-------: | :-----: | :----------------- | :-: |
| macOS Terminal.app   |  #1e1e1e  | #d4d4d4 | Menlo              |  P1 |
| macOS iTerm2         | #283amode | #909090 | MesloLGM Nerd Font |  P1 |
| Windows CMD          |  #0c0c0c  | #f2f2f2 | Cascadia Mono      |  P1 |
| Windows PowerShell 5 |  #0c0c0c  | #f2f2f2 | Consolas           |  P1 |
| Windows PowerShell 7 |  #012456  | #f2f2f2 | Cascadia Mono      |  P1 |
| Linux GNOME Terminal |  #2e3436  | #d4d4d4 | Source Han Mono    |  P1 |
| Linux Konsole        |  #1e1e1e  | #d4d4d4 | JetBrains Mono     |  P2 |
| Linux Alacritty      |  #1e1e1e  | #cccccc | JetBrains Mono     |  P2 |

**实现思路：** 在 [theme.ts](file:///f:/clishot/src/render/theme.ts) 的 `THEMES` 字典中增加上述主题定义，每个主题包含背景色、前景色、字体栈。

***

#### P1-2：粗体、斜体、下划线文本样式

**现状：** 即使保留 ANSI 样式序列，Canvas 渲染层也只使用单一 fillStyle 绘制文字。

**实现思路：**

1. 扩展 [raster.ts](file:///f:/clishot/src/render/raster.ts) 的 `renderPageToCanvas`，支持 font style 变化：`bold ${fontSize}px ${family}`、`italic ${fontSize}px ${family}`
2. 下划线用 `ctx.fillRect` 在文字底部绘制
3. 与 ANSI SGR 支持协同开发（优先级 P0-1）

***

#### P1-3：背景样式增强

| 效果          | 说明                                   | 优先级 |
| :---------- | :----------------------------------- | :-: |
| 圆角边框        | `--border-radius <px>` 给图片加圆角        |  P1 |
| 外阴影         | `--shadow <x> <y> <blur> <color>`    |  P1 |
| 内边距（独立于外边距） | `--padding <number>` 控制文字与背景边缘的距离    |  P1 |
| 渐变背景        | `--bg-gradient <from> <to>` 背景从上到下渐变 |  P2 |
| 透明背景        | `--bg transparent` 输出 PNG 支持透明通道     |  P2 |

***

#### P1-4：批量处理能力

**现状：** 每次只能处理一个输入文件。

**实现思路：**

1. 支持 `--in file1.txt file2.txt` 多文件输入
2. 支持 `--in *.txt` glob 模式
3. 支持 `--in-dir <directory>` 处理目录下所有文本文件
4. 所有输出按输入文件名对应生成

**验收标准：** `clishot --in-dir ./outputs --out ./screenshots` 将 `./outputs/` 下所有 .txt 文件渲染为图片。

***

#### P1-5：输出文件名模板

**现状：** 多页输出固定为 `name-001.png` 格式，无法自定义。

**实现思路：**

1. 支持 `--out-template "{name}-{page}"` 等命名模板
2. 模板变量：`{name}`（原始文件名）、`{page}`（页码）、`{date}`（日期）、`{time}`（时间）

***

#### P1-6：更多字符编码支持

| 编码                 | 自动检测 | 显式指定 | 说明            |
| :----------------- | :--: | :--: | :------------ |
| GB18030            |   ❌  |   ✅  | 中文 Windows 常用 |
| Big5               |   ❌  |   ✅  | 繁体中文          |
| EUC-KR             |   ❌  |   ✅  | 韩文            |
| EUC-JP / Shift-JIS |   ❌  |   ✅  | 日文            |
| ISO-8859-1         |   ❌  |   ✅  | 西文            |

***

### 3.3 低优先级（高级功能与生态扩展）

#### P2-1：输出格式扩展

| 格式       | 说明                       | 备注                    |
| :------- | :----------------------- | :-------------------- |
| WebP     | 比 PNG 更小，支持透明            | 需要 @napi-rs/canvas 支持 |
| GIF      | 支持动画终端输出（如 `top` 命令持续输出） | 需要帧序列合并               |
| SVG 矢量输出 | 纯文本模式，无字体依赖              | 需要 SVG 渲染后端           |

***

#### P2-2：复制到剪贴板

**实现思路：**

1. 添加 `--clipboard` 参数，生成图片后写入系统剪贴板
2. 使用 `napi-rs` 的剪贴板 API 或 `electron` 的 clipboard 模块（需评估体积）

***

#### P2-3：预览模式

**实现思路：**

1. 添加 `--preview` 参数，生成图片后调用系统默认图片查看器打开
2. Unix: `xdg-open` / macOS: `open` / Windows: `start`

***

#### P2-4：国际化（i18n）

**现状：** 所有错误信息、帮助文档为中文硬编码。

**实现思路：**

1. 将错误信息和 CLI 帮助文本抽取到 `locales/` 目录下的 JSON 文件
2. 支持 `--lang en` 参数切换语言
3. 初始支持：中文（默认）、英文

***

#### P2-5：详细日志与 dry-run 模式

**实现思路：**

1. `--verbose` 参数输出详细处理过程（解析了哪些 ANSI 序列、换行了多少处等）
2. `--dry-run` 参数只输出处理分析，不生成图片，便于调试

***

#### P2-6：集成文档工具

| 工具         | 集成方式        | 说明            |
| :--------- | :---------- | :------------ |
| Docusaurus | 插件 / CLI 包装 | 自动生成 API 文档截图 |
| VitePress  | 插件          | 生成组件示例截图      |
| GitBook    | CLI 集成      | 生成章节命令截图      |
| MkDocs     | 插件          | 生成文档截图        |

***

#### P2-7：VS Code 插件

**实现思路：**

1. 发布 VS Code 插件，一键将选中终端输出渲染为图片
2. 右键菜单集成：`将选定内容导出为图片`

***

### 3.4 优先级汇总表

|   优先级  | 功能              | 影响维度      |
| :----: | :-------------- | :-------- |
| **P0** | ANSI 颜色支持       | 渲染能力      |
| **P0** | 配置文件系统          | usability |
| **P0** | 页码标注与水印         | 实验报告场景    |
| **P0** | PowerShell 风格细化 | 当前主要用户场景  |
| **P1** | 多平台终端风格（6种）     | 跨平台覆盖     |
| **P1** | 粗体/斜体/下划线       | 样式完整性     |
| **P1** | 背景样式增强（圆角/阴影）   | 视觉效果      |
| **P1** | 批量处理            | 效率提升      |
| **P1** | 输出文件名模板         | usability |
| **P1** | 更多编码支持          | 国际化       |
| **P2** | WebP/GIF/SVG 输出 | 格式扩展      |
| **P2** | 剪贴板集成           | usability |
| **P2** | 预览模式            | usability |
| **P2** | 国际化             | 国际化       |
| **P2** | 详细日志/dry-run    | 调试能力      |
| **P2** | 文档工具集成          | 生态        |
| **P2** | VS Code 插件      | 生态        |

***

## 四、Skill 层规划（第二阶段）

> 本节为占位章节，待 CLI 工具基本完善后展开。

### 4.1 Skill 层定位

Skill 层是 CLI 工具与 AI Agent 之间的"胶水层"，负责：

- 将自然语言指令（如"把 git log 最近10条记录生成截图"）转换为精确的 CLI 参数
- 自动协商字体大小、列数等参数以适配输出内容
- 处理多图结果，汇总返回给 Agent
- 异常处理与回退（如编码问题、文件不存在）

### 4.2 Skill 层待研究问题

- Skill 指令标识设计（`invoke_command:/brainstorming` ？）
- 参数协商策略（如何决定 cols/rows/font-size）
- 多页输出的结果聚合返回格式
- 与飞书、Notion 等文档工具的集成方式

### 4.3 Skill 与 CLI 的依赖关系

```
Skill 依赖 CLI 具备的能力：
├── ANSI 颜色保留（P0-1）→ Skill 可输出带颜色的截图
├── 多平台终端风格（P1-1）→ Skill 可指定目标终端类型
├── 页码标注（P0-3）→ 多图返回时自动标注序号
├── 批量处理（P1-4）→ Skill 可一次处理多个命令输出
└── 配置文件系统（P0-2）→ Skill 可注入预设主题配置
```

***

## 五、技术债务与改进建议

### 5.1 测试覆盖改进

| 问题                      | 建议                                  |
| :---------------------- | :---------------------------------- |
| 字体回退链未测试                | 增加字体存在性检查的单元测试                      |
| 中文字体未实际验证               | 在 Windows/macOS/Linux 各平台跑 e2e 截图验证 |
| 编码检测边界条件未覆盖             | 增加 GB18030/Big5 的 mock 数据测试         |
| 缺少 visual regression 测试 | 引入 reg-cli 或 pixelmatch 进行截图diff测试  |

### 5.2 代码质量

| 问题                | 建议                                                     |
| :---------------- | :----------------------------------------------------- |
| `ThemeName` 类型硬编码 | 改为动态加载，支持插件式主题注册                                       |
| 渲染管道缺乏中间状态暴露      | 增加 `--debug` 模式输出每步中间结果（stripped text、wrapped lines 等） |
| Canvas 尺寸计算分散在两处  | 抽取为独立 `calculateCanvasDimensions()` 函数并加强测试            |

### 5.3 性能优化

| 场景               | 建议                           |
| :--------------- | :--------------------------- |
| 超大文件（如 10MB+ 文本） | 增加 streaming 渲染，避免一次性加载到内存   |
| 批量处理时并发渲染        | 使用 Promise.all 并行处理多文件（注意内存） |
| 重复渲染相同内容         | 可选增加 `--cache` 参数，缓存渲染结果     |

***

## 六、附录

### 6.1 核心文件速查

| 文件                                                                                | 职责                         |
| :-------------------------------------------------------------------------------- | :------------------------- |
| [src/cli.ts](file:///f:/clishot/src/cli.ts)                                       | CLI 入口，参数解析，stdin/文件输入     |
| [src/render/render.ts](file:///f:/clishot/src/render/render.ts)                   | 渲染主流程编排                    |
| [src/render/raster.ts](file:///f:/clishot/src/render/raster.ts)                   | Canvas 绑定、绘制、编码            |
| [src/render/theme.ts](file:///f:/clishot/src/render/theme.ts)                     | 主题定义（terminal/paper）       |
| [src/render/text.ts](file:///f:/clishot/src/render/text.ts)                       | 文本清理（换行、CR、Tab、控制字符）       |
| [src/render/layout.ts](file:///f:/clishot/src/render/layout.ts)                   | 列换行、页分页                    |
| [src/render/typography.ts](file:///f:/clishot/src/render/typography.ts)           | 字体加载与回退链                   |
| [src/render/output.ts](file:///f:/clishot/src/render/output.ts)                   | 输出路径解析、目录验证                |
| [src/input/encoding.ts](file:///f:/clishot/src/input/encoding.ts)                 | 编码检测与解码                    |
| [src/__tests__/cli.e2e.test.ts](file:///f:/clishot/src/__tests__/cli.e2e.test.ts) | E2E 测试，覆盖 stdin/文件/多页/中文场景 |

### 6.2 package.json 关键依赖

| 依赖                         | 版本      | 用途          |
| :------------------------- | :------ | :---------- |
| @napi-rs/canvas            | ^0.1.76 | Canvas 渲染后端 |
| @fontsource/jetbrains-mono | ^5.2.6  | 内嵌等宽字体      |
| commander                  | ^13.1.0 | CLI 参数解析    |

### 6.3 构建与测试命令

```bash
# 构建
npm run build

# 测试
npm run test

# 类型检查
npm run typecheck

# 本地运行
node dist/cli.js render --in <file> --out <output.png>
```

***

*本报告由 AI 根据仓库源码分析生成，如有遗漏或偏差欢迎补充指正。*
