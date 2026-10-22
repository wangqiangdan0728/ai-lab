import Link from 'next/link';
import { getPosts } from '@/lib/posts';
import { createPost } from './actions';

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const posts = await getPosts();
  const list = sort === 'new' ? [...posts].reverse() : posts;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">文章列表</h2>

      {/* 👇 当前读到的查询串 */}
      <p className="text-sm text-gray-600">当前排序：{sort ?? '默认'}</p>

      {/* 👇 两个链接，只是 ? 后面不同 */}
      <div className="my-3 flex gap-3">
        <Link href="/posts" className="text-blue-600 underline">
          默认排序
        </Link>
        <Link href="/posts?sort=new" className="text-blue-600 underline">
          按最新
        </Link>
      </div>

      <form action={createPost} className="mb-6 flex gap-2">
        <input
          name="title"
          placeholder="新文章标题"
          className="rounded border px-3 py-1"
        />
        <button type="submit" className="rounded bg-black px-3 py-1 text-white">
          添加
        </button>
      </form>

      <ul className="space-y-2">
        {list.map((p) => (
          <li key={p.id}>
            <Link href={`/posts/${p.id}`} className="text-blue-600 underline">
              {p.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
