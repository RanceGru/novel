// 弹窗对齐验证：以 CDP 驱动 Electron，打开「新建章节」弹窗并测量
// 「分卷外创建」与「分卷内创建」两个文本相对弹窗左边界的水平偏移，确认对齐。
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = 'E:/project/novel';
const CLIENT = path.join(ROOT, 'client');
const SHOTS = path.join(ROOT, '.tools/shots');
const PORT = 9223;
const API = 'http://localhost:3000/api/v1';

mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@novel.com', password: 'demo123456' }),
  });
  const json = await res.json();
  if (!json.success) throw new Error('登录失败: ' + JSON.stringify(json));
  return json.data;
}

/** 确保至少有一本书，否则左侧列表不渲染「新建章节」按钮 */
async function ensureBook(token) {
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const list = await (await fetch(`${API}/books`, { headers: H })).json();
  if (list.data.length > 0) return list.data[0];
  const created = await (await fetch(`${API}/books`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ title: '对齐验证用书', author: '测试' }),
  })).json();
  // 建一个分卷，便于弹窗展示「分卷内创建」的展开项
  await fetch(`${API}/books/${created.data.id}/volumes`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ title: '第一卷', volumeNumber: 1 }),
  });
  return created.data;
}

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
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  }
}

async function main() {
  const auth = await login();
  console.log('登录成功:', auth.user.email);
  const book = await ensureBook(auth.accessToken);
  console.log('使用作品:', book.title);

  const electronBin = path.join(CLIENT, 'node_modules/electron/dist/electron.exe');
  const child = spawn(electronBin, ['.', `--remote-debugging-port=${PORT}`], {
    cwd: CLIENT,
    env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' },
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page' && t.url.includes('5173'));
      if (target) break;
    } catch { /* 端口未就绪 */ }
  }
  if (!target) throw new Error('无法连接调试端口');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  // 注入登录态并进入写作台
  await cdp.eval(`
    localStorage.setItem('novel-auth', ${JSON.stringify(JSON.stringify({
      state: { isAuthenticated: true, accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user },
      version: 0,
    }))});
    location.replace('http://localhost:5173/workspace');
    'ok'
  `);
  await sleep(6000);

  // 先展开作品行（折叠时不会渲染「新建章节」按钮）
  const expandedState = await cdp.eval(`
    (() => {
      const rows = [...document.querySelectorAll('div')].filter(d =>
        d.className && typeof d.className === 'string' && d.className.includes('cursor-pointer') && d.textContent.includes('写作区') === false);
      // 退而求其次：直接找写作区列表里的第一个可点击行
      const zone = [...document.querySelectorAll('div')].find(d => d.textContent.trim() === '写作区');
      return zone ? 'found-zone' : 'no-zone';
    })()
  `);
  console.log('定位写作区:', expandedState);

  // 点击作品标题行展开
  const expanded = await cdp.eval(`
    (() => {
      const btn = document.querySelector('button[title="新建章节"]');
      if (btn) return 'already-expanded';
      // 找写作区中的书籍行：包含字数文本（如 "0字"）的最近可点击祖先
      const nodes = [...document.querySelectorAll('div,button')];
      for (const n of nodes) {
        if (/\\d+字/.test(n.textContent || '') && n.textContent.length < 40) {
          const clickable = n.closest('[onclick],button,div[class*="cursor-pointer"]');
          if (clickable) { clickable.click(); return 'expanded:' + clickable.tagName; }
        }
      }
      return 'row-not-found';
    })()
  `);
  console.log('展开作品:', expanded);
  await sleep(1500);

  // 打开「新建章节」弹窗：点击书籍行上的 FilePlus 按钮
  const opened = await cdp.eval(`
    (() => {
      const btn = document.querySelector('button[title="新建章节"]');
      if (!btn) return 'NOT_FOUND';
      btn.click();
      return 'CLICKED';
    })()
  `);
  console.log('打开弹窗:', opened);
  await sleep(1200);

  // 测量两个入口文本相对弹窗左边界的偏移
  const measured = await cdp.eval(`
    (() => {
      const dialog = document.querySelector('div.fixed.inset-0.z-50 > div');
      if (!dialog) return JSON.stringify({ error: '弹窗未找到' });
      const dl = dialog.getBoundingClientRect().left;
      const pick = (el) => {
        if (!el) return null;
        // 取文本所在元素（button 本身或 summary 内的 span）
        const r = el.getBoundingClientRect();
        return { left: Math.round((r.left - dl) * 100) / 100, width: Math.round(r.width * 100) / 100 };
      };
      const btn = dialog.querySelector('button');
      const sum = dialog.querySelector('summary');
      const btnText = btn ? btn.querySelector('span.flex-1') : null;
      const sumText = sum ? sum.querySelector('span.flex-1') : null;
      return JSON.stringify({
        dialogLeft: dl,
        分卷外创建: pick(btnText),
        分卷内创建: pick(sumText),
        文本对齐: (btnText && sumText)
          ? (Math.abs(btnText.getBoundingClientRect().left - sumText.getBoundingClientRect().left) < 0.5)
          : null,
      }, null, 2);
    })()
  `);
  console.log('测量结果:', measured);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const out = path.join(SHOTS, 'dialog-align.png');
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('截图:', out);

  ws.close();
  child.kill();
  await sleep(400);
  process.exit(0);
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
