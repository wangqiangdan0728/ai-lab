import { getPosts } from '@/lib/posts';

export async function GET() {
  return Response.json(await getPosts());
}
