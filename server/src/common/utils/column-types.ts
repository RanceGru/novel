// 跨数据库列类型辅助
//
// 背景：TypeScript 对 `Date | null` 这类联合类型反射出的是 `Object`，
// TypeORM 无法据此推断列类型（会报 Data type "Object" is not supported）。
// 因此可空的日期列必须显式声明类型，而 Postgres 与 SQLite 的类型名并不相同。
//
// 本模块按当前驱动返回对应的类型名，使同一份实体定义在两种数据库下都成立：
//   postgres -> timestamptz（对应技术文档的 TIMESTAMPTZ）
//   sqlite   -> datetime
import type { ColumnType } from 'typeorm';

/** 驱动判定必须与 config/database.config.ts 的 resolveDriver() 保持一致 */
function isPostgres(): boolean {
  const explicit = process.env.DB_TYPE?.toLowerCase();
  if (explicit === 'postgres' || explicit === 'postgresql') return true;
  if (explicit === 'sqlite' || explicit === 'better-sqlite3') return false;
  // 与 database.config 相同的回退规则：配置了 DB_HOST 视为 Postgres
  return !!process.env.DB_HOST;
}

/** 可空/非空日期列的类型名（按驱动自适应） */
export function dateColumnType(): ColumnType {
  return (isPostgres() ? 'timestamptz' : 'datetime') as ColumnType;
}
