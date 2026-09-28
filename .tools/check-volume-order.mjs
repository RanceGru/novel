// 验证分卷倒序展示与新建草稿的插入位置
// 断言基于真实 DOM 顺序，不依赖任何调试钩子
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loginDemo, makeClient, freshBook, seedBook, selectBookInUi, openTocInUi } from './test-utils.mjs';

const CLIENT = 'E:/project/novel/client';
const SHOTS = 'E:/project/novel/.tools/shots';
const PORT = 9236;
const API = 'http://localhost:3000/api/v1';
mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('超时: ' + method)); } }, 20000);
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) return { __error: (r.exceptionDetails.exception?.description || '').slice(0, 300) };
    return r.result.value;
  }
}

/** 按 DOM 顺序输出 [卷号 | 'DRAFT'] */
const ORDER = `
  (() => {
    const num = document.querySelector('input[type="number"][title*="第几"]');
    const rows = [...document.querySelectorAll('button')].filter(b => /第\\d+卷 /.test(b.textContent || ''));
    let draftRow = null;
    if (num) { let el = num; while (el) { if ((el.className||'').toString().includes('pl-10')) { draftRow = el; break; } el = el.parentElement; } }
    const kids = draftRow && draftRow.parentElement ? [...draftRow.parentElement.children] : [];
    const seq = [];
    for (const c of kids) {
      const btn = c.querySelector && c.querySelector('button');
      const numIn = c.querySelector && c.querySelector('input[type="number"]');
      if (btn && /第\\d+卷 /.test(btn.textContent || '')) seq.push(Number((btn.textContent.match(/第(\\d+)卷/) || [])[1]));
      else if (numIn) seq.push('DRAFT');
    }
    return JSON.stringify({ seq, savedOnly: rows.map(r => Number((r.textContent.match(/第(\\d+)卷/) || [])[1])) });
  })()
`;

const setNum = (v) => `
  (() => {
    const el = document.querySelector('input[type="number"][title*="第几"]');
    if (!el) return 'no-el';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, '${v}');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()
`;

async function main() {
  const auth = await loginDemo();
  const { H, J } = makeClient(auth.accessToken);
  // 用本套件专属的作品，并清掉上次遗留
  const book = await freshBook(J, '分卷倒序验证用书');
  await seedBook(J, book.id, { volumeCount: 2, chaptersOfFirst: 0 });
  const volumes = (await J('GET', `/books/${book.id}/volumes`)).body.data
    .filter(v => v.title !== '默认').map(v => v.volumeNumber).sort((a, b) => b - a);
  console.log('数据库卷号（降序）:', volumes.join(', '));

  const child = spawn(path.join(CLIENT, 'node_modules/electron/dist/electron.exe'),
    ['.', `--remote-debugging-port=${PORT}`],
    { cwd: CLIENT, env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' }, stdio: ['ignore', 'ignore', 'ignore'] });
  let t = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      t = list.find((x) => x.type === 'page' && x.url.includes('5173'));
      if (t) break;
    } catch { /* 等待 */ }
  }
  if (!t) throw new Error('无法连接调试端口');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  await cdp.eval(`
    localStorage.setItem('novel-auth', ${JSON.stringify(JSON.stringify({
      state: { isAuthenticated: true, accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user },
      version: 0 }))});
    location.replace('http://localhost:5173/workspace'); 'ok'
  `);
  await sleep(6000);
  // 点作品行 = 切换当前作品并展开；再点「目录」展开页签
  console.log('选择作品:', await cdp.eval(selectBookInUi(book.title)));
  await sleep(2500);
  console.log('展开目录:', await cdp.eval(openTocInUi()));
  await sleep(2000);

  let pass = 0, fail = 0;
  const check = (label, cond, extra = '') => { console.log(`   ${cond ? '✓' : '✗'} ${label} ${extra}`); cond ? pass++ : fail++; };

  // ① 倒序
  const base = JSON.parse(await cdp.eval(ORDER));
  console.log('\n【① 分卷倒序】');
  console.log('   DOM 顺序:', JSON.stringify(base.savedOnly));
  check('已保存分卷为降序', JSON.stringify(base.savedOnly) === JSON.stringify([...base.savedOnly].sort((a, b) => b - a)));

  // ② 新建草稿默认号 = 最大+1，且在最上方
  await cdp.eval(`(() => { const b=document.querySelector('button[title="新建分卷"]'); if(b) b.click(); return 'ok'; })()`);
  await sleep(1600);
  console.log('\n【② 新建草稿】');
  let o = JSON.parse(await cdp.eval(ORDER));
  console.log('   顺序:', JSON.stringify(o.seq));
  check('草稿默认排在最上方', o.seq[0] === 'DRAFT', `（seq=${JSON.stringify(o.seq)}）`);

  // ③ 改号后按倒序插到对应位置
  console.log('\n【③ 草稿改号后的插入位置】');
  const maxVol = Math.max(...base.savedOnly);
  const cases = [
    { v: String(maxVol), expect: 'top' },
    { v: '1', expect: 'between-or-bottom' },
    { v: '0', expect: 'bottom' },
  ];
  for (const c of cases) {
    await cdp.eval(setNum(c.v));
    await sleep(900);
    o = JSON.parse(await cdp.eval(ORDER));
    const draftAt = o.seq.indexOf('DRAFT');
    const nums = o.seq.filter(x => x !== 'DRAFT');
    const isDesc = JSON.stringify(nums) === JSON.stringify([...nums].sort((a, b) => b - a));
    console.log(`   草稿号=${c.v} -> seq=${JSON.stringify(o.seq)}`);
    check(`  卷号保持降序`, isDesc);
    if (c.expect === 'top') check(`  草稿在最上方`, draftAt === 0);
    if (c.expect === 'bottom') check(`  草稿在最下方`, draftAt === o.seq.length - 1);
    if (c.expect === 'between-or-bottom') check(`  草稿不在最上方`, draftAt > 0);
  }

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(SHOTS, 'order-final.png'), Buffer.from(shot.data, 'base64'));

  // 取消
  await cdp.eval(`(() => { const b=document.querySelector('button[title^="取消"]'); if(b) b.click(); return 'ok'; })()`);
  await sleep(900);
  const after = JSON.parse(await cdp.eval(ORDER));
  check('取消后无草稿残留', !after.seq.includes('DRAFT'));

  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  ws.close(); child.kill();
  await sleep(400);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
