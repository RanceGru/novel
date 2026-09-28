// 重启后登录：等 Vite 就绪 → 带调试端口启动 Electron → 注入登录态进写作台
// 用法：先由 pnpm dev:client 启动 Vite（其自身也会拉起一个 Electron），
//       本脚本再启动一个带调试端口的实例以便可靠注入登录态并验证渲染结果。
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const CLIENT = 'E:/project/novel/client';
const SHOTS = 'E:/project/novel/.tools/shots';
const PORT = 9260;
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

async function main() {
  // 1) 登录接口
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@novel.com', password: 'demo123456' }),
  })).json();
  if (!login.success) throw new Error('登录接口失败: ' + JSON.stringify(login));
  console.log('① 登录接口成功:', login.data.user.email);

  // 2) 等 Vite 就绪
  let viteOk = false;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch('http://localhost:5173/');
      if (r.ok) { viteOk = true; break; }
    } catch { /* 等待 */ }
    await sleep(500);
  }
  console.log('② Vite 就绪:', viteOk ? '是' : '否');

  // 3) 启动带调试端口的 Electron。
  //    注意：如果端口上已经有实例在监听（上一次「常驻」留下的），就复用它，
  //    不要再起一个——新实例抢不到调试端口，脚本会一直等到超时。
  //    （这个坑踩过：旧实例占着 9260，新实例默默启动后脚本卡死。）
  let reused = false;
  let t = null;
  const findTarget = async () => {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      return list.find((x) => x.type === 'page' && x.url.includes('5173')) || null;
    } catch { return null; }
  };
  t = await findTarget();
  let child = null;
  if (t) {
    reused = true;
    console.log('③ 调试端口已有实例，复用该窗口（不新起）');
  } else {
    child = spawn(path.join(CLIENT, 'node_modules/electron/dist/electron.exe'),
      ['.', `--remote-debugging-port=${PORT}`],
      { cwd: CLIENT, env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' }, stdio: ['ignore', 'ignore', 'ignore'] });
    console.log('③ 已启动新的 Electron 实例');
  }

  for (let i = 0; i < 40 && !t; i++) {
    await sleep(500);
    t = await findTarget();
  }
  if (!t) { if (child) child.kill(); throw new Error('无法连接调试端口'); }
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');

  // 4) 注入登录态（与登录页提交后 zustand persist 写入的结构一致）并进入写作台
  const authPayload = JSON.stringify({
    state: {
      isAuthenticated: true,
      accessToken: login.data.accessToken,
      refreshToken: login.data.refreshToken,
      user: login.data.user,
    },
    version: 0,
  });
  await cdp.eval(
    `localStorage.setItem('novel-auth', ${JSON.stringify(authPayload)});` +
    `location.replace('http://localhost:5173/workspace'); 'ok'`
  );
  await sleep(6500);

  // 5) 断言渲染结果
  let state = null;
  for (let i = 0; i < 15; i++) {
    const raw = await cdp.eval(`
      (() => {
        const auth = JSON.parse(localStorage.getItem('novel-auth') || '{}').state || {};
        const books = [...document.querySelectorAll('button')]
          .filter(b => b.querySelector('img') && /字/.test(b.textContent || ''))
          .map(b => b.textContent.replace(/\\s+/g, ' ').trim());
        return { url: location.href, email: auth.user ? auth.user.email : null,
                 hasShell: document.body.innerText.includes('功能区'), books };
      })()
    `);
    state = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (state && state.hasShell && state.email) break;
    await sleep(1000);
  }

  console.log('\n③ 界面状态:');
  console.log('   URL      :', state.url);
  console.log('   登录用户 :', state.email);
  console.log('   写作台   :', state.hasShell ? '已渲染' : '未渲染');
  console.log('   作品     :', JSON.stringify(state.books));

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(SHOTS, 'app-restarted.png'), Buffer.from(shot.data, 'base64'));
  console.log('\n   截图: .tools/shots/app-restarted.png');

  let pass = 0, fail = 0;
  const check = (l, c) => { console.log(`   ${c ? '✓' : '✗'} ${l}`); c ? pass++ : fail++; };
  console.log('\n④ 断言:');
  check('已进入写作台 /workspace', (state.url || '').includes('/workspace'));
  check('登录用户为 demo@novel.com', state.email === 'demo@novel.com');
  check('写作台已渲染', state.hasShell);
  console.log(`\n=== ${pass} 通过 / ${fail} 失败 ===`);

  // 常驻模式：保持 CDP 连接与 Electron 存活，使应用窗口一直可用。
  // （脚本退出会带走 Electron 子进程，故需要 keepAlive）
  if (process.env.KEEP_ALIVE === '1') {
    console.log('（常驻模式：应用保持运行，Ctrl+C 或结束本任务即可关闭）');
    setInterval(() => {}, 1 << 30);
    return;
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
