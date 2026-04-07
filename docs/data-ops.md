# 数据操作参考

AI 指令解析、执行、变量保护、自动修复，多通道并行/串行调用模式。

---

## 多通道调用模式

### 并行（叙事与逻辑同时发起）

```javascript
const [logicResult, narrativeResult] = await Promise.all([
  callAI(logicPrompt, { config, history: logicHistory, mode: 'generateRaw' }),
  callAI(narrativePrompt, { config, history: narrativeHistory, mode: 'generate' }),
]);

const commands = parseCommands(logicResult);
await executeCommands(sanitizeCommands(commands));
renderNarrative(narrativeResult);
```

### 串行（逻辑先行，叙事基于更新后状态）

```javascript
const logicResult = await callAI(logicPrompt, { config, history: logicHistory });
await executeCommands(sanitizeCommands(parseCommands(logicResult)));

const updatedState = await getFullGameState();
const narrativeResult = await callAI(
  buildNarrativePrompt(action, updatedState),
  { config, history: narrativeHistory, mode: 'generate' },
);
renderNarrative(narrativeResult);
```

---

## 指令格式

AI 回复中嵌入的数据操作指令：

| 指令 | 格式 | 说明 |
|---|---|---|
| `y_insert` | `y_insert({...})` | 插入新记录 |
| `y_update` | `y_update("ID", {...})` | 更新指定记录 |
| `y_delete` | `y_delete("ID")` | 删除指定记录 |
| `y_add_json` | `y_add_json("ID", col, "key", delta)` | JSON 字段数值增减 |

---

## 指令解析

```javascript
function parseCommands(aiResponse) {
  const commands = [];

  const insertReg = /y_insert\((\{[\s\S]*?\})\)/g;
  let match;
  while ((match = insertReg.exec(aiResponse)) !== null) {
    try {
      commands.push({ type: 'insert', data: JSON.parse(match[1]) });
    } catch (e) {
      const fixed = attemptAutoFix(match[1]);
      if (fixed) commands.push({ type: 'insert', data: fixed });
    }
  }

  const updateReg = /y_update\("([^"]+)",\s*(\{[\s\S]*?\})\)/g;
  while ((match = updateReg.exec(aiResponse)) !== null) {
    try {
      commands.push({ type: 'update', id: match[1], data: JSON.parse(match[2]) });
    } catch (e) {
      const fixed = attemptAutoFix(match[2]);
      if (fixed) commands.push({ type: 'update', id: match[1], data: fixed });
    }
  }

  const deleteReg = /y_delete\("([^"]+)"\)/g;
  while ((match = deleteReg.exec(aiResponse)) !== null) {
    commands.push({ type: 'delete', id: match[1] });
  }

  const addJsonReg = /y_add_json\("([^"]+)",\s*"?(\d+)"?,\s*"([^"]+)",\s*(-?\d+(?:\.\d+)?)\)/g;
  while ((match = addJsonReg.exec(aiResponse)) !== null) {
    commands.push({
      type: 'add_json', id: match[1],
      col: parseInt(match[2]), key: match[3], delta: parseFloat(match[4]),
    });
  }

  return commands;
}
```

---

## 指令执行

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
            ? JSON.parse(record[cmd.col]) : record[cmd.col];
          jsonField[cmd.key] = (jsonField[cmd.key] || 0) + cmd.delta;
          await db.table(table).update(cmd.id, {
            [cmd.col]: typeof record[cmd.col] === 'string'
              ? JSON.stringify(jsonField) : jsonField
          });
        }
        break;
      }
    }
  }
  refreshUI();
}
```

## ID 前缀 → 表路由

| 前缀 | 表 |
|---|---|
| `B`, `C`, `P` | `characters` |
| `M` | `monsters` |
| `IT`, `I` | `items` |
| `T` | `quests` |
| `S` | `skills` |

---

## 变量保护

```javascript
function sanitizeCommands(commands) {
  return commands.filter(cmd => {
    if (cmd.type === 'delete' && cmd.id === 'B1') return false;
    if (!debugMode && cmd.id === 'B1' && cmd.type === 'update') {
      for (const f of ['level', 'core_stats', 'identity']) delete cmd.data[f];
    }
    return true;
  });
}
```

---

## 指令自动修复

处理 AI 生成的格式错误 JSON：

```javascript
function attemptAutoFix(rawJson) {
  let str = rawJson.trim();
  str = str.replace(/,\s*([}\]])/g, '$1');    // 尾部多余逗号
  str = str.replace(/'/g, '"');                // 单引号 → 双引号
  const open = (str.match(/\{/g) || []).length;
  const close = (str.match(/\}/g) || []).length;
  if (open > close) str += '}'.repeat(open - close);
  try { return JSON.parse(str); }
  catch { return null; }
}
```
