# ST-skill

Claude Code plugin，用于编写 SillyTavern 角色卡。

## 安装

```bash
/plugin marketplace add github.com/ultranationalism/ST-skill
/plugin install st-skill
```

安装后可用 `/st-skill:write-fullfront-card` 等命令调用，或让 Claude 自动识别触发。

## Skills

### st-skill:write-fullfront-card — 完全前端卡设计

设计完全前端化的 SillyTavern 角色卡：卡结构、世界书、数据库 schema、UI 设计、多通道架构规划。

- 正则脚本注入完整 HTML 应用（可达 1MB+）
- IndexedDB (Dexie) 数据库 schema 设计
- 多通道 AI 架构设计：通道分工、叙事与逻辑分离
- AI 数据操作指令系统设计
- 世界书条目分类与命名约定
- 适用：游戏化系统（RPG、模拟经营等）

### st-skill:write-embedded-card — 前端嵌入卡

在 ST 原生对话框架内嵌入前端 UI，保留对话交互层。

- MVU 变量系统（Zod schema + YAML 初始化 + JSONPatch 更新）
- 状态栏：正则占位符 → HTML 渲染，零 token 消耗
- 动态提示词（EJS 模板，根据变量值条件性发送）
- 酒馆助手脚本（事件监听、按钮交互、变量校验）
- 适用：角色扮演 + 状态追踪

## 预览工具（可选）

预览工具需要 clone 仓库并安装依赖：

```bash
git clone https://github.com/ultranationalism/ST-skill.git
cd ST-skill
bun install

# 预览角色卡（支持 JSON 和 PNG）
bun run preview card.json
bun run preview card.png

# 指定端口和模式
bun run preview card.json --port 8080 --mode frontend

# 从 PNG 提取 JSON
bun run parse card.png
bun run parse card.png -o output.json
```

预览工具自动检测卡类型：
- 完全前端卡：默认打开前端视图，`/data` 查看数据视图
- 嵌入卡/基础卡：显示数据视图，世界书按常驻/选择性/禁用分组

## 项目结构

```
.claude-plugin/
  plugin.json                    # 插件清单
skills/
  write-fullfront-card/SKILL.md  # 完全前端卡设计 skill
  write-embedded-card/SKILL.md   # 前端嵌入卡 skill
  write-lorebook-entry/SKILL.md  # 世界书条目 skill（配合 lorebook MCP）
  st-card-debug/SKILL.md         # 卡调试 skill（配合 Chrome DevTools MCP）
docs/
  tavernhelper-api.md            # TavernHelper API 参考
  toolkit-api.md                 # st-card-toolkit API 参考
  prompt-orchestration.md        # 提示词编排参考
  structured-output.md           # 结构化输出参考
  data-ops.md                    # 数据操作参考
src/
  cli.ts                         # CLI 预览工具
  template.html                  # 数据视图模板
  parse-png.ts                   # PNG 解析工具
example/
  demo.json                      # 示例卡
```

## 依赖

- [Claude Code](https://claude.com/claude-code) — 安装和使用 skills
- [Bun](https://bun.sh) — 仅预览工具需要
- [SillyTavern](https://github.com/SillyTavern/SillyTavern) — 角色卡运行环境
- [JS-Slash-Runner](https://github.com/N0VI028/JS-Slash-Runner)（酒馆助手）— 仅嵌入卡需要
