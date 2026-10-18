import Link from 'next/link';

export default function Home() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">ai-lab</h1>
      <Link className="mt-4 inline-block text-blue-600 underline" href="/posts">
        去看文章列表
      </Link>
    </main>
  );
}
