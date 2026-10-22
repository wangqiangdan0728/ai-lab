import Counter from './counter';

export default function PostsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="p-6">
      {/* <h2 className="rounded bg-yellow-100 p-2 text-xl font-bold">文章区</h2>
      <Counter /> */}
      {children}
    </div>
  );
}
