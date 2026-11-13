/**
 * Day 22 · buildMessages —— 把 system / few-shot 示例 / 真问题
 * 拼成模型要的 messages 数组。
 */
export function buildMessages({ system, examples = [], user }) {
  const messages = [];

  // ① system 放最前面（可以没有 —— 对照组 A 就是空）
  if (system) {
    messages.push({ role: 'system', content: system });
  }

  // ② 示例：每条示例 = 一问一答两条消息
  for (const [q, a] of examples) {
    messages.push({ role: 'user', content: q });
    messages.push({ role: 'assistant', content: a });
  }

  // ③ 真正的问题永远放最后
  messages.push({ role: 'user', content: user });

  return messages;
}
