import { createPost } from './actions';

// 在 return 里：
<form action={createPost} className="mb-6 flex gap-2">
  <input
    name="title"
    placeholder="新文章标题"
    className="rounded border px-3 py-1"
  />
  <button type="submit" className="rounded bg-black px-3 py-1 text-white">
    添加
  </button>
</form>;
