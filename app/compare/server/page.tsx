import { getPosts } from '@/lib/posts';

export default async function ServerPage() {
  const posts = await getPosts();
  return <pre>{JSON.stringify(posts, null, 2)}</pre>;
}
