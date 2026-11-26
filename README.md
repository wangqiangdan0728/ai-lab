# ai-lab

> 一个 5 年前端工程师从零学 AI 应用开发的实验室 —— 不抄教程，每一行都自己跑过、错过、再修对。

**在线体验**：[https://www.wqd-ai.club/chat](https://www.wqd-ai.club/chat)（自有域名，国内可直连）
备用地址：`ai-lab-kappa-sepia.vercel.app`（`*.vercel.app` 在国内多被 DNS 污染 + SNI 阻断双层封锁，不建议发给别人）

---

## 这是什么

不是课程笔记仓库，是**一个能用的 AI 应用 + 一堆亲手做过的实验**。

- 起点：写了 5 年 Vue 2，第一次碰 React Server Components、Next.js App Router 和 LLM API。
- 目标：把「会调 API」变成「能交付一个 AI 产品」。
- 进度：阶段一 W1–W6 已完成（Next.js 核心模型 → 手写流式 → AI SDK → 交互补全 → 公网部署 → 会话持久化 + 云端数据库）。

---

## 四个能跑的东西

### ① 聊天应用 · `/chat`

流式逐字输出的完整实现，链路是三层协议：

```text
DeepSeek 原生 SSE        {"choices":[{"delta":{"content":"好"}}]}
        ↓  Route Handler 翻译
AI SDK UI 消息流         {"type":"text-delta","id":"txt-0","delta":"好"}
        ↓  useChat 归组
浏览器 message.parts     { type: "text", text: "好" }
```

交互补齐：空态 / 思考中 / 防重复提交 / 清空 / 出错重试。
布局用 Tailwind：`flex-1` 要有定高父级，`min-h-0` 才能让消息区自己滚而不是撑破整页。

### ② 手写流式客户端 · `scripts/stream.mjs`

不用任何 SDK，自己拆 SSE。三个坑全部踩过并写进了代码：

| 坑 | 解法 |
| --- | --- |
| 汉字被网络切成两半 | 字节层 `TextDecoder('utf-8', { stream: true })` |
| JSON 被切成两半 | 帧层 `buffer` 累积 + `frames.pop()` 留最后一个不完整帧 |
| `data: [DONE]` 不是 JSON | 先比字符串，再 `JSON.parse` |

`pop()` 不是性能优化，是**正确性必需**——同一份代码会因为网络切点不同，分别报 `Unexpected token 'd'` 和 `Unterminated string in JSON`。

### ③ 故障注入 · `scripts/mock-split.mjs`

本地假服务器，**故意**把「好」字的 3 个 UTF-8 字节（`E5 A5 BD`）从中间切开。

不等网络偶然出错，直接把 bug 请出来——这样修复才算验证过。

### ④ 成本实测 · `scripts/fewshot.mjs`

few-shot 到底值不值？跑 5 组对照得出的结论：

- `system` 不省钱，但能把输出方差收窄：不带 system 时输出在 29–51 token 之间跳，带了之后只波动 ±8%；
- 示例从 1 个加到 3 个，输入成本涨 12 个 token，输出只省 1 个——**净亏 11 个**；
- `temperature` 是唯一免费的质量杠杆；
- `temperature: 0` 高度稳定，但**不保证逐字一致**。

---

## 目录结构

```text
app/
  chat/page.tsx            服务端壳：await connection() 读历史 → 当 props 传给客户端
  chat/chat-client.tsx     客户端：useChat + 流式渲染 + 编辑重发 / 清空 / 复制
  chat/actions.ts          Server Actions：新建会话 / 清空 / 编辑后截断
  api/chat/route.ts        流式 Route Handler（streamText + 落库）
  posts/                   Server Component + Server Action + 数据获取
  lab/                     嵌套 layout 实验（layout 是否重渲染）
  compare/client/          "use client" 边界对照
  compare/server/          Server Component 对照
  blog/                    静态页面
lib/prisma.ts              Prisma client 单例（PrismaPg adapter + globalThis 防热更新堆连接）
prisma/schema.prisma       Conversation / Message 两张表
prisma/migrations/         迁移 SQL（进 git；数据库文件不进）
lib/posts.ts               模块级数据源（用来验证 revalidatePath 的必要性）
scripts/                   8 个命令行实验（见上）
docs/                      协议与原理笔记
deepseek_v4_tokenizer/     离线 tokenizer（本地算 token，不联网）
```

---

## 技术栈

- **Next.js 16.4.2** — App Router / React Server Components / Route Handlers / `cacheComponents`
- **React 19.3** · **TypeScript 5** · **Tailwind CSS 4**
- **Vercel AI SDK 7** — `ai` / `@ai-sdk/deepseek` / `@ai-sdk/react`
- **DeepSeek `deepseek-flash`** — OpenAI 兼容接口，关闭 thinking 模式省 token
- **Prisma 7.10.1** + `@prisma/adapter-pg` — 7.x 必须显式给 driver adapter（引擎已从 Rust 二进制改成 WASM）
- **Supabase Postgres** — 用 Session pooler 连接串（Direct connection 现在只解析 IPv6，国内多数网络连不上）

---

## 本地运行

```bash
nvm use 22                                  # .nvmrc 已写明；Node 16 跑 Prisma 7 会直接 WASM 编译失败
pnpm install                                # postinstall 会自动跑 prisma generate
echo 'DEEPSEEK_API_KEY=sk-...' > .env
echo 'DATABASE_URL="postgresql://..."' >> .env
pnpm exec prisma migrate dev                # 建表
pnpm dev                                    # http://localhost:3000
```

两个变量都只在服务端读取（Route Handler / Server Action / `lib/prisma.ts`），不会进浏览器包；`.env` 已被 `.gitignore` 覆盖。

**Prisma 的 client 是「生成产物」不是「依赖包」**：它在 `lib/generated/prisma`，被 `.gitignore` 排除，由 `prisma generate` 现场生成。所以 `package.json` 里必须有这一句，否则部署时必然 `Module not found`：

```json
"build": "prisma generate && next build"
```

生产环境变量要在平台侧单独配置，**并且配置后必须重新部署**——Vercel 的环境变量是构建时注入的，已经存在的部署不会自己变。

---

## 数据怎么存的

一次对话的完整回路：

```text
浏览器                     服务器                       数据库
──────                     ──────                       ──────
sendMessage({text})
  │ POST /api/chat
  └──────────────────>  route.ts
                          ├─ 存 user 消息 ──────────────> Message
                          ├─ streamText(DeepSeek)
                          └─ onFinish 存 assistant + token 用量 ─> Message

刷新页面
  │ GET /chat
  └──────────────────>  page.tsx
                          await connection()   ← 声明「从这里开始是请求期数据」
                          ├─ findFirst(updatedAt desc) ─> Conversation
                          └─ findMany(按 createdAt) ────> Message
                                                          │
                        当作 props 传下去 <────────────────┘
                             ↓
                        chat-client.tsx（useChat 接管）
```

**两处容易错的地方，都真踩过：**

| 坑 | 现象 | 原因 |
|---|---|---|
| 少了 `await connection()` | 部署后永远显示构建那一刻的历史 | Next 把数据烤进了静态 HTML；`instant = false` **不等于**不预渲染 |
| 少了 `revalidatePath` | 操作成功了，刷新还是旧的 | Next 看不见模块级数据变化，得自己说一声 |

**表设计三条**（第一版做错了两条）：

1. **一行 = 一件事** —— `Conversation` 一行 = 一次会话，`Message` 一行 = 一条消息。说不出「它属于哪个事物的哪一次」，就是放错表了。
2. **时间用原生类型** —— `DateTime` 而不是 `String`。字符串比较会让 `"9:05"` 排在 `"11:48"` 后面。
3. **能推导的值不存** —— `totalTokens` 不存，用 `inputTokens + outputTokens` 算。

**「清空」和「编辑重发」都必须落库**：只 `setMessages([])` 是清屏幕，刷新就回来了。屏幕是数据的副本，数据库才是真相。

---

## 部署

```text
git push  →  GitHub 按 webhook 通知 Vercel
          →  Vercel 在自己的机器上 clone + install + build
          →  产物挂到域名；旧部署变成可回滚的上一版
```

| 规则 | 原因 |
|---|---|
| `main` → Production，其它分支 → Preview | 分支决定环境 |
| 改了环境变量必须 **Redeploy** | 部署是不可变的，env 在构建时注入 |
| `lib/generated/prisma` 不进 git | 它是生成产物，由 `prisma generate` 在构建前现场生成 |
| 数据库不能放本地文件 | Vercel 上只有一个只读的项目目录，`dev.db` 根本不存在 |

---

## 命令行实验（不用起服务）

```bash
export DEEPSEEK_API_KEY="sk-..."

node scripts/chat.mjs              # 多轮对话（维护 messages 数组）
node scripts/complete.mjs          # 带超时 + 退避重试的通用调用函数
node scripts/stream.mjs "数到 20"   # 手写 SSE，逐字打印
node scripts/stream-raw.mjs        # 原样打印 SSE 帧，只看结构不解析
node scripts/mock-split.mjs        # 复现「半个汉字」的乱码
node scripts/fewshot.mjs           # few-shot / temperature 成本对照
node scripts/test-timeout.mjs      # 超时 + 指数退避（用假服务器逼出来）
```

`test-timeout.mjs` 起了一个「收请求、永不回复」的假服务器——真实 API 一两秒就返回，30 秒超时永远等不到。

---

## 文档

- [`docs/Day16-ChatCompletions-核心要点.md`](docs/Day16-ChatCompletions-核心要点.md) — Chat Completions 请求 / 响应结构、SSE 帧格式、`[DONE]`
- [`docs/W3执行清单.md`](docs/W3执行清单.md) — 手写流式的逐日拆解与验收标准
- [`docs/Day36-对话数据模型设计.md`](docs/Day36-对话数据模型设计.md) — 第一版设计错在哪、为什么 Conversation 和 Message 必须两张表

---

## 说明

这是一个**学习仓库**：注释写得多，实验脚本比页面多，有的页面就是为了验证一个猜想（比如 `app/lab/` 下面那几层嵌套 layout）。

生产项目不会这么写——但正是这些「多余」的实验，让每个结论都有出处。

---

维护者：王强丹 · 白天写 Vue 2，晚上写这个
