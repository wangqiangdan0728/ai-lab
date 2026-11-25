import { prisma } from '@/lib/prisma';

import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { deepSeek } from '@ai-sdk/deepseek';

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, conversationId } = body;
  const lastUser = messages[messages.length - 1];

  await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: lastUser.parts?.map((p: any) => p.text ?? '').join('') ?? '',
    },
  });

  const result = streamText({
    model: deepSeek('deepseek-flash'),
    system: '你是一个简洁的中文助手，回答尽量三句话以内；',
    messages: await convertToModelMessages(messages),

    // 关掉思考模式（DeepSeek 默认是 enabled）
    // 好处：① 不再烧 reasoning token（按输出价算，很贵）
    //       ② 正文立刻开始吐，不用先干等一段"看不见的推理"
    //       ③ temperature / topP 才生效（开着 thinking 时这两个参数无效）
    providerOptions: {
      deepseek: { thinking: { type: 'disabled' } },
    },

    // ★ 关键：客户端断开 → 中止上游请求（省 token）
    abortSignal: req.signal,

    onFinish: async ({ text, usage }) => {
      await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: text,
          model: 'deepseek-flash',
          inputTokens: usage.inputTokens ?? null,
          outputTokens: usage.outputTokens ?? null,
          cacheHitTokens: usage.inputTokenDetails?.cacheReadTokens ?? null,
        },
      });
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    },
    onAbort: ({ steps }) => {
      console.log('[chat] ⛔ 被中止（客户端断开）', {
        已完成步数: steps.length,
      });
    },
    onError: ({ error }) => {
      console.log('[chat] ❌ 出错', error);
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
