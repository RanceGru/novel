// Electron preload 修复验证：
// 此前 preload 被编译成 ESM，而 Electron 的 sandbox preload 只支持 CJS，
// 报「Cannot use import statement outside a module」，contextBridge 从未执行，
// 渲染进程里 window.electronAPI 一直是 undefined。
//
// 本脚本通过 CDP 直接检查渲染进程：
//   ① window.electronAPI 存在且方法齐全
//   ② 同步方法 getPlatform() 可用
//   ③ 异步 IPC getAppVersion() 能真正拿到值（证明主进程 handler 已注册）
//   ④ 文件读写 IPC 往返一致，且拒绝相对路径
//   ⑤ 主进程/渲染进程控制台没有 preload 相关报错
//
// 默认验证开发模式（加载 Vite dev server）；加 --prod 则不加 VITE_DEV_SERVER_URL，
// 让主进程走 loadFile(dist/index.html)，验证打包场景下 preload 同样注入。
import { spawn } from 'node:child_process';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

const CLIENT = 'E:/project/novel/client';
const PORT = 9241;
const PROD = process.argv.includes('--prod');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (l, c, extra = '') => { console.log(`   ${c ? '✓' : '✗'} ${l}${extra ? ' ' + extra : ''}`); c ? pass++ : fail++; };

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.logs = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.consoleAPICalled') {
        this.logs.push({ type: m.params.type, text: (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ') });
      }
      if (m.method === 'Log.entryAdded') {
        this.logs.push({ type: m.params.entry.level, text: m.params.entry.text });
      }
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
    if (r.exceptionDetails) return { __error: (r.exceptionDetails.exception?.description || '').slice(0, 400) };
    return r.result.value;
  }
}

async function main() {
  const tmp = mkdtempSync(path.join(tmpdir(), 'novel-preload-'));
  const target = path.join(tmp, 'roundtrip.txt');

  // 先确认构建产物确实是 CJS
  console.log('【⓪ 构建产物】');
  const preloadPath = path.join(CLIENT, 'dist-electron/preload.cjs');
  if (existsSync(preloadPath)) {
    const built = readFileSync(preloadPath, 'utf-8');
    check('存在 dist-electron/preload.cjs', true);
    check('不含 ESM import 语句', !/^\s*import\s/m.test(built));
    check('使用 CJS require', /require\(["']electron["']\)/.test(built));
  } else {
    check('存在 dist-electron/preload.cjs', false, '（需先构建）');
  }

  const child = spawn(path.join(CLIENT, 'node_modules/electron/dist/electron.exe'),
    ['.', `--remote-debugging-port=${PORT}`],
    {
      cwd: CLIENT,
      // 生产模式不设 VITE_DEV_SERVER_URL，主进程会 loadFile(dist/index.html)
      env: PROD ? { ...process.env, VITE_DEV_SERVER_URL: '' } : { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  let mainStderr = '';
  child.stderr.on('data', (d) => { mainStderr += d.toString(); });
  child.stdout.on('data', (d) => { mainStderr += d.toString(); });

  let t = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      t = list.find((x) => x.type === 'page' && (PROD ? x.url.startsWith('file:') : x.url.includes('5173')));
      if (t) break;
    } catch { /* 等待 */ }
  }
  if (!t) { child.kill(); throw new Error('无法连接调试端口'); }
  console.log(`   窗口 URL: ${t.url}`);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.enable');
  await sleep(6000);   // 等页面加载完，preload 已注入

  console.log('\n【① window.electronAPI 是否暴露】');
  const api = await cdp.eval(`
    (() => {
      const a = window.electronAPI;
      if (!a) return { ok:false, keys:[] };
      return { ok:true, keys:Object.keys(a), types:Object.fromEntries(Object.entries(a).map(([k,v])=>[k, typeof v])) };
    })()
  `);
  check('window.electronAPI 存在', api.ok, api.ok ? '' : '（仍未注入）');
  if (api.ok) {
    const expect = ['getAppVersion', 'getPlatform', 'saveFile', 'readFile', 'onSyncStatusChange'];
    check('方法齐全', expect.every(k => api.keys.includes(k)), JSON.stringify(api.keys));
  }

  console.log('\n【② 同步方法】');
  const platform = await cdp.eval(`window.electronAPI ? window.electronAPI.getPlatform() : null`);
  check('getPlatform() 返回平台名', typeof platform === 'string' && platform.length > 0, String(platform));

  console.log('\n【③ 异步 IPC：主进程 handler 是否注册】');
  const version = await cdp.eval(`
    (async () => {
      try { return { ok:true, value: await window.electronAPI.getAppVersion() }; }
      catch (e) { return { ok:false, error: String(e && e.message || e) }; }
    })()
  `);
  check('getAppVersion() 拿到应用版本', version.ok && !!version.value, JSON.stringify(version));

  console.log('\n【④ 文件读写 IPC 往返】');
  writeFileSync(target, '预置内容', 'utf-8');
  const read = await cdp.eval(`
    (async () => {
      try { return { ok:true, value: await window.electronAPI.readFile(${JSON.stringify(target)}) }; }
      catch (e) { return { ok:false, error: String(e && e.message || e) }; }
    })()
  `);
  check('readFile() 读到预置内容', read.ok && read.value === '预置内容', JSON.stringify(read));

  const save = await cdp.eval(`
    (async () => {
      try { await window.electronAPI.saveFile(${JSON.stringify(target)}, '写入内容OK'); return { ok:true }; }
      catch (e) { return { ok:false, error: String(e && e.message || e) }; }
    })()
  `);
  const afterSave = readFileSync(target, 'utf-8');
  check('saveFile() 写盘成功', save.ok && afterSave === '写入内容OK', JSON.stringify({ save, afterSave }));

  const rel = await cdp.eval(`
    (async () => {
      try { await window.electronAPI.readFile('relative/path.txt'); return { ok:true }; }
      catch (e) { return { ok:false, error: String(e && e.message || e) }; }
    })()
  `);
  check('拒绝相对路径（不越权读写）', !rel.ok && /绝对路径/.test(rel.error || ''), JSON.stringify(rel));

  console.log('\n【⑤ 控制台与主进程输出】');
  const noise = [...cdp.logs, { type: 'main', text: mainStderr }]
    .filter(l => /preload|import statement|Cannot use import|Unable to load/i.test(l.text || ''));
  check('无 preload 相关报错', noise.length === 0, noise.map(n => n.text.slice(0, 160)).join(' | '));

  ws.close();
  child.kill();
  rmSync(tmp, { recursive: true, force: true });

  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
