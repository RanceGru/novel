// 数据库配置 — PostgreSQL (优先) / SQLite (开发回退)
import { TypeOrmModuleOptions, TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { Logger } from '@nestjs/common';

const logger = new Logger('DatabaseConfig');

export function databaseConfig(): TypeOrmModuleOptions {
  // 检测是否配置了 PostgreSQL
  const usePostgres = process.env.DB_TYPE === 'postgres' ||
    (!process.env.DB_TYPE && process.env.DB_HOST);

  if (usePostgres) {
    logger.log('使用 PostgreSQL 数据库');
    return {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'novel',
      password: process.env.DB_PASSWORD || 'novel_dev_password',
      database: process.env.DB_DATABASE || 'novel_writing',
      entities: [join(__dirname, '../modules/**/*.entity{.ts,.js}')],
      migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      extra: { max: 20, idleTimeoutMillis: 30000 },
    };
  }

  // SQLite 回退 (零配置开发环境)
  logger.warn('⚠️ 未检测到 PostgreSQL，使用 SQLite (开发模式)');
  return {
    type: 'better-sqlite3',
    database: join(__dirname, '../../data/novel-dev.sqlite'),
    entities: [join(__dirname, '../modules/**/*.entity{.ts,.js}')],
    synchronize: true,
    logging: ['error', 'warn'],
  };
}
