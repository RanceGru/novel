// 把已登录的窗口恢复到指定作品：刷新 → 选中该书 → 展开目录
// TITLE 可用环境变量 WINDOW_BOOK_TITLE 覆盖，默认选库里当前存在的那本演示作品
const PORT = 9260;
const TITLE = process.env.WINDOW_BOOK_TITLE || '示例作品';
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
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const t = list.find((x) => x.type === 'page' && x.url.includes('5173'));
  if (!t) throw new Error('未找到窗口（调试端口 ' + PORT + '）');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');

  await cdp.send('Page.reload');
  await sleep(7000);

  const clicked = await cdp.eval(`
    (() => {
      const btns=[...document.querySelectorAll('button')].filter(b=>b.querySelector('img') && /字/.test(b.textContent||''));
      const t=btns.find(b=>(b.textContent||'').includes(${JSON.stringify(TITLE)}));
      if(!t) return 'not-found:' + btns.map(b=>b.textContent.trim()).join('|');
      t.click(); return 'clicked';
    })()
  `);
  console.log('选中作品:', clicked);
  await sleep(2200);

  const toc = await cdp.eval(`
    (() => {
      const s=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()==='目录');
      if(!s.length) return 'no-toc';
      (s[0].closest('div[class*="cursor-pointer"]')||s[0].parentElement).click(); return 'clicked';
    })()
  `);
  console.log('展开目录:', toc);
  await sleep(2000);

  const state = await cdp.eval(`
    (() => ({
      url: location.href,
      books: [...document.querySelectorAll('button')].filter(b=>b.querySelector('img') && /字/.test(b.textContent||'')).map(b=>b.textContent.replace(/\\s+/g,' ').trim()),
      有目录: (document.body.innerText||'').includes('目录'),
    }))()
  `);
  console.log('窗口状态:', JSON.stringify(state, null, 1));
  ws.close();
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
