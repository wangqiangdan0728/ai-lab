import Counter from '@/app/counter';

export default function BetaPage() {
  return (
    <div className="mt-4">
      <h3 className="font-bold">这是 /lab/beta</h3>

      <Counter key="beta"  label="③ 页面级（app/lab/beta/page.tsx）"  tone="orange" />
    </div>
  );
}
