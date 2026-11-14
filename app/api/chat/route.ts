import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { deepSeek } from '@ai-sdk/deepseek';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: deepSeek('deepseek-v4-flash'),
    system: '你是一个简洁的中文助手，回答尽量三句话以内。',
    messages: await convertToModelMessages(messages),

    // ★ 关键：客户端断开 → 中止上游请求（省 token）
    abortSignal: req.signal,

    // 只是日志，看清到底走了哪条路
    onFinish: ({ finishReason, text }) => {
      console.log('[chat] ✅ 正常结束', {
        finishReason,
        已生成字数: text.length,
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
