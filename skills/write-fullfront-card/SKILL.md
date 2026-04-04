---
name: write-fullfront-card
description: 设计完全前端化的 SillyTavern 角色卡。当用户要求设计完全前端卡、全前端卡、前端游戏卡、自定义界面卡、HTML 卡时使用。
---

# 完全前端卡设计 Skill

设计完全前端化的 SillyTavern 角色卡——放弃 ST 原生对话交互，用自定义 HTML/CSS/JS 构建完整的游戏/交互界面。

## 触发条件

用户要求设计/编写：完全前端卡、全前端卡、前端游戏卡、自定义界面卡、HTML 卡、独立前端卡。

## 开发工具链

完全前端卡使用 Vite 项目化开发 + `st-card-toolkit` 共享工具包：

- **JS 逻辑**：模块化开发，AI 调用/配置/历史/解析/DOM/设置面板全部通过 `st-card-toolkit` 导入，卡只写 schema + prompt + 游戏逻辑
- **构建**：`npm run build` → Vite 内联所有资源 → `build.cjs` 提取片段 + 合并 lorebook → 输出 card.json
- **世界书**：lorebook MCP (`lorebook-editor`) 保证条目格式正确

API 调用细节见 `st-card-toolkit` skill。只有 toolkit 不覆盖的场景（流式事件、世界书操作、自定义 ordered_prompts 编排）才需要查阅 `fullfront-api` / `fullfront-prompt` skill。

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
| `replaceString` | 完整 HTML 应用代码 | **必须**包裹在 ` ```html ` 代码块中（见踩坑清单） |
| `placement` | `[2]` | 匹配用户输入 |
| `markdownOnly` | `true` | 仅在显示时替换，不影响发送给 AI 的内容 |
| `promptOnly` | `false` | 显示侧需要渲染 |

## 前端应用框架

### 渲染机制

完全前端卡依赖 SillyTavern 的**代码块渲染器**（需用户在 ST 设置中开启）。渲染器会将 ` ```html ` 代码块放进 iframe 执行，从而绕过 DOMPurify 的 `<script>` 剥离。

> **重要前置条件：** 用户必须在 ST 设置中开启「启用渲染器 - 启用后，符合条件的代码块将被渲染」。

### 项目结构（Vite 项目化）

```
cards/my-card/
├── package.json          # dependencies: st-card-toolkit
├── vite.config.js        # vite-plugin-singlefile
├── index.html            # Vite 入口 HTML（模板）
├── build.cjs             # 后处理：Vite 产物 → card.json
├── card.meta.json        # 卡元数据
├── src/
│   ├── main.js           # 入口 + window 暴露
│   ├── style.css         # CSS
│   ├── schema.js         # AI 输出 JSON Schema
│   ├── ai.js             # callAI 包装 + parseResponse
│   ├── prompt.js         # 提示词构建
│   ├── state.js          # createConfig + createHistory + 卡状态
│   ├── settings.js       # createSettingsController 包装
│   ├── ...               # 卡特有模块
│   └── first_mes.html    # 首条消息
├── lorebook/             # 世界书条目（V2 Spec JSON）
└── dist/card.json        # 构建产物
```

### 渲染格式要求

构建产物是 HTML 片段（不含 `<!DOCTYPE>`/`<html>`/`<head>` 外壳），用 `<body>` 标签包裹以通过 `isFrontend()` 检测。JS-Slash-Runner 的 `createSrcContent()` 会自动包一层完整 HTML 文档并注入 FontAwesome、jQuery、Vue 等。

**卡不需要自己引入 FontAwesome / jQuery / Vue**（框架已注入）。只需引入框架未提供的依赖（如 Dexie）。

### 资源约束

- **所有 CSS/JS 由 Vite 内联**到单文件
- **外部库只能用 CDN**（unpkg、cdnjs 等）
- **图片/图标使用 CDN 或 base64 内联**

### ST 渲染踩坑清单（必读）

以下是在 SillyTavern 中实际部署完全前端卡时的已知坑点：

#### 1. JS 中的反引号（模板字面量）不能出现在行首

**问题：** Markdown 的 ` ``` ` 围栏代码块只匹配**行首**的三连反引号来关闭代码块。如果 JS 代码中恰好有一行以 ` ``` ` 开头（极少见但可能），会提前关闭代码块，导致后续 HTML 显示为原始文本。

**规则：** JS 中可以正常使用模板字面量（反引号），但**确保没有任何一行以三个或更多连续反引号开头**。实际开发中几乎不会遇到此情况，但如果构建的字符串中包含 markdown 代码块标记，需要注意。

```javascript
// 完全没问题 - 行内反引号不影响代码块
const msg = `你好 ${name}，欢迎来到 ${place}`;
const html = `<div class="${cls}">${content}</div>`;

// 危险 - 行首三连反引号（极罕见，但要避免）
const markdown = `
` + '``' + `html
code here
` + '``' + `
`;
```

> 已验证：异界幻想v5.42 卡的 JS 中有 2600+ 反引号，因为没有行首三连反引号，` ```html ` 代码块完全正常工作。

#### 2. DOMPurify 会剥离直接注入的 HTML 中的 script 和事件属性

**问题：** 如果 replaceString 不使用 ` ```html ` 代码块包裹，而是直接输出 HTML 片段，SillyTavern 的 DOMPurify 净化器会：
- 剥离所有 `<script>` 标签
- 剥离所有 `onclick`、`onchange` 等事件处理器属性
- 剥离 `<iframe srcdoc>` 属性

**表现：** HTML/CSS 正常渲染（布局、样式、图标都在），但所有交互完全失效——点击按钮无任何反应，浏览器控制台也无报错（因为事件处理器根本不存在）。

**规则：** 完全前端卡**必须**使用 ` ```html ` 代码块包裹，依赖 ST 的代码块渲染器（在 iframe 中执行脚本，绕过 DOMPurify）。

**调试方法：** F12 → Elements 面板，搜索 `<script>` 或 `onclick`。如果搜不到，说明被净化器剥离了。

#### 3. first_mes 同理

**问题：** first_mes 中的 HTML 同样经过 DOMPurify。

**规则：** 如果 first_mes 需要 JS 交互，必须用 ` ```html ` 代码块包裹完整 HTML 文档。纯静态展示页（无 JS）可以直接用 HTML 片段：

```
// 静态展示（无 JS）—— 直接 HTML 片段即可：
<style>.intro { ... }</style>
<div class="intro">...</div>

// 需要 JS 交互 —— 必须代码块包裹：
` ` `html
<!DOCTYPE html>
<html>...<script>...</script>...</html>
` ` `
```

#### 4. first_mes 只放触发占位符，所有内容由 JS 渲染

**原则：** 完全前端卡的 first_mes 不应包含任何实际文字内容。它的唯一职责是**提供一个正则匹配的上下文**，让 regex_scripts 将其替换为前端应用。所有展示内容（封面、介绍文字、按钮等）都在 replaceString 的 HTML/JS 中实现。

**原因：** 正则脚本会扫描所有渲染的消息内容。如果 first_mes 中包含任何文字（包括说明文字中提到的触发词），可能被正则意外匹配，导致封面页同时渲染出游戏界面。

**推荐做法：** first_mes 直接填入触发关键词本身，让正则将其完整替换为封面页 HTML：

```jsonc
{
  "first_mes": "start_game",          // 触发词本身，会被正则替换为封面 HTML
  "alternate_greetings": ["start_game"], // 同一个触发词，替换为游戏主界面
  "regex_scripts": [{
    "findRegex": "start_game",
    "replaceString": "```html\n<!DOCTYPE html>...\n```"  // 前端应用
  }]
}
```

如果封面页和游戏主界面不同，可以用两个正则分别匹配不同的触发词：

```jsonc
{
  "first_mes": "show_intro",
  "alternate_greetings": ["start_game"],
  "regex_scripts": [
    { "findRegex": "show_intro", "replaceString": "```html\n...封面HTML...\n```" },
    { "findRegex": "start_game", "replaceString": "```html\n...游戏HTML...\n```" }
  ]
}
```

#### 5. 需要用户开启代码块渲染器

**前置条件：** 用户必须在 ST 设置中开启「启用渲染器」（启用后，符合条件的代码块将被渲染）。未开启时，` ```html ` 代码块只会显示为语法高亮的源码，不会执行。

建议在 `creator_notes` 中注明此要求。

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

## 结构化输出

推荐使用 `json_schema`（通过 `callAI()` 的 `json_schema` 参数传入），一轮完成叙事+结构化数据混合输出。用 `parseNarrativeAndData()` 拆分。

Function calling (`tools` 参数) 也支持，适合需要触发外部操作的场景。详见 `fullfront-structured-output` skill。

## 多通道 AI 架构设计

完全前端卡的核心优势：前端 JS 可以**同时发起多个独立 AI 调用**，每个通道用不同温度和提示词。

每个通道创建独立的 `createConfig()` + `createHistory()`：

```js
const logicConfig = createConfig('mycard_logic', { temperature: 0.1 });
const narrativeConfig = createConfig('mycard_narrative', { temperature: 0.9 });
const logicHistory = createHistory();
const narrativeHistory = createHistory();

// 并行调用
const [logicResult, narrativeResult] = await Promise.all([
  callAI(logicPrompt, { config: logicConfig, history: logicHistory, json_schema: LOGIC_SCHEMA }),
  callAI(narrativePrompt, { config: narrativeConfig, history: narrativeHistory }),
]);
```

### 通道分工设计

| 通道 | 温度 | 用途 |
|---|---|---|
| 主叙事 | 0.9 | 故事推进 |
| 逻辑处理 | 0.1 | 数据操作指令 |
| 摘要 | 0.5 | 记忆压缩 |

### 设置面板

用 `createSettingsController()` 为每个通道绑定独立设置面板。

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

**first_mes 只放触发占位符**，不放任何实际文字内容。封面/引导界面的所有展示内容（世界观介绍、角色创建表单、动画效果等）都在 replaceString 的 HTML/JS 中实现，由正则脚本将 first_mes 替换为封面页。

如果封面页和游戏主界面是同一个应用（由 JS 内部切换状态），只需一个正则和一个触发词。如果是独立的两个页面，用两个正则分别匹配（见踩坑清单第 4 条）。

## UI 设计原则

- **根容器高度**：建议使用固定像素值（如 `height: 800px`）。`100vh` 在部分 ST 环境下会导致 iframe 无限扩展（消息区域不断撑高，输入栏被推出视口）。如需全屏效果，考虑使用 Fullscreen API 按钮
- **自适应布局**：使用 flexbox/grid 适配宽度，高度在固定根容器内自适应
- **暗色主题优先**：与 ST 默认主题协调
- **CSS 作用域隔离**：所有选择器加应用前缀（如 `.myapp .btn`）
- **可拖动面板**：游戏面板应支持拖动定位
- **折叠/展开**：大型界面（如角色面板、地图）应支持折叠
- **所有资源内联或 CDN**：不能引用本地文件
- **加载状态**：AI 调用期间显示加载指示器
- **错误提示**：API 调用失败时给出友好提示

## 工作流程

1. **需求确认**：游戏类型、核心机制、需要的数据表结构
2. **创建卡项目**：基于 Vite 模板，`npm install st-card-toolkit`
3. **定义 Schema**：`src/schema.js` — AI 输出的 JSON Schema
4. **编写 Prompt**：`src/prompt.js` — 提示词构建逻辑
5. **编写游戏逻辑**：`src/actions.js` — 用 `callAI()` + `parseNarrativeAndData()` 驱动
6. **编写世界书**：通过 `lorebook-editor` MCP 创建条目（格式自动正确）
7. **开发 UI**：`index.html` + `src/style.css`，设置面板用 `createSettingsController()`
8. **构建**：`npm run build` → `dist/card.json`

## 输出要求

- `npm run build` 产出完整 card.json，可直接导入 SillyTavern
- **根容器使用固定像素高度**（如 `800px`），避免 `100vh` 导致 iframe 无限扩展
- CSS 选择器建议加应用前缀（iframe 模式下影响较小，但养成好习惯）
- 世界书条目的 content 使用 XML 标签组织结构
- 用户需在 ST 中开启「代码块渲染器」才能使用完全前端卡
