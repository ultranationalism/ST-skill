---
name: fullfront-prompt
description: 完全前端卡底层提示词编排：ordered_prompts、generate/generateRaw 差异、上下文管理。当需要混用 ST 内置标识符或走 ST 预设路径时使用。
---

# 完全前端卡 提示词编排 Skill（底层）

generate() 与 generateRaw() 的提示词编排差异、ordered_prompts 用法、上下文管理策略。

> **大多数场景不需要本 skill。** `st-card-toolkit` 的 `callAI()` + `createHistory()` 已封装了 `ordered_prompts` 多轮对话管理。只有需要混用 ST 内置标识符（`'char_description'`、`'world_info_before'` 等）或使用 `generate()` 走 ST 预设路径时才需要本 skill。

## 触发条件

用户在编写完全前端卡时涉及 toolkit 不覆盖的提示词编排：自定义 ordered_prompts 中混用 ST 标识符、generate() 预设路径、上下文策略选择。

## generate() 与 generateRaw() 的核心差异

两者在提示词编排上有本质区别。

### generate(params) — 使用 ST 预设

- `use_preset: true`，走 ST 完整的 Prompt Manager 编排
- ST 预设中的系统提示、角色描述、世界书、作者注释、jailbreak 等全部按预设顺序注入
- `user_input` 被插入到预设模板中 `user_input` 对应的位置
- `max_chat_history` 控制携带多少条 ST 聊天记录
- 适合：需要利用 ST 预设编排的场景，或把所有上下文塞进 `user_input` 自行管理

### generateRaw(params) — 不使用预设，自定义编排

- `use_preset: false`，走 `handleCustomPath` 独立编排
- 通过 `ordered_prompts` 数组显式控制哪些内容以什么顺序出现
- 支持两种元素：
  - **字符串标识符**（`'char_description'`, `'world_info_before'` 等）→ 自动拉取 ST 对应内容
  - **RolePrompt 对象**（`{role: 'system'|'user'|'assistant', content: '...'}`）→ 原样插入
- 只有 `ordered_prompts` 中显式列出的内置标识符对应的内容才会被注入
- `'chat_history'` 标识符还承载世界书深度条目、作者注释、角色深度提示的注入点
- **不放 `'chat_history'` = 这些深度注入全部丢失**

## ordered_prompts 示例

```javascript
// 最小化：完全自管上下文，不注入任何 ST 内容
const result = await window.parent.TavernHelper.generateRaw({
  ordered_prompts: [
    { role: 'user', content: prompt },
  ]
});

// 挂回 ST 编排：注入角色描述、世界书，自己加系统提示
const result = await window.parent.TavernHelper.generateRaw({
  ordered_prompts: [
    'world_info_before',
    'char_description',
    { role: 'system', content: '你的自定义系统提示' },
    'world_info_after',
    'chat_history',     // ← 不加这个，世界书深度条目/作者注释不会注入
    'user_input',
  ],
  user_input: currentPrompt,
  max_chat_history: 0,
});

// 自管多轮对话历史（fullfront 卡典型用法）
const result = await window.parent.TavernHelper.generateRaw({
  ordered_prompts: [
    { role: 'system', content: systemPrompt },
    ...chatHistory,  // [{role:'user',content:...}, {role:'assistant',content:...}, ...]
    { role: 'user', content: currentPrompt },
  ]
});
```

## 可用的内置标识符

| 标识符 | 对应内容 |
|---|---|
| `'world_info_before'` | 世界书（角色定义前） |
| `'persona_description'` | 用户描述 |
| `'char_description'` | 角色描述 |
| `'char_personality'` | 角色性格 |
| `'scenario'` | 场景 |
| `'world_info_after'` | 世界书（角色定义后） |
| `'dialogue_examples'` | 对话示例 |
| `'chat_history'` | 聊天历史 + 深度注入（作者注释、世界书深度条目） |
| `'user_input'` | 用户输入 |

## 上下文管理策略

### 策略 A：完全解耦（纯 RolePrompt，不用内置标识符）

- iframe 自行维护 chatHistory 数组，每次把完整对话传入
- 不受 ST 预设/世界书影响，行为完全可控
- 缺点：用户的 ST 预设、世界书、作者注释全部失效

### 策略 B：挂回 ST 编排（混用内置标识符 + RolePrompt）

- 在 `ordered_prompts` 中插入 `'char_description'`、`'world_info_before'` 等
- 用户的世界书和预设能生效
- 缺点：提示词顺序和内容受 ST 配置影响，卡的行为不完全可控

### 策略 C：generate() + user_input 塞全部上下文

- 用 `generate()` 利用 ST 预设，但 `max_chat_history: 0`
- 把自管的历史、状态、指令全部拼进 `user_input`
- 用 `role:` 前缀模拟多角色消息（`system: xxx\nuser: xxx\nassistant: xxx`）
- ST 预设、世界书、作者注释都正常注入
- 缺点：所有内容挤在一个 user 消息里，不是真正的多轮对话格式
