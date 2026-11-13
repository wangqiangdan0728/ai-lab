import { complete } from './complete.mjs';
import { buildMessages } from './prompt.mjs';

const task = '把这句用户抱怨改成客服口吻：物流太慢了，我等了十天还没到。';

const SYS =
  '你是电商客服。回复必须礼貌、简短（不超过 40 字），先共情再给方案。';

const EX = [
  [
    '快递三天没动，能查一下吗？',
    '非常抱歉让您久等，我马上帮您查物流，稍后回复您。',
  ],
  ['你们客服态度太差了', '实在抱歉让您有不好的体验，我这就为您跟进处理。'],
  ['东西坏了怎么办', '抱歉给您添麻烦了，我为您安排退换，无需您承担运费。'],
];

const groups = [
  {
    name: 'A 空 system / 0 例 / t=1.0',
    system: '',
    examples: [],
    temperature: 1.0,
  },
  {
    name: 'B 有 system / 0 例 / t=1.0',
    system: SYS,
    examples: [],
    temperature: 1.0,
  },
  {
    name: 'C 有 system / 1 例 / t=1.0',
    system: SYS,
    examples: EX.slice(0, 1),
    temperature: 1.0,
  },
  {
    name: 'D 有 system / 3 例 / t=1.0',
    system: SYS,
    examples: EX,
    temperature: 1.0,
  },
  {
    name: 'E 有 system / 3 例 / t=0.2',
    system: SYS,
    examples: EX,
    temperature: 0.2,
  },
];

for (const g of groups) {
  const messages = buildMessages({
    system: g.system,
    examples: g.examples,
    user: task,
  });

  console.log(`\n===== ${g.name} =====`);
  console.log(`（共 ${messages.length} 条消息）`);

  const res = await complete(messages, { temperature: g.temperature });
  const text = res.choices[0].message.content;

  console.log(text);
  console.log(
    `—— 字数 ${text.length}，completion_tokens ${res.usage.completion_tokens}`,
  );

  console.log(
    `prompt ${res.usage.prompt_tokens} / output ${res.usage.completion_tokens} / total ${res.usage.total_tokens}`,
  );
}

// for (let index = 0; index < 5; index++) {
//   const messages = buildMessages({
//     system: groups[3].system,
//     examples: groups[3].examples,
//     user: task,
//   });

//   console.log(`\n===== ${groups[3].name} =====`);
//   console.log(`（共 ${messages.length} 条消息）`);

//   const res = await complete(messages, { temperature: groups[3].temperature });
//   const text = res.choices[0].message.content;

//   console.log(text);
//   console.log(
//     `—— 字数 ${text.length}，completion_tokens ${res.usage.completion_tokens}`,
//   );
// }
