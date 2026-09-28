// 全量验证入口：依次运行所有检查套件并汇总结果。
// 各套件现在各自使用独立作品（按标题取书），因此不再互相污染。
import { spawn } from 'node:child_process';
import { loginDemo, makeClient, deleteBooksByTitle } from './test-utils.mjs';

/** 各套件使用的作品标题；跑完统一清掉，避免测试数据堆在界面里。
 *  注意：这份清单只允许放测试套件自建的作品，绝不能包含用户自己的作品
 *  （例如「示例作品」）—— check-book-cascade 会真的删库，加错就是数据丢失。 */
const TEST_BOOK_TITLES = [
  '纲树结构验证',
  '纲树界面统一验证',
  '细纲对齐验证',
  '角色界面验证书',
  '角色标题行验证书',
  '世界观验证书',
  '编号验证用书',
  '草稿保存验证用书',
  '分卷倒序验证用书',
  '级联删除验证用书',
];

/** 用户自己的作品，任何清理都不得触碰（作为保险再显式声明一次） */
const PROTECTED_BOOK_TITLES = ['示例作品', '作品1'];

const SUITES = [
  ['纲树 API', 'check-outline-api.mjs'],
  ['角色 API', 'check-character-api.mjs'],
  ['作品删除级联', 'check-book-cascade.mjs'],
  ['Electron preload', 'check-preload.mjs'],
  ['preload 重建稳定性', 'check-preload-stability.mjs'],
  ['纲树界面', 'check-outline-ui.mjs'],
  ['细纲对齐', 'check-outline-aligned.mjs'],
  ['角色界面', 'check-character-ui.mjs'],
  ['角色标题行', 'check-character-header.mjs'],
  ['世界观新增', 'check-worldsetting.mjs'],
  ['编号与重命名回归', 'check-regression.mjs'],
  ['草稿保存', 'check-draft-save.mjs'],
  ['分卷倒序', 'check-volume-order.mjs'],
];

/** 单个套件的超时上限；界面套件要反复等 Electron/CDP，给足余量 */
const SUITE_TIMEOUT_MS = 8 * 60 * 1000;

function run(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [`.tools/${file}`], {
      cwd: 'E:/project/novel',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let timedOut = false;
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { out += d.toString(); });

    // 卡死时主动结束，避免整个回归无限等待
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, SUITE_TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) out += `\n[runner] 超过 ${SUITE_TIMEOUT_MS / 1000}s 未结束，已强制终止\n`;
      const m = out.match(/===\s*结论:\s*(\d+)\s*通过\s*\/\s*(\d+)\s*失败\s*===/);
      const failed = [...out.matchAll(/✗\s*(.+)/g)].map((x) => x[1].trim());
      resolve({ code, pass: m ? +m[1] : 0, fail: m ? +m[2] : (code === 0 ? 0 : -1), failed, out });
    });
  });
}

const results = [];
for (const [name, file] of SUITES) {
  process.stdout.write(`▶ ${name} (${file}) ... `);
  const r = await run(file);
  const ok = r.code === 0 && r.fail === 0;
  console.log(ok ? `通过 ${r.pass}/${r.pass + Math.max(r.fail, 0)}` : `失败 (exit=${r.code}, ${r.pass} 通过 / ${r.fail} 失败)`);
  if (!ok) {
    for (const f of r.failed.slice(0, 8)) console.log(`     ✗ ${f}`);
    if (!r.failed.length) console.log('     （未解析到断言失败，输出尾部）\n' + r.out.split('\n').slice(-12).join('\n'));
  }
  results.push({ name, file, ...r, ok });
}

const good = results.filter((r) => r.ok);
console.log(`\n================ 汇总 ================`);
for (const r of results) {
  console.log(`${r.ok ? '✅' : '❌'} ${r.name.padEnd(14)} ${r.ok ? `${r.pass} 通过` : `${r.pass}/${Math.max(r.fail, 0)} 失败`}`);
}
const totalPass = good.reduce((s, r) => s + r.pass, 0);
console.log(`\n套件: ${good.length}/${results.length} 全通过 | 断言: ${totalPass} 条通过`);

// 清理测试作品（保留用户自己的作品）
try {
  const auth = await loginDemo();
  const { J } = makeClient(auth.accessToken);

  // 保险：万一清单里混进了受保护的标题，这里直接拦下来，宁可不清理也不误删
  const bad = TEST_BOOK_TITLES.filter((t) => PROTECTED_BOOK_TITLES.includes(t));
  if (bad.length) throw new Error(`清理清单里含受保护作品，已中止清理: ${bad.join(', ')}`);

  const n = await deleteBooksByTitle(J, TEST_BOOK_TITLES);
  const left = (await J('GET', '/books')).body.data.map((b) => b.title);
  const kept = left.filter((t) => PROTECTED_BOOK_TITLES.includes(t));
  console.log(`已清理测试作品 ${n} 本；剩余作品: ${left.join(', ') || '（无）'}`);
  if (kept.length) console.log(`受保护作品仍在: ${kept.join(', ')}`);
} catch (e) {
  console.log('清理测试作品失败（不影响验证结论）:', e.message);
}

process.exit(good.length === results.length ? 0 : 1);
