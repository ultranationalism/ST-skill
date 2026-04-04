#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// ── V2 Spec 默认值 ──

const ENTRY_DEFAULTS = {
  keys: [],
  secondary_keys: [],
  comment: '',
  content: '',
  constant: false,
  selective: false,
  insertion_order: 100,
  enabled: true,
  position: 'before_char',
  use_regex: true,
  extensions: {
    position: 0,
    exclude_recursion: false,
    prevent_recursion: false,
    delay_until_recursion: false,
    display_index: 0,
    probability: 100,
    useProbability: true,
    depth: 4,
    selectiveLogic: 0,
    outlet_name: '',
    group: '',
    group_override: false,
    group_weight: 100,
    scan_depth: null,
    case_sensitive: null,
    match_whole_words: null,
    use_group_scoring: false,
    automation_id: '',
    role: 0,
    vectorized: false,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    match_persona_description: false,
    match_character_description: false,
    match_character_personality: false,
    match_character_depth_prompt: false,
    match_scenario: false,
    match_creator_notes: false,
    triggers: [],
    ignore_budget: false,
  },
};

// ── 工具函数 ──

function resolveDir(lorebookDir) {
  const resolved = path.resolve(lorebookDir);
  if (!fs.existsSync(resolved)) {
    throw new Error(`目录不存在: ${resolved}`);
  }
  return resolved;
}

function listFiles(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
}

function readEntry(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function writeEntry(filepath, entry) {
  fs.writeFileSync(filepath, JSON.stringify(entry, null, 2) + '\n', 'utf8');
}

function sanitizeFilename(comment) {
  return comment.replace(/[📌📎🔖]/g, '').trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
}

function getNextId(dir) {
  const files = listFiles(dir);
  let maxId = -1;
  for (const f of files) {
    try {
      const e = readEntry(path.join(dir, f));
      if (typeof e.id === 'number' && e.id > maxId) maxId = e.id;
    } catch { /* skip */ }
  }
  return maxId + 1;
}

function buildEntry(params, id) {
  const ext = { ...ENTRY_DEFAULTS.extensions };

  // extensions 字段覆盖
  if (params.ext_position !== undefined) ext.position = params.ext_position;
  if (params.depth !== undefined) ext.depth = params.depth;
  if (params.role !== undefined) ext.role = params.role;
  if (params.probability !== undefined) ext.probability = params.probability;
  if (params.exclude_recursion !== undefined) ext.exclude_recursion = params.exclude_recursion;
  if (params.prevent_recursion !== undefined) ext.prevent_recursion = params.prevent_recursion;
  if (params.selectiveLogic !== undefined) ext.selectiveLogic = params.selectiveLogic;
  if (params.group !== undefined) ext.group = params.group;
  if (params.group_weight !== undefined) ext.group_weight = params.group_weight;
  if (params.group_override !== undefined) ext.group_override = params.group_override;
  if (params.scan_depth !== undefined) ext.scan_depth = params.scan_depth;
  if (params.case_sensitive !== undefined) ext.case_sensitive = params.case_sensitive;
  if (params.match_whole_words !== undefined) ext.match_whole_words = params.match_whole_words;
  if (params.use_group_scoring !== undefined) ext.use_group_scoring = params.use_group_scoring;
  if (params.sticky !== undefined) ext.sticky = params.sticky;
  if (params.cooldown !== undefined) ext.cooldown = params.cooldown;
  if (params.delay !== undefined) ext.delay = params.delay;
  if (params.vectorized !== undefined) ext.vectorized = params.vectorized;
  if (params.ignore_budget !== undefined) ext.ignore_budget = params.ignore_budget;
  if (params.automation_id !== undefined) ext.automation_id = params.automation_id;
  if (params.outlet_name !== undefined) ext.outlet_name = params.outlet_name;
  if (params.triggers !== undefined) ext.triggers = params.triggers;
  // match_* fields
  if (params.match_persona_description !== undefined) ext.match_persona_description = params.match_persona_description;
  if (params.match_character_description !== undefined) ext.match_character_description = params.match_character_description;
  if (params.match_character_personality !== undefined) ext.match_character_personality = params.match_character_personality;
  if (params.match_character_depth_prompt !== undefined) ext.match_character_depth_prompt = params.match_character_depth_prompt;
  if (params.match_scenario !== undefined) ext.match_scenario = params.match_scenario;
  if (params.match_creator_notes !== undefined) ext.match_creator_notes = params.match_creator_notes;

  ext.display_index = id;

  return {
    id,
    keys: params.keys ?? ENTRY_DEFAULTS.keys,
    secondary_keys: params.secondary_keys ?? ENTRY_DEFAULTS.secondary_keys,
    comment: params.comment,
    content: params.content,
    constant: params.constant ?? ENTRY_DEFAULTS.constant,
    selective: params.selective ?? ENTRY_DEFAULTS.selective,
    insertion_order: params.insertion_order ?? ENTRY_DEFAULTS.insertion_order,
    enabled: params.enabled ?? ENTRY_DEFAULTS.enabled,
    position: params.position ?? ENTRY_DEFAULTS.position,
    use_regex: params.use_regex ?? ENTRY_DEFAULTS.use_regex,
    extensions: ext,
  };
}

// ── extensions 参数 schema（共用） ──

const EXT_PARAMS = {
  ext_position: z.number().int().min(0).max(6).optional()
    .describe('注入位置: 0=before_char, 1=after_char, 2=before_example, 3=after_example, 4=@Depth, 5=before_author_note, 6=after_author_note'),
  depth: z.number().int().min(0).optional()
    .describe('@Depth 深度值（position=4 时生效）'),
  role: z.number().int().min(0).max(2).optional()
    .describe('@Depth 角色: 0=system, 1=user, 2=assistant'),
  probability: z.number().min(0).max(100).optional()
    .describe('激活概率百分比'),
  exclude_recursion: z.boolean().optional()
    .describe('不扫描此条目触发其他条目'),
  prevent_recursion: z.boolean().optional()
    .describe('阻止被递归触发'),
  selectiveLogic: z.number().int().min(0).max(3).optional()
    .describe('二级关键词逻辑: 0=AND_ANY, 1=NOT_ALL, 2=NOT_ANY, 3=AND_ALL'),
  group: z.string().optional()
    .describe('分组名'),
  group_weight: z.number().optional()
    .describe('组内权重'),
  group_override: z.boolean().optional()
    .describe('优先使用组内评分'),
  scan_depth: z.number().nullable().optional()
    .describe('覆盖扫描深度 (null=跟随全局)'),
  case_sensitive: z.boolean().nullable().optional()
    .describe('覆盖大小写敏感 (null=跟随全局)'),
  match_whole_words: z.boolean().nullable().optional()
    .describe('覆盖全词匹配 (null=跟随全局)'),
  use_group_scoring: z.boolean().nullable().optional()
    .describe('覆盖组评分 (null=跟随全局)'),
  sticky: z.number().int().optional()
    .describe('触发后持续激活消息数'),
  cooldown: z.number().int().optional()
    .describe('触发后冷却消息数'),
  delay: z.number().int().optional()
    .describe('首次触发前延迟消息数'),
  vectorized: z.boolean().optional()
    .describe('使用向量搜索'),
  ignore_budget: z.boolean().optional()
    .describe('无视 token 预算'),
  automation_id: z.string().optional()
    .describe('斜杠命令自动化 ID'),
  outlet_name: z.string().optional()
    .describe('命名输出口'),
  triggers: z.array(z.string()).optional()
    .describe('生成类型触发器'),
  match_persona_description: z.boolean().optional(),
  match_character_description: z.boolean().optional(),
  match_character_personality: z.boolean().optional(),
  match_character_depth_prompt: z.boolean().optional(),
  match_scenario: z.boolean().optional(),
  match_creator_notes: z.boolean().optional(),
};

// ── MCP Server ──

const server = new McpServer({
  name: 'lorebook-editor',
  version: '1.0.0',
});

// ── create_entry ──

server.tool(
  'create_entry',
  '创建新的世界书条目（V2 Spec 格式，自动填充默认值）',
  {
    lorebook_dir: z.string().describe('lorebook 目录的绝对路径'),
    comment: z.string().describe('条目名称/标签'),
    content: z.string().describe('条目内容文本'),
    keys: z.array(z.string()).optional().describe('主关键词列表（constant=true 时可为空）'),
    secondary_keys: z.array(z.string()).optional().describe('二级关键词'),
    constant: z.boolean().optional().describe('常驻条目（始终注入，无视关键词）'),
    selective: z.boolean().optional().describe('启用二级关键词过滤'),
    insertion_order: z.number().int().optional().describe('注入优先级（越大越优先）'),
    enabled: z.boolean().optional().describe('是否启用'),
    position: z.string().optional().describe('旧版位置标记: before_char / after_char'),
    use_regex: z.boolean().optional().describe('关键词是否使用正则'),
    ...EXT_PARAMS,
  },
  async (params) => {
    const dir = resolveDir(params.lorebook_dir);
    const id = getNextId(dir);
    const entry = buildEntry(params, id);
    const filename = sanitizeFilename(params.comment) + '.json';
    const filepath = path.join(dir, filename);
    if (fs.existsSync(filepath)) throw new Error(`文件已存在: ${filename}`);
    writeEntry(filepath, entry);
    return { content: [{ type: 'text', text: `已创建: ${filename} (id=${id})\n${JSON.stringify(entry, null, 2)}` }] };
  },
);

// ── update_entry ──

server.tool(
  'update_entry',
  '更新已有条目的指定字段（只传需要修改的字段）',
  {
    lorebook_dir: z.string().describe('lorebook 目录的绝对路径'),
    filename: z.string().describe('条目文件名'),
    comment: z.string().optional().describe('条目名称'),
    content: z.string().optional().describe('条目内容'),
    keys: z.array(z.string()).optional().describe('主关键词'),
    secondary_keys: z.array(z.string()).optional().describe('二级关键词'),
    constant: z.boolean().optional(),
    selective: z.boolean().optional(),
    insertion_order: z.number().int().optional(),
    enabled: z.boolean().optional(),
    position: z.string().optional(),
    use_regex: z.boolean().optional(),
    ...EXT_PARAMS,
  },
  async (params) => {
    const dir = resolveDir(params.lorebook_dir);
    const filepath = path.join(dir, params.filename);
    if (!fs.existsSync(filepath)) throw new Error(`文件不存在: ${params.filename}`);
    const entry = readEntry(filepath);

    // 顶层字段
    if (params.comment !== undefined) entry.comment = params.comment;
    if (params.content !== undefined) entry.content = params.content;
    if (params.keys !== undefined) entry.keys = params.keys;
    if (params.secondary_keys !== undefined) entry.secondary_keys = params.secondary_keys;
    if (params.constant !== undefined) entry.constant = params.constant;
    if (params.selective !== undefined) entry.selective = params.selective;
    if (params.insertion_order !== undefined) entry.insertion_order = params.insertion_order;
    if (params.enabled !== undefined) entry.enabled = params.enabled;
    if (params.position !== undefined) entry.position = params.position;
    if (params.use_regex !== undefined) entry.use_regex = params.use_regex;

    // extensions
    if (!entry.extensions) entry.extensions = { ...ENTRY_DEFAULTS.extensions };
    const ext = entry.extensions;
    if (params.ext_position !== undefined) ext.position = params.ext_position;
    if (params.depth !== undefined) ext.depth = params.depth;
    if (params.role !== undefined) ext.role = params.role;
    if (params.probability !== undefined) ext.probability = params.probability;
    if (params.exclude_recursion !== undefined) ext.exclude_recursion = params.exclude_recursion;
    if (params.prevent_recursion !== undefined) ext.prevent_recursion = params.prevent_recursion;
    if (params.selectiveLogic !== undefined) ext.selectiveLogic = params.selectiveLogic;
    if (params.group !== undefined) ext.group = params.group;
    if (params.group_weight !== undefined) ext.group_weight = params.group_weight;
    if (params.group_override !== undefined) ext.group_override = params.group_override;
    if (params.scan_depth !== undefined) ext.scan_depth = params.scan_depth;
    if (params.case_sensitive !== undefined) ext.case_sensitive = params.case_sensitive;
    if (params.match_whole_words !== undefined) ext.match_whole_words = params.match_whole_words;
    if (params.use_group_scoring !== undefined) ext.use_group_scoring = params.use_group_scoring;
    if (params.sticky !== undefined) ext.sticky = params.sticky;
    if (params.cooldown !== undefined) ext.cooldown = params.cooldown;
    if (params.delay !== undefined) ext.delay = params.delay;
    if (params.vectorized !== undefined) ext.vectorized = params.vectorized;
    if (params.ignore_budget !== undefined) ext.ignore_budget = params.ignore_budget;
    if (params.automation_id !== undefined) ext.automation_id = params.automation_id;
    if (params.outlet_name !== undefined) ext.outlet_name = params.outlet_name;
    if (params.triggers !== undefined) ext.triggers = params.triggers;
    if (params.match_persona_description !== undefined) ext.match_persona_description = params.match_persona_description;
    if (params.match_character_description !== undefined) ext.match_character_description = params.match_character_description;
    if (params.match_character_personality !== undefined) ext.match_character_personality = params.match_character_personality;
    if (params.match_character_depth_prompt !== undefined) ext.match_character_depth_prompt = params.match_character_depth_prompt;
    if (params.match_scenario !== undefined) ext.match_scenario = params.match_scenario;
    if (params.match_creator_notes !== undefined) ext.match_creator_notes = params.match_creator_notes;

    writeEntry(filepath, entry);

    // 如果 comment 变了，重命名文件
    if (params.comment !== undefined && params.comment !== entry.comment) {
      const newFilename = sanitizeFilename(params.comment) + '.json';
      const newPath = path.join(dir, newFilename);
      if (!fs.existsSync(newPath)) {
        fs.renameSync(filepath, newPath);
        return { content: [{ type: 'text', text: `已更新并重命名: ${params.filename} → ${newFilename}` }] };
      }
    }

    return { content: [{ type: 'text', text: `已更新: ${params.filename}\n${JSON.stringify(entry, null, 2)}` }] };
  },
);

// ── delete_entry ──

server.tool(
  'delete_entry',
  '删除指定条目',
  {
    lorebook_dir: z.string().describe('lorebook 目录的绝对路径'),
    filename: z.string().describe('要删除的条目文件名'),
  },
  async ({ lorebook_dir, filename }) => {
    const filepath = path.join(resolveDir(lorebook_dir), filename);
    if (!fs.existsSync(filepath)) throw new Error(`文件不存在: ${filename}`);
    const entry = readEntry(filepath);
    fs.unlinkSync(filepath);
    return { content: [{ type: 'text', text: `已删除: ${filename} (id=${entry.id}, comment="${entry.comment}")` }] };
  },
);

// ── 启动 ──

const transport = new StdioServerTransport();
await server.connect(transport);
