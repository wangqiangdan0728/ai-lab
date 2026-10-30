/**
 * Day 13 · complete() —— 带超时 + 重试的通用调用函数
 *
 * 独立成模块：chat.mjs（CLI）和 test-timeout.mjs（测试）都能复用。
 * 多了一个 apiUrl 参数 —— 测试时可以指向本地假服务器。
 */
export const API_URL = 'https://api.deepseek.com/chat/completions';
export const MODEL = 'deepseek-flash';

// 可用环境变量覆盖，方便验证超时（不用改代码）：
//   DS_TIMEOUT_MS=100 node scripts/chat.mjs
export const DEFAULT_TIMEOUT_MS = Number(process.env.DS_TIMEOUT_MS ?? 30_000);
export const DEFAULT_MAX_RETRIES = Number(process.env.DS_MAX_RETRIES ?? 3);


export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function complete(
  messages,
  {
    model = MODEL,
    thinking = { type: 'disabled' },
    maxRetries = DEFAULT_MAX_RETRIES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    apiUrl = API_URL,
  } = {},
) {
  const API_KEY = process.env.DEEPSEEK_API_KEY;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ model, messages, thinking, stream: false }),
        signal: controller.signal, // ← 超时信号
      });

      // fetch 对 500 不抛错！必须主动检查 res.ok
      if (!res.ok) {
        const text = await res.text();
        const err = new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
        // 401/402/4xx = 重试也没用；429/5xx = 值得重试
        err.retryable = [429, 500, 502, 503, 504].includes(res.status);
        throw err;
      }

      return await res.json(); // 成功，直接出函数
    } catch (err) {
      lastError = err;
      const isTimeout = err.name === 'AbortError';

      // 只重试「可能自己好起来」的错误：
      //   超时(AbortError) / 网络失败(TypeError: fetch failed) / 429、5xx
      // 代码写错、401 这类一律不重试
      const isRetryable =
        isTimeout ||
        err.retryable === true ||
        (err instanceof TypeError && /fetch failed/i.test(err.message));

      if (attempt === maxRetries || !isRetryable) break;

      const delayMs = attempt * 1000; // 退避：1s、2s、3s
      console.log(
        `   ⚠️ 第 ${attempt} 次失败（${isTimeout ? '超时' : err.message}），${delayMs / 1000}s 后重试…`,
      );
      await sleep(delayMs);
    } finally {
      clearTimeout(timer); // ← 别忘，否则定时器泄漏
    }
  }

  throw lastError;
}
