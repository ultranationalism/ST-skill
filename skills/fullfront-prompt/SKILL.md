---
name: fullfront-prompt
description: 完全前端卡底层提示词编排：ordered_prompts、generate/generateRaw 差异、上下文管理。当需要混用 ST 内置标识符或走 ST 预设路径时使用。
---

# 完全前端卡 提示词编排 Skill（底层）

generate() 与 generateRaw() 的提示词编排差异、ordered_prompts 用法、上下文管理策略。

> **大多数场景不需要本 skill。** `st-card-toolkit` 的 `callAI()` + `createHistory()` 已封装了多轮对话管理。只有需要直接操作 `ordered_prompts`、`overrides.chat_history`、或混用 ST 内置标识符时才需要本 skill。选择 `generate()` 还是 `generateRaw()` 是设计决策，见 `write-fullfront-card` skill 的「AI 调用模式」章节。

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

## generate() 的 overrides 参数

`generate()` 走 ST 预设路径时，可通过 `overrides` 覆盖预设中的特定槽位内容。

### overrides.chat_history — 注入自管对话历史

将自维护的多轮对话注入到预设的 `chat_history` 槽位，替换 ST 原有聊天记录：

```javascript
const result = await window.parent.TavernHelper.generate({
  user_input: currentPrompt,
  max_chat_history: 0,           // 不带 ST 聊天记录
  json_schema: MY_SCHEMA,        // 可选
  overrides: {
    chat_history: {
      prompts: [                  // 替换 chat_history 槽位
        { role: 'user', content: '第1轮 prompt' },
        { role: 'assistant', content: '第1轮回复' },
        { role: 'user', content: '第2轮 prompt' },
        { role: 'assistant', content: '第2轮回复' },
      ],
      with_depth_entries: true,   // 默认 true，世界书 @depth 条目仍注入
    }
  }
});
```

`max_chat_history: 0` + `overrides.chat_history.prompts` 的组合效果：清空 ST 聊天记录，用自管历史替代。

### overrides 的其他字段

```javascript
overrides: {
  world_info_before: '覆盖的世界书(前)',    // 覆盖 WI before_char 内容
  char_description: '覆盖的角色描述',       // 覆盖角色描述
  char_personality: '覆盖的性格',
  persona_description: '覆盖的用户人设',
  scenario: '覆盖的场景',
  world_info_after: '覆盖的世界书(后)',
  dialogue_examples: '覆盖的对话示例',
}
```

传空字符串 `''` 可清空对应槽位。不传的槽位保持预设原有内容。

### generate() 的最终上下文结构

ST 预设（Prompt Manager）按以下顺序编排，用户可拖拽调整：

```
[Main Prompt]                          ← 系统提示（用户预设）
[World Info Before]                    ← lorebook "before_char" 条目
[Persona Description]                  ← 用户人设
[Character Description / Personality]  ← 角色卡字段
[World Info After]                     ← lorebook "after_char" 条目
[Chat History]                         ← overrides 或 ST 聊天记录 + @depth 注入
[user_input]                           ← generate() 的 user_input 参数
[Post-History Instructions]            ← 最终指令（用户预设）
```
