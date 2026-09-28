// 复现用户操作：在一个全新实例里真实地输入账号密码、点「登录」，
// 然后检查窗口路由与 DOM —— 确认登录页是否真的被卸载。
// 关键：全程不注入 localStorage，模拟用户真实操作。
import { spawn } from 'node:child_process';

const CLIENT = 'E:/project/novel/client';
const PORT = 9262;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) { const { resolve } = this.pending.get(m.id); this.pending.delete(m.id); resolve(m.result); }
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
    if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception?.description || '').slice(0, 200) };
    return r.result.value;
  }
  async type(selector, text) {
    // 真实键盘输入：先聚焦，再逐字符派发 key 事件
    await this.eval(`document.querySelector('${selector}').focus()`);
    for (const ch of text) {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch });
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
    }
  }
}

const probe = `
  (() => {
    const text = document.body.innerText || '';
    return {
      url: location.href,
      有登录表单: !!document.querySelector('input[type="password"]'),
      有功能区: text.includes('功能区'),
      有写作区: text.includes('写作区'),
      顶层元素数: document.getElementById('root') ? document.getElementById('root').children.length : -1,
    };
  })()
`;

async function main() {
  const child = spawn(`${CLIENT}/node_modules/electron/dist/electron.exe`,
    ['.', `--remote-debugging-port=${PORT}`],
    { cwd: CLIENT, env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const logs = [];
  child.stderr.on('data', (d) => logs.push(d.toString()));
  child.stdout.on('data', (d) => logs.push(d.toString()));

  let t = null;
  for (let i = 0; i < 40 && !t; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      t = list.find((x) => x.type === 'page');
    } catch { /* 等待 */ }
  }
  if (!t) { child.kill(); throw new Error('无法连接调试端口'); }
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await sleep(7000);

  console.log('① 初始（未登录）:', JSON.stringify(await cdp.eval(probe)));

  // 真实输入
  await cdp.type('input[type="email"]', 'demo@novel.com');
  await sleep(400);
  await cdp.type('input[type="password"]', 'demo123456');
  await sleep(400);
  console.log('② 输入后:', JSON.stringify(await cdp.eval(`
    (() => ({ email: document.querySelector('input[type="email"]').value,
              pwd长度: document.querySelector('input[type="password"]').value.length }))()
  `)));

  // 点登录按钮
  await cdp.eval(`
    (() => {
      const b=[...document.querySelectorAll('button')].find(x=>/^登录/.test((x.textContent||'').trim()));
      if(!b) return 'no-btn'; b.click(); return 'clicked';
    })()
  `);
  await sleep(3000);
  console.log('③ 点登录后 3s:', JSON.stringify(await cdp.eval(probe)));

  await sleep(4000);
  console.log('④ 点登录后 7s:', JSON.stringify(await cdp.eval(probe)));

  // 截一张图确认视觉状态
  try {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    const { writeFileSync } = await import('node:fs');
    writeFileSync('E:/project/novel/.tools/shots/login-flow.jpg', Buffer.from(shot.data, 'base64'));
    console.log('   截图: .tools/shots/login-flow.jpg');
  } catch (e) { console.log('   截图失败:', e.message); }

  // 检查渲染进程是否有报错
  const err = await cdp.eval(`window.__probeErrors || null`);
  console.log('⑤ 渲染进程报错标记:', JSON.stringify(err));

  ws.close();
  child.kill();
  await sleep(1000);
  const preloadErr = logs.join('').split('\n').filter((l) => /error|Error/.test(l)).slice(0, 5);
  if (preloadErr.length) console.log('   主进程日志含错误:', preloadErr.join(' | ').slice(0, 300));
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
