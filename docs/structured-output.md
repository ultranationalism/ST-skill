# 结构化输出参考

Function Calling (Tool Use) 与 JSON Schema 两种方案的用法、对比与兼容性。

> toolkit 的 `callAI()` 已支持 `json_schema` 和 `tools` 透传，`parseNarrativeAndData()` 已封装 JSON 提取 + narrative/data 拆分。以下为协议细节。

---

## Function Calling vs JSON Schema

| | Function Calling | JSON Schema |
|---|---|---|
| 协议 | tool_call → tool_result 多轮 | response_format，直接返回 JSON 字符串 |
| 轮次 | 严格遵循需两轮 | 一轮完成 |
| 结构保证 | 模型自觉遵循 parameters schema | `strict: true` 时 API 层面保证 |
| 叙事+数据混合 | 需把叙事塞进 tool 参数 | 天然支持（narrative 作为 JSON 字段） |
| 降级 | 不支持的 API 需 fallback 到文本解析 | 不支持时降级为 json_object |
| 流式 | 流式模式下不返回 tool_calls | 逐步输出 JSON 文本 |

### 选择建议

- 叙事+结构化混合 → **json_schema**（一轮，narrative 为 JSON 字段）
- 触发外部操作/多步推理 → **function calling**（agent 模式）
- 最大兼容性 → **文本解析 fallback**（始终保留兜底）

---

## Function Calling

```javascript
const result = await TavernHelper.generateRaw({
  user_input: prompt,
  should_stream: false,
  max_chat_history: 0,
  tools: [{
    type: 'function',
    function: {
      name: 'update_game_state',
      description: '更新游戏状态',
      parameters: {
        type: 'object',
        properties: {
          operations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['insert', 'update', 'delete'] },
                entity_id: { type: 'string' },
                data: { type: 'object' }
              },
              required: ['action', 'entity_id']
            }
          }
        },
        required: ['operations']
      }
    }
  }],
  tool_choice: 'auto'
});

// 判断返回类型
if (typeof result === 'object' && result.tool_calls) {
  for (const call of result.tool_calls) {
    const args = JSON.parse(call.function.arguments);
  }
} else {
  // 未调用工具，result 是 string，回退到文本解析
}
```

- tools 采用 OpenAI 标准格式，ST 服务端自动转换为 Claude/Gemini 格式
- `tool_choice` 始终用 `'auto'`（推理模型 COT 不支持强制指定）
- 流式模式下不返回 tool_calls
- 部分 API 不支持 tools，需做 fallback

### 协议限制

tool_call 后必须等 tool_result 才能继续生成：

| | tool_call 前 content | reasoning/thinking | tool_call 后正文 |
|---|---|---|---|
| vLLM | 保留 | 保留在 reasoning_content | 必须等 tool_result |
| Claude API | 保留 | 保留 | 必须等 tool_result |

同时需要叙事和结构化数据的三种处理方式：

- **单轮取 content**：只用 tool_call 前的 content 当叙事（有些模型 content 为空）
- **多轮回 tool_result**：回传 `{"status":"ok"}`，模型继续生成叙事（两轮调用）
- **叙事塞进 tool 参数**：parameters 加 narrative 字段（一轮，但模型可能压缩长文本）

---

## JSON Schema

```javascript
const result = await TavernHelper.generateRaw({
  ordered_prompts: [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
    { role: 'user', content: currentPrompt },
  ],
  json_schema: {
    name: 'scene_response',
    description: '叙事 + 状态',
    value: {
      type: 'object',
      properties: {
        narrative: { type: 'string', description: '叙事正文' },
        hp: { type: 'number' },
        status: { type: 'string', enum: ['normal', 'injured', 'dead'] }
      },
      required: ['narrative', 'hp', 'status'],
      additionalProperties: false
    },
    strict: true
  }
});
const parsed = JSON.parse(result);
```

ST 服务端转换：OpenAI/DeepSeek/Mistral → `response_format.json_schema`，Claude → tool + forced tool_choice。

json_schema 与 tools 互斥。
