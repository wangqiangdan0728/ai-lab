import { NextResponse, type NextRequest } from 'next/server';

const SID_COOKIE = 'wqd_sid';

// Next 16 把这个文件从 middleware.ts 改名成 proxy.ts。
// 源码里两条名字都还认（PROXY_FILENAME / MIDDLEWARE_FILENAME），
// 但 build 出来的产物仍叫 middleware.js —— 所以你在网上看到的老教程
// 讲的 middleware 就是它，只是名字换了。
//
// 职责只有一件：保证每个浏览器都有一个自己的身份证号（sid）。
// 注意它不是"客户端"，也不是"页面"，它在页面之前跑，拿不到数据库也拿不到 React。
export function proxy(request: NextRequest) {
  const existing = request.cookies.get(SID_COOKIE)?.value;

  // 已经有的，直接放行，一行不动。
  if (existing) return NextResponse.next();

  const sid = crypto.randomUUID();

  // ★ 关键第一半：改写"这次请求"的 Cookie 头。
  //   为什么不能只 set 到 response 上？
  //   因为 response 上的 cookie 是给"下一次请求"用的。
  //   这一次请求马上就要往下走到 page.tsx，它读的是 request 的 cookies()。
  //   不改写 request，第一次访问的页面读到的还是"没有 sid"。
  const requestHeaders = new Headers(request.headers);
  const cookieHeader = request.headers.get('cookie');
  requestHeaders.set(
    'cookie',
    cookieHeader
      ? `${cookieHeader}; ${SID_COOKIE}=${sid}`
      : `${SID_COOKIE}=${sid}`,
  );

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // ★ 关键第二半：把这个 sid 交给浏览器存着，下次请求自动带回来。
  response.cookies.set({
    name: SID_COOKIE,
    value: sid,
    // httpOnly：JS 读不到，别人在你页面里注入脚本也偷不走；
    // 服务端照常能读。默认 false 的话，document.cookie 就能看到它。
    httpOnly: true,
    // sameSite lax：同站点正常发，跨站 POST 不带（挡掉一部分 CSRF）。
    sameSite: 'lax',
    path: '/',
    // 一年。不设的话是"会话 cookie"，关掉浏览器就没了 → 回来变陌生人。
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

// 只管 /chat。别的路径（首页、静态资源）不跑这段代码。
export const config = {
  matcher: ['/chat'],
};
