import Counter from '@/app/counter';

export default function AlphaPage() {
  return (
    <div className="mt-4">
      <h3 className="font-bold">这是 /lab/alpha</h3>

      <Counter key="alpha" label="③ 页面级（app/lab/alpha/page.tsx）" tone="orange" />
    </div>
  );
}
