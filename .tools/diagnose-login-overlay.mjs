// 诊断：列出所有 Electron 窗口（无论是否有调试端口），报告各自的 URL、
// localStorage 登录态、路由与页面特征，判断是否存在「两个窗口」或「路由没切干净」
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const CLIENT = 'E:/project/novel/client';
const PORTS = [9260, 9261];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve } = this.pending.get(m.id); this.pending.delete(m.id); resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve) => {
      this.pending.set(id, { resolve });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); resolve({ __timeout: true }); } }, 15000);
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    return r.result ? r.result.value : { __err: JSON.stringify(r).slice(0, 200) };
  }
}

async function inspectPort(port) {
  let list;
  try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); }
  catch { return { port, available: false }; }
  const pages = list.filter((x) => x.type === 'page');
  const out = [];
  for (const p of pages) {
    const ws = new WebSocket(p.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
    const cdp = new CDP(ws);
    await cdp.send('Runtime.enable');
    const info = await cdp.eval(`
      (() => {
        const auth = JSON.parse(localStorage.getItem('novel-auth') || '{}').state || {};
        const text = document.body.innerText || '';
        return {
          url: location.href,
          登录态: !!auth.isAuthenticated,
          用户: auth.user ? auth.user.email : null,
          有登录表单: !!document.querySelector('input[type="password"]'),
          有功能区: text.includes('功能区'),
          有写作区: text.includes('写作区'),
          页面首行: text.split('\\n').map(s=>s.trim()).filter(Boolean).slice(0,3),
        };
      })()
    `);
    out.push({ targetId: p.id, title: p.title, ...info });
    ws.close();
  }
  return { port, available: true, pages: out };
}

async function main() {
  // 1) 当前有调试端口的窗口
  for (const port of PORTS) {
    const r = await inspectPort(port);
    console.log(`\n=== 调试端口 ${port} ===`);
    if (!r.available) { console.log('  （无监听）'); continue; }
    for (const p of r.pages) console.log('  ' + JSON.stringify(p));
  }

  // 2) 自己起一个实例（带独立端口），看它在未注入登录态时是什么表现
  console.log('\n=== 新起一个干净实例（未注入登录态）===');
  const child = spawn(`${CLIENT}/node_modules/electron/dist/electron.exe`,
    ['.', `--remote-debugging-port=9261`],
    { cwd: CLIENT, env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' }, stdio: ['ignore', 'ignore', 'ignore'] });
  await sleep(9000);
  const fresh = await inspectPort(9261);
  if (fresh.available) for (const p of fresh.pages) console.log('  ' + JSON.stringify(p));
  child.kill();
  await sleep(1500);

  // 3) 统计系统里的 Electron 主进程数量
  const out = execFileSync('powershell', ['-NoProfile', '-Command',
    "Get-CimInstance Win32_Process -Filter \"Name='electron.exe'\" | Where-Object { $_.CommandLine -notmatch '--type=' } | Select-Object -ExpandProperty CommandLine"],
    { encoding: 'utf8' });
  const mains = out.split('\n').map((s) => s.trim()).filter(Boolean);
  console.log(`\n=== Electron 主进程数: ${mains.length} ===`);
  mains.forEach((m, i) => console.log(`  ${i + 1}. ${m.slice(0, 120)}`));
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
