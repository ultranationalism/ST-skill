/**
 * 设置面板通用控制器。
 * 处理 API 来源切换、表单读写、保存。
 *
 * 约定的 DOM ID：
 *   setApiSource   - <select> API 来源
 *   customApiFields - <div> 自定义端点字段容器
 *   setApiUrl      - <input> API 端点
 *   setApiKey      - <input> API Key
 *   setApiModel    - <input> 模型名
 *   setTemp        - <input> 温度
 *
 * 这些 ID 可以通过 elementIds 参数覆盖。
 */

const DEFAULT_IDS = {
  overlay: 'settingsOverlay',
  apiSource: 'setApiSource',
  customFields: 'customApiFields',
  apiUrl: 'setApiUrl',
  apiKey: 'setApiKey',
  apiModel: 'setApiModel',
  temperature: 'setTemp',
};

/**
 * 创建设置面板控制器。
 *
 * @param {object} config - createConfig() 返回的配置实例
 * @param {object} [ids] - 覆盖默认 DOM ID
 */
export function createSettingsController(config, ids) {
  const el = { ...DEFAULT_IDS, ...ids };

  function $(id) { return document.getElementById(id); }

  function onApiSourceChange() {
    const source = $(el.apiSource)?.value;
    const fields = $(el.customFields);
    if (fields) fields.style.display = source === 'custom' ? 'block' : 'none';
  }

  function open() {
    const overlay = $(el.overlay);
    if (!overlay) return;
    overlay.classList.toggle('open');
    const cfg = config.data;
    if ($(el.apiSource)) $(el.apiSource).value = cfg.apiSource;
    if ($(el.apiUrl)) $(el.apiUrl).value = cfg.apiUrl;
    if ($(el.apiKey)) $(el.apiKey).value = cfg.apiKey;
    if ($(el.apiModel)) $(el.apiModel).value = cfg.apiModel;
    if ($(el.temperature)) $(el.temperature).value = cfg.temperature;
    onApiSourceChange();
  }

  function save() {
    const cfg = config.data;
    if ($(el.apiSource)) cfg.apiSource = $(el.apiSource).value;
    if ($(el.apiUrl)) cfg.apiUrl = $(el.apiUrl).value;
    if ($(el.apiKey)) cfg.apiKey = $(el.apiKey).value;
    if ($(el.apiModel)) cfg.apiModel = $(el.apiModel).value;
    if ($(el.temperature)) cfg.temperature = parseFloat($(el.temperature).value) || 0.9;
    config.save();
  }

  return { open, save, onApiSourceChange };
}
