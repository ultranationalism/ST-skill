# 前端嵌入卡编写 Skill

编写在 SillyTavern 原生交互框架内嵌入前端 UI 的角色卡——保留 ST 的对话交互层，通过 MVU 变量系统、状态栏、酒馆助手脚本和 EJS 动态提示词增强体验。

## 触发条件

用户要求编写：嵌入卡、前端嵌入卡、变量卡、MVU 卡、状态栏卡、带界面的角色卡、交互增强卡。

## 架构原理

前端嵌入卡在 ST 原生对话流程中叠加前端层。核心组件：

```
description        → 角色核心设定
first_mes          → 正常对话开场白（纯文本 + 状态栏占位符）
character_book     → MVU 变量定义 + 更新规则 + 动态提示词 + 角色知识
regex_scripts      → 状态栏渲染（分离显示与发送）
extensions.tavern_helper → 酒馆助手脚本（事件监听、变量校验、按钮交互）
```

### 与完全前端卡的区别

| 维度 | 前端嵌入卡 | 完全前端卡 |
|---|---|---|
| 对话交互 | ST 原生（用户输入 → AI 回复） | 完全自定义 JS 流程 |
| 数据存储 | ST 变量系统（消息级/聊天级） | IndexedDB (Dexie) |
| 前端 UI | 状态栏 + 正则美化 + iframe 嵌入 | 完整 HTML 应用 |
| 复杂度 | 中等 | 高 |
| 适用场景 | 角色扮演 + 状态追踪 | 游戏化系统 |

## JSON 结构规范

```jsonc
{
  "name": "角色名",
  "description": "角色核心设定...",
  "personality": "性格关键词",
  "scenario": "场景描述",
  "first_mes": "开场白文本...\n<StatusPlaceHolderImpl/>",
  "mes_example": "<START>\n{{user}}: ...\n{{char}}: ...",
  "creator_notes": "需要安装酒馆助手扩展 (JS-Slash-Runner)。推荐模型: ...",
  "system_prompt": "",
  "post_history_instructions": "",
  "alternate_greetings": [],
  "tags": ["嵌入卡", "MVU"],
  "creator": "作者名",
  "character_version": "1.0.0",

  "character_book": {
    "name": "角色名_worldbook",
    "entries": [
      // MVU 变量初始化、变量列表、更新规则、输出格式
      // 动态提示词（EJS）
      // 角色知识库
    ]
  },

  "extensions": {
    "regex_scripts": [
      // 状态栏渲染正则
      // 思考过程隐藏正则
    ],
    "tavern_helper": {
      "scripts": [
        // 酒馆助手脚本
      ],
      "variables": {}
    }
  }
}
```

## MVU 变量系统

MVU（MagVariaRUpdate）是前端嵌入卡的核心，分三层：

### 第一层：变量结构定义（Zod Schema 脚本）

在酒馆助手的脚本中用 Zod 定义变量的合法结构：

```javascript
import { z } from 'zod';
import { registerMvuSchema } from 'tavern-helper';

export const Schema = z.object({
  // 角色状态
  affection: z.coerce.number().min(0).max(100).describe('好感度'),
  trust: z.coerce.number().min(0).max(100).describe('信任度'),
  mood: z.enum(['开心', '平静', '难过', '生气', '害羞']).describe('心情'),

  // 时间系统
  day: z.coerce.number().min(1).describe('天数'),
  time_period: z.enum(['早晨', '上午', '中午', '下午', '傍晚', '夜晚']).describe('时段'),

  // 库存
  inventory: z.record(
    z.string(),
    z.object({
      description: z.string(),
      quantity: z.coerce.number().min(0),
    })
  ).describe('物品栏'),

  // 标记
  flags: z.record(z.string(), z.boolean()).describe('剧情标记'),
});

$(() => { registerMvuSchema(Schema); });
```

**常用 Zod 类型：**
| 类型 | 用途 |
|---|---|
| `z.coerce.number().min(x).max(y)` | 数值范围（自动转换字符串） |
| `z.string()` | 文本 |
| `z.boolean()` | 布尔标记 |
| `z.enum([...])` | 固定选项 |
| `z.record(key, value)` | 动态键值对（库存、NPC 集合等） |
| `z.object({...})` | 嵌套对象 |
| `.describe('说明')` | 字段说明 |
| `.transform(fn)` | 值变换/钳制 |

### 第二层：变量初始化（[initvar] 条目）

世界书条目，disabled 状态，YAML 格式存储初始值：

**条目设置：**
- 名称: `[initvar]变量初始化勿开`
- enabled: `false`
- constant: `false`

**内容格式（YAML）：**
```yaml
affection: 30
trust: 20
mood: 平静
day: 1
time_period: 早晨
inventory: {}
flags: {}
```

也可以在开场白中用 `<initvar>` 标签为不同场景设置不同初始值：

```
开场白文本...

<initvar>
affection: 50
mood: 开心
</initvar>
```

### 第三层：变量与 AI 的通信

需要 3 个世界书条目：

#### [mvu_list] 变量列表

让 AI 看到当前变量值。

- constant: `true`
- 内容: `{{format_message_variable::stat_data}}`
- 这个宏会自动展开为当前变量的 YAML 格式

#### [mvu_update] 变量更新规则

告诉 AI 何时、如何修改变量。

- constant: `true`
- 内容示例:
```
<变量更新规则>
- affection: 正面互动 +1~5，负面互动 -1~5，每次变动不超过 5
- trust: 信守承诺 +3，欺骗 -10，需要长期积累
- mood: 根据对话内容和情境自然变化
- day/time_period: 场景转换或时间流逝时更新
- inventory: 获得/使用/丢弃物品时更新
- flags: 触发关键剧情节点时设置
</变量更新规则>
```

#### [mvu_update] 变量输出格式

告诉 AI 如何输出变量变更。

- constant: `true`
- 内容示例:
```
每次回复末尾，如有变量变动，使用以下格式输出：
<UpdateVariable>
<JSONPatch>["replace", "affection", 35]</JSONPatch>
<JSONPatch>["replace", "mood", "开心"]</JSONPatch>
</UpdateVariable>

注意：
- 只输出发生变化的字段
- 使用 replace 操作
- 路径用点号分隔嵌套：如 "inventory.铁剑.quantity"
- <StatusPlaceHolderImpl/> 标签必须保留在回复中
```

## 状态栏系统

状态栏是前端嵌入卡的可视化核心——在对话中显示变量状态，零 token 消耗。

### 实现方式

1. AI 在每次回复中输出占位符 `<StatusPlaceHolderImpl/>`
2. 正则脚本捕获占位符，分别处理显示和发送：
   - **显示侧**：替换为 HTML 状态栏界面
   - **发送侧**：移除占位符（不占 token）

### 正则脚本配置

**状态栏显示正则：**
```json
{
  "scriptName": "状态栏显示",
  "findRegex": "<StatusPlaceHolderImpl\\/>",
  "replaceString": "<div class='status-bar'>...HTML 状态栏...</div>",
  "placement": [1],
  "markdownOnly": true,
  "promptOnly": false
}
```

**状态栏发送正则（移除占位符）：**
```json
{
  "scriptName": "状态栏发送清除",
  "findRegex": "<StatusPlaceHolderImpl\\/>",
  "replaceString": "",
  "placement": [1],
  "markdownOnly": false,
  "promptOnly": true
}
```

### 状态栏 HTML 示例

在 replaceString 中使用 `{{format_message_variable::path}}` 宏显示实时变量值：

```html
<div style="background:#1a1a2e;border:1px solid #333;border-radius:8px;padding:12px;margin:8px 0;font-size:13px;color:#e0e0e0;">
  <div style="display:flex;gap:16px;flex-wrap:wrap;">
    <span>❤️ 好感: {{format_message_variable::affection}}/100</span>
    <span>🤝 信任: {{format_message_variable::trust}}/100</span>
    <span>😊 心情: {{format_message_variable::mood}}</span>
    <span>📅 第 {{format_message_variable::day}} 天 {{format_message_variable::time_period}}</span>
  </div>
</div>
```

## 动态提示词（EJS 模板）

在世界书条目的 content 中使用 EJS 语法，根据变量状态条件性发送提示词：

```html
<%_ if (Number(getvar('affection')) >= 70) { _%>
{{char}}对{{user}}已经产生了深厚的感情，会主动亲近，偶尔会脸红，
会找借口制造独处机会。
<%_ } else if (Number(getvar('affection')) >= 40) { _%>
{{char}}对{{user}}有好感但还在观察，态度友善但保持一定距离，
偶尔会不经意间表露关心。
<%_ } else { _%>
{{char}}对{{user}}保持礼貌但疏离的态度，不会主动接近。
<%_ } _%>
```

**EJS 中可用的函数：**
- `getvar('path')` — 获取变量值
- `setvar('path', value)` — 设置变量值
- `Number(getvar('path'))` — 获取数值型变量

## 酒馆助手脚本

脚本运行在 SillyTavern 内的 iframe 沙箱中，可以：

### 事件监听
```javascript
eventOn('VARIABLE_UPDATE_ENDED', async (data) => {
  // 变量更新后的钩子——校验、联动、触发效果
  const vars = await getVariables({ scope: 'message' });
  if (vars.affection >= 100) {
    // 触发特殊事件
    vars.flags['confession_unlocked'] = true;
    await replaceVariables(vars, { scope: 'message' });
  }
});
```

### 按钮交互
```javascript
// 在脚本中定义按钮
replaceScriptButtons([
  { name: '查看状态', visible: true },
  { name: '打开背包', visible: true },
]);

// 监听按钮点击
eventOn('BUTTON_CLICKED', async (buttonName) => {
  if (buttonName === '查看状态') {
    // 显示详细状态面板
  }
});
```

### 变量校验
```javascript
eventOn('COMMAND_PARSED', async (commands) => {
  // 在 AI 的变量更新指令执行前拦截和修正
  for (const cmd of commands) {
    if (cmd.path === 'affection' && cmd.value > 100) {
      cmd.value = 100; // 钳制范围
    }
  }
});
```

## 世界书条目设计

### 常驻条目

| 条目名 | 用途 |
|---|---|
| `[mvu_list]变量列表` | 向 AI 展示当前变量值 |
| `[mvu_update]变量更新规则` | 定义变量变更的触发条件和幅度 |
| `[mvu_update]变量输出格式` | 定义 AI 输出变更的标签格式 |
| `[系统]输出格式` | 控制 AI 的叙事风格和格式 |
| `[系统]角色行为准则` | 角色一致性规则 |

### 选择性条目（配合 EJS）

| 条目名 | 触发条件 | 用途 |
|---|---|---|
| `[阶段]好感度低` | EJS: affection < 30 | 低好感时的行为倾向 |
| `[阶段]好感度中` | EJS: 30 ≤ affection < 70 | 中好感时的行为倾向 |
| `[阶段]好感度高` | EJS: affection ≥ 70 | 高好感时的行为倾向 |
| `[场景]关键词触发` | 关键词匹配 | 场景相关信息 |

### 禁用条目

| 条目名 | 用途 |
|---|---|
| `[initvar]变量初始化勿开` | 存储变量初始值（YAML） |

## 工作流程

1. **需求确认**：角色设定、需要追踪的状态、交互功能
2. **设计变量结构**：用 Zod schema 定义所有变量
3. **编写变量初始化**：[initvar] 条目（YAML）
4. **编写 AI 通信条目**：变量列表、更新规则、输出格式
5. **编写角色设定和知识库**：description + 世界书条目
6. **设计状态栏**：正则脚本 + HTML 模板
7. **编写动态提示词**：EJS 条件模板
8. **（可选）编写酒馆助手脚本**：事件监听、按钮、校验
9. **保存并预览**：`bun run preview card.json`

## 输出要求

- 完整 JSON 文件，可直接导入 SillyTavern
- 需在 creator_notes 中注明依赖：酒馆助手扩展版本要求
- 所有 HTML 内联在正则的 replaceString 中
- EJS 模板直接写在世界书条目的 content 中
- UTF-8 编码
