'use server';

import { revalidatePath } from 'next/cache';
import { addPost } from '@/lib/posts';

export async function createPost(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;
  await addPost(title);
  revalidatePath('/posts'); // 让列表页拿到新数据
}
