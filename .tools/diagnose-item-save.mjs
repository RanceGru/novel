// 诊断：在条目编辑器里改内容并点保存，看中间区域实际渲染了什么、错误在哪
import { loginDemo, makeClient, freshBook, selectBookInUi, openRelatedInUi } from './test-utils.mjs';

const PORT = Number(process.env.PORT || 9260);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.find((x) => x.type === 'page' && x.url.includes('5173'));
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.consoleAPICalled') logs.push(`[console.${m.params.type}] ` + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  return r.exceptionDetails ? { __err: (r.exceptionDetails.exception?.description || '').slice(0, 300) } : r.result.value;
};

await send('Runtime.enable');

const auth = await loginDemo();
const { J } = makeClient(auth.accessToken);
const book = await freshBook(J, '保存诊断书');
await J('GET', `/books/${book.id}/world-settings`);

await send('Page.reload');
await sleep(8000);
console.log('选作品:', await ev(selectBookInUi(book.title)));
await sleep(2500);
console.log('展开相关:', await ev(openRelatedInUi()));
await sleep(1800);
console.log('展开世界观:', await ev(`
  (() => {
    const s=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()==='世界观');
    if(!s.length) return 'not-found';
    (s[0].closest('div[class*="cursor-pointer"]')||s[0].parentElement).click();
    return 'clicked';
  })()
`));
await sleep(2500);
console.log('点条目:', await ev(`(() => { const r=document.querySelector('[data-world-row="fixed"][data-world-title="时代信息"]'); if(!r) return 'no-row'; r.click(); return 'clicked'; })()`));
await sleep(1600);

const probe = await ev(`
  (() => {
    const item=document.querySelector('[data-role="item-content"]');
    return {
      有内容框: !!item,
      内容框可编辑: item ? !item.readOnly && !item.disabled : null,
      有保存按钮: !!document.querySelector('[data-role="item-save"]'),
      有正文编辑器: !!document.querySelector('.tiptap-editor'),
      菜单里所有data-role: [...new Set([...document.querySelectorAll('[data-role]')].map(e=>e.getAttribute('data-role')))].slice(0,25),
      页面文本前200字: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,200),
    };
  })()
`);
console.log('中间区域状态:', JSON.stringify(probe, null, 1));

// 写入并保存
console.log('写内容:', await ev(`
  (() => {
    const el=document.querySelector('[data-role="item-content"]');
    if(!el) return 'no-el';
    const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    set.call(el,'诊断内容XYZ'); el.dispatchEvent(new Event('input',{bubbles:true}));
    return 'ok';
  })()
`));
await sleep(400);
console.log('点保存:', await ev(`(() => { const b=document.querySelector('[data-role="item-save"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`));
await sleep(3500);

const after = await ev(`
  (() => {
    const item=document.querySelector('[data-role="item-content"]');
    return { 内容框值: item ? item.value : null, 页面文本前200字: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,200) };
  })()
`);
console.log('保存后:', JSON.stringify(after, null, 1));
const wsData = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
console.log('库里的时代信息:', JSON.stringify(wsData.find((s) => s.title === '时代信息')?.content));

console.log('\n页面日志（错误优先）:');
for (const l of logs.filter((x) => /error|Error|失败/.test(x)).slice(-8)) console.log('  ', l.slice(0, 300));
ws.close();
