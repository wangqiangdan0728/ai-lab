#!/usr/bin/env node
/**
 * Day 13 · 多轮对话 CLI（DeepSeek）
 *
 * 可复用的调用逻辑（超时 + 重试）在 complete.mjs 里，
 * 这个文件只负责「读输入、维护 messages、打印结果」。
 *
 * 运行（必须用 Node 18+）：
 *   nvm use 22
 *   export DEEPSEEK_API_KEY="sk-..."
 *   node scripts/chat.mjs
 *
 * 命令：直接输入 → 对话；/clear → 清空历史；exit → 退出
 */
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  complete,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
} from './complete.mjs';

// —— Node 版本保护 ——
const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  console.error(
    `❌ 当前 Node v${process.versions.node} 太老（fetch 需要 18+）`,
  );
  console.error('   先切版本：nvm use 22   或   fnm use 22');
  process.exit(1);
}

const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) {
  console.error('❌ 没找到 DEEPSEEK_API_KEY');
  console.error('   方式 A：export DEEPSEEK_API_KEY="sk-..."');
  console.error('   方式 B：node --env-file=.env.local scripts/chat.mjs');
  process.exit(1);
}

function getArgvVal(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null; // ← 没传：安静返回，不打印

  const val = process.argv[index + 1];
  if (val === undefined || val.startsWith('--')) {
    console.error(`❌ ${name} 后面缺少值`);
    process.exit(1);
  }
  return val;
}

// system 可选：没传就静默用默认
const SYS =
  getArgvVal('--system') ?? '你是一个简洁的中文助手，回答尽量三句话以内。';

// temp 可选：没传用 0；传了非法值就报错退出
let temp = 0;
const tempArg = getArgvVal('--temp');
if (tempArg !== null) {
  temp = Number(tempArg);
  if (!Number.isFinite(temp) || temp < 0 || temp > 2) {
    console.error(`❌ --temp 必须是 0～2 的数字，收到：${tempArg}`);
    process.exit(1);
  }
}

// 🧠 「记忆」就在这个数组里 —— 靠每次把完整历史重新发过去
const messages = [{ role: 'system', content: SYS }];

// 累计 token，供 Day 14 算账用
let totalPrompt = 0;
let totalCompletion = 0;

// ---------- chat：追加消息 → 调 complete → 失败时撤回 user ----------
async function chat(userText) {
  messages.push({ role: 'user', content: userText });

  try {
    const data = await complete(messages, {
      temperature: temp,
    });
    const reply = data.choices?.[0]?.message?.content ?? '(空回复)';
    messages.push({ role: 'assistant', content: reply });

    const u = data.usage;
    if (u) {
      totalPrompt += u.prompt_tokens ?? 0;
      totalCompletion += u.completion_tokens ?? 0;
      console.log(
        '   ⓘ 本次 ' +
          u.prompt_tokens +
          ' 入 / ' +
          u.completion_tokens +
          ' 出 · ' +
          '累计 ' +
          totalPrompt +
          ' 入 / ' +
          totalCompletion +
          ' 出',
      );
    }
    return reply;
  } catch (err) {
    // 任何失败都撤回刚塞的 user，避免「连续两个 user」违反交替规则
    messages.pop();
    throw err;
  }
}

// ---------- CLI 主循环 ----------
const rl = readline.createInterface({ input, output });

console.log(
  `💬 DeepSeek 多轮对话 CLI（超时 ${DEFAULT_TIMEOUT_MS / 1000}s · 重试 ${DEFAULT_MAX_RETRIES} 次）`,
);
console.log('   · 直接输入即可对话');
console.log('   · /clear 清空历史 · exit 退出');
console.log('--------------------------------------------------\n');

while (true) {
  let line;
  try {
    line = await rl.question('你 > ');
  } catch {
    break; // Ctrl+C / EOF
  }

  const text = line.trim();
  if (!text) continue;
  if (text === 'exit' || text === 'quit') break;

  if (text === '/clear') {
    messages.length = 1; // 只留 system
    console.log('🧹 历史已清空\n');
    continue;
  }

  try {
    const reply = await chat(text);
    console.log('AI > ' + reply + '\n');
  } catch (err) {
    console.error('❌ 请求失败：' + err.message + '\n');
  }
}

rl.close();

// ---------- Day 14：成本估算 ----------
// 单价（deepseek-flash 非高峰，美元 / token）
const PRICE_INPUT = 0.00000015; // $0.15 / 百万 token
const PRICE_OUTPUT = 0.0000006; // $0.60 / 百万 token
const USD_TO_CNY = 6.66;

const pricePrompt = totalPrompt * PRICE_INPUT;
const priceCompletion = totalCompletion * PRICE_OUTPUT;
const totalPrice = pricePrompt + priceCompletion;

console.log(`\n📊 本次会话：${totalPrompt} 入 / ${totalCompletion} 出`);
console.log(
  `💵 输入 $${pricePrompt.toFixed(6)} + 输出 $${priceCompletion.toFixed(6)}`,
);
console.log(
  `💰 合计：$${totalPrice.toFixed(6)}（≈ ¥${(totalPrice * USD_TO_CNY).toFixed(4)}）`,
);
