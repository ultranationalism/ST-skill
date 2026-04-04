---
name: fullfront-api
description: 完全前端卡底层 API 参考：TavernHelper、流式输出、世界书读写、中断控制。当 toolkit 不覆盖的场景需要直接操作底层 API 时使用。
---

# 完全前端卡 API 调用 Skill（底层）

TavernHelper API、直接 fetch OpenAI 兼容端点、流式输出、设置面板、中断控制、错误处理。

> **大多数场景不需要本 skill。** 写卡时优先使用 `st-card-toolkit` skill 中的 `callAI()` / `createConfig()` / `createSettingsController()` 等抽象 API。只有以下场景才需要本 skill：
> - 流式 token 事件监听（`js_stream_token_received_incrementally`）
> - 世界书读写（`getLorebookEntries` / `setLorebookEntries`）
> - 中断控制（`stopAllGeneration`）
> - 直接操作 TavernHelper 的高级功能

提示词编排详见 `fullfront-prompt` skill，结构化输出详见 `fullfront-structured-output` skill，指令解析与数据操作详见 `fullfront-data-ops` skill。

## 触发条件

用户在编写完全前端卡时涉及 toolkit 不覆盖的底层 API：流式事件、世界书操作、中断控制、generate() 预设路径。

## 双 API 源

完全前端卡的每个 AI 通道支持两种调用方式，由用户在设置面板中选择：

### 通道 A: TavernHelper（通过 ST 父窗口调用）

使用 SillyTavern 已配置的模型和 API，无需用户额外设置。

```javascript
// 静默调用（不进对话历史，不流式）
const result = await window.parent.TavernHelper.generateRaw({
  user_input: prompt,
  should_stream: false,
  max_chat_history: 0
});

// 流式调用（进入对话流，流式显示）
const result = await window.parent.TavernHelper.generate({
  user_input: prompt,
  should_stream: true,
  max_chat_history: 0
});
```

### 通道 B: 直接 fetch OpenAI 兼容端点

用户自行配置 API 端点、Key 和模型。支持任何 OpenAI 兼容 API（OpenAI、Claude via proxy、本地 LLM 等）。

```javascript
async function fetchOpenAICompatible(prompt, config) {
  const response = await fetch(config.apiUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.apiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: config.temperature
    }),
    signal: config.abortSignal
  });
  const data = await response.json();
  return data.choices[0].message.content;
}
```

### 统一调用入口

```javascript
async function callAI(prompt, config) {
  if (config.apiSource === 'parent') {
    return await window.parent.TavernHelper.generateRaw({
      user_input: prompt,
      should_stream: false,
      max_chat_history: 0
    });
  } else {
    return await fetchOpenAICompatible(prompt, config);
  }
}
```

## TavernHelper API 参考

通过 `window.parent.TavernHelper` 可调用的关键方法：

### 生成相关

| 方法 | 用途 |
|---|---|
| `generate(params)` | 主生成，使用 ST 预设，支持流式 |
| `generateRaw(params)` | 静默生成，不使用预设，自定义编排 |
| `stopAllGeneration()` | 中断所有生成 |
| `isGenerating` | 当前是否正在生成（属性） |
| `getGenerationState()` | 返回 `{status: 'stopped'|...}` |

generate / generateRaw 通用参数：

```javascript
{
  user_input: "提示文本",
  should_stream: true/false,
  max_chat_history: 0,          // 携带的历史消息数（0=不带历史）
  image: [base64String],        // 可选，多模态图片输入
  tools: [...],                 // 可选，function calling（详见 fullfront-structured-output skill）
  tool_choice: 'auto',          // 可选
  json_schema: {...},           // 可选，结构化 JSON 输出（详见 fullfront-structured-output skill）
}
```

generateRaw 额外参数：

```javascript
{
  ordered_prompts: [...],       // 自定义提示词编排（详见 fullfront-prompt skill）
}
```

### 世界书相关

| 方法 | 用途 |
|---|---|
| `getCurrentCharPrimaryLorebook()` | 获取当前角色主世界书名 |
| `getLorebookEntries(bookName)` | 读取世界书条目 |
| `setLorebookEntries(bookName, entries)` | 更新世界书条目 |
| `createLorebookEntries(bookName, entries)` | 新建世界书条目 |

### 使用注意

- `generate()` 会触发 ST 的对话流程，回复会显示在聊天界面中
- `generateRaw()` 完全静默，适合后台逻辑处理
- 调用前检查 `isGenerating`，避免并发冲突
- ST 同一时间只能有一个 `generate()` 在进行

## 流式输出实现

### 通过 ST 事件系统接收流式 token

```javascript
window.eventOn('js_stream_token_received_incrementally', (chunk) => {
  const container = document.getElementById('streaming-message');
  const pre = container?.querySelector('pre');
  if (pre) {
    pre.textContent += chunk;
    mainArea.scrollTop = mainArea.scrollHeight;
  }
});
```

### 直接 fetch 流式（SSE）

对于通道 B 的流式调用，使用 ReadableStream 处理 SSE：

```javascript
async function fetchStreamOpenAI(prompt, config, onToken) {
  const response = await fetch(config.apiUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.apiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: config.temperature,
      stream: true
    }),
    signal: config.abortSignal
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') break;

      try {
        const json = JSON.parse(data);
        const token = json.choices[0]?.delta?.content || '';
        fullText += token;
        onToken(token);
      } catch (e) { /* skip parse errors */ }
    }
  }

  return fullText;
}
```

## 设置面板实现

### 通道配置结构

```javascript
const channelConfig = {
  apiSource: 'parent',  // 'parent' | 'custom'
  apiUrl: '',
  apiKey: '',
  apiModel: '',
  temperature: 0.1
};

function saveChannelConfig(channelName, config) {
  const allConfigs = JSON.parse(localStorage.getItem('game_channels') || '{}');
  allConfigs[channelName] = config;
  localStorage.setItem('game_channels', JSON.stringify(allConfigs));
}

function loadChannelConfig(channelName, defaults) {
  const allConfigs = JSON.parse(localStorage.getItem('game_channels') || '{}');
  return { ...defaults, ...allConfigs[channelName] };
}
```

### 获取可用模型列表（自定义端点）

```javascript
async function fetchModels(baseUrl, apiKey) {
  const url = baseUrl.endsWith('/models') ? baseUrl : `${baseUrl}/models`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const data = await res.json();
  return data.data.map(m => m.id);
}
```

### 中断控制

```javascript
let currentAbortController = null;

function startGeneration() {
  currentAbortController = new AbortController();
}

function stopGeneration() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  window.parent.TavernHelper.stopAllGeneration();
}
```

## 错误处理

```javascript
async function callAIWithRetry(prompt, config, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await callAI(prompt, config);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      if (i === maxRetries) {
        showError(`AI 调用失败: ${e.message}`);
        throw e;
      }
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```
