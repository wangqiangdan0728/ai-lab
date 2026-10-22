'use client';
import { useEffect, useState } from 'react';
import type { Post } from '@/lib/posts';

export default function ClientPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/posts')
      .then((r) => r.json())
      .then((data) => {
        setPosts(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>加载中…</p>;
  return <pre>{JSON.stringify(posts, null, 2)}</pre>;
}
