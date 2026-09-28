// 界面自检脚本：以 CDP 驱动 Electron，注入登录态后打开写作台并截图
// 用途：验证前端三栏工作台是否能正常挂载并渲染真实数据（仅本地开发自检）
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'E:/project/novel';
const CLIENT = path.join(ROOT, 'client');
const SHOTS = path.join(ROOT, '.tools/shots');
const PORT = 9222;
const API = 'http://localhost:3000/api/v1';

mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 通过 HTTP 登录，拿到真实 token 与用户信息 */
async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@novel.com', password: 'test123456' }),
  });
  const json = await res.json();
  if (!json.success) throw new Error('登录失败: ' + JSON.stringify(json));
  return json.data;
}

/** 极简 CDP 客户端（Node 内置 WebSocket） */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP 超时: ${method}`));
        }
      }, 20000);
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  }
}

async function main() {
  const auth = await login();
  console.log('已获取登录态, 用户:', auth.user.email);

  // 启动带调试端口的 Electron
  const electronBin = path.join(CLIENT, 'node_modules/electron/dist/electron.exe');
  const child = spawn(electronBin, ['.', `--remote-debugging-port=${PORT}`], {
    cwd: CLIENT,
    env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write('[electron] ' + d));
  child.stderr.on('data', (d) => process.stderr.write('[electron:err] ' + d));

  // 等待调试端口就绪
  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page' && t.url.includes('5173'));
      if (target) break;
    } catch {
      /* 端口还没起来 */
    }
  }
  if (!target) throw new Error('未能连接到 Electron 调试端口');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.setDeviceMetricsOverride', {
    width: 1440, height: 824, deviceScaleFactor: 1, mobile: false,
  }).catch(() => {});

  // 注入登录态（模拟已登录用户）
  await cdp.evaluate(`
    localStorage.setItem('novel-auth', ${JSON.stringify(JSON.stringify({
      state: {
        isAuthenticated: true,
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        user: auth.user,
      },
      version: 0,
    }))});
    location.replace('http://localhost:5173/workspace');
    'ok'
  `);
  await sleep(6000);

  const info = await cdp.evaluate(`
    JSON.stringify({
      url: location.href,
      title: document.title,
      rootChildren: document.getElementById('root')?.children.length ?? -1,
      text: (document.body.innerText || '').slice(0, 600),
    })
  `);
  console.log('页面状态:', info);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const out = path.join(SHOTS, 'workspace-cdp.png');
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('截图已保存:', out);

  const errors = cdp.events
    .filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
    .map((e) => e.params.entry.text);
  console.log('控制台错误数:', errors.length);
  errors.slice(0, 10).forEach((t) => console.log('  [error]', t));

  ws.close();
  child.kill();
  await sleep(500);
  process.exit(0);
}

main().catch((e) => {
  console.error('自检失败:', e.message);
  process.exit(1);
});
