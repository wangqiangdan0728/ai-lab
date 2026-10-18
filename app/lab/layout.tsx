import Counter from '@/app/counter';

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border-2 border-dashed border-gray-400 p-4">
      <h2 className="font-bold">实验区布局（作用域：/lab/*）</h2>

      <Counter label="② lab layout（app/lab/layout.tsx）" tone="green" />

      {children}
    </div>
  );
}
