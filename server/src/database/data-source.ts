// TypeORM 数据源配置 (用于 CLI 迁移命令)
// 使用方式: DB_HOST=localhost DB_USERNAME=novel ... npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
import { DataSource } from 'typeorm';
import { join } from 'path';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'novel',
  password: process.env.DB_PASSWORD || 'novel_dev_password',
  database: process.env.DB_DATABASE || 'novel_writing',
  entities: [join(__dirname, '../modules/**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false,
  logging: true,
});
