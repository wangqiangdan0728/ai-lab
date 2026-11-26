import { Suspense } from 'react';
import { connection } from 'next/server';
import type { UIMessage } from 'ai';
import { prisma } from '@/lib/prisma';
import ChatClient from './chat-client';

export default function ChatPage() {
  return (
    // 外层是"静态壳"，里面那个洞每次请求现算。
    // 客户端组件在预渲染阶段会请求"改成浏览器渲染"（useChat 内部有随机/取时间），
    // 按 Next 16 的规则，这种内容必须包在 Suspense 里，否则 build 直接失败。
    <Suspense
      fallback={<div className="p-6 text-sm text-slate-500">加载中…</div>}
    >
      <ChatHistory />
    </Suspense>
  );
}

async function ChatHistory() {
  // ★ 关键：声明"这之后要读请求期才有的数据"。
  // 少了这一行，Next 会在 build 时就把数据库内容烤进静态 HTML，
  // 刷新页面看到的永远是构建那一刻的历史。
  await connection();

  let conv = await prisma.conversation.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (!conv) {
    conv = await prisma.conversation.create({
      data: {
        title: '新对话',
        model: 'deepseek-flash',
        thinking: false,
        updatedAt: new Date(),
      },
    });
  }

  const conversationId = conv.id;

  // 服务端读历史：刷新页面 = 重新执行这个函数 = 再从库里取一遍
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });

  // 库里的行 → AI SDK 的 UIMessage 形状
  const initialMessages: UIMessage[] = rows.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: m.content }],
    // ★ 把数据库里的时间一起带过去。
    //   少了这一行，前端只能用 Date.now() 兜底 → 刷新后所有历史消息都显示成"刚刚"。
    metadata: { createdAt: m.createdAt.toISOString() },
  }));

  // 数据作为 props 交给客户端组件（跨边界传的是数据，不是代码）
  return (
    <ChatClient
      initialMessages={initialMessages}
      conversationId={conversationId}
    />
  );
}
