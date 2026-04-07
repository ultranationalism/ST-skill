/**
 * 双源 AI 调用。
 * 支持 TavernHelper (parent) 和自定义 OpenAI 兼容端点。
 * 自动管理对话历史、json_schema / tools 透传。
 *
 * @param {string} prompt - 用户提示
 * @param {object} opts
 * @param {object} opts.config - createConfig() 返回的配置（需要 .data）
 * @param {object} opts.history - createHistory() 返回的历史管理器
 * @param {'generate'|'generateRaw'} [opts.mode='generateRaw'] - TavernHelper 调用模式
 * @param {object} [opts.overrides] - generate() 模式的 overrides（覆盖预设槽位）
 * @param {object} [opts.json_schema] - JSON Schema 结构化输出
 * @param {object[]} [opts.tools] - Function calling tools
 * @param {string} [opts.tool_choice] - Tool choice
 * @param {boolean} [opts.resetHistory] - 是否在调用前清空历史
 * @param {boolean} [opts.stream] - 是否流式（仅 TavernHelper）
 * @param {AbortSignal} [opts.signal] - 中断信号（仅自定义端点）
 * @returns {Promise<string>} AI 回复文本
 */
export async function callAI(prompt, opts) {
  const { config, history, json_schema, tools, tool_choice, resetHistory, stream, signal,
          mode = 'generateRaw', overrides } = opts;
  const cfg = config.data;

  if (resetHistory) {
    history.reset();
  }
  history.push('user', prompt);

  let result;

  if (cfg.apiSource === 'parent') {
    try {
      const useGenerate = mode === 'generate';
      const params = {
        user_input: useGenerate ? prompt : undefined,
        should_stream: stream || false,
        max_chat_history: 0,
      };

      if (useGenerate) {
        // generate() 模式：走 ST 预设，用 overrides 注入自管历史
        const historyPrompts = history.toPrompts();
        // 去掉最后一条 user（已经通过 user_input 传入）
        const chatHistory = historyPrompts.slice(0, -1);
        if (chatHistory.length > 0) {
          params.overrides = {
            ...overrides,
            chat_history: {
              prompts: chatHistory,
              with_depth_entries: true,
              ...(overrides?.chat_history),
            },
          };
        } else if (overrides) {
          params.overrides = overrides;
        }
      } else {
        // generateRaw() 模式：完全自控上下文
        params.ordered_prompts = history.toPrompts();
      }

      if (json_schema) params.json_schema = json_schema;
      if (tools) {
        params.tools = tools;
        params.tool_choice = tool_choice || 'auto';
      }

      const raw = await window.parent.TavernHelper[useGenerate ? 'generate' : 'generateRaw'](params);

      if (typeof raw === 'string') {
        result = raw;
      } else if (raw && typeof raw === 'object') {
        // tool_calls 场景直接返回整个对象的 JSON
        if (raw.tool_calls) {
          result = JSON.stringify(raw);
        } else {
          result = raw.content || JSON.stringify(raw);
        }
      } else {
        result = String(raw);
      }
    } catch (e) {
      history.pop();
      throw e;
    }
  } else {
    const body = {
      model: cfg.apiModel,
      messages: history.toPrompts(),
      temperature: cfg.temperature,
    };

    if (json_schema) {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: json_schema.name,
          strict: json_schema.strict,
          schema: json_schema.value,
        },
      };
    }
    if (tools) {
      body.tools = tools;
      body.tool_choice = tool_choice || 'auto';
    }

    const res = await fetch(cfg.apiUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      history.pop();
      throw new Error(`API ${res.status}: ${await res.text().catch(() => '')}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice) {
      history.pop();
      throw new Error('API 返回了空的 choices');
    }

    if (choice.message.tool_calls) {
      result = JSON.stringify(choice.message);
    } else {
      result = choice.message.content || '';
    }
  }

  history.push('assistant', result);
  return result;
}
