# 完全前端卡 API 实现 Skill

实现完全前端卡内部的 AI 调用逻辑——TavernHelper API、直接 fetch OpenAI 兼容端点、流式输出、多通道并行调用、指令解析与变量保护。

## 触发条件

用户在编写完全前端卡时涉及：API 调用、TavernHelper、流式输出、多通道调用、指令解析、变量保护等实现层面的工作。

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
    signal: config.abortSignal // 支持中断
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
| `generate(params)` | 主生成，支持流式输出，进入 ST 对话流 |
| `generateRaw(params)` | 静默生成，不流式，不进对话历史 |
| `stopAllGeneration()` | 中断所有生成 |
| `isGenerating` | 当前是否正在生成（属性） |
| `getGenerationState()` | 返回 `{status: 'stopped'|...}` |

generate / generateRaw 参数：

```javascript
{
  user_input: "提示文本",        // 必填，发送给 AI 的内容
  should_stream: true/false,    // 是否流式（generate 支持，generateRaw 建议 false）
  max_chat_history: 0,          // 携带的历史消息数（0=不带历史）
  image: [base64String]         // 可选，多模态图片输入
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
// 监听流式 token（增量接收）
window.eventOn('js_stream_token_received_incrementally', (chunk) => {
  const container = document.getElementById('streaming-message');
  const pre = container?.querySelector('pre');
  if (pre) {
    pre.textContent += chunk;
    // 自动滚动到底部
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
      const data = line.slice(6); // 去掉 "data: "
      if (data === '[DONE]') break;

      try {
        const json = JSON.parse(data);
        const token = json.choices[0]?.delta?.content || '';
        fullText += token;
        onToken(token); // 回调：逐 token 渲染
      } catch (e) { /* skip parse errors */ }
    }
  }

  return fullText;
}
```

## 多通道并行调用

### 并行执行（叙事与逻辑同时发起）

```javascript
async function handlePlayerAction(action, gameState) {
  const logicPrompt = buildLogicPrompt(action, gameState);
  const narrativePrompt = buildNarrativePrompt(action, gameState);

  const [logicResult, narrativeResult] = await Promise.all([
    callAI(logicPrompt, channels.logic),      // 逻辑通道，低温静默
    callAI(narrativePrompt, channels.narrative) // 叙事通道，正常温度
  ]);

  // 先处理逻辑指令
  const commands = parseCommands(logicResult);
  const sanitized = sanitizeCommands(commands);
  await executeCommands(sanitized);

  // 再渲染叙事内容
  renderNarrative(narrativeResult);
}
```

### 串行执行（逻辑先行，叙事基于更新后状态）

```javascript
async function handlePlayerActionSerial(action, gameState) {
  // 第一步：逻辑 AI 处理
  const logicResult = await callAI(
    buildLogicPrompt(action, gameState),
    channels.logic
  );
  const commands = parseCommands(logicResult);
  await executeCommands(sanitizeCommands(commands));

  // 第二步：基于更新后的状态生成叙事
  const updatedState = await getFullGameState();
  const narrativeResult = await callAI(
    buildNarrativePrompt(action, updatedState),
    channels.narrative
  );
  renderNarrative(narrativeResult);
}
```

## 指令解析实现

解析 AI 回复中的数据操作指令：

```javascript
function parseCommands(aiResponse) {
  const commands = [];

  // 匹配 y_insert({...})
  const insertReg = /y_insert\((\{[\s\S]*?\})\)/g;
  let match;
  while ((match = insertReg.exec(aiResponse)) !== null) {
    try {
      commands.push({ type: 'insert', data: JSON.parse(match[1]) });
    } catch (e) {
      // 尝试自动修复格式
      const fixed = attemptAutoFix(match[1]);
      if (fixed) commands.push({ type: 'insert', data: fixed });
    }
  }

  // 匹配 y_update("ID", {...})
  const updateReg = /y_update\("([^"]+)",\s*(\{[\s\S]*?\})\)/g;
  while ((match = updateReg.exec(aiResponse)) !== null) {
    try {
      commands.push({ type: 'update', id: match[1], data: JSON.parse(match[2]) });
    } catch (e) {
      const fixed = attemptAutoFix(match[2]);
      if (fixed) commands.push({ type: 'update', id: match[1], data: fixed });
    }
  }

  // 匹配 y_delete("ID")
  const deleteReg = /y_delete\("([^"]+)"\)/g;
  while ((match = deleteReg.exec(aiResponse)) !== null) {
    commands.push({ type: 'delete', id: match[1] });
  }

  // 匹配 y_add_json(id, col, key, delta)
  const addJsonReg = /y_add_json\("([^"]+)",\s*"?(\d+)"?,\s*"([^"]+)",\s*(-?\d+(?:\.\d+)?)\)/g;
  while ((match = addJsonReg.exec(aiResponse)) !== null) {
    commands.push({
      type: 'add_json',
      id: match[1],
      col: parseInt(match[2]),
      key: match[3],
      delta: parseFloat(match[4])
    });
  }

  return commands;
}
```

### 指令执行

```javascript
async function executeCommands(commands) {
  for (const cmd of commands) {
    const table = getTableByPrefix(cmd.data?.['0'] || cmd.id);
    switch (cmd.type) {
      case 'insert':
        await db.table(table).put(cmd.data);
        break;
      case 'update':
        await db.table(table).update(cmd.id, cmd.data);
        break;
      case 'delete':
        await db.table(table).delete(cmd.id);
        break;
      case 'add_json': {
        const record = await db.table(table).get(cmd.id);
        if (record) {
          const jsonField = typeof record[cmd.col] === 'string'
            ? JSON.parse(record[cmd.col])
            : record[cmd.col];
          jsonField[cmd.key] = (jsonField[cmd.key] || 0) + cmd.delta;
          await db.table(table).update(cmd.id, {
            [cmd.col]: typeof record[cmd.col] === 'string'
              ? JSON.stringify(jsonField)
              : jsonField
          });
        }
        break;
      }
    }
  }
  refreshUI();
}

// 根据 ID 前缀判断所属表
function getTableByPrefix(id) {
  if (!id) return null;
  if (id.startsWith('B')) return 'characters';
  if (id.startsWith('C')) return 'characters';
  if (id.startsWith('M')) return 'monsters';
  if (id.startsWith('IT')) return 'items'; // IT 在 I 前面检查
  if (id.startsWith('I')) return 'items';
  if (id.startsWith('T')) return 'quests';
  if (id.startsWith('P')) return 'characters';
  if (id.startsWith('S')) return 'skills';
  return 'characters'; // 兜底
}
```

## 变量保护机制

在执行 AI 返回的指令前，前端必须做安全拦截：

```javascript
function sanitizeCommands(commands) {
  return commands.filter(cmd => {
    // 禁止删除玩家角色
    if (cmd.type === 'delete' && cmd.id === 'B1') return false;

    // 保护关键字段（除非开启调试模式）
    if (!debugMode && cmd.id === 'B1' && cmd.type === 'update') {
      const protectedFields = ['level', 'core_stats', 'identity'];
      for (const field of protectedFields) {
        delete cmd.data[field];
      }
    }

    return true;
  });
}
```

## 指令自动修复

AI 生成的 JSON 可能有格式错误，尝试自动修复：

```javascript
function attemptAutoFix(rawJson) {
  let str = rawJson.trim();

  // 修复尾部多余逗号
  str = str.replace(/,\s*([}\]])/g, '$1');

  // 修复单引号 → 双引号
  str = str.replace(/'/g, '"');

  // 尝试补全未闭合的括号
  const openBraces = (str.match(/\{/g) || []).length;
  const closeBraces = (str.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    str += '}'.repeat(openBraces - closeBraces);
  }

  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn('Auto-fix failed:', e, str);
    return null;
  }
}
```

## 设置面板实现

### 通道配置结构

```javascript
// 每个通道的配置
const channelConfig = {
  apiSource: 'parent',  // 'parent' | 'custom'
  apiUrl: '',            // 自定义端点 URL
  apiKey: '',            // 自定义 API Key
  apiModel: '',          // 自定义模型名
  temperature: 0.1       // 温度
};

// 存储 / 读取 localStorage
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
  const url = baseUrl.endsWith('/models')
    ? baseUrl
    : `${baseUrl}/models`;
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
  // 传给 config.abortSignal
}

function stopGeneration() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  // 同时中断 ST 侧
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
      if (e.name === 'AbortError') throw e; // 用户主动中断，不重试
      if (i === maxRetries) {
        showError(`AI 调用失败: ${e.message}`);
        throw e;
      }
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // 退避重试
    }
  }
}
```
