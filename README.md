# clishot

把纯文本终端输出渲染成“伪终端截图”图片（PNG/JPG），用于实验报告等场景：不依赖真实截屏、不依赖终端窗口大小，支持自动换行与分页。

## 特性（V1 Render-only）

- 输入：stdin（管道/重定向）或 `--in <file>`
- 输出：PNG/JPG（默认 PNG）
- 排版：等宽字体、自动换行、按页分页输出多张图片
- 主题：`terminal` / `paper`
- 文本清洗：规范化换行、剔除不可见控制字符、对 `\r`（回车覆盖行）做确定性处理

不支持：ANSI 颜色/样式还原、真实窗口截图、复杂 TUI 动态刷新高保真复刻。

## 环境要求

- Node.js >= 18

## 安装与构建（本仓库）

```bash
npm install
npm run build
```

构建后可直接运行：

```bash
node dist/cli.js render --help
```

如果你希望全局直接使用 `clishot` 命令（本地开发）：

```bash
npm link
clishot render --help
```

## 用法

### 从 stdin 渲染（推荐）

PowerShell：

```powershell
"hello`nworld" | clishot render --out out.png
```

或重定向：

```powershell
python .\script.py *> out.log
clishot render --in .\out.log --out out.png
```

### 从文件渲染并分页

```bash
clishot render --in .\log.txt --out out.png --cols 100 --rows 40
```

### 输出 JPG + paper 主题

```bash
echo "hi" | clishot render --out out.jpg --format jpg --theme paper --jpg-quality 90
```

## 参数说明（render）

- `--in <file>`：从文件读取文本（不传则从 stdin 读取；stdin 是 TTY 时会报错）
- `--out <path>`：输出文件路径或前缀（必填）
- `--format <png|jpg>`：输出格式（默认 `png`）
- `--theme <terminal|paper>`：主题（默认 `terminal`）
- `--cols <number>`：最大列宽（字符数，默认 `100`）
- `--rows <number>`：每页最大行数（默认 `40`）
- `--font-size <number>`：字体大小 px（默认 `16`）
- `--line-height <number>`：行高倍数（默认 `1.35`）
- `--margin <number>`：边距 px（默认 `24`）
- `--tab-stop <number>`：tab 展开到的空格列宽（默认 `4`）
- `--jpg-quality <number>`：JPG 质量 1~100（默认 `90`）

## 多页输出命名规则

当渲染结果超过 `--rows` 需要分页时：

- `--out out.png` → `out-001.png`, `out-002.png`, ...
- `--out out.jpg` → `out-001.jpg`, `out-002.jpg`, ...

## 开发与测试

```bash
npm run typecheck
npm test
```

