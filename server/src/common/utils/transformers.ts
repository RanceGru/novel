// TypeORM 列转换器
// 背景：`bigint` 列在 PostgreSQL 下经 pg 驱动返回的是**字符串**（避免精度丢失），
// 直接参与算术运算会得到字符串拼接或 NaN。SQLite 下返回 number，行为不一致。
// 统一转换为 number，保证两种数据库下业务代码拿到相同的 JS 类型。
import type { ValueTransformer } from 'typeorm';

export const bigintTransformer: ValueTransformer = {
  /** 写入数据库：保持为数值 */
  to: (value: number | null | undefined): number | null | undefined => value,
  /** 从数据库读取：Postgres 返回字符串，转为 number */
  from: (value: string | number | null): number | null => {
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? parseInt(value, 10) : value;
  },
};
