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
