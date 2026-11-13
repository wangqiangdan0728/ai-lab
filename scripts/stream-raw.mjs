#!/usr/bin/env node
/**
 * Day 17 · 把流式原始 chunk 原样打印出来（只看结构，不解析）
 *
 * 这个脚本故意「不做任何解析」——目的只有一个：让你亲眼看到
 * SSE 数据长什么样、分几段到达、哪一块带 finish_reason 和 usage。
 *
 * 运行（Node 18+）：
 *   nvm use 22
 *   export DEEPSEEK_API_KEY="sk-..."
 *   node scripts/stream-raw.mjs
 *   node scripts/stream-raw.mjs "用三句话介绍你自己"
 *
 * 然后回答清单里的 Q1–Q5。
 */
const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  console.error(`❌ 当前 Node v${process.versions.node} 太老（fetch 需要 18+）`);
  console.error('   先切版本：nvm use 22   或   fnm use 22');
  process.exit(1);
}

const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) {
  console.error('❌ 没找到 DEEPSEEK_API_KEY');
  console.error('   先 export DEEPSEEK_API_KEY="sk-..."');
  process.exit(1);
}

const prompt = process.argv.slice(2).join(' ') || '输出《悯农》';

// 可用 DS_API_URL 指向本地假服务器（方便离线验证）
const API_URL =
  process.env.DS_API_URL || 'https://api.deepseek.com/chat/completions';

const res = await fetch(API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    model: 'deepseek-flash',
    messages: [{ role: 'user', content: prompt }],
    thinking: { type: 'disabled' },
    stream: true, // ← 唯一的变化：从这里开始就是流式
    stream_options: { include_usage: true }, // 让最后一块带 usage
  }),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`❌ HTTP ${res.status}`);
  console.error(text.slice(0, 500));
  process.exit(1);
}

console.log(`问题：${prompt}`);
console.log(`Content-Type: ${res.headers.get('content-type')}`);
console.log('='.repeat(60));

// ---- 从这一刻起，不解析，只看原始数据 ----
const reader = res.body.getReader();
const decoder = new TextDecoder();

let chunkNo = 0;
let totalBytes = 0;
const t0 = Date.now();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  chunkNo++;
  totalBytes += value.byteLength;
  const raw = decoder.decode(value);

  console.log(`\n--- chunk #${chunkNo}（+${Date.now() - t0}ms，${value.byteLength} 字节）---`);
  // 用 JSON.stringify 打印，这样 \n、引号、中文都看得清
  console.log(JSON.stringify(raw));
}

console.log('\n' + '='.repeat(60));
console.log(`共收到 ${chunkNo} 个 chunk，${totalBytes} 字节，耗时 ${Date.now() - t0}ms`);
// console.log(`
// 👉 现在回答清单 Day 17 的 5 个问题：
//    Q1: 一个 chunk 里通常有几个 data: 帧？
//    Q2: delta.content 每次给几个字？
//    Q3: 哪一块的 finish_reason 不是 null？
//    Q4: usage 出现在哪一块？
//    Q5: [DONE] 长什么样？
// `);