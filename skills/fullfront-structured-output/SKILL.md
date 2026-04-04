---
name: fullfront-structured-output
description: Function Calling 与 JSON Schema 两种结构化输出方案的用法与兼容性。当需要了解 tool_result 多轮协议、叙事集成模式对比时使用。大多数场景不需要本 skill。
---

# 完全前端卡 结构化输出 Skill（底层）

Function Calling (Tool Use) 与 JSON Schema 两种结构化输出方案的用法、对比与兼容性。

> **大多数场景不需要本 skill。** `st-card-toolkit` 的 `callAI()` 已支持 `json_schema` 和 `tools` 透传，`parseNarrativeAndData()` 已封装 JSON 提取 + narrative/data 拆分。只有需要了解 function calling 协议细节（tool_result 多轮、叙事集成模式对比）时才需要本 skill。

## 触发条件

用户在编写完全前端卡时涉及 toolkit 不覆盖的结构化输出细节：function calling 多轮协议、tool_result 处理、叙事+数据混合输出的方案选择。

## Function Calling (Tool Use)

`generateRaw()` / `generate()` 支持 `tools` 和 `tool_choice` 参数。

```javascript
const result = await window.parent.TavernHelper.generateRaw({
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
  // result.content: string（文本回复，可能为空）
  // result.tool_calls: ToolCall[]
  for (const call of result.tool_calls) {
    const args = JSON.parse(call.function.arguments);
    // 处理 args.operations...
  }
} else {
  // 未调用工具，result 是 string，回退到文本解析
}
```

tools 采用 OpenAI 标准格式，ST 服务端自动转换为 Claude/Gemini 格式。

`tool_choice` 始终用 `'auto'`——推理模型 COT 模式不支持强制指定工具，`'auto'` 兼容性最好。

流式模式下不返回 tool_calls，只返回文本。逻辑通道用非流式 + function calling，叙事通道用流式。

部分 API 完全不支持 tools，需做 fallback。

### function calling 协议限制

tool_call 之后的正文必须等 tool_result 返回才能继续生成：

| | tool_call 前 content | reasoning/thinking | tool_call 后正文 |
|---|---|---|---|
| vLLM | 保留 | 保留在 reasoning_content | 必须等 tool_result |
| Claude API | 保留 | 保留 | 必须等 tool_result |

因此，如果同时需要叙事文本和结构化数据，有三种处理方式：
- **单轮取 content**：只用 tool_call 前的 content 当叙事，但有些模型 content 为空
- **多轮回 tool_result**：收到 tool_call 后回传 `{"status":"ok"}`，模型继续生成叙事，两轮调用
- **叙事塞进 tool 参数**：tool parameters 加 narrative 字段，一轮完成但模型可能压缩长文本

## JSON Schema（结构化输出）

`generateRaw()` / `generate()` 支持 `json_schema` 参数，强制模型输出符合指定 schema 的 JSON。与 tools 互斥。

```javascript
const result = await window.parent.TavernHelper.generateRaw({
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
const parsed = JSON.parse(result); // result 是 JSON 字符串
```

ST 服务端自动转换：OpenAI/DeepSeek/Mistral → `response_format.json_schema`，Claude → 转为 tool + forced tool_choice。

## Function Calling vs JSON Schema 对比

| | Function Calling | JSON Schema |
|---|---|---|
| 协议 | tool_call，按规范应回 tool_result | response_format，直接返回 JSON 字符串 |
| 轮次 | 严格遵循需两轮，或单轮但不合规 | 一轮完成 |
| 结构保证 | 模型自觉遵循 parameters schema | `strict: true` 时 API 层面保证 |
| 叙事+数据混合 | 需要把叙事塞进 tool 参数 | 天然支持，narrative 就是一个 JSON 字段 |
| 降级 | 不支持的 API 需 fallback 到文本解析 | 不支持 json_schema 的降级为 json_object |
| 流式 | 流式模式下不返回 tool_calls | 流式下逐步输出 JSON 文本 |

### 选择建议

- 需要叙事+结构化数据混合输出 → **json_schema**（一轮完成，narrative 作为 JSON 字段）
- 需要触发外部操作/多步推理 → **function calling**（符合 agent 模式）
- 需要最大兼容性 → **文本解析 fallback**（始终保留作为兜底）
