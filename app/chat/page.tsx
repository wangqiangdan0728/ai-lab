'use client';
import ReactMarkdown, { type Components } from 'react-markdown';
import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import remarkGfm from 'remark-gfm';
import { codeToHtml } from 'shiki';

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

export default function Chat() {
  const [input, setInput] = useState('');
  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    regenerate,
    stop,
  } = useChat();
  const isLoading = status === 'submitted' || status === 'streaming';

  // ——————————————— 滚动控制 ———————————————
  const listRef = useRef<HTMLDivElement>(null); // 滚动容器（overflow-y-auto 那个）
  const contentRef = useRef<HTMLDivElement>(null); // 内容包裹层（高度会变）
  const stickRef = useRef(true); // 是否「粘」在底部（用 ref 避免闭包拿到旧值）
  const programmatic = useRef(false); // 这次滚动是不是我们自己触发的
  const [stick, setStick] = useState(true); // 同上的 state，只为了显示「回到底部」按钮

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

          {messages.map((m) => (
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
                {m.parts.map((part, index) =>
                  part.type === 'text' ? (
                    <ReactMarkdown
                      key={index}
                      remarkPlugins={REMARK_PLUGINS}
                      components={MD_COMPONENTS}
                    >
                      {part.text}
                    </ReactMarkdown>
                  ) : null,
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
            onClick={() => regenerate()}
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
          onClick={() => setMessages([])}
        >
          清空
        </button>
      </div>

      {/* ② 输入区：吸底，不许被压 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || isLoading) return;
          jumpToBottom(); // 用户主动发消息 → 一定跟到底
          sendMessage({ text: input });
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
