# Tasks
- [x] Task 1: 设计并落地 ANSI SGR 解析输出结构
  - [x] 定义 `StyledSegment` 及相关类型（行/页容器），明确默认样式与 reset 规则
  - [x] 实现 ANSI CSI `\x1b[ ... m` 的解析（仅 SGR 子集），并保证对非法序列鲁棒
  - [x] 保留既有 `\r` 覆盖行与 `\t` 展开语义，确保“可见文本”与样式一致

- [x] Task 2: 更新布局逻辑以支持样式化文本
  - [x] 将按列换行逻辑改为基于“可见字符”计数（SGR 不计入列宽）
  - [x] 处理 segment 在换行点被切分的情况，保证样式在下一行延续
  - [x] 保持分页行为与现有参数一致（rows/cols 仍作为最终可见网格约束）

- [x] Task 3: 扩展主题以支持 ANSI 16/256 色映射
  - [x] 为主题新增 ANSI 16 色调色板（前景/背景共享）
  - [x] 实现 ANSI 256 色到 RGB 的确定性映射（包含 0-15、16-231 色立方、232-255 灰阶）
  - [x] 定义“未设置颜色”时的回退策略（使用主题 foreground/background）

- [x] Task 4: 栅格渲染按 segment 输出样式
  - [x] `renderPageToCanvas` 支持渲染 styled lines/pages（逐 segment 绘制）
  - [x] 实现背景色填充矩形与前景色文本绘制
  - [x] 实现 bold（font 前缀）与 underline（线条绘制）的确定性策略

- [x] Task 5: 测试与验收样例补齐
  - [x] 新增单测：SGR 解析（reset/bold/underline/16 色/256 色/非法序列）
  - [x] 新增单测：布局对 ANSI 不敏感（列宽/换行/样式延续）
  - [x] 新增 E2E：构造含红/绿 SGR 的输入，断言输出 PNG 中对应区域像素颜色符合预期（避免仅做存在性断言）

# Task Dependencies
- Task 2 depends on Task 1
- Task 4 depends on Task 1, Task 2, Task 3
- Task 5 depends on Task 1, Task 2, Task 4
