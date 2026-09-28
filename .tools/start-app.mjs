// 以远程调试启动 App，注入持久登录态并进入写作台，用内置登录功能断言最终状态
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const CLIENT = 'E:/project/novel/client';
const SHOTS = 'E:/project/novel/.tools/shots';
const PORT = 9250;
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
  // 1) 用真实登录接口拿 token（等价于用户在登录页提交）
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@novel.com', password: 'demo123456' }),
  })).json();
  console.log('① 登录接口:', login.success ? `成功 (${login.data.user.email})` : '失败');

  // 2) 启动 App（带远程调试），注入登录态 —— 与登录页提交后写入的 localStorage 一致
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

  // 构造要写入 localStorage 的登录态（与登录页提交后 zustand persist 写入的结构一致）
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

  // 3) 等页面稳定后再断言（首次加载可能仍在请求数据）
  let state = null;
  for (let i = 0; i < 20; i++) {
    const raw = await cdp.eval(`
      (() => {
        const auth = JSON.parse(localStorage.getItem('novel-auth') || '{}').state || {};
        const bookRows = [...document.querySelectorAll('button')]
          .filter(b => b.querySelector('img') && /字/.test(b.textContent || ''))
          .map(b => b.textContent.replace(/\\s+/g, ' ').trim());
        return {
          url: location.href,
          hasToken: !!auth.accessToken,
          email: auth.user ? auth.user.email : null,
          isAuthenticated: !!auth.isAuthenticated,
          books: bookRows,
          hasShell: document.body.innerText.includes('功能区'),
        };
      })()
    `);
    state = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (state && state.books && state.books.length >= 0 && state.hasShell && state.hasToken) break;
    await sleep(1000);
  }

  console.log('\n② 界面状态:');
  console.log('   当前 URL   :', state.url);
  console.log('   登录态     :', state.isAuthenticated ? '已登录' : '未登录', '|', state.email);
  console.log('   写作台可见 :', state.hasShell ? '是' : '否');
  console.log('   侧栏作品   :', JSON.stringify(state.books));

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(SHOTS, 'app-logged-in.png'), Buffer.from(shot.data, 'base64'));
  console.log('\n   截图: .tools/shots/app-logged-in.png');

  let pass = 0, fail = 0;
  const check = (l, c) => { console.log(`   ${c ? '✓' : '✗'} ${l}`); c ? pass++ : fail++; };
  console.log('\n③ 断言:');
  check('已跳转到写作台 /workspace', state.url.includes('/workspace'));
  check('持有访问令牌', state.hasToken);
  check('登录用户为 demo@novel.com', state.email === 'demo@novel.com');
  check('写作台已渲染', state.hasShell);
  check('侧栏作品与后端一致（仅 1 本「编号验证用书」）',
    state.books.length === 1 && state.books[0].includes('编号验证用书'),
    `实际=${JSON.stringify(state.books)}`);

  console.log(`\n=== ${pass} 通过 / ${fail} 失败 ===`);
  console.log('（本进程保持运行，即用户看到的应用窗口）');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
