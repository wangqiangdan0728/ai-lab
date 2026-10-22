export type Post = { id: string; title: string; body: string };

let posts: Post[] = [
  { id: '1', title: '第一篇', body: '这是第一篇的内容' },
  { id: '2', title: '第二篇', body: '这是第二篇的内容' },
  { id: '3', title: '第三篇', body: '这是第三篇的内容' },
];

export async function addPost(title: string) {
  posts = [...posts, { id: String(Date.now()), title, body: '（待补充）' }];
}
