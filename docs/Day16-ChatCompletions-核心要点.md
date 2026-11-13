# Day 16 · DeepSeek Chat Completions API 核心要点

> 来源：[官方文档 create-chat-completion](https://api-docs.deepseek.com/zh-cn/api/create-chat-completion)（2026-10 抓取）
> 只留**会实际用到**的部分，砍掉 tool_calls、logprobs 这类 W3 还用不上的细节。

---

## 一、一句话定位

```
POST /chat/completions
给模型一段对话（messages），让它补全下一条消息。
```

**这一个接口，就是所有 LLM 应用的地基。** 你后面做的聊天、RAG、Agent，全是在它上面加东西。

---

## 二、请求参数

### 必填

| 参数 | 说明 |
|---|---|
| `model` | `deepseek-flash` 或 `deepseek-v4-pro` |
| `messages` | 数组，**至少 1 条** |

**messages 里的 role 只有四种**：`system` / `user` / `assistant` / `tool`

```js
{ role: 'system',    content: '规则', name?: '可选区分同名参与者' }
{ role: 'user',      content: '问题' }
{ role: 'assistant', content: '历史回复' }
{ role: 'tool',      content: '工具结果' }
```

### 你 W3 会高频用的

| 参数 | 取值 | 默认 | 注意 |
|---|---|---|---|
| `stream` | boolean | false | `true` → SSE，以 `data: [DONE]` 结尾 |
| `stream_options` | `{ include_usage: true }` | — | **必须同时 `stream: true`，否则 400** |
| `thinking` | `{ type: 'enabled' \| 'disabled' }` | ⚠️ **enabled** | 你可能忘了关 |
| `max_tokens` | 1 – 384K | 非思考 **8K** / 思考 **64K** | `reasoning_effort: max` 时 128K |
| `temperature` | 0 – 2 | 1 | **思考模式下不生效** |
| `top_p` | 0 – 1 | 1 | **只在思考模式生效**（0.95–1.0）|
| `stop` | string \| string[] | — | 最多 16 个 |
| `response_format` | `{ type: 'text' \| 'json_object' }` | text | JSON 模式仍需在 prompt 里要求输出 JSON |
| `user_id` | `[a-zA-Z0-9-_]`，≤512 | — | 用于**限速隔离 + KVCache 隔离** |
| `reasoning_effort` | `none \| low \| high \| max` | high | `none` = 关思考 |

### 🔴 已废弃，别抄老教程

| 参数 | 官方原文 |
|---|---|
| `frequency_penalty` | 该参数已不再支持，传入不产生任何效果 |
| `presence_penalty` | 同上 |

### ⚠️ 最大的两个坑

**坑 1：`thinking` 默认是 `enabled`**

```js
// 你以为在用普通模式，其实在烧 reasoning token
{ model: 'deepseek-flash', messages: [...] }          // ❌ 默认开思考

{ model: 'deepseek-flash', messages: [...],
  thinking: { type: 'disabled' } }                     // ✅ 明确关掉
```

**坑 2：`temperature` 和 `top_p` 按模式互斥**

```
非思考模式（thinking: disabled）→ temperature 有效，top_p 恒 1.0 被忽略
思考模式（thinking: enabled）  → temperature 无效，top_p 有效(0.95-1.0)
```

> 所以你现在的配置下：**只调 temperature，别碰 top_p。**

---

## 三、响应结构（非流式）

```json
{
  "id": "chat-id",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "deepseek-flash",
  "choices": [
    {
      "index": 0,
      "finish_reason": "stop",
      "message": {
        "role": "assistant",
        "content": "回复正文",
        "reasoning_content": "思考过程（仅思考模式）",
        "tool_calls": []
      }
    }
  ],
  "usage": { ... }
}
```

### `finish_reason` 的六种取值

| 值 | 含义 |
|---|---|
| `stop` | 自然结束（**正常**）|
| `length` | 撞上 max_tokens / 上下文上限（**内容被截断**）|
| `content_filter` | 触发过滤策略 |
| `tool_calls` | 模型要调工具 |
| `insufficient_system_resource` | 推理资源不足，被打断 |
| `aborted` | 生成被中断（你主动 abort 就是它） |

> ⚠️ 看到 `length` 就说明**回复没写完**——这在流式里也得检查。

### ⭐ `usage`：算钱的唯一依据

```json
"usage": {
  "prompt_tokens": 12,
  "completion_tokens": 9,
  "total_tokens": 21,
  "prompt_tokens_details": { "cached_tokens": 0 },
  "prompt_cache_hit_tokens": 0,
  "prompt_cache_miss_tokens": 12
}
```

> ⚠️ **2026-11-04 实测修正**：`prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`
> 在 **usage 顶层**，不在 `prompt_tokens_details` 里；details 里**只有** `cached_tokens`。
> 文档示例和真实响应在这里不一致，以实测为准（原始响应见 `scripts/stream-raw.mjs` 输出）。
>
> 只有开了思考模式才会出现 `completion_tokens_details.reasoning_tokens`。

| 字段 | 用途 |
|---|---|
| `prompt_tokens` | = `hit` + `miss` |
| `prompt_cache_hit_tokens` | **命中缓存的部分，便宜 50 倍**（**在 usage 顶层**，不在 details 里）|
| `prompt_cache_miss_tokens` | 全价 |
| `reasoning_tokens` | 思考模式烧掉的（**算在 output 里**）|

> **W14 讲成本优化时，你的钱就是从这里省出来的**：
> 多轮对话里前面的历史会被缓存 → `hit_tokens` 变多 → 越聊越便宜。

---

## 四、流式响应（W3 的主战场）

```
data: {"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"choices":[{"index":0,"delta":{"content":"你"},"finish_reason":null}]}

data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{...}}

data: [DONE]
```

### 四条铁律

1. 每条以 `data: ` 开头，帧间用 **`\n\n`** 分隔
2. 内容是 **`delta.content`（增量）**，要自己拼
3. 以 **`data: [DONE]`** 结尾 —— **不是 JSON，别 parse**
4. **一个 chunk 可能含 1.5 个帧** → 必须 buffer 累积

### `usage` 在哪？

- **不管传不传 `stream_options`，`[DONE]` 之前的最后一块都带 `usage`**
- 那一块：`choices` 只有 1 个元素、**无新增内容**、`finish_reason` 非 null
- 传 `include_usage: true` → 所有块都有 `usage` 字段（其余为 null）

**所以流式里要拿 usage：记下"finish_reason 非 null 那一块"的 usage。**

---

## 五、和 W3 直接相关的 5 条

```
1. stream: true + stream_options: { include_usage: true } —— 必须成对
2. 流式内容是增量 delta.content，不是全量
3. [DONE] 不是 JSON
4. 一个 chunk 可能切在 JSON 中间 / 中文字节中间
5. usage 在最后一帧，不在 [DONE] 里
```

---

## 六、英文术语（搜索用）

| 中文 | 英文 |
|---|---|
| 对话补全 | chat completion |
| 消息列表 | messages |
| 增量 | delta |
| 停止原因 | finish_reason |
| 用量 | usage |
| 思考模式 | thinking mode / reasoning |
| 上下文缓存 | context caching / KV cache |
| JSON 模式 | JSON mode |
| 工具调用 | tool calling / function calling |
| 最大输出长度 | max_tokens |
