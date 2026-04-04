---
name: st-card-toolkit
description: 完全前端卡的通用 JS 工具包 API 参考。当用户编写前端卡涉及 AI 调用、配置管理、对话历史、响应解析、DOM 工具、设置面板时使用。
---

# st-card-toolkit Skill

完全前端卡的通用 JS 工具包。封装了 AI 调用、配置管理、对话历史、响应解析、DOM 工具、设置面板。

写卡时**优先使用 toolkit 抽象**，不需要直接操作 TavernHelper API。只有 toolkit 不覆盖的场景（流式 token 事件监听、世界书操作、自定义 ordered_prompts 编排）才需要查阅底层 API skill（`fullfront-api`、`fullfront-prompt`）。

## 触发条件

用户在编写完全前端卡的 JS 逻辑时，涉及 AI 调用、配置、响应解析、消息显示等。

## 安装

卡项目中通过本地依赖引用：

```json
{
  "dependencies": {
    "st-card-toolkit": "file:../../packages/st-card-toolkit"
  }
}
```

Vite 构建时自动 bundle 进产物。

## API 一览

```js
import {
  callAI,                    // AI 调用（双源 + 历史 + schema/tools）
  createConfig,              // API 配置管理
  createHistory,             // 对话历史管理
  parseJson,                 // JSON 提取
  parseNarrativeAndData,     // narrative + 结构化数据拆分
  escHtml,                   // HTML 转义
  formatText,                // 纯文本 → 安全 HTML
  addMessage,                // 追加消息气泡
  showLoading,               // 显示加载指示器
  hideLoading,               // 隐藏加载指示器
  createSettingsController,  // 设置面板控制器
} from 'st-card-toolkit';
```

## createConfig(storageKey, overrides?)

创建 API 配置实例，自动从 localStorage 恢复。

```js
const config = createConfig('mycard_config', { temperature: 0.7 });

config.data.apiSource  // 'parent' | 'custom'
config.data.apiUrl     // 自定义端点 URL
config.data.apiKey     // API Key
config.data.apiModel   // 模型名
config.data.temperature // 温度

config.save();  // 持久化到 localStorage
config.load();  // 重新从 localStorage 读取
```

默认值：`apiSource: 'parent'`, `temperature: 0.9`，其余为空。`overrides` 覆盖默认值。

## createHistory()

创建对话历史管理器。

```js
const history = createHistory();

history.push('user', '你好');
history.push('assistant', '你好！');
history.toPrompts();  // [{role:'user',content:'你好'}, {role:'assistant',content:'你好！'}]
history.reset();      // 清空
history.pop();        // 移除最后一条（失败回滚）
history.length;       // 当前消息数
```

## callAI(prompt, opts)

双源 AI 调用，自动管理对话历史。

```js
const raw = await callAI('描写角色进入房间', {
  config,           // createConfig() 返回的实例
  history,          // createHistory() 返回的实例
  json_schema: MY_SCHEMA,  // 可选，结构化输出
  resetHistory: true,      // 可选，调用前清空历史
});
// raw 是 string（AI 回复文本）
```

### 参数

| 参数 | 类型 | 说明 |
|---|---|---|
| `prompt` | string | 用户提示文本 |
| `opts.config` | Config | createConfig() 实例 |
| `opts.history` | History | createHistory() 实例 |
| `opts.json_schema` | object? | JSON Schema 结构化输出 |
| `opts.tools` | object[]? | Function calling tools 定义 |
| `opts.tool_choice` | string? | Tool choice（默认 'auto'） |
| `opts.resetHistory` | boolean? | 调用前清空历史 |
| `opts.stream` | boolean? | 是否流式（仅 TavernHelper） |
| `opts.signal` | AbortSignal? | 中断信号（仅自定义端点） |

### 行为

- `config.data.apiSource === 'parent'`：通过 `TavernHelper.generateRaw()` 调用，用 `ordered_prompts` 传递完整对话历史
- `config.data.apiSource === 'custom'`：通过 `fetch` 调用 OpenAI 兼容端点
- 自动将 prompt 追加到 history（user），将回复追加到 history（assistant）
- 调用失败时自动 pop 未完成的 user 消息
- 返回值始终是 string

### json_schema 格式

```js
const MY_SCHEMA = {
  name: 'response_name',
  description: '描述',
  value: {
    type: 'object',
    properties: {
      narrative: { type: 'string', description: '叙事正文' },
      hp: { type: 'number' },
      // ...
    },
    required: ['narrative', 'hp'],
    additionalProperties: false,
  },
  strict: true,
};
```

TavernHelper 路径直接传 `json_schema`；自定义端点路径自动转换为 `response_format.json_schema` 格式。

## parseJson(raw)

从 AI 回复中提取 JSON。处理 ` ```json ``` ` 包裹。

```js
const { data, text } = parseJson(raw);
// data: 解析后的对象，解析失败为 null
// text: 原始/清理后的文本
```

## parseNarrativeAndData(raw, textField?)

从 JSON 回复中拆分主文本和结构化数据。适用于 `narrative + status` 的典型模式。

```js
const { text, data } = parseNarrativeAndData(raw, 'narrative');
// text: narrative 字段内容（或 fallback 到整个文本）
// data: 剩余字段组成的对象（或 null）
```

`textField` 默认 `'narrative'`，可改为其他字段名。

## DOM 工具

```js
// HTML 转义
escHtml('<script>alert(1)</script>')  // '&lt;script&gt;...'

// 纯文本 → HTML（换行转 <br>）
formatText('第一行\n第二行')  // '第一行<br>第二行'

// 追加消息（container 可以是 ID 字符串或 DOM 元素）
addMessage('narrativeArea', 'narrator', '角色走进了房间...');
addMessage('narrativeArea', 'user', '检查证件');
addMessage('narrativeArea', 'system', '<i class="fa-solid fa-info"></i> 系统消息');
// narrator → escHtml + <br>，user → escHtml，system → 原样 HTML

// 加载指示器
showLoading('narrativeArea', '生成中...');  // text 可选，loadingId 可选
hideLoading();  // 默认移除 id='loadingMsg' 的元素
```

### 消息类型 CSS 约定

toolkit 的 `addMessage` 生成以下结构，卡的 CSS 需要提供对应样式：

```css
.msg { margin-bottom: 16px; }
.msg-narrator .msg-narrator { /* 叙事气泡 */ }
.msg-user .msg-bubble { /* 用户气泡 */ }
.msg-system { /* 系统消息 */ }
.loading-indicator { /* 加载指示器 */ }
.loading-indicator .dots span { /* 动画点 */ }
```

## createSettingsController(config, ids?)

创建设置面板控制器，双向绑定 config 和 DOM 表单。

```js
const settings = createSettingsController(config);

// 绑定到 onclick
window.CK = {
  toggleSettings: settings.open,          // 打开/关闭面板 + 加载配置到表单
  onApiSourceChange: settings.onApiSourceChange,  // 切换 parent/custom
  saveSettings: settings.save,            // 从表单读取 → 保存到 config + localStorage
};
```

### 约定的 DOM ID

| ID | 元素 | 说明 |
|---|---|---|
| `settingsOverlay` | div | 设置面板遮罩层（toggle `.open`） |
| `setApiSource` | select | API 来源选择 |
| `customApiFields` | div | 自定义端点字段容器（显隐） |
| `setApiUrl` | input | API 端点 |
| `setApiKey` | input | API Key |
| `setApiModel` | input | 模型名 |
| `setTemp` | input | 温度 |

可通过第二个参数 `ids` 覆盖任意 ID：

```js
const settings = createSettingsController(config, {
  overlay: 'mySettingsPanel',
  apiSource: 'myApiSource',
});
```

## 典型卡集成模式

```js
// state.js
import { createConfig, createHistory } from 'st-card-toolkit';
export const config = createConfig('mycard_config');
export const history = createHistory();

// ai.js
import { callAI as _callAI, parseNarrativeAndData } from 'st-card-toolkit';
import { config, history } from './state.js';
import { MY_SCHEMA } from './schema.js';

export async function callAI(prompt, resetHistory) {
  return await _callAI(prompt, { config, history, json_schema: MY_SCHEMA, resetHistory });
}
export function parseResponse(raw) {
  const { text, data } = parseNarrativeAndData(raw);
  return { narrative: text, statusData: data };
}

// settings.js
import { createSettingsController } from 'st-card-toolkit';
import { config } from './state.js';
export const settings = createSettingsController(config);

// main.js — 只需 import 并暴露到 window
```

## toolkit 不覆盖的场景

以下情况需查阅底层 skill：

| 场景 | 需要的 skill |
|---|---|
| 流式 token 事件监听 (`js_stream_token_received_incrementally`) | `fullfront-api` |
| 世界书读写 (`getLorebookEntries` / `setLorebookEntries`) | `fullfront-api` |
| 自定义 `ordered_prompts` 编排（混用 ST 内置标识符） | `fullfront-prompt` |
| Function calling 协议细节（tool_result 多轮） | `fullfront-structured-output` |
| AI 指令解析（`y_insert` / `y_update` 等文本指令） | `fullfront-data-ops` |
| `generate()` 走 ST 预设路径 | `fullfront-prompt` |
