'use client';

import { useEffect, useState } from 'react';

export default function Counter({
  label,
  tone = 'blue',
}: {
  label: string;
  tone?: 'blue' | 'green' | 'orange';
}) {
  // 用户可见状态：重置为 0 → 说明重新挂载了。
  const [clicks, setClicks] = useState(0);

  // ⚠️ 时间值在服务端和客户端会算出不同结果，
  //    直接渲染会导致 hydration 失败 → 先留 null，挂载后再填。
  const [mountedAt, setMountedAt] = useState<string | null>(null);

  // 最直接的证据：挂载 / 卸载时各打一条日志
  useEffect(() => {
    setMountedAt(new Date().toLocaleTimeString('zh-CN'));

    console.log(`✅ [挂载] ${label}`);
    return () => console.log(`❌ [卸载] ${label}`);
  }, []);

  const tones = {
    blue: 'bg-blue-50 border-blue-300',
    green: 'bg-green-50 border-green-300',
    orange: 'bg-orange-50 border-orange-300',
  };

  return (
    <div className={`my-3 rounded border p-3 ${tones[tone]}`}>
      <div className="text-sm font-bold text-gray-800">{label}</div>
      <button
        className="mt-2 rounded bg-black px-3 py-1 text-sm text-white"
        onClick={() => setClicks((c) => c + 1)}
      >
        点击次数：{clicks}
      </button>
      <div className="mt-2 text-xs text-gray-600">
        挂载时间：{mountedAt ?? '—'}
      </div>
    </div>
  );
}
