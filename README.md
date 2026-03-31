# ST-skill

Claude Code skill + 预览工具，用于编写 SillyTavern 角色卡。

## Skills

### write-fullfront-card — 完全前端卡

放弃 ST 原生对话交互，用自定义 HTML/CSS/JS 构建完整的游戏/交互界面。

- 正则脚本注入完整 HTML 应用（可达 1MB+）
- IndexedDB (Dexie) 数据持久化
- 多通道 AI 调用架构：叙事与逻辑分离，独立温度/模型配置
- 双 API 源：TavernHelper 父窗口调用 + 直接 fetch OpenAI 兼容端点
- 流式输出、变量保护、指令自动修复
- 适用：游戏化系统（RPG、模拟经营等）

### write-embedded-card — 前端嵌入卡

在 ST 原生对话框架内嵌入前端 UI，保留对话交互层。

- MVU 变量系统（Zod schema + YAML 初始化 + JSONPatch 更新）
- 状态栏：正则占位符 → HTML 渲染，零 token 消耗
- 动态提示词（EJS 模板，根据变量值条件性发送）
- 酒馆助手脚本（事件监听、按钮交互、变量校验）
- 适用：角色扮演 + 状态追踪

## 预览工具

```bash
# 安装依赖
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
.claude/skills/
  write-fullfront-card.md    # 完全前端卡 skill
  write-embedded-card.md     # 前端嵌入卡 skill
src/
  cli.ts                     # CLI 预览工具
  template.html              # 数据视图模板
  parse-png.ts               # PNG 解析工具
example/
  demo.json                  # 示例卡
```

## 依赖

- [Bun](https://bun.sh) 运行时
- 角色卡使用时需要 [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- 嵌入卡需要 [JS-Slash-Runner](https://github.com/N0VI028/JS-Slash-Runner)（酒馆助手）扩展
