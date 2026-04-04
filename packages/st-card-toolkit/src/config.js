/**
 * API 配置管理。
 * 统一的双源（TavernHelper / 自定义端点）配置结构 + localStorage 持久化。
 */

const CONFIG_DEFAULTS = {
  apiSource: 'parent',  // 'parent' | 'custom'
  apiUrl: '',
  apiKey: '',
  apiModel: '',
  temperature: 0.9,
};

/**
 * 创建配置实例。
 * @param {string} storageKey - localStorage 的 key
 * @param {object} [overrides] - 覆盖默认值
 * @returns {{ data: object, save(): void, load(): void }}
 */
export function createConfig(storageKey, overrides) {
  const data = { ...CONFIG_DEFAULTS, ...overrides };

  // 从 localStorage 恢复
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) Object.assign(data, JSON.parse(saved));
  } catch { /* ignore */ }

  return {
    data,
    save() {
      localStorage.setItem(storageKey, JSON.stringify(data));
    },
    load() {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) Object.assign(data, JSON.parse(saved));
      } catch { /* ignore */ }
    },
  };
}
