# 完全前端卡设计 Skill

设计完全前端化的 SillyTavern 角色卡——放弃 ST 原生对话交互，用自定义 HTML/CSS/JS 构建完整的游戏/交互界面。

## 触发条件

用户要求设计/编写：完全前端卡、全前端卡、前端游戏卡、自定义界面卡、HTML 卡、独立前端卡。

## 架构原理

完全前端卡利用 SillyTavern 的正则脚本机制，将用户输入的触发词替换为完整的 HTML 应用。核心结构：

```
first_mes          → 开场白/引导界面（HTML 页面）
alternate_greetings[0] → 触发关键词（如 "start_game"）
regex_scripts      → findRegex 匹配触发词 → replaceString 注入完整 HTML/JS 应用
character_book     → 世界规则、AI 行为指令、变量操作规范
description        → 可留空或简短说明（前端卡主要靠世界书驱动）
```

### 数据流

```
用户输入触发词 → 正则匹配 → 替换为 HTML 应用 → 应用内用 JS 调用 AI API
                                               → 应用内用 IndexedDB (Dexie) 存储状态
                                               → AI 回复中包含数据操作指令
                                               → 前端 JS 解析指令 → 更新数据库 → 刷新 UI
```

## JSON 结构规范

```jsonc
{
  "name": "卡名",
  "description": "",
  "personality": "",
  "scenario": "",
  "first_mes": "<完整 HTML 引导页面>",
  "mes_example": "",
  "creator_notes": "使用说明：推荐模型、触发方式等",
  "system_prompt": "",
  "post_history_instructions": "",
  "alternate_greetings": ["触发关键词"],
  "tags": ["前端卡", "游戏"],
  "creator": "作者名",
  "character_version": "1.0.0",

  "character_book": {
    "name": "卡名_worldbook",
    "entries": [
      // 世界规则、AI 行为指令、变量操作规范等
    ]
  },

  "extensions": {
    "regex_scripts": [
      {
        "scriptName": "卡名 (作者)",
        "findRegex": "触发关键词",
        "replaceString": "提示文字\n```html\n<!DOCTYPE html>...\n```",
        "trimStrings": [],
        "placement": [2],
        "disabled": false,
        "markdownOnly": true,
        "promptOnly": false,
        "runOnEdit": true,
        "substituteRegex": true,
        "minDepth": null,
        "maxDepth": null
      }
    ]
  }
}
```

### 正则脚本关键参数

| 参数 | 完全前端卡设置 | 说明 |
|---|---|---|
| `findRegex` | 触发关键词字符串 | 用户输入此词时触发界面注入 |
| `replaceString` | 完整 HTML 应用代码 | 包裹在 ` ```html ` 代码块中 |
| `placement` | `[2]` | 匹配用户输入 |
| `markdownOnly` | `true` | 仅在显示时替换，不影响发送给 AI 的内容 |
| `promptOnly` | `false` | 显示侧需要渲染 |

## 前端应用框架

### 基础 HTML 结构

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>应用名称</title>
  <!-- 外部依赖（CDN） -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <script src="https://unpkg.com/dexie/dist/dexie.js"></script>
  <style>
    /* 内联样式 —— 完全前端卡所有 CSS 必须内联 */
  </style>
</head>
<body>
  <!-- 应用 UI -->
  <script>
    // 应用逻辑
  </script>
</body>
</html>
```

### 资源约束

- **所有 CSS 必须内联**（不能引用本地文件）
- **外部库只能用 CDN**（unpkg、cdnjs 等）
- **图片/图标使用 CDN 或 base64 内联**

## 数据库 Schema 设计

完全前端卡使用 IndexedDB (Dexie.js) 存储游戏状态。

### Dexie 表定义

```javascript
const db = new Dexie('GameDB');
db.version(1).stores({
  // 表名: 索引字段（数字索引对应字段序号）
  characters: '0, 1, 2',    // ID, 名字, 种族
  items: '0, 1, 2',         // ID, 名字, 类型
  quests: '0, 1, 9',        // ID, 名字, 状态
  skills: '0, 1, 11',       // ID, 名字, 所属角色ID
  monsters: '0, 1',         // ID, 名字
});
```

### 实体 ID 命名规范

| 前缀 | 实体类型 |
|---|---|
| C | NPC |
| M | 敌怪 |
| I | 物品 |
| IT | 场景物品 |
| T | 任务 |
| P | 伙伴/宠物 |
| S | 技能 |
| B1 | 玩家角色（固定） |

### 设计原则

- 每个实体类型一张表
- 主键字段为 `0`（即 ID 字段）
- 所有数据以纯数字索引访问字段（0=ID, 1=名字, 2+=自定义字段）
- 设计表结构时需同步在世界书中告知 AI 字段含义

## AI 数据操作指令系统

前端 JS 解析 AI 回复中的结构化指令来操作数据库。

### 指令格式

```
y_insert({...data})     — 新增实体
y_update("ID", {...})   — 更新实体字段
y_delete("ID")          — 删除实体
y_add_json(id, col, key, delta)  — JSON 字段数值增减
```

### 设计要点

- 指令前缀（`y_`）可自定义，但需全卡统一
- AI 在世界书中学习指令格式和使用规则
- 前端 JS 用正则解析指令 → 执行数据库操作 → 刷新 UI
- 必须设计**变量保护**（禁止删除玩家角色、保护关键字段）
- 建议设计**指令自动修复**（修复 AI 生成的格式错误）

## 多通道 AI 架构设计

完全前端卡的核心优势：前端 JS 可以**同时发起多个独立 AI 调用**，每个通道用不同温度和提示词。

### 通道分工设计

| 通道 | 温度 | 用途 | 调用方式 |
|---|---|---|---|
| 主叙事 | 跟随预设 | 故事推进，流式显示 | 流式调用 |
| 逻辑处理 | 0.1 | 解析行为 → 生成数据操作指令 | 静默调用 |
| 润色 | 0.7 | 文本精修美化 | 静默调用 |
| 摘要 | 0.5 | 记忆压缩/上下文总结 | 静默调用 |
| 世界模拟 | 1.0 | 背景世界异步演化 | 静默调用 |
| 战斗/地牢 | 1.0 | 战斗系统独立生成 | 静默调用 |

### 叙事与逻辑分离

```
玩家行为输入
    │
    ├─→ 逻辑 AI (低温, 静默)
    │     ↓ 返回结构化指令
    │     ↓ 前端解析 → 执行 → 更新数据库 → 刷新 UI
    │
    └─→ 叙事 AI (流式, 显示在界面)
          ↓ 流式 token → 实时渲染
```

两个通道可以**并行执行**（Promise.all）或**串行执行**（逻辑先行，叙事基于更新后的状态）。

### 设置面板设计

为每个通道提供独立配置：
- API 源选择（ST 内置 / 自定义端点）
- 自定义端点 URL、API Key、模型
- 温度参数
- 配置存入 localStorage

> **实现细节参见 `fullfront-api` skill**——包含 TavernHelper API 参考、流式输出实现、fetch 调用代码等。

## 世界书条目设计

完全前端卡的世界书主要驱动 AI 行为，常见条目类型：

### 常驻条目（constant=true，始终发送）

| 条目名 | 用途 |
|---|---|
| `📌变量操作要求` | 定义 AI 可用的数据指令格式和规则 |
| `📌输出格式/文风指导` | 控制 AI 叙事风格 |
| `📌COT（思维链）` | 强制 AI 在回复前执行思考流程 |
| `📌认知隔离` | 防止 AI 使用元知识 |
| `📌合理性审查` | AI 自检回复的逻辑一致性 |
| `📌核心规则` | 游戏系统核心机制（属性、战斗、经济等） |

### 选择性条目（selective=true，关键词触发）

| 条目名 | 触发关键词示例 | 用途 |
|---|---|---|
| `🍊地区详情` | 地名关键词 | 触发对应地区的详细描述 |
| `🍊种族介绍` | 种族名 | 触发种族背景信息 |
| `🍊NPC详情` | NPC 名字 | 触发 NPC 深度设定 |

### 条目命名约定

| 前缀 | 含义 |
|---|---|
| `📌` | 常驻/核心条目 |
| `📌📌` | 最高优先级核心条目 |
| `🍊` | 选择性触发条目 |
| `【不用开】` | 备用/可选功能（默认 disabled） |
| `【分步用】` | 分步引导专用（与简化版互斥，默认 disabled） |

### 世界书条目内容组织

- 使用 XML 标签组织结构化内容
- 常驻条目中需包含完整的数据库字段说明（让 AI 知道每个字段的含义）
- 指令格式条目需给出完整的指令示例和使用限制

## 开场白（first_mes）设计

开场白本身是一个完整的 HTML 页面，通常作为引导/角色创建界面：

- 展示游戏介绍和世界观
- 提供角色创建表单（种族、职业、属性点分配等）
- 引导用户进入游戏
- 可以包含动画和交互效果
- 提交后通过 JS 初始化数据库并写入初始数据

## UI 设计原则

- **自适应布局**：使用 flexbox/grid，适配 SillyTavern 的消息区域宽度
- **暗色主题优先**：与 ST 默认主题协调
- **可拖动面板**：游戏面板应支持拖动定位
- **折叠/展开**：大型界面（如角色面板、地图）应支持折叠
- **所有资源内联或 CDN**：不能引用本地文件
- **加载状态**：AI 调用期间显示加载指示器
- **错误提示**：API 调用失败时给出友好提示

## 工作流程

1. **需求确认**：游戏类型、核心机制、需要的数据表结构
2. **设计数据库 schema**：定义 Dexie 表结构和字段
3. **设计多通道架构**：确定需要哪些 AI 通道、各自温度和用途
4. **编写世界书条目**：核心规则、AI 指令规范、选择性知识库
5. **开发前端应用**：HTML/CSS/JS 主界面（API 调用实现参见 `fullfront-api` skill）
6. **开发开场白页面**：引导/角色创建 HTML
7. **组装正则脚本**：设置触发词和 HTML 注入
8. **保存并预览**：`bun run preview card.json`

## 输出要求

- 完整 JSON 文件，可直接导入 SillyTavern
- HTML 应用代码嵌入 `replaceString` 中，用 ` ```html ` 包裹
- 所有 CSS 内联，所有外部资源使用 CDN
- UTF-8 编码
- 世界书条目的 content 使用 XML 标签组织结构
