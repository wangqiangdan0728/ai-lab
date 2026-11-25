import { PrismaClient } from '@/lib/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Prisma 7 不再自带数据库引擎，必须显式给一个 driver adapter。
// SQLite 用的是 better-sqlite3（原生模块），连接串读 .env 里的 DATABASE_URL。
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./dev.db',
});

// dev 模式热更新会反复执行模块顶层代码，
// 挂到 globalThis 上可以保证整个进程只有一份 client（否则连接越堆越多）。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
