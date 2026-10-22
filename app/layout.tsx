import Link from 'next/link';
import Counter from '@/app/counter';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="p-6">
        {/* <h1 className="text-lg font-bold">根布局（作用域：全站）</h1>

        <Counter label="① 根 layout（app/layout.tsx）" tone="blue" />

        <nav className="my-4 flex flex-wrap gap-4 text-sm">
          <Link className="text-blue-600 underline" href="/">
            首页
          </Link>
          <Link className="text-blue-600 underline" href="/lab">
            /lab
          </Link>
          <Link className="text-blue-600 underline" href="/lab/alpha">
            /lab/alpha
          </Link>
          <Link className="text-blue-600 underline" href="/lab/beta">
            /lab/beta
          </Link>
        </nav> */}

        {children}
      </body>
    </html>
  );
}
