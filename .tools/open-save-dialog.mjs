// 打开「保存到」弹窗并下钻到「目录 → 第1卷」，截图留档
import { loginDemo, makeClient, freshBook, seedBook, selectBookInUi } from './test-utils.mjs';
import { writeFileSync } from 'node:fs';

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

const auth = await loginDemo();
const { J } = makeClient(auth.accessToken);
// 注意：截图用的书必须是专属标题。
// 曾经这里用了「示例作品」，freshBook 会先删同名作品，把用户的演示数据一起删了。
const book = await freshBook(J, '保存弹窗截图用书');
await seedBook(J, book.id, { volumeCount: 2, chaptersOfFirst: 2 });

await send('Page.reload');
await sleep(8000);
console.log('选作品:', await ev(selectBookInUi(book.title)));
await sleep(2500);
console.log('新建文本:', await ev(`(() => { const b=document.querySelector('[data-role="new-text"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`));
await sleep(1500);
await ev(`
  (() => {
    const el=document.querySelector('[data-role="draft-content"]');
    const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    set.call(el,'少年林逸自边城起势，卷入一桩灭门旧案……');
    el.dispatchEvent(new Event('input',{bubbles:true}));
    return 'ok';
  })()
`);
await sleep(400);
console.log('点保存:', await ev(`(() => { const b=document.querySelector('[data-role="draft-save"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`));
await sleep(2500);
const clickRow = (label) => `
  (() => {
    const rows=[...document.querySelectorAll('[data-role^="save-row-"]')].filter(r=>r.getAttribute('data-row-kind')!=='disabled');
    const t=rows.find(r=>(r.textContent||'').trim().startsWith(${JSON.stringify(label)}));
    if(!t) return 'not-found'; t.click(); return 'clicked';
  })()
`;
console.log('进入目录:', await ev(clickRow('目录')));
await sleep(1500);
console.log('进入分卷:', await ev(clickRow('第1卷')));
await sleep(1500);
console.log('选中新建章节:', await ev(clickRow('新建章节')));
await sleep(1200);
const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
if (shot && shot.data) {
  writeFileSync('E:/project/novel/.tools/shots/save-as-dialog.jpg', Buffer.from(shot.data, 'base64'));
  console.log('截图已保存');
}
ws.close();
