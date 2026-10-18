import Link from 'next/link';
import { getPosts } from '@/lib/posts';

export default async function PostsPage() {
  const posts = await getPosts();
  return (
    <ul className="space-y-2 p-6">
      {posts.map((p) => (
        <li key={p.id}>
          <Link className="text-blue-600 underline" href={`/posts/${p.id}`}>
            {p.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
