/**
 * 对话历史管理。
 * 维护 {role, content}[] 数组，提供 push / reset / toPrompts。
 */
export function createHistory() {
  let messages = [];

  return {
    /** 追加一条消息 */
    push(role, content) {
      messages.push({ role, content });
    },

    /** 清空历史 */
    reset() {
      messages = [];
    },

    /** 返回 ordered_prompts 格式的副本 */
    toPrompts() {
      return messages.map(m => ({ role: m.role, content: m.content }));
    },

    /** 移除最后一条（用于失败回滚） */
    pop() {
      return messages.pop();
    },

    /** 当前消息数 */
    get length() {
      return messages.length;
    },

    /** 导出为可序列化数组 */
    export() {
      return messages.map(m => ({ role: m.role, content: m.content }));
    },

    /** 从数组恢复（覆盖当前历史） */
    import(arr) {
      messages = (arr || []).map(m => ({ role: m.role, content: m.content }));
    },
  };
}
