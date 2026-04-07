# TavernHelper API Reference

通过 `window.parent.TavernHelper` 访问。全前端卡运行在 iframe 中，所有 ST 交互经由此对象。

---

## generate vs generateRaw

| | `generate()` | `generateRaw()` |
|---|---|---|
| ST 预设（文风/破限/世界书） | 生效 | 不生效 |
| 上下文编排 | `overrides` 覆盖预设槽位 | `ordered_prompts` 完全自定义 |
| 并发 | 同时只能一个 | 可并行多个 |
| 回复写入聊天界面 | 是（全前端卡已替换界面，无影响） | 否 |
| 适用 | 叙事 / 角色扮演 | 数据处理 / 摘要 / 逻辑判定 |

同一张卡可混用：叙事通道 `generate()`，逻辑通道 `generateRaw()`。

---

## 通用参数

```javascript
{
  user_input: string,             // 提示文本
  should_stream: boolean,         // 流式输出
  max_chat_history: number,       // 携带 ST 聊天历史条数（0 = 不带）
  image: string[],                // 可选，base64 图片
  tools: Tool[],                  // 可选，function calling（见 fullfront-structured-output skill）
  tool_choice: 'auto',            // 可选
  json_schema: object,            // 可选，结构化 JSON 输出（见 fullfront-structured-output skill）
}
```

## generate() 额外参数

```javascript
{
  overrides: {
    chat_history: {
      prompts: Message[],         // 自管对话历史，替换 ST 聊天记录
      with_depth_entries: true,   // 世界书 @depth 条目仍注入（默认 true）
    },
    world_info_before: string,    // 覆盖世界书(前)，传 '' 清空
    world_info_after: string,
    char_description: string,
    char_personality: string,
    persona_description: string,
    scenario: string,
    dialogue_examples: string,
  }
}
```

## generateRaw() 额外参数

```javascript
{
  ordered_prompts: Message[],     // 完全自定义提示词序列（见 fullfront-prompt skill）
}
```

---

## 流式输出

### TavernHelper 事件

```javascript
window.eventOn('js_stream_token_received_incrementally', (chunk) => {
  outputEl.textContent += chunk;
});
```

### OpenAI 兼容端点 SSE

```javascript
async function fetchStream(prompt, config, onToken) {
  const res = await fetch(config.apiUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.apiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: config.temperature,
      stream: true,
    }),
    signal: config.abortSignal,
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return full;
      try {
        const token = JSON.parse(data).choices[0]?.delta?.content || '';
        full += token;
        onToken(token);
      } catch {}
    }
  }
  return full;
}
```

---

## 世界书读写

| 方法 | 签名 | 说明 |
|---|---|---|
| `getCurrentCharPrimaryLorebook` | `() → Promise<string>` | 当前角色主世界书名 |
| `getLorebookEntries` | `(bookName) → Promise<Entry[]>` | 读取所有条目 |
| `setLorebookEntries` | `(bookName, entries) → Promise<void>` | 更新条目（按 uid 匹配） |
| `createLorebookEntries` | `(bookName, entries) → Promise<void>` | 新建条目 |

---

## 中断控制

| 方法/属性 | 说明 |
|---|---|
| `isGenerating` | `boolean` 属性，当前是否正在生成 |
| `stopAllGeneration()` | 中断所有生成 |
| `getGenerationState()` | 返回 `{ status: 'stopped' \| ... }` |

自定义端点用 `AbortController` 中断 fetch。

---

## 双源调用模式

用户在设置面板选择 API 源：

| 源 | 说明 |
|---|---|
| `parent` | 通过 TavernHelper 调用 ST 已配置的模型，无需额外设置 |
| `custom` | 直接 fetch OpenAI 兼容端点（用户配置 URL / Key / Model） |

toolkit 的 `callAI()` 已封装双源切换 + 历史管理 + generate/generateRaw 模式选择。

---

## 配置持久化

```javascript
// 通道配置结构
{ apiSource: 'parent'|'custom', apiUrl: string, apiKey: string, apiModel: string, temperature: number }

// 存取（toolkit 的 createConfig 已封装）
localStorage.getItem / setItem
```

## 获取可用模型（自定义端点）

```javascript
const res = await fetch(`${baseUrl}/models`, {
  headers: { Authorization: `Bearer ${apiKey}` },
});
const models = (await res.json()).data.map(m => m.id);
```
