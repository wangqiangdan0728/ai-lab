'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// 读"我是谁"。proxy.ts 保证了 /chat 上一定有这个 cookie。
async function currentSid() {
  return (await cookies()).get('wqd_sid')?.value ?? null;
}

// ★ 归属校验：不是"这个会话存在吗"，而是"这个会话是我的吗"。
//   两句话的区别就是漏洞本身 —— 以前只查存在，所以谁传 id 都能删。
async function requireOwned(conversationId: string) {
  const sid = await currentSid();
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, sid },
    select: { id: true },
  });
  if (!conv) throw new Error('这个会话不属于你');
  return conv;
}

export async function createConversation() {
  const sid = await currentSid();
  await prisma.conversation.create({
    data: {
      sid, // ← 归属。少了这一行，新会话又是"无主"的。
      title: '新对话',
      model: 'deepseek-flash',
      thinking: false,
      updatedAt: new Date(), // ← 这个字段 NOT NULL 又没有默认值，必须给
    },
  });

  revalidatePath('/chat'); // 让 /chat 的服务端部分重新跑一遍
}

// 清空 = 真的把库里的消息删掉（不是只清浏览器那一份）
export async function clearConversation(conversationId: string) {
  await requireOwned(conversationId);
  await prisma.message.deleteMany({ where: { conversationId } });
  revalidatePath('/chat');
}

// 编辑重发 = 先删掉「这条及它之后」的所有消息，再发新的。
// 用「保留前 keepCount 条」来表达，不依赖时间戳：
// 界面上第 N 条消息，就是库里按 createdAt 升序的第 N 行（一次问答 = 两行 = 两条）。
export async function truncateTo(conversationId: string, keepCount: number) {
  await requireOwned(conversationId);
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const toDelete = rows.slice(keepCount).map((r) => r.id);
  if (toDelete.length > 0) {
    await prisma.message.deleteMany({ where: { id: { in: toDelete } } });
  }
  revalidatePath('/chat');
}
