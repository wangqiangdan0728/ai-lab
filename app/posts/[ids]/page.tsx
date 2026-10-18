import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPost } from '@/lib/posts';

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>; // ⚠️ Next 16：Promise
}) {
  const { id } = await params; // ⚠️ 必须 await
  const post = await getPost(id);
  if (!post) notFound();

  return (
    <article className="p-6">
      <Link className="text-blue-600 underline" href="/posts">
        ← 返回列表
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{post.title}</h1>
      <p className="mt-2">{post.body}</p>
    </article>
  );
}
