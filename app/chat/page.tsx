'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';

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

  return (
    // 抵消 layout.tsx 里 body 的 p-6（上下共 3rem）
    <div className="mx-auto flex h-[calc(100vh-3rem)] max-w-2xl flex-col">
      {/* ① 消息区：永远渲染，自己滚 */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-2xl text-slate-400">
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
              className={`max-w-[70%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-200 text-slate-900'
              }`}
            >
              {m.parts.map((part, i) =>
                part.type === 'text' ? <span key={i}>{part.text}</span> : null,
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

      {error && (
        <div className="text-red-500 text-sm">
          出错了：{error.message}
          <button onClick={() => regenerate()}>重试</button>
        </div>
      )}
      <button
        className="rounded border px-4 py-2"
        onClick={() => setMessages([])}
      >
        清空
      </button>
      {/* ② 输入区：吸底，不许被压 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || isLoading) return;
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
