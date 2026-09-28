// 比对「世界观」下固定条目与新增条目的渲染是否一致（几何 + 结构）
const PORT = Number(process.env.PORT || 9260);

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.find((x) => x.type === 'page' && x.url.includes('5173'));
if (!t) throw new Error('未找到窗口');
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');

const r = await send('Runtime.evaluate', {
  expression: `(() => {
    const info = (sel) => [...document.querySelectorAll(sel)].map(el => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        标题: el.getAttribute('data-world-title'),
        左: Math.round(b.left), 高: Math.round(b.height),
        左内边距: cs.paddingLeft, 字号: cs.fontSize, 颜色: cs.color,
        子元素: [...el.children].map(c => c.tagName.toLowerCase()).join('+'),
        有svg: !!el.querySelector('svg'),
      };
    });
    return { 固定: info('[data-world-row="fixed"]'), 新增: info('[data-world-row="item"]') };
  })()`,
  returnByValue: true,
});
const v = r.result.value;
console.log('固定条目:');
for (const x of v.固定) console.log('  ', JSON.stringify(x));
console.log('新增条目:');
for (const x of v.新增) console.log('  ', JSON.stringify(x));

const keys = ['左', '高', '左内边距', '字号', '颜色', '子元素', '有svg'];
// 注意：两组的条目数量不同（固定 7 条、新增若干），所以要比「取值集合」而不是数组本身
const uniq = (arr) => JSON.stringify([...new Set(arr.map((x) => JSON.stringify(x)))].sort());
const same = keys.every((k) => uniq(v.固定.map((x) => x[k])) === uniq(v.新增.map((x) => x[k])));
console.log(`\n几何/样式/结构完全一致: ${same ? '是 ✅' : '否 ❌'}`);
if (!same) {
  for (const k of keys) {
    const a = uniq(v.固定.map((x) => x[k]));
    const b = uniq(v.新增.map((x) => x[k]));
    if (a !== b) console.log(`  差异 ${k}: 固定=${a} 新增=${b}`);
  }
}
ws.close();
process.exit(same ? 0 : 1);
