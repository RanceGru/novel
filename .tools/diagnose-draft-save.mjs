// 诊断「新建文本 → 保存」按钮：看按钮是否禁用、点击后弹窗是否出现
import { loginDemo, makeClient, freshBook, selectBookInUi } from './test-utils.mjs';

const PORT = Number(process.env.PORT || 9260);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.find((x) => x.type === 'page' && x.url.includes('5173'));
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.consoleAPICalled') logs.push(`[${m.params.type}] ` + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  return r.exceptionDetails ? { __err: (r.exceptionDetails.exception?.description || '').slice(0, 250) } : r.result.value;
};
await send('Runtime.enable');

const auth = await loginDemo();
const { J } = makeClient(auth.accessToken);
await freshBook(J, '保存按钮诊断书');

await send('Page.reload');
await sleep(8000);

const probe = () => ev(`
  (() => {
    const b=document.querySelector('[data-role="draft-save"]');
    if(!b) return { 有按钮:false };
    const cs=getComputedStyle(b);
    return {
      有按钮:true, 禁用:b.disabled, disabled属性:b.getAttribute('disabled'),
      透明度:cs.opacity, 按钮文本:(b.textContent||'').trim(), title:b.title,
      有草稿框: !!document.querySelector('[data-role="draft-content"]'),
      有弹窗: !!document.querySelector('[data-role="save-draft-dialog"]'),
    };
  })()
`);

// ===== 场景 A：先点「新建文本」，不选作品 =====
console.log('【A】直接点新建文本（不先选作品）');
console.log('  新建文本:', await ev(`(() => { const b=document.querySelector('[data-role="new-text"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`));
await sleep(1500);
const a1 = await probe();
console.log('  按钮状态:', JSON.stringify(a1));
console.log('  点保存:', await ev(`(() => { const b=document.querySelector('[data-role="draft-save"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`));
await sleep(2500);
const a2 = await probe();
console.log('  点击后:', JSON.stringify(a2));

// ===== 场景 B：先选作品，再点新建文本 =====
console.log('\n【B】先选作品，再点新建文本');
const login2 = await loginDemo();
const { J: J2 } = makeClient(login2.accessToken);
const books = (await J2('GET', '/books')).body.data;
console.log('  库里作品:', books.map((b) => b.title).join(', '));
console.log('  选作品:', await ev(selectBookInUi(books[0].title)));
await sleep(2500);
console.log('  新建文本:', await ev(`(() => { const b=document.querySelector('[data-role="new-text"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`));
await sleep(1500);
const b1 = await probe();
console.log('  按钮状态:', JSON.stringify(b1));
console.log('  点保存:', await ev(`(() => { const b=document.querySelector('[data-role="draft-save"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`));
await sleep(3000);
const b2 = await probe();
console.log('  点击后:', JSON.stringify(b2));
if (b2.有弹窗) {
  console.log('  弹窗内容:', JSON.stringify(await ev(`
    (() => {
      const d=document.querySelector('[data-role="save-draft-dialog"]');
      return { 落点:[...d.querySelectorAll('[data-role^="target-"]')].map(x=>(x.textContent||'').trim()) };
    })()
  `)));
}

console.log('\n页面错误日志:');
for (const l of logs.filter((x) => /error|Error/.test(x)).slice(-6)) console.log('  ', l.slice(0, 250));
ws.close();
