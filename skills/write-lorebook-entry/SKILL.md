---
name: write-lorebook-entry
description: 编写 SillyTavern 卡内世界书条目的完整格式规范。当用户要求编写世界书、lorebook 条目、character_book entries 时使用。
---

# 世界书条目编写 Skill

编写 SillyTavern 卡内世界书（character_book）条目的完整格式规范。

## 触发条件

用户在编写或修改 ST 角色卡的世界书条目时。

## 两套格式

ST 存在两套世界书格式，**不可混用**：

| | 卡内 character_book (V2 Spec) | 外部世界书 (ST Internal) |
|---|---|---|
| 用途 | 嵌入角色卡 JSON | ST 独立世界书文件 |
| 关键词 | `keys` / `secondary_keys` | `key` / `keysecondary` |
| 启用 | `enabled: true` | `disable: false` |
| ID | `id` (number) | `uid` (number) |
| 排序 | `insertion_order` | `order` |
| 高级字段 | 在 `extensions` 对象内（snake_case） | 平铺在顶层（camelCase） |

本 skill 主要覆盖**卡内 character_book** 格式。

## 卡内条目完整模板

```json
{
  "id": 0,
  "keys": [],
  "secondary_keys": [],
  "comment": "条目名称",
  "content": "条目内容文本",
  "constant": true,
  "selective": false,
  "insertion_order": 100,
  "enabled": true,
  "position": "before_char",
  "use_regex": true,
  "extensions": {
    "position": 0,
    "exclude_recursion": false,
    "prevent_recursion": false,
    "delay_until_recursion": false,
    "display_index": 0,
    "probability": 100,
    "useProbability": true,
    "depth": 4,
    "selectiveLogic": 0,
    "outlet_name": "",
    "group": "",
    "group_override": false,
    "group_weight": 100,
    "scan_depth": null,
    "case_sensitive": null,
    "match_whole_words": null,
    "use_group_scoring": false,
    "automation_id": "",
    "role": 0,
    "vectorized": false,
    "sticky": 0,
    "cooldown": 0,
    "delay": 0,
    "match_persona_description": false,
    "match_character_description": false,
    "match_character_personality": false,
    "match_character_depth_prompt": false,
    "match_scenario": false,
    "match_creator_notes": false,
    "triggers": [],
    "ignore_budget": false
  }
}
```

## 顶层字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | number | 是 | 条目 ID，从 0 开始递增 |
| `keys` | string[] | 是 | 主关键词，触发条目的词列表 |
| `secondary_keys` | string[] | 否 | 二级关键词，配合 selectiveLogic 过滤 |
| `comment` | string | 是 | 条目标签名（显示在 UI 中） |
| `content` | string | 是 | 注入到提示词中的实际文本 |
| `constant` | boolean | 否 | `true` = 常驻条目，无视关键词始终注入 |
| `selective` | boolean | 否 | `true` = 启用二级关键词过滤 |
| `insertion_order` | number | 是 | 注入优先级（数字越大越优先） |
| `enabled` | boolean | 是 | 是否启用（ST 内部转换为 `disable: !enabled`） |
| `position` | string | 否 | 旧版位置："before_char" / "after_char"，**实际使用 extensions.position** |
| `use_regex` | boolean | 否 | 关键词是否使用正则匹配 |

## extensions 字段说明

### 位置控制

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `position` | number | 0 | 注入位置，见下方枚举 |
| `depth` | number | 4 | @Depth 模式下的深度值 |
| `role` | number | 0 | @Depth 模式下的角色：0=system, 1=user, 2=assistant |

**position 枚举值：**

| 值 | 含义 |
|---|---|
| 0 | before_char — 角色定义前 |
| 1 | after_char — 角色定义后 |
| 2 | before_example — 对话示例前 |
| 3 | after_example — 对话示例后 |
| 4 | @Depth — 按 depth 值插入聊天历史中（配合 role 使用） |
| 5 | before_author_note — 作者注释前 |
| 6 | after_author_note — 作者注释后 |

### 递归控制

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `exclude_recursion` | boolean | false | 不扫描此条目触发其他条目 |
| `prevent_recursion` | boolean | false | 阻止被其他条目递归触发 |
| `delay_until_recursion` | number/boolean | false | 延迟到递归扫描第 N 轮才激活 |

### 激活概率

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `probability` | number | 100 | 激活概率百分比 |
| `useProbability` | boolean | true | 是否启用概率机制 |

### 分组

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `group` | string | "" | 分组名，同组条目互斥 |
| `group_override` | boolean | false | 优先使用组内评分 |
| `group_weight` | number | 100 | 组内权重 |
| `use_group_scoring` | boolean\|null | null | 覆盖全局组评分设置，null=跟随全局 |

### 扫描范围覆盖（null = 跟随全局设置）

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `scan_depth` | number\|null | null | 覆盖扫描深度 |
| `case_sensitive` | boolean\|null | null | 覆盖大小写敏感 |
| `match_whole_words` | boolean\|null | null | 覆盖全词匹配 |

### 上下文匹配扩展

这些字段控制关键词是否也在角色描述等字段中搜索（默认只搜索聊天历史）：

| 字段 | 类型 | 默认 |
|---|---|---|
| `match_persona_description` | boolean | false |
| `match_character_description` | boolean | false |
| `match_character_personality` | boolean | false |
| `match_character_depth_prompt` | boolean | false |
| `match_scenario` | boolean | false |
| `match_creator_notes` | boolean | false |

### 时间控制

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `sticky` | number | 0 | 触发后持续激活的消息数 |
| `cooldown` | number | 0 | 触发后冷却的消息数 |
| `delay` | number | 0 | 首次触发前延迟的消息数 |

### 其他

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `display_index` | number | 0 | UI 显示排序 |
| `outlet_name` | string | "" | 命名输出口 |
| `automation_id` | string | "" | 斜杠命令自动化 ID |
| `vectorized` | boolean | false | 是否使用向量搜索 |
| `selectiveLogic` | number | 0 | 二级关键词逻辑：0=AND_ANY, 1=NOT_ALL, 2=NOT_ANY, 3=AND_ALL |
| `triggers` | string[] | [] | 生成类型触发器 |
| `ignore_budget` | boolean | false | 无视 token 预算限制 |

## 常用场景速查

### 常驻系统指令（始终注入，放在角色定义前）

```json
{
  "id": 0,
  "keys": [],
  "secondary_keys": [],
  "comment": "📌核心规则",
  "content": "<core_rules>\n你的规则内容\n</core_rules>",
  "constant": true,
  "selective": false,
  "insertion_order": 100,
  "enabled": true,
  "position": "before_char",
  "use_regex": true,
  "extensions": {
    "position": 0,
    "exclude_recursion": true,
    "prevent_recursion": true,
    "display_index": 0,
    "probability": 100,
    "useProbability": true,
    "depth": 4,
    "selectiveLogic": 0,
    "role": 0,
    "vectorized": false
  }
}
```

关键：`constant: true` + `keys: []`，无需关键词触发。

### 关键词触发条目（提到"魔法"时注入）

```json
{
  "id": 1,
  "keys": ["魔法", "法术", "施法"],
  "secondary_keys": [],
  "comment": "魔法体系",
  "content": "这个世界的魔法体系是...",
  "constant": false,
  "selective": false,
  "insertion_order": 50,
  "enabled": true,
  "position": "before_char",
  "use_regex": false,
  "extensions": {
    "position": 0,
    "depth": 4,
    "probability": 100,
    "useProbability": true,
    "selectiveLogic": 0,
    "role": 0
  }
}
```

### 深度注入条目（插入聊天历史第 2 层作为 system 消息）

```json
{
  "id": 2,
  "keys": [],
  "secondary_keys": [],
  "comment": "深度提醒",
  "content": "记住保持角色一致性",
  "constant": true,
  "selective": false,
  "insertion_order": 100,
  "enabled": true,
  "position": "before_char",
  "use_regex": false,
  "extensions": {
    "position": 4,
    "depth": 2,
    "role": 0
  }
}
```

关键：`extensions.position: 4`（@Depth 模式）+ `depth: 2` + `role: 0`（system）。

## 省略字段规则

extensions 中未显式指定的字段会使用 ST 默认值。以下字段可以安全省略（ST 导入时会自动填充默认值）：

- 所有 `match_*` 字段（默认 false）
- `sticky` / `cooldown` / `delay`（默认 0）
- `group*` 相关字段（默认空/false/100）
- `scan_depth` / `case_sensitive` / `match_whole_words`（默认 null）
- `automation_id` / `outlet_name`（默认空字符串）
- `triggers`（默认空数组）
- `ignore_budget`（默认 false）

**但建议在项目源文件中保留完整字段**，避免 ST 版本更新改变默认值时出问题。

## V2 Spec ↔ ST Internal 字段映射

ST 导入卡时通过 `convertCharacterBook()` 转换。对照表：

| V2 Spec (卡内) | ST Internal (运行时) |
|---|---|
| `keys` | `key` |
| `secondary_keys` | `keysecondary` |
| `id` | `uid` |
| `insertion_order` | `order` |
| `enabled` | `!disable` |
| `extensions.position` | `position` |
| `extensions.exclude_recursion` | `excludeRecursion` |
| `extensions.prevent_recursion` | `preventRecursion` |
| `extensions.delay_until_recursion` | `delayUntilRecursion` |
| `extensions.display_index` | `displayIndex` |
| `extensions.selectiveLogic` | `selectiveLogic` |
| `extensions.outlet_name` | `outletName` |
| `extensions.group_override` | `groupOverride` |
| `extensions.group_weight` | `groupWeight` |
| `extensions.scan_depth` | `scanDepth` |
| `extensions.case_sensitive` | `caseSensitive` |
| `extensions.match_whole_words` | `matchWholeWords` |
| `extensions.use_group_scoring` | `useGroupScoring` |
| `extensions.automation_id` | `automationId` |
| `extensions.match_*` | `match*` (snake→camel) |
| `extensions.ignore_budget` | `ignoreBudget` |
