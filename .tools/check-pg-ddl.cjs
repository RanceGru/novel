// Postgres 实体类型预检：无需真实数据库连接，用 TypeORM 的 Postgres 驱动
// 构建元数据并规范化每个列的类型，验证实体定义在 PostgreSQL 下是否成立。
//
// 覆盖三类曾经的隐患：
//   1. SQLite 专有的 datetime 类型
//   2. 可空日期列（Date | null 反射为 Object）导致的 DataTypeNotSupportedError
//   3. bigint 在 Postgres 下返回字符串导致算术错误（必须带 transformer）
const path = require('path');
const { createRequire } = require('module');

const SERVER = 'E:/project/novel/server';
const requireFromServer = createRequire(path.join(SERVER, 'package.json'));
const { DataSource } = requireFromServer('typeorm');

const DATE_PROPS = /createdAt|updatedAt|lastLoginAt|startedAt|expiresAt|resolvedAt|revokedAt/;

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 5432,
    username: 'novel',
    password: 'novel_dev_password',
    database: 'novel_writing',
    entities: [path.join(SERVER, 'dist/modules/**/*.entity.js')],
    synchronize: false,
  });

  // buildMetadatas 内部会执行 EntityMetadataValidator —— 类型不合法会直接抛错
  await ds.buildMetadatas();

  const tables = ds.entityMetadatas;
  console.log(`✓ 元数据校验通过，已加载 ${tables.length} 个实体\n`);

  const problems = [];
  const dateTypes = new Map();
  const vectorCols = [];
  const bigintCols = [];

  for (const meta of tables) {
    for (const col of meta.columns) {
      const pgType = ds.driver.normalizeType(col);
      if (/datetime/i.test(pgType)) {
        problems.push(`${meta.tableName}.${col.propertyName} 仍是 datetime`);
      }
      if (DATE_PROPS.test(col.propertyName)) {
        dateTypes.set(pgType, (dateTypes.get(pgType) || 0) + 1);
      }
      if (col.propertyName === 'embedding') {
        vectorCols.push(`${meta.tableName}.${col.databaseName} -> ${pgType}`);
      }
      if (/bigint/i.test(pgType)) {
        bigintCols.push({
          name: `${meta.tableName}.${col.propertyName}`,
          hasTransformer: !!col.transformer,
        });
      }
    }
  }

  console.log('=== 向量列（期望 text，即不依赖 pgvector 扩展）===');
  vectorCols.forEach((v) => console.log('  ' + v));

  console.log('\n=== 日期列的 Postgres 类型分布 ===');
  [...dateTypes.entries()].forEach(([t, n]) => console.log(`  ${t}: ${n} 列`));

  console.log('\n=== bigint 列及 transformer ===');
  const missing = bigintCols.filter((b) => !b.hasTransformer);
  bigintCols.forEach((b) => console.log(`  ${b.hasTransformer ? '✓' : '⚠'} ${b.name}`));
  if (missing.length) {
    console.log(`  注意: ${missing.length} 个 bigint 列未加 transformer，Postgres 下会返回字符串`);
  }

  console.log('\n=== 结论 ===');
  if (problems.length === 0) {
    console.log('✓ 全部实体可在 PostgreSQL 16 下建表（无 SQLite 专有类型）');
  } else {
    problems.forEach((p) => console.log('✗ ' + p));
  }
  process.exit(problems.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('✗ 预检失败:', e.message);
  process.exit(1);
});
