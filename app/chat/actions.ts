'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export async function createConversation() {
  await prisma.conversation.create({
    data: {
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
  await prisma.message.deleteMany({ where: { conversationId } });
  revalidatePath('/chat');
}

// 编辑重发 = 先删掉「这条及它之后」的所有消息，再发新的。
// 用「保留前 keepCount 条」来表达，不依赖时间戳：
// 界面上第 N 条消息，就是库里按 createdAt 升序的第 N 行（一次问答 = 两行 = 两条）。
export async function truncateTo(conversationId: string, keepCount: number) {
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
