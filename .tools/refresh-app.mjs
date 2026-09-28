// 刷新已登录的窗口并截图（复用 restart-and-login 启动的调试端口）
import { writeFileSync } from 'node:fs';

const PORT = 9260;
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
    if (r.exceptionDetails) return { __error: (r.exceptionDetails.exception?.description || '').slice(0, 200) };
    return r.result.value;
  }
}

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const t = list.find(x => x.type === 'page' && x.url.includes('5173'));
  if (!t) throw new Error('未找到页面（应用可能已关闭）');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');

  await cdp.send('Page.reload', { ignoreCache: false });
  await sleep(7000);

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
  const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
  console.log('刷新后状态:', JSON.stringify(state));

  // 展开该作品的相关 → 纲树，展示新结构
  await cdp.eval(`
    (() => {
      const b=[...document.querySelectorAll('button')].find(x=>x.querySelector('img') && /字/.test(x.textContent||''));
      if(b) b.click(); return 'ok';
    })()
  `);
  await sleep(1600);
  const clickByText = (text) => `
    (() => {
      const el=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()==='${text}');
      if(!el.length) return 'no-span';
      (el[0].closest('div[class*="cursor-pointer"]')||el[0].closest('button')||el[0].parentElement).click();
      return 'clicked';
    })()
  `;
  console.log('展开相关:', await cdp.eval(clickByText('相关')));
  await sleep(1400);
  console.log('展开纲树:', await cdp.eval(clickByText('纲树')));
  await sleep(2600);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('E:/project/novel/.tools/shots/app-final.png', Buffer.from(shot.data, 'base64'));
  console.log('截图: .tools/shots/app-final.png');
  ws.close();
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
