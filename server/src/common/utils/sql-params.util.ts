// 原生 SQL 参数占位符工具
//
// 背景：本项目同时支持 PostgreSQL 与 SQLite（本地开发回退）。两者的参数占位符
// 语法不同，写死任何一种都会在另一种上出错：
//   - PostgreSQL：$1 / $2 …，数组参数可写 col = ANY($1)
//   - SQLite（better-sqlite3 驱动）：只认位置参数 ?，且不支持数组参数绑定
//     （用 $1 会抛 "Too many parameter values were provided"）
// 因此所有手写 SQL 都通过这里的辅助函数生成占位符。
import { DataSource, EntityManager } from 'typeorm';

export type SqlRunner = DataSource | EntityManager;

// DataSource 直接持有 driver；EntityManager 需要经由 connection 取。
// 两者都没有共同的可辨识属性，故用运行时判断。
function driverType(r: SqlRunner): string {
  const anyRunner = r as unknown as { driver?: { options?: { type?: string } }; connection?: { driver?: { options?: { type?: string } } } };
  return anyRunner.driver?.options?.type ?? anyRunner.connection?.driver?.options?.type ?? '';
}

export const isPostgres = (r: SqlRunner): boolean => driverType(r) === 'postgres';

/**
 * 单个位置参数占位符。
 * n 从 1 开始，SQLite 下始终返回 '?'（靠参数数组顺序对应）。
 */
export function ph(r: SqlRunner, n: number): string {
  return isPostgres(r) ? `$${n}` : '?';
}

/**
 * 注意：不要用 TypeORM 的命名参数（`:name`）。`DataSource.query()` / `EntityManager.query()`
 * 的类型签名只接受数组参数（`any[]`），传对象虽在部分版本能工作，但依赖未声明行为；
 * 统一用 ph()/inList() 生成当前驱动真正支持的占位符更可靠。
 */

/** 「列 IN (值列表)」的 SQL 片段与参数数组；values 必须非空。 */
export function inList(r: SqlRunner, col: string, values: string[]): { sql: string; params: string[] } {
  if (isPostgres(r)) {
    return { sql: `${col} = ANY($1)`, params: [values as unknown as string] };
  }
  return { sql: `${col} IN (${values.map(() => '?').join(', ')})`, params: values };
}

/** 判断某表是否存在指定列（用于可选扩展，如 pgvector 的 embedding 列）。 */
export async function hasColumn(r: SqlRunner, table: string, column: string): Promise<boolean> {
  if (isPostgres(r)) {
    const rows: unknown[] = await r.query(
      'SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
      [table, column],
    );
    return rows.length > 0;
  }
  const rows: Array<{ name: string }> = await r.query(`PRAGMA table_info(${table})`);
  return rows.some((c) => c.name === column);
}
