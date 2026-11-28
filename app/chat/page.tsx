import { Suspense } from 'react';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import type { UIMessage } from 'ai';
import { prisma } from '@/lib/prisma';
import ChatClient, { type ConversationItem } from './chat-client';

export default function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  return (
    // ★ searchParams 的 Promise 直接传下去，在 Suspense 里面才 await。
    //   在外面 await 会把整个页面变成「每次请求现算」，静态壳就没了。
    <Suspense
      fallback={<div className="p-6 text-sm text-slate-500">加载中…</div>}
    >
      <ChatHistory searchParams={searchParams} />
    </Suspense>
  );
}

async function ChatHistory({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  await connection();

  // ① 先问「你是谁」
  const sid = (await cookies()).get('wqd_sid')?.value ?? null;

  // ② 再问「你要看哪一条」（?c=xxx）
  const { c } = await searchParams;

  // ③ 我的会话列表 —— 侧边栏就是它
  const conversations: ConversationItem[] = sid
    ? (
        await prisma.conversation.findMany({
          where: { sid },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, title: true, updatedAt: true },
        })
      ).map((row) => ({
        id: row.id,
        title: row.title,
        updatedAt: row.updatedAt.toISOString(), // Date 也能过边界，但统一成字符串省心
      }))
    : [];

  // ④ 定「当前会话」，三条规则：
  //    1) URL 指定了、而且确实在我的列表里 → 用它
  //      （★ 必须"在我的列表里"：别人把 id 塞进 URL 也进不来）
  //    2) 没指定 / 指定的不属于我 → 用我最近一条
  //    3) 一条都没有 → 新建
  let current = (c ? conversations.find((x) => x.id === c) : undefined) ?? conversations[0];

  if (!current) {
    const created = await prisma.conversation.create({
      data: {
        sid,
        title: '新对话',
        model: 'deepseek-flash',
        thinking: false,
        updatedAt: new Date(),
      },
      select: { id: true, title: true, updatedAt: true },
    });
    current = {
      id: created.id,
      title: created.title,
      updatedAt: created.updatedAt.toISOString(),
    };
    conversations.unshift(current);
  }

  const conversationId = current.id;

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
      // ★ key 换成会话 id：切换会话时 React 会重建这个组件。
      //   不加 key 的话，useChat 的 messages 只认第一次的初始值，
      //   切过去屏幕上还是旧会话的内容（这是最容易踩的一个坑）。
      key={conversationId}
      initialMessages={initialMessages}
      conversations={conversations}
      conversationId={conversationId}
    />
  );
}
