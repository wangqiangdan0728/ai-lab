#!/usr/bin/env node
/**
 * Day 13 · 验证 complete() 的「超时 + 重试」
 *
 * 为什么不能拿真实 API 测：
 *   DeepSeek 通常 1~3 秒就返回，30 秒超时永远等不到。
 *
 * 正确做法：造一个「收了请求、永不回复」的假服务器，
 *          把超时调到 500ms，逼它超时，观察它是否按 1s、2s 退避重试。
 *
 * 运行：node scripts/test-timeout.mjs
 */
import http from 'node:http';
import { complete } from './complete.mjs';

// —— Node 版本保护：fetch 是 Node 18 才有的，v16 会报 "fetch is not defined" ——
const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  console.error(`❌ 当前 Node v${process.versions.node} 太老（fetch 需要 18+）`);
  console.error('   先切版本：nvm use 22   或   fnm use 22');
  process.exit(1);
}

const t0 = Date.now();
const stamp = () => `[${((Date.now() - t0) / 1000).toFixed(1)}s]`;

// ================= 阶段 1：挂起服务器（永不回复）=================
const hang = http.createServer(() => {
  // 故意什么都不做：不 write、不 end → fetch 永远等不到响应
});
await new Promise((r) => hang.listen(0, '127.0.0.1', r));
const hangUrl = `http://127.0.0.1:${hang.address().port}/chat/completions`;

console.log('='.repeat(58));
console.log('阶段 1：假服务器「永不回复」+ 超时 500ms + 重试 3 次');
console.log('='.repeat(58));
console.log(`${stamp()} 假 API 启动：${hangUrl}`);
console.log('       预期：3 次超时，中间退避 1s、2s，最后抛 AbortError\n');

try {
  await complete([{ role: 'user', content: '测试' }], {
    apiUrl: hangUrl,
    timeoutMs: 500,
    maxRetries: 3,
  });
  console.log(`${stamp()} ❌ 意外：应该超时失败，却成功了`);
} catch (err) {
  console.log(`${stamp()} 最终失败：${err.name} —— ${err.message}`);
  console.log(`${stamp()} ✅ 超时 + 重试按预期触发（3 次尝试后放弃）`);
}
hang.close();
hang.closeAllConnections?.();

// ================= 阶段 2：正常服务器（立刻回复）=================
const ok = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        choices: [{ message: { content: '✅ 假响应：正常回复（未超时）' } }],
        usage: { prompt_tokens: 3, completion_tokens: 8 },
      }),
    );
  });
});
await new Promise((r) => ok.listen(0, '127.0.0.1', r));
const okUrl = `http://127.0.0.1:${ok.address().port}/chat/completions`;

console.log('\n' + '='.repeat(58));
console.log('阶段 2：同一个函数 + 同样 500ms 超时，但服务器正常回复');
console.log('='.repeat(58));
console.log(`${stamp()} 假 API 启动：${okUrl}`);
console.log('       预期：立刻成功，完全不触发超时\n');

const data = await complete([{ role: 'user', content: '测试' }], {
  apiUrl: okUrl,
  timeoutMs: 500,
  maxRetries: 3,
});
console.log(`${stamp()} 成功返回：${data.choices[0].message.content}`);
console.log(`${stamp()} usage：${JSON.stringify(data.usage)}`);
console.log(`${stamp()} ✅ 正常响应不受影响 —— 超时只是「和请求赛跑」`);
ok.close();
