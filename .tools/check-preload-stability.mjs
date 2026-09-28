// preload 构建稳定性检查：多次触发重建，确认产物始终是干净的 CJS。
//
// 为什么单独有这个检查：曾经出现过「首次构建正常、改动源码后重建就变成 ESM」的问题
// （vite-plugin-electron 的 lib 模式会为同一入口生成多个 format 的 output，都指向
// preload.cjs，并发写同一文件、谁后写谁赢）。而且两种产物字节数完全相同（613B），
// 只看文件大小完全发现不了，必须查内容。
//
// 注意：本脚本会在 preload.ts 末尾追加再移除自己的标记注释，
// 不使用 git checkout，以免覆盖使用者本地未提交的修改。
import { appendFileSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';

const SRC = 'E:/project/novel/client/electron/preload.ts';
const OUT = 'E:/project/novel/client/dist-electron/preload.cjs';
const MARK = '// preload-stability-probe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (l, c, extra = '') => { console.log(`   ${c ? '✓' : '✗'} ${l}${extra ? ' ' + extra : ''}`); c ? pass++ : fail++; };

/** 产物是否为「干净的 CJS preload」 */
function inspect() {
  const t = readFileSync(OUT, 'utf-8');
  const noImport = !/^\s*import\s/m.test(t);
  const noExport = !/(^|\n)\s*export\s/.test(t);
  const hasRequire = /require\(["']electron["']\)/.test(t);
  const exposesOnce = (t.match(/exposeInMainWorld/g) || []).length === 1;
  return { ok: noImport && noExport && hasRequire && exposesOnce, size: statSync(OUT).size, noImport, noExport, hasRequire, exposesOnce, text: t };
}

/** 移除本脚本留下的标记，还原源码 */
function cleanupSource() {
  if (!existsSync(SRC)) return;
  const t = readFileSync(SRC, 'utf-8');
  if (!t.includes(MARK)) return;
  writeFileSync(SRC, t.replace(new RegExp(`\\r?\\n?${MARK}\\r?\\n?`, 'g'), ''), 'utf-8');
}

async function main() {
  if (!existsSync(OUT)) throw new Error(`产物不存在: ${OUT}（请先启动 dev 或执行 build）`);

  console.log('【preload 重建稳定性】');
  const first = inspect();
  check('初始产物是干净的 CJS', first.ok, `${first.size}B`);

  for (let i = 1; i <= 3; i++) {
    appendFileSync(SRC, `\n${MARK}\n`);
    await sleep(6000);
    let r = inspect();
    // 构建写入过程中可能读到半个文件，复核一次以排除假失败
    if (!r.ok) { await sleep(3000); r = inspect(); }
    check(`第 ${i} 次重建后仍是干净的 CJS`, r.ok,
      r.ok ? `${r.size}B` : `${r.size}B import=${!r.noImport} export=${!r.noExport} require=${r.hasRequire} exposeOnce=${r.exposesOnce}`);
    if (!r.ok && i === 1) {
      console.log('     --- 产物内容 ---');
      console.log(r.text.split('\n').slice(0, 16).map((l, n) => `     ${n + 1}: ${l}`).join('\n'));
    }
  }

  cleanupSource();
  const restored = readFileSync(SRC, 'utf-8');
  check('源码已还原（无残留标记）', !restored.includes(MARK));

  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { cleanupSource(); console.error('失败:', e.message); process.exit(1); });
