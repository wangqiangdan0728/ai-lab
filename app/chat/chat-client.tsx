'use client';
import ReactMarkdown, { type Components } from 'react-markdown';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import remarkGfm from 'remark-gfm';
import { codeToHtml } from 'shiki';
import { clearConversation, createConversation, truncateTo } from './actions';

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [shown, setShown] = useState<{ code: string; html: string }>({
    code: '',
    html: '',
  });

  useEffect(() => {
    let alive = true;
    // 内容还在变 → 不断重置定时器 → 永远不会触发
    // 内容稳定 300ms → 触发一次 → 高亮一次
    const timer = setTimeout(() => {
      const t0 = performance.now();
      codeToHtml(code, { lang: lang || 'text', theme: 'github-dark' }).then(
        (h) => {
          if (alive) {
            console.log(
              '[shiki]',
              code.length,
              Math.round(performance.now() - t0),
              'ms',
            );
            setShown({ code, html: h });
          }
        },
      );
    }, 300);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [code, lang]);

  // 只有「当前 code 已经有对应的着色结果」才显示彩色版本
  if (shown.html && shown.code === code) {
    return (
      <div
        className="my-2 overflow-x-auto rounded-lg text-xs"
        dangerouslySetInnerHTML={{ __html: shown.html }}
      />
    );
  }
  return (
    <pre className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
      {code}
    </pre>
  );
}

const REMARK_PLUGINS = [remarkGfm];

const MD_COMPONENTS: Components = {
  table: ({ node, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th
      className="border border-slate-300 bg-slate-100 px-2 py-1 text-left font-semibold"
      {...props}
    />
  ),
  td: ({ node, ...props }) => (
    <td className="border border-slate-300 px-2 py-1 align-top" {...props} />
  ),
  p: ({ node, ...props }) => <p className="my-1 leading-relaxed" {...props} />,
  ul: ({ node, ...props }) => <ul className="my-1 list-disc pl-5" {...props} />,
  ol: ({ node, ...props }) => (
    <ol className="my-1 list-decimal pl-5" {...props} />
  ),
  li: ({ node, ...props }) => <li className="my-0.5" {...props} />,
  h1: ({ node, ...props }) => (
    <h1 className="mt-3 mb-1 text-base font-bold" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="mt-3 mb-1 text-sm font-bold" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="mt-2 mb-1 text-sm font-semibold" {...props} />
  ),
  pre: ({ node, children }) => {
    const el = children as ReactElement<{
      className?: string;
      children?: ReactNode;
    }>;
    const lang =
      /language-(\w+)/.exec(el?.props?.className ?? '')?.[1] ?? 'text';
    const code = String(el?.props?.children ?? '');
    return <CodeBlock code={code} lang={lang} />;
  },
  code: ({ node, className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? '');
    return isBlock ? (
      <code className={className} {...props}>
        {children}
      </code>
    ) : (
      <code
        className="rounded bg-slate-200 px-1 py-0.5 text-[0.85em]"
        {...props}
      >
        {children}
      </code>
    );
  },
};

export default function ChatClient({
  initialMessages,
  conversationId,
}: {
  initialMessages: UIMessage[];
  conversationId: string;
}) {
  const [input, setInput] = useState('');
  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    regenerate,
    stop,
  } = useChat({ messages: initialMessages });
  const isLoading = status === 'submitted' || status === 'streaming';

  // ——————————————— 滚动控制 ———————————————
  const listRef = useRef<HTMLDivElement>(null); // 滚动容器（overflow-y-auto 那个）
  const contentRef = useRef<HTMLDivElement>(null); // 内容包裹层（高度会变）
  const stickRef = useRef(true); // 是否「粘」在底部（用 ref 避免闭包拿到旧值）
  const programmatic = useRef(false); // 这次滚动是不是我们自己触发的
  const [stick, setStick] = useState(true); // 同上的 state，只为了显示「回到底部」按钮
  const [editing, setEditing] = useState<{
    index: number;
    text: string;
  } | null>(null);

  function textOf(m: (typeof messages)[number]) {
    return m.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('');
  }

  async function submitEdit() {
    if (!editing || isLoading) return;
    const text = editing.text.trim();
    if (!text) return; // 边界三：空内容不发
    const cut = editing.index; // 保留这条之前的消息
    setEditing(null);
    setMessages(messages.slice(0, cut)); // ① 先截断屏幕
    // ② 再把库里「这条及之后」删掉 —— 少了这一步，旧消息留在库里，
    //    新的一轮又 append 两条，刷新就多出两条（线上真踩）
    await truncateTo(conversationId, cut);
    jumpToBottom();
    sendMessage({ text }, { body: { conversationId } }); // ③ 最后发
  }

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    programmatic.current = true; // 标记：下面 onScroll 收到的事件是我们自己造成的
    el.scrollTop = el.scrollHeight;
  }

  // ★ 关键：观察「内容高度」而不是依赖 messages 引用是否变化。
  //   流式吐字时消息条数不变、只有高度在长，ResizeObserver 能抓到每一次。
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (stickRef.current) scrollToBottom();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function onScroll() {
    // 我们自己滚的，不要把 stick 又打回 false（这是最常见的「滚一下就停」原因）
    if (programmatic.current) {
      programmatic.current = false;
      return;
    }
    const el = listRef.current;
    if (!el) return;
    // 用 80px 容差，别用 === 0：受 DPI / 缩放 / padding 影响，几乎永远不等于 0
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickRef.current = atBottom;
    setStick(atBottom);
  }

  function jumpToBottom() {
    stickRef.current = true;
    setStick(true);
    scrollToBottom();
  }

  const times = useRef(new Map<string, number>());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function timeOf(m: (typeof messages)[number]) {
    // ① 来自数据库的历史消息：page.tsx 已经把 createdAt 塞进 metadata
    const fromDb = (m.metadata as { createdAt?: string } | undefined)?.createdAt;
    if (fromDb) return new Date(fromDb).getTime();
    // ② 本次会话新发的消息：库里还没有，用本地时间兜底
    if (!times.current.has(m.id)) times.current.set(m.id, Date.now());
    return times.current.get(m.id)!;
  }

  // 非安全上下文（http + 局域网 IP）下 navigator.clipboard 不存在，
  // 只能用老的 execCommand；它虽已废弃，但仍是唯一可用方案。
  function fallbackCopy(text: string) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', ''); // 否则 iOS 会弹键盘
      ta.style.position = 'fixed';
      ta.style.opacity = '0'; // 别让它出现在页面上
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }

  async function copyText(text: string, id: string) {
    let ok = false;

    // ★ 不能写成 navigator.clipboard?.writeText(text).catch(...)：
    //   可选链一旦短路，后面的 .catch 根本不会注册 → 兜底永远不执行。
    //   必须先判断「有没有 + 安不安全」，再显式分支。
    if (window.isSecureContext && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        ok = false; // 权限被拒等情况，落到下面的兜底
      }
    }
    if (!ok) ok = fallbackCopy(text);

    // 只有真的复制成功才提示，否则「已复制」是在骗人
    if (!ok) return;
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
  }

  return (
    // 抵消 layout.tsx 里 body 的 p-6（上下共 3rem）
    <div className="relative mx-auto flex h-[calc(100vh-3rem)] max-w-2xl flex-col">
      {/* ① 消息区：永远渲染，自己滚 */}
      <div
        ref={listRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto pb-4"
      >
        <div ref={contentRef} className="space-y-3 pt-4">
          {messages.length === 0 && (
            <div className="flex h-60 items-center justify-center text-2xl text-slate-400">
              有什么可以帮你？
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={m.id}
              className={
                m.role === 'user' ? 'flex justify-end' : 'flex justify-start'
              }
            >
              <div
                className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-200 text-slate-900'
                }`}
              >
                {editing?.index === i ? (
                  <div className="flex flex-col gap-2">
                    <input
                      autoFocus
                      value={editing.text}
                      onChange={(e) =>
                        setEditing({ index: i, text: e.target.value })
                      }
                      onKeyDown={(e) => {
                        // 中文输入法选字时按回车是「上屏」，不是提交
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          submitEdit();
                        }
                      }}
                      className="w-full rounded border px-2 py-1 text-sm text-slate-900"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={submitEdit}
                        className="rounded border border-slate-400 px-3 py-1 text-xs text-slate-900"
                      >
                        重发
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="rounded border border-slate-400 px-3 py-1 text-xs text-slate-900"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  m.parts.map((part, index) =>
                    part.type === 'text' ? (
                      <ReactMarkdown
                        key={index}
                        remarkPlugins={REMARK_PLUGINS}
                        components={MD_COMPONENTS}
                      >
                        {part.text}
                      </ReactMarkdown>
                    ) : null,
                  )
                )}
              </div>

              {/* 编辑按钮：只有用户消息、非流式、且不在编辑态时显示 */}
              {m.role === 'user' && !isLoading && editing?.index !== i && (
                <button
                  type="button"
                  onClick={() => setEditing({ index: i, text: textOf(m) })}
                  className="mt-1 text-xs text-slate-500 underline"
                >
                  编辑
                </button>
              )}

              <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                <span>
                  {new Date(timeOf(m)).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {m.role === 'assistant' && (
                  <button
                    type="button"
                    onClick={() => copyText(textOf(m), m.id)}
                    className="underline"
                  >
                    {copiedId === m.id ? '已复制' : '复制'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {status === 'submitted' && (
            <div className="flex justify-start">
              <div className="mr-auto flex items-center gap-2 rounded-2xl bg-slate-200 px-3 py-2 text-sm text-slate-500">
                <span className="animate-pulse">思考中…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 用户上翻后出现，点了回到底部 */}
      {!stick && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="absolute bottom-32 left-1/2 -translate-x-1/2 rounded-full border bg-white px-3 py-1 text-xs shadow-md"
        >
          ↓ 回到底部
        </button>
      )}

      {error && (
        <div className="shrink-0 text-sm text-red-500">
          出错了：{error.message}
          <button
            type="button"
            onClick={() => regenerate({ body: { conversationId } })}
            className="ml-2 underline"
          >
            重试
          </button>
        </div>
      )}

      <div className="flex shrink-0 justify-end pb-4 pt-2">
        <button
          type="button"
          className="rounded border px-4 py-2"
          onClick={async () => {
            await clearConversation(conversationId); // ① 先把库里的删掉
            setMessages([]); // ② 再清屏幕
            setEditing(null); // 清空时顺手清掉编辑态，否则 editing 还指向旧下标
            times.current.clear(); // 时间表也清掉，不然旧 id 会一直留在 Map 里
          }}
        >
          清空
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={async () => {
            await createConversation(); // ① 库里新开一条
            setMessages([]); // ② 顺便清掉屏幕
          }}
          className="rounded border px-4 py-2"
        >
          新对话
        </button>
      </div>

      {/* ② 输入区：吸底，不许被压 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || isLoading) return;
          jumpToBottom(); // 用户主动发消息 → 一定跟到底
          sendMessage({ text: input }, { body: { conversationId } });
          setInput('');
        }}
        className="flex shrink-0 gap-2 border-t pt-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded border px-3 py-2"
          placeholder="说点什么…"
        />

        {isLoading ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded border px-4 py-2"
          >
            停止
          </button>
        ) : (
          <button type="submit" className="rounded border px-4 py-2">
            发送
          </button>
        )}
      </form>
    </div>
  );
}
