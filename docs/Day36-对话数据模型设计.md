# Day 36 · 对话数据模型设计（Conversation / Message）

> 今天不装数据库、不写代码。只做一件事：把"内存里的一个 messages 数组"变成两张表，
> 并且能说清每个字段为什么在、为什么不在。
> 产出：`docs/Day36-对话数据模型设计.md`（本文件）——W6 后面 4 天都照它写。

---

## 0. 先定读取场景，再定表

表结构不是"想存什么"，是"谁以什么频率来读什么"。

| 谁 | 要什么 | 频率 |
|---|---|---|
| 聊天页 | 某个会话的消息，按时间正序 | 高 |
| 侧边栏 | 所有会话的 id / 标题 / 最后更新时间 / 条数，按更新时间倒序 | 每次进页面 |
| 发消息 | 追加一条 message + 刷新 conversation.updated_at | 每轮 |
| 以后统计 | 某个会话 / 某段时间的 token 花费 | 偶尔 |

结论：**写永远是"追加一条"，读永远是"按会话切一段"**。
这个形状决定了表结构——日志型数据，不是文档型数据。

---

## 1. 为什么不用一个大 JSON（三个机制，各自都能独立打死它）

| # | 机制 | 一个大 JSON 会怎样 |
|---|---|---|
| 1 | **写放大 + 丢更新** | 每来一条消息要 `UPDATE` 整行；行越大越慢。两个标签页同时发 → 后写覆盖前写（读-改-写没有事务保护） |
| 2 | **读放大** | 只是想画侧边栏的"标题 + 最后时间"，却必须把整段几十万 token 的对话读出来再解析 |
| 3 | **改一条要重写全部** | 编辑重发 / 重新生成 / 删一条，都改中间某条 → JSON 得整串重写，还可能盖掉别人刚写的 |

一句话记：**JSON 存的是"快照"，聊天需要的是"日志"。日志只追加，不改前面。**
（token 计费表、埋点日志也都是 append-only，同一个道理。）

还有一条软理由：**schema 是给未来的自己看的**。字段写进表里，漏了会被数据库当场报错；
塞进 JSON，漏了就静默为 `undefined`，等三个月后发现。

---

## 2. 表结构（Postgres 语法，Day 37 直接翻译成 Prisma）

### conversation

```sql
CREATE TABLE conversation (
  id             TEXT PRIMARY KEY,                       -- cuid/nanoid，不用自增
  title          TEXT NOT NULL DEFAULT '新对话',
  model          TEXT NOT NULL,                          -- 'deepseek-flash'
  system_prompt  TEXT,                                   -- 现在的"你是一个简洁的中文助手…"
  -- 会话级默认采样参数，NULL = 用模型默认值
  temperature    DOUBLE PRECISION,
  top_p          DOUBLE PRECISION,
  thinking       BOOLEAN NOT NULL DEFAULT false,         -- 现在 route.ts 里是 disabled
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX conversation_updated_at_idx ON conversation (updated_at DESC);
```

### message

```sql
CREATE TABLE message (
  id                TEXT PRIMARY KEY,
  conversation_id   TEXT NOT NULL
                      REFERENCES conversation(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content           TEXT NOT NULL,                       -- 原始 markdown 文本，不是 HTML
  -- 只有 assistant 行有值（user 行全 NULL）
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  cache_read_tokens INTEGER,                             -- usage.inputTokenDetails.cacheReadTokens
  finish_reason     TEXT,                                -- 'stop' | 'length' | 'aborted'
  -- 这条消息"当时"用的参数快照，可复现
  temperature       DOUBLE PRECISION,
  thinking          BOOLEAN,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX message_conv_created_idx ON message (conversation_id, created_at);
```

---

## 3. 三个字段取舍（面试会问，自己写也会问）

| 决定 | 为什么 |
|---|---|
| **id 用字符串，不用自增 int** | 前端要在写库**之前**就拿到 id（流式占位、乐观更新）。自增 id 必须等数据库返回才知道 |
| **usage 存 message 上，不存 conversation 上** | "这条回答花了多少 token"是这条消息的属性；会话总额是 `SUM()`，别提前冗余（冗余就会不一致） |
| **参数存两处：会话级默认 + 消息级快照** | 改默认值不能改写历史。三个月后回看，只能靠快照解释"这条为什么这么长 / 这么随机" |
| **content 存原文，不存渲染后的 HTML** | 渲染层会变（shiki / react-markdown 换版本、换主题）。数据不该被渲染实现绑架 |
| **ON DELETE CASCADE** | 删会话自动清消息，不留孤儿行 |

### 采样参数到底存哪 —— 一条判据

> **参数属于"谁的行为"，就存在谁身上。**

- 属于**会话**（这个会话从头到尾一个设定）：`model` / `system_prompt` / `thinking` / 默认 temperature
- 属于**这一次调用**：这一次真实的 temperature、这一次的 usage
- 所以：**conversation 存默认值，message 存快照；读的时候快照优先，没快照用默认值。**

---

## 4. 和现有代码怎么对上（今天只看，不改）

| 现在 | 落库后 |
|---|---|
| `app/chat/page.tsx` 里的 `messages: UIMessage[]` | 每条 = 一行 message，用 `role` + `content` 两列就能还原 |
| `app/api/chat/route.ts` 的 `onFinish({ usage })` | 就是写 `input_tokens / output_tokens / cache_read_tokens` 三列的地方 |
| `thinking: { type: 'disabled' }` 写死在 route 里 | 变成 `conversation.thinking` 字段，一条会话一个设定 |

**留给 Day 39 的真问题**（今天只记下来，别现在解决）：
流式生成到一半的消息怎么落库？
A. 先 INSERT 一条空 content 的 assistant 行，流完 `UPDATE` 补内容 → 中断了也有半个回复，但要一个 `status` 字段区分。
B. 流完再一次性 INSERT → 简单，但用户中途关了页面，这条回复就丢了（钱已经花了）。

---

## 5. 验收自检（合上文件，用嘴说出来）

1. 侧边栏要「标题 + 最后消息时间」，这个模型**只用** conversation 表能不能画出来？
2. 同一个会话开两个标签页同时发消息，用两张表会丢吗？用大 JSON 为什么会丢？
3. `thinking` 为什么存两处？只存 conversation 上，错在哪？
4. 表里有 10 万条消息，取某会话最近 20 条，走哪个索引？

四题都能答上 → 今天的活干完了。
