// 分卷空状态验证：展开一个无章节的分卷，确认出现「暂无内容，点击右边 + 新建」提示，
// 且未展开时不存在该提示（说明它确实由展开动作触发）。
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'E:/project/novel';
const CLIENT = path.join(ROOT, 'client');
const SHOTS = path.join(ROOT, '.tools/shots');
const PORT = 9224;
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
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  }
}

/** 精确统计空状态提示元素，并检查其内部是否还残留图标 */
const PROBE = `
  (() => {
    const all = [...document.querySelectorAll('div.text-text-tertiary')];
    const hints = all.filter(d => (d.textContent || '').includes('暂无内容'));
    const hintBoxes = hints.map(h => {
      const r = h.getBoundingClientRect();
      return {
        left: Math.round(r.left),
        top: Math.round(r.top),
        text: h.textContent.trim(),
        svgChildren: h.querySelectorAll('svg').length,
      };
    });
    const volRows = [...document.querySelectorAll('button')].filter(b => /^第\\d+卷/.test((b.textContent || '').trim()));
    return JSON.stringify({
      hintCount: hintBoxes.length,
      hints: hintBoxes,
      分卷行数: volRows.length,
      分卷行文本: volRows.map(v => v.textContent.trim().slice(0, 24)),
    });
  })()
`;

async function main() {
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@novel.com', password: 'demo123456' }),
  })).json();
  const auth = login.data;
  console.log('登录成功:', auth.user.email);

  // 直接用 API 准备确定性数据：确保有一本书，且其中有一个「无章节」的分卷
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` };
  let books = (await (await fetch(`${API}/books`, { headers: H })).json()).data;
  if (!books.length) {
    const b = await (await fetch(`${API}/books`, {
      method: 'POST', headers: H, body: JSON.stringify({ title: '空分卷验证', author: '测试' }),
    })).json();
    books = [b.data];
  }
  const book = books[0];
  let vols = (await (await fetch(`${API}/books/${book.id}/volumes`, { headers: H })).json()).data;
  let emptyVol = null;
  for (const v of vols) {
    const chs = (await (await fetch(`${API}/volumes/${v.id}/chapters`, { headers: H })).json()).data;
    if (chs.length === 0) { emptyVol = v; break; }
  }
  if (!emptyVol) {
    const n = vols.filter(v => v.title !== '默认').length + 1;
    const r = await (await fetch(`${API}/books/${book.id}/volumes`, {
      method: 'POST', headers: H, body: JSON.stringify({ title: `分卷${n}`, volumeNumber: n }),
    })).json();
    emptyVol = r.data;
  }
  console.log(`准备数据: 作品「${book.title}」/ 空分卷「第${emptyVol.volumeNumber}卷 ${emptyVol.title}」`);

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
    } catch { /* 等待端口 */ }
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

  await cdp.eval(`
    localStorage.setItem('novel-auth', ${JSON.stringify(JSON.stringify({
      state: { isAuthenticated: true, accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user },
      version: 0,
    }))});
    location.replace('http://localhost:5173/workspace');
    'ok'
  `);
  await sleep(6000);

  // 1) 展开作品行：点击作品标题按钮（"写作区" 列表内、含封面图的行）
  console.log('展开作品:', await cdp.eval(`
    (() => {
      // 作品行是包含封面 img 且带 flex/truncate 标题的按钮
      const btns = [...document.querySelectorAll('button')].filter(b => b.querySelector('img') && /字/.test(b.textContent || ''));
      if (!btns.length) return 'no-book-row';
      btns[0].click();
      return 'clicked:' + btns[0].textContent.trim().slice(0, 20);
    })()
  `));
  await sleep(1500);

  // 2) 展开「目录」行（该行是可点击的 div，文本节点为「相关」/「目录」）
  console.log('展开目录:', await cdp.eval(`
    (() => {
      const spans = [...document.querySelectorAll('span')].filter(s => (s.textContent || '').trim() === '目录');
      if (!spans.length) return 'no-toc-span';
      const row = spans[0].closest('div[class*="cursor-pointer"]') || spans[0].parentElement;
      row.click();
      return 'clicked';
    })()
  `));
  await sleep(2200);

  // 3) 展开前：不应出现分卷内的空状态（此时可能有书籍级空状态，故只比对数量变化）
  // 3) 展开前记录（此时分卷应处于折叠态）
  const volCount = await cdp.eval(`
    (() => [...document.querySelectorAll('button')].filter(b => /第\\d+卷/.test(b.textContent || '')).length)()
  `);
  console.log('页面上分卷行数:', volCount);

  const before = JSON.parse(await cdp.eval(PROBE));
  console.log('展开分卷前:', JSON.stringify(before));

  // 4) 点击分卷行展开
  console.log('展开分卷:', await cdp.eval(`
    (() => {
      const rows = [...document.querySelectorAll('button')].filter(b => /第\\d+卷/.test(b.textContent || ''));
      if (!rows.length) return 'no-volume-row';
      rows[0].click(); return 'clicked:' + rows[0].textContent.trim().slice(0, 24);
    })()
  `));
  await sleep(1800);

  const after = JSON.parse(await cdp.eval(PROBE));
  console.log('展开分卷后:', JSON.stringify(after, null, 2));

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(SHOTS, 'volume-empty.png'), Buffer.from(shot.data, 'base64'));
  console.log('截图: .tools/shots/volume-empty.png');

  // 结论
  const appeared = after.hintCount > before.hintCount;
  console.log(`\n结论: 展开空分卷后提示${appeared ? '已出现 ✓' : '未出现 ✗'}（${before.hintCount} -> ${after.hintCount}）`);

  ws.close(); child.kill();
  await sleep(400);
  process.exit(appeared ? 0 : 1);
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
