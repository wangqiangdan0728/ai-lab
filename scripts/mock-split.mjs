// 强制把「好」字切成两半，专门制造乱码
import http from 'node:http';

const frame = (text) =>
  'data: ' +
  JSON.stringify({
    id: 'mock',
    object: 'chat.completion.chunk',
    model: 'deepseek-flash',
    choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
    usage: null,
  }) +
  '\n\n';

http
  .createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });

    const body = Buffer.from(frame('你好世界'), 'utf8');
    const cut = body.indexOf(Buffer.from('好', 'utf8')) + 1; // 切在「好」的第 1 个字节后

    res.write(body.subarray(0, cut));
    await new Promise((r) => setTimeout(r, 50)); // 强制分成两个 TCP 包
    res.write(body.subarray(cut));
    res.end('data: [DONE]\n\n');
  })
  .listen(3210, () => console.log('mock: http://127.0.0.1:3210'));
