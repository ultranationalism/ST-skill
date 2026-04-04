/**
 * 通用 DOM 工具。
 */

/** HTML 转义 */
export function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

/** 纯文本 → 安全 HTML（换行转 <br>） */
export function formatText(text) {
  return escHtml(text).replace(/\n/g, '<br>');
}

/**
 * 向消息区域追加一条消息。
 *
 * @param {string|HTMLElement} container - 容器元素或其 ID
 * @param {'narrator'|'user'|'system'} type - 消息类型
 * @param {string} content - 内容（narrator/user 会转义，system 允许 HTML）
 */
export function addMessage(container, type, content) {
  const area = typeof container === 'string' ? document.getElementById(container) : container;
  if (!area) return;

  const div = document.createElement('div');
  div.className = 'msg msg-' + type;

  if (type === 'narrator') {
    div.innerHTML = '<div class="msg-narrator">' + formatText(content) + '</div>';
  } else if (type === 'user') {
    div.innerHTML = '<div class="msg-bubble">' + escHtml(content) + '</div>';
  } else {
    div.innerHTML = '<i class="fa-solid fa-info-circle"></i> ' + content;
  }

  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

/**
 * 显示加载指示器。
 *
 * @param {string|HTMLElement} container - 容器元素或其 ID
 * @param {string} [text='生成中...'] - 加载提示文本
 * @param {string} [loadingId='loadingMsg'] - 加载元素的 ID
 */
export function showLoading(container, text, loadingId) {
  const area = typeof container === 'string' ? document.getElementById(container) : container;
  if (!area) return;

  const id = loadingId || 'loadingMsg';
  // 避免重复
  if (document.getElementById(id)) return;

  const div = document.createElement('div');
  div.className = 'loading-indicator';
  div.id = id;
  div.innerHTML = '<div class="dots"><span></span><span></span><span></span></div> ' + (text || '生成中...');
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

/**
 * 移除加载指示器。
 *
 * @param {string} [loadingId='loadingMsg'] - 加载元素的 ID
 */
export function hideLoading(loadingId) {
  const el = document.getElementById(loadingId || 'loadingMsg');
  if (el) el.remove();
}
