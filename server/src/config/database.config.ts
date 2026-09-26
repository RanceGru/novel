// 数据库配置
// 支持两种驱动：
//   postgres  — 生产/联调目标（PostgreSQL 16）
//   sqlite    — 本地零配置回退（开发专用，不用于生产）
//
// pgvector 说明：本文件不依赖 pgvector 扩展。向量列目前以 simple-json（Postgres 下为 text）存储，
// 向量检索走 vector-search.service.ts 的 JS 余弦回退路径。待需要原生检索时，
// 只需在 Postgres 实例上安装 pgvector 扩展并执行一次列迁移，代码侧无需改动。
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { Logger } from '@nestjs/common';

const logger = new Logger('DatabaseConfig');

/** 显式解析驱动类型，避免环境变量缺失导致的隐式回退 */
function resolveDriver(): 'postgres' | 'better-sqlite3' {
  const explicit = process.env.DB_TYPE?.toLowerCase();

  if (explicit === 'postgres' || explicit === 'postgresql') return 'postgres';
  if (explicit === 'sqlite' || explicit === 'better-sqlite3') return 'better-sqlite3';

  if (explicit) {
    throw new Error(`不支持的 DB_TYPE: ${explicit}（可选 postgres | sqlite）`);
  }

  // 生产环境必须显式指定，避免静默落到本地 SQLite 造成数据分叉
  if (process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须显式设置 DB_TYPE=postgres');
  }

  // 开发环境：配置了 DB_HOST 视为使用 Postgres，否则回退 SQLite
  return process.env.DB_HOST ? 'postgres' : 'better-sqlite3';
}

export function databaseConfig(): TypeOrmModuleOptions {
  const isDev = process.env.NODE_ENV === 'development';
  const driver = resolveDriver();

  // 实体路径：编译产物在 dist/ 下为 .js，ts-node 直接运行时为 .ts
  const entities = [join(__dirname, '../modules/**/*.entity{.ts,.js}')];

  if (driver === 'postgres') {
    logger.log(
      `使用 PostgreSQL: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_DATABASE || 'novel_writing'}`,
    );
    return {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'novel',
      password: process.env.DB_PASSWORD || 'novel_dev_password',
      database: process.env.DB_DATABASE || 'novel_writing',
      entities,
      migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
      // 仅开发环境允许自动同步表结构；生产必须走迁移
      synchronize: isDev,
      logging: isDev ? ['error', 'warn'] : ['error'],
      extra: { max: 20, idleTimeoutMillis: 30000 },
    };
  }

  logger.warn('⚠️ 未启用 PostgreSQL，使用 SQLite 回退（仅限本地开发）');
  return {
    type: 'better-sqlite3',
    database: join(__dirname, '../../data/novel-dev.sqlite'),
    entities,
    synchronize: true,
    logging: ['error', 'warn'],
  };
}
