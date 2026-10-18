import Link from 'next/link';

export default function LabPage() {
  return (
    <div className="mt-4 text-sm">
      <p>请点进一个子页面开始实验：</p>
      <Link className="text-blue-600 underline" href="/lab/alpha">
        → /lab/alpha
      </Link>
    </div>
  );
}
