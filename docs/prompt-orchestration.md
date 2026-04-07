# 提示词编排参考

generate() 与 generateRaw() 的提示词编排，ordered_prompts 用法，overrides 覆盖。

> toolkit 的 `callAI()` + `createHistory()` 已封装多轮对话管理。只有需要直接操作 `ordered_prompts`、`overrides.chat_history`、或混用 ST 内置标识符时才需要本文档。

---

## generate() vs generateRaw() 编排差异

### generate() — 走 ST 预设

- ST Prompt Manager 编排所有内容（系统提示、角色描述、世界书、作者注释等）
- `user_input` 插入到预设模板对应位置
- `max_chat_history` 控制携带多少条 ST 聊天记录
- 通过 `overrides` 覆盖预设中的特定槽位

### generateRaw() — 完全自定义

- 通过 `ordered_prompts` 显式控制内容和顺序
- 支持两种元素：
  - **字符串标识符**（`'char_description'` 等）→ 拉取 ST 对应内容
  - **RolePrompt 对象**（`{role, content}`）→ 原样插入
- 只有显式列出的标识符才会注入
- **不放 `'chat_history'` = 世界书深度条目、作者注释全部丢失**

---

## ordered_prompts 示例

```javascript
// 最小化：完全自管上下文
await TavernHelper.generateRaw({
  ordered_prompts: [
    { role: 'user', content: prompt },
  ]
});

// 混用 ST 内容
await TavernHelper.generateRaw({
  ordered_prompts: [
    'world_info_before',
    'char_description',
    { role: 'system', content: '自定义系统提示' },
    'world_info_after',
    'chat_history',     // ← 不加则深度注入/作者注释丢失
    'user_input',
  ],
  user_input: currentPrompt,
  max_chat_history: 0,
});

// 自管多轮对话（fullfront 卡典型用法）
await TavernHelper.generateRaw({
  ordered_prompts: [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
    { role: 'user', content: currentPrompt },
  ]
});
```

---

## 内置标识符

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

---

## overrides（generate 模式）

覆盖 ST 预设中的特定槽位内容。

### chat_history — 注入自管对话历史

```javascript
await TavernHelper.generate({
  user_input: currentPrompt,
  max_chat_history: 0,
  overrides: {
    chat_history: {
      prompts: [
        { role: 'user', content: '第1轮 prompt' },
        { role: 'assistant', content: '第1轮回复' },
        { role: 'user', content: '第2轮 prompt' },
        { role: 'assistant', content: '第2轮回复' },
      ],
      with_depth_entries: true,   // 默认 true
    }
  }
});
```

`max_chat_history: 0` + `overrides.chat_history.prompts`：清空 ST 聊天记录，用自管历史替代。

### 其他槽位

```javascript
overrides: {
  world_info_before: '覆盖的世界书(前)',
  char_description: '覆盖的角色描述',
  char_personality: '覆盖的性格',
  persona_description: '覆盖的用户人设',
  scenario: '覆盖的场景',
  world_info_after: '覆盖的世界书(后)',
  dialogue_examples: '覆盖的对话示例',
}
```

传 `''` 清空槽位。不传的保持预设原有内容。

---

## generate() 最终上下文结构

ST Prompt Manager 默认顺序（用户可拖拽调整）：

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
