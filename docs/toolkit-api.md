# st-card-toolkit API Reference

完全前端卡通用 JS 工具包。封装 AI 调用、配置、对话历史、响应解析、DOM 工具、设置面板。

安装：卡项目 `package.json` 中 `"st-card-toolkit": "file:../../packages/st-card-toolkit"`，Vite 构建时自动 bundle。

```js
import {
  callAI, createConfig, createHistory,
  parseJson, parseNarrativeAndData,
  escHtml, formatText, addMessage, showLoading, hideLoading,
  createSettingsController,
} from 'st-card-toolkit';
```

---

## createConfig(storageKey, overrides?)

```js
const config = createConfig('mycard_config', { temperature: 0.7 });

config.data.apiSource   // 'parent' | 'custom'
config.data.apiUrl      // 自定义端点 URL
config.data.apiKey      // API Key
config.data.apiModel    // 模型名
config.data.temperature // 温度

config.save();  // → localStorage
config.load();  // ← localStorage
```

默认值：`apiSource: 'parent'`, `temperature: 0.9`，其余为空。

---

## createHistory()

```js
const history = createHistory();

history.push('user', '你好');
history.push('assistant', '你好！');
history.toPrompts();  // [{role:'user',content:'你好'}, {role:'assistant',content:'你好！'}]
history.reset();
history.pop();        // 移除最后一条（失败回滚用）
history.length;
```

---

## callAI(prompt, opts)

| 参数 | 类型 | 说明 |
|---|---|---|
| `prompt` | string | 用户提示文本 |
| `opts.config` | Config | createConfig() 实例 |
| `opts.history` | History | createHistory() 实例 |
| `opts.mode` | string? | `'generateRaw'`（默认）或 `'generate'` |
| `opts.overrides` | object? | generate 模式下覆盖 ST 预设槽位 |
| `opts.json_schema` | object? | JSON Schema 结构化输出 |
| `opts.tools` | object[]? | Function calling tools |
| `opts.tool_choice` | string? | 默认 `'auto'` |
| `opts.resetHistory` | boolean? | 调用前清空历史 |
| `opts.stream` | boolean? | 流式（仅 TavernHelper） |
| `opts.signal` | AbortSignal? | 中断（仅自定义端点） |

### mode 选择

| `'generateRaw'`（默认） | `'generate'` |
|---|---|
| 完全自控上下文（`ordered_prompts`） | 走 ST 预设（Prompt Manager） |
| 用户预设/世界书/文风不生效 | 生效 |
| 可并行多个 | 同时只能一个 |
| 数据处理、摘要、逻辑判定 | 叙事、角色扮演、故事生成 |

generate 模式自动将 history 通过 `overrides.chat_history` 注入，最新 prompt 通过 `user_input` 传入。

### 行为

- `apiSource === 'parent'`：根据 mode 调用 `TavernHelper.generate()` 或 `generateRaw()`
- `apiSource === 'custom'`：fetch OpenAI 兼容端点（mode 不影响）
- 自动 push prompt(user) 和回复(assistant) 到 history
- 失败时自动 pop 未完成的 user 消息
- 返回值始终 string

### json_schema 格式

```js
{
  name: 'response_name',
  description: '描述',
  value: { type: 'object', properties: {...}, required: [...], additionalProperties: false },
  strict: true,
}
```

TavernHelper 直接传 `json_schema`；自定义端点自动转为 `response_format.json_schema`。

---

## parseJson(raw)

```js
const { data, text } = parseJson(raw);
// data: object | null（解析失败）
// text: 原始/清理后文本
```

处理 ` ```json ``` ` 包裹。

## parseNarrativeAndData(raw, textField?)

```js
const { text, data } = parseNarrativeAndData(raw, 'narrative');
// text: textField 字段内容（或 fallback 整个文本）
// data: 剩余字段对象（或 null）
```

默认 `textField = 'narrative'`。

---

## DOM 工具

| 函数 | 说明 |
|---|---|
| `escHtml(str)` | HTML 转义 |
| `formatText(str)` | 纯文本 → HTML（换行转 `<br>`） |
| `addMessage(container, type, content)` | 追加消息气泡 |
| `showLoading(container, text?)` | 显示加载指示器 |
| `hideLoading()` | 移除加载指示器 |

`addMessage` 的 type：`narrator`（escHtml+br）、`user`（escHtml）、`system`（原样 HTML）。

CSS 约定：`.msg`, `.msg-narrator`, `.msg-user`, `.msg-system`, `.loading-indicator`。

---

## createSettingsController(config, ids?)

```js
const settings = createSettingsController(config);
// settings.open()   — 打开/关闭面板 + 加载配置
// settings.save()   — 表单 → config → localStorage
// settings.onApiSourceChange() — 切换 parent/custom 显隐
```

### 约定 DOM ID

| ID | 元素 |
|---|---|
| `settingsOverlay` | 面板遮罩层 |
| `setApiSource` | API 来源 select |
| `customApiFields` | 自定义端点字段容器 |
| `setApiUrl` / `setApiKey` / `setApiModel` / `setTemp` | 表单控件 |

通过第二个参数 `ids` 覆盖：`createSettingsController(config, { overlay: 'myPanel' })`。

---

## 典型集成

```js
// state.js
export const config = createConfig('mycard_config');
export const history = createHistory();

// ai.js
import { callAI as _callAI, parseNarrativeAndData } from 'st-card-toolkit';
import { config, history } from './state.js';

export const callAI = (prompt, reset) =>
  _callAI(prompt, { config, history, json_schema: MY_SCHEMA, resetHistory: reset });
export const parseResponse = (raw) => {
  const { text, data } = parseNarrativeAndData(raw);
  return { narrative: text, statusData: data };
};
```
