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
