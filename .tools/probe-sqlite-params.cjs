// 探针：确认 better-sqlite3 支持哪些参数占位符写法
// （用来决定 BookCleanupService 里如何同时兼容 PostgreSQL 与 SQLite）
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('E:/project/novel/server/data/novel-dev.sqlite', { readOnly: true });

const cases = [
  ['?', 'SELECT ? AS a'],
  [':1', 'SELECT :1 AS a'],
  [':p1', 'SELECT :p1 AS a'],
  ['$1', 'SELECT $1 AS a'],
];

for (const [label, sql] of cases) {
  try {
    console.log(label.padEnd(4), '->', JSON.stringify(db.prepare(sql).get('X')));
  } catch (e) {
    console.log(label.padEnd(4), '-> 错误:', e.message);
  }
}
db.close();
