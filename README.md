# clishot

> 将终端输出变成漂亮的截图 —— 为实验报告截图痛点而生，但不止于此

![license](https://img.shields.io/badge/license-MIT-blue)

## 为什么做？

写实验报告时，最烦的不是实验本身，而是**截图**。
如果你利用agent工具做实验报告，截图只能手动完成，又慢又烦。

- 终端窗口大小不统一，截出来的图高矮胖瘦各不同
- 换台电脑主题变了，截图风格前后不一致
- 长输出要截好几张，还要手动拼起来
- 中文显示乱码，或者字体发虚
- agent工具不可以一次性完成需要频繁手动操作

clishot 就是想解决这些问题：**一行命令，把任何终端输出变成风格统一、清晰美观的截图**。

当然，它不止于实验报告 —— 写技术博客、分享命令行技巧、做自动化文档，任何需要「终端截图」的场景都能用上。

## 效果预览

| Terminal 主题 | Paper 主题 |
|:---:|:---:|
| ![terminal-theme](./docs/images/terminal-theme.png) | ![paper-theme](./docs/images/paper-theme.png) |

*（截图占位，请替换为实际生成的示例图片）*

## 核心特性

- **🎨 多种主题**：terminal（深色终端）、paper（浅色纸张）
- **🌈 ANSI 支持**：完整还原颜色、粗体、下划线等样式
- **📄 自动分页**：长输出自动拆分为多张图片，告别手动拼接
- **🔤 中文优化**：自动识别编码（UTF-8/UTF-16LE/GB18030），多平台字体回退
- **⚡ 管道友好**：支持 `stdin` 输入，轻松集成到工作流
- **🖼️ 多格式输出**：PNG（默认）、JPG 可选

## 安装

> 目前处于开发阶段，需要从源码安装

### 1. 克隆仓库

```bash
git clone https://github.com/yhala2414/clishot.git
cd clishot
```

### 2. 安装依赖

```bash
npm install
```

### 3. 构建

```bash
npm run build
```

### 4. 本地运行（两种方式）

**方式 A：直接用 Node 运行（推荐开发时用）**

```bash
node dist/cli.js --in example.txt --out result.png
```

**方式 B：链接到全局（像普通 CLI 工具一样用）**

```bash
npm link

# 现在可以在任何地方使用
clishot --in example.txt --out result.png
```

> 如果想取消全局链接：`npm unlink -g clishot`

### 环境要求

- Node.js >= 18

## 快速开始

### 场景 1：实验报告截图（从文件）

```bash
# 把你的终端输出保存到文件
python experiment.py > output.txt

# 生成截图
clishot --in output.txt --out report.png
```

### 场景 2：命令行分享（管道输入）

```bash
# 直接把命令输出转成截图
git log --oneline -10 | clishot --out git-history.png

# 或者带颜色
git diff --color | clishot --out changes.png
```

### 场景 3：自动化文档（集成到脚本）

```bash
#!/bin/bash
# generate-docs.sh

# 自动生成命令帮助截图
my-cli --help | clishot --out docs/cli-help.png --theme paper

# 自动生成版本信息截图
my-cli --version | clishot --out docs/version.png
```

## 参数说明

```
clishot [options]

Options:
  --in <file>          从文件读取文本（不传则从 stdin 读取）
  --out <path>         输出文件路径或前缀（必填）
  --format <png|jpg>   输出格式，默认 png
  --theme <terminal|paper>  主题，默认 terminal
  --encoding <name>    输入编码，默认 auto（自动识别 UTF-8/UTF-16LE/GB18030）
  --cols <number>      最大列宽，默认 100
  --rows <number>      每页最大行数，默认 40
  --font-size <number> 字体大小 px，默认 16
  --line-height <number> 行高倍数，默认 1.35
  --margin <number>    边距 px，默认 24
  --jpg-quality <number> JPG 质量 1~100，默认 90
```

### 多页输出命名规则

当内容超过 `--rows` 时，会自动分页：

```bash
clishot --in long.txt --out output.png
# 生成：output-001.png, output-002.png, output-003.png...
```

## 中文使用指南

### 常见问题排查

| 现象 | 原因 | 解决 |
|:---|:---|:---|
| 中文显示为方块/空白 | 字体缺字 | 已内置多平台字体回退，一般无需处理 |
| 中文乱码（ä¸­æ��） | 输入文件编码错误 | 检查原始文件编码，或用 `--encoding` 指定 |
| PowerShell 输出乱码 | UTF-16LE 编码 | 加 `--encoding utf-16le` 或改用 UTF-8 输出 |

### PowerShell 使用建议

```powershell
# PowerShell 5（默认 UTF-16LE）
python script.py | Out-File output.txt -Encoding Unicode
clishot --in output.txt --encoding utf-16le --out result.png

# PowerShell 7（推荐用 UTF-8）
python script.py | Out-File output.txt -Encoding UTF8
clishot --in output.txt --out result.png
```

## 贡献指南

clishot 目前还是一个 MVP，欢迎各种形式的贡献！

### 🎨 新增终端主题

目前只有两种主题，欢迎添加：

- [ ] **macOS 风格** — 仿 Terminal.app 或 iTerm2 外观
- [ ] **Windows CMD** — 经典命令提示符风格
- [ ] **Windows PowerShell** — 蓝色背景 PowerShell 风格
- [ ] **Linux GNOME Terminal** — Ubuntu 默认终端风格
- [ ] **自定义主题** — 通过配置文件定义颜色、字体、边距

主题实现参考 `src/render/theme.ts`，主要定义：
- 背景色/前景色
- 字体栈
- 边距和间距

### 🤖 Agent / 自动化集成

clishot 的设计初衷之一就是**让 Agent 能自动生成截图**。欢迎探索：

- **MCP Skill 封装** — 让 AI Agent 直接调用生成截图
- **CLI 工具链插件** — 与文档生成工具（如 Docusaurus、VitePress）集成
- **CI/CD 集成** — 在自动化流程中生成文档截图

如果你实现了任何集成方案，欢迎分享！

### 🐛 其他贡献

- 修复中文渲染问题
- 添加更多编码支持
- 优化分页算法
- 补充测试用例

## 路线图

- [x] 基础渲染（terminal/paper 主题）
- [x] ANSI 颜色支持
- [x] 自动分页
- [x] 中文编码识别与渲染
- [ ] 更多终端主题（macOS、Windows CMD 等）
- [ ] 配置文件支持（自定义主题）
- [ ] MCP Skill 封装
- [ ] 网页版（浏览器内直接生成）

## License

MIT

---

**Made with ❤️ for anyone who hates taking terminal screenshots manually.**
