/**
 * AI 响应解析工具。
 * 处理 JSON 提取、markdown code block 剥离、fallback。
 */

/**
 * 从 AI 回复中提取 JSON 对象。
 * 处理 ```json ... ``` 包裹、直接 JSON 字符串、parse 失败 fallback。
 *
 * @param {string} raw - AI 原始回复文本
 * @returns {{ data: object|null, text: string }} data=解析后对象, text=原始文本(fallback)
 */
export function parseJson(raw) {
  let str = (raw || '').trim();

  // 剥离 markdown code block
  const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    str = codeBlockMatch[1];
  }

  try {
    return { data: JSON.parse(str), text: str };
  } catch (e) {
    console.warn('[parseJson] JSON.parse failed:', e.message, '\nFirst 200 chars:', str.slice(0, 200));
    return { data: null, text: str };
  }
}

/**
 * 从 JSON 对象中提取指定字段作为主文本，剩余字段作为结构化数据。
 * 适用于 narrative + status 混合输出的典型模式。
 *
 * @param {string} raw - AI 原始回复文本
 * @param {string} [textField='narrative'] - 作为主文本的字段名
 * @returns {{ text: string, data: object|null }}
 */
export function parseNarrativeAndData(raw, textField = 'narrative') {
  const { data, text } = parseJson(raw);

  if (!data) {
    // JSON 解析失败，整体作为文本
    return { text, data: null };
  }

  const mainText = (data[textField] || '').trim();
  const rest = { ...data };
  delete rest[textField];

  return {
    text: mainText || text,
    data: Object.keys(rest).length > 0 ? rest : null,
  };
}
