// 复现「新建作品后无法新建分卷 / 分卷外章节」
// 用 API 建一本全新作品（等价于点「新建作品」），再用真实 UI 操作它
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'E:/project/novel';
const CLIENT = path.join(ROOT, 'client');
const SHOTS = path.join(ROOT, '.tools/shots');
const PORT = 9232;
const API = 'http://localhost:3000/api/v1';
mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      } else if (m.method) this.events.push(m);
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
    if (r.exceptionDetails) return { __error: (r.exceptionDetails.exception?.description || '').slice(0, 200) };
    return r.result.value;
  }
  errors() {
    return [...new Set(this.events
      .filter(e => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
      .map(e => e.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 160)))];
  }
}

const setVal = (sel, v) => `
  (() => {
    const el = document.querySelector('${sel}');
    if (!el) return 'no-el';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, '${v}');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()
`;

async function main() {
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@novel.com', password: 'demo123456' }),
  })).json();
  const auth = login.data;
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` };

  // 模拟「新建作品」：造一本全新、没有任何分卷的作品
  const fresh = (await (await fetch(`${API}/books`, {
    method: 'POST', headers: H, body: JSON.stringify({ title: '全新作品X', author: '测试' }),
  })).json()).data;
  console.log('已新建作品:', fresh.title, '(无分卷)');

  const electronBin = path.join(CLIENT, 'node_modules/electron/dist/electron.exe');
  const child = spawn(electronBin, ['.', `--remote-debugging-port=${PORT}`], {
    cwd: CLIENT, env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' },
    stdio: ['ignore', 'ignore', 'ignore'],
  });
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

  // 1) 展开新作品（点它的作品行）
  console.log('\n1) 展开作品行:', await cdp.eval(`
    (() => {
      const b=[...document.querySelectorAll('button')].find(x=>x.querySelector('img') && (x.textContent||'').includes('${fresh.title}'));
      if(!b) return 'no-row';
      b.click(); return 'clicked';
    })()
  `));
  await sleep(1800);
  console.log('   展开后可见的入口:', await cdp.eval(`
    (() => {
      const spans=[...document.querySelectorAll('span')].map(s=>(s.textContent||'').trim());
      return JSON.stringify({
        有相关: spans.includes('相关'),
        有目录: spans.includes('目录'),
        有新建分卷按钮: !!document.querySelector('button[title="新建分卷"]'),
        有新建章节按钮: !!document.querySelector('button[title="新建章节"]'),
      });
    })()
  `));

  // 2) 点「目录」
  console.log('\n2) 点目录:', await cdp.eval(`
    (() => {
      const s=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()==='目录');
      if(!s.length) return 'no-toc';
      // 只点属于该作品的那个目录行
      for (const el of s) {
        const row = el.closest('div[class*="cursor-pointer"]') || el.parentElement;
        const bookRow = el.closest('div')?.parentElement;
        row.click();
        return 'clicked-first';
      }
      return 'none';
    })()
  `));
  await sleep(2000);
  console.log('   目录区状态:', await cdp.eval(`
    (() => {
      const empty=[...document.querySelectorAll('div')].find(d=>(d.textContent||'').trim()==='暂无内容，点击右边+新建');
      return JSON.stringify({
        显示空状态: !!empty,
        新建分卷按钮存在: !!document.querySelector('button[title="新建分卷"]'),
        新建章节按钮存在: !!document.querySelector('button[title="新建章节"]'),
      });
    })()
  `));

  // 3) 点「新建分卷」
  console.log('\n3) 点新建分卷:', await cdp.eval(`
    (() => { const b=document.querySelector('button[title="新建分卷"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()
  `));
  await sleep(1500);
  console.log('   编辑器:', await cdp.eval(`
    (() => {
      const num=document.querySelector('input[type="number"][title^="第几"]');
      const title=document.querySelector('input[placeholder$="标题"]');
      return JSON.stringify({ 出现: !!title, number: num?num.value:null, title: title?title.value:null });
    })()
  `));
  const shot1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(SHOTS, 'repro-newbook-volume.png'), Buffer.from(shot1.data, 'base64'));

  // 取消，避免留下草稿
  await cdp.eval(`(() => { const b=document.querySelector('button[title^="取消"]'); if(b) b.click(); return 'ok'; })()`);
  await sleep(800);

  // 4) 点空状态里的「分卷外创建」 —— 但空状态只是提示文字，没有按钮
  console.log('\n4) 空状态是否可点（分卷外创建入口）:', await cdp.eval(`
    (() => {
      const hint=[...document.querySelectorAll('div')].find(d=>(d.textContent||'').trim()==='暂无内容，点击右边+新建');
      if(!hint) return 'no-hint';
      return JSON.stringify({ 是按钮吗: hint.tagName === 'BUTTON', 标签: hint.tagName, 有onclick: typeof hint.onclick === 'function' });
    })()
  `));

  // 5) 用「新建章节」按钮（弹窗）测试分卷外创建
  console.log('\n5) 点新建章节（弹窗）:', await cdp.eval(`
    (() => { const b=document.querySelector('button[title="新建章节"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()
  `));
  await sleep(1200);
  console.log('   弹窗内容:', await cdp.eval(`
    (() => {
      const spans=[...document.querySelectorAll('span')].map(s=>(s.textContent||'').trim());
      return JSON.stringify({ 有分卷外创建: spans.includes('分卷外创建'), 有分卷内创建: spans.includes('分卷内创建') });
    })()
  `));
  console.log('   点分卷外创建:', await cdp.eval(`
    (() => {
      const sp=[...document.querySelectorAll('span')].find(s=>(s.textContent||'').trim()==='分卷外创建');
      if(!sp) return 'no-span';
      (sp.closest('button')||sp.parentElement).click(); return 'clicked';
    })()
  `));
  await sleep(2000);
  console.log('   编辑器:', await cdp.eval(`
    (() => {
      const num=document.querySelector('input[type="number"][title^="第几"]');
      const title=document.querySelector('input[placeholder$="标题"]');
      return JSON.stringify({ 出现: !!title, number: num?num.value:null });
    })()
  `));
  const shot2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(SHOTS, 'repro-newbook-chapter.png'), Buffer.from(shot2.data, 'base64'));

  console.log('\n控制台错误:', JSON.stringify(cdp.errors()));
  ws.close(); child.kill();
  await sleep(400);
  process.exit(0);
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
