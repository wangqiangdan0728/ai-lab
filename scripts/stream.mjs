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
  console.error('   先 export DEEPSEEK_API_KEY="sk-..."');
  process.exit(1);
}

const prompt = process.argv.slice(2).join(' ') || '输出《蜀道难》';

// 可用 DS_API_URL 指向本地假服务器（方便离线验证）
const API_URL =
  process.env.DS_API_URL || 'https://api.deepseek.com/chat/completions';

async function main() {
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
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value);

    const frams = buffer.split('\n\n');
    buffer = frams.pop();

    for (const fram of frams) {
      let line = fram.trim();
      if (!line.startsWith('data: ')) {
        continue;
      }

      let newLine = line.slice(6);
      if (newLine === '[DONE]') break;

      const json = JSON.parse(newLine);
      const text = json.choices?.[0].delta?.content;

      if (text) {
        process.stdout.write(text);
      }
    }
  }
}

main();
