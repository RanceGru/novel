// 把窗口切到「目录」并展开分卷、点开一个章节，便于查看纯文本正文编辑器
const PORT = Number(process.env.PORT || 9260);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.find((x) => x.type === 'page' && x.url.includes('5173'));
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  return r.exceptionDetails ? { __err: (r.exceptionDetails.exception?.description || '').slice(0, 200) } : r.result.value;
};
await send('Runtime.enable'); await send('Page.enable');
await send('Page.reload');
await sleep(8000);

// 选中一个分卷数最多的作品（作品3 里有测试章节）
console.log('选作品:', await ev(`
  (() => {
    const btns=[...document.querySelectorAll('button')].filter(b=>b.querySelector('img') && /字/.test(b.textContent||''));
    const t=btns.find(b=>/作品3/.test(b.textContent||'')) || btns.find(b=>/示例作品/.test(b.textContent||''));
    if(!t) return 'not-found'; t.click(); return 'clicked';
  })()
`));
await sleep(2500);
console.log('展开目录:', await ev(`
  (() => {
    const s=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()==='目录');
    if(!s.length) return 'not-found';
    (s[0].closest('div[class*="cursor-pointer"]')||s[0].parentElement).click();
    return 'clicked';
  })()
`));
await sleep(2000);
const vol = await ev(`
  (() => {
    const s=[...document.querySelectorAll('span')].filter(x=>/^第\\d+卷/.test((x.textContent||'').trim()));
    if(!s.length) return 'no-volume';
    (s[0].closest('button')||s[0]).click();
    return 'clicked:'+(s[0].textContent||'').trim().slice(0,16);
  })()
`);
console.log('展开分卷:', vol);
await sleep(2500);
const ch = await ev(`
  (() => {
    const s=[...document.querySelectorAll('span')].filter(x=>/^第\\d+章 /.test((x.textContent||'').trim()));
    if(!s.length) return 'no-chapter';
    (s[0].closest('button')||s[0]).click();
    return 'clicked:'+(s[0].textContent||'').trim().slice(0,18);
  })()
`);
console.log('点开章节:', ch);
await sleep(2500);
console.log('正文编辑器:', JSON.stringify(await ev(`
  (() => ({
    纯文本框: !!document.querySelector('[data-role="chapter-content"]'),
    富文本残留: !!document.querySelector('.tiptap-editor'),
    字数: (document.querySelector('[data-role="char-count"]')||{}).textContent,
    内容前40字: (document.querySelector('[data-role="chapter-content"]')||{}).value?.slice(0,40),
  }))()
`)));
ws.close();
