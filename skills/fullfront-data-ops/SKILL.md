---
name: fullfront-data-ops
description: 完全前端卡的 AI 指令解析、数据库操作、变量保护与自动修复。当用户涉及 y_insert/y_update 指令系统、多通道并行调用模式时使用。
---

# 完全前端卡 数据操作 Skill

AI 指令解析、执行、变量保护、自动修复，以及多通道并行/串行调用模式。

## 触发条件

用户在编写完全前端卡时涉及：AI 指令解析、数据库操作、变量保护、多通道调用架构。

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
  const logicResult = await callAI(
    buildLogicPrompt(action, gameState),
    channels.logic
  );
  const commands = parseCommands(logicResult);
  await executeCommands(sanitizeCommands(commands));

  const updatedState = await getFullGameState();
  const narrativeResult = await callAI(
    buildNarrativePrompt(action, updatedState),
    channels.narrative
  );
  renderNarrative(narrativeResult);
}
```

## 指令解析

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
  if (id.startsWith('IT')) return 'items';
  if (id.startsWith('I')) return 'items';
  if (id.startsWith('T')) return 'quests';
  if (id.startsWith('P')) return 'characters';
  if (id.startsWith('S')) return 'skills';
  return 'characters';
}
```

## 变量保护

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
