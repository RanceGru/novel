// 把窗口定位到「相关」标签，便于直接查看角色/世界观等分区
const PORT = Number(process.env.PORT || 9260);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
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
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.reload');
  await sleep(8000);

  // 与 test-utils / 其它界面套件一致的写法：
  // 先按文本精确定位 <span>，再点它所在的可点击父节点
  const clickBySpan = (text) => `
    (() => {
      const s=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()===${JSON.stringify(text)});
      if(!s.length) return 'not-found';
      (s[0].closest('div[class*="cursor-pointer"]')||s[0].closest('button')||s[0].parentElement).click();
      return 'clicked';
    })()
  `;
  // 选中演示作品 → 展开相关 → 展开角色
  console.log('选中作品:', await send('Runtime.evaluate', {
    expression: `(() => {
      const btns=[...document.querySelectorAll('button')].filter(b=>b.querySelector('img') && /字/.test(b.textContent||''));
      const t=btns.find(b=>(b.textContent||'').includes('示例作品'));
      if(!t) return 'not-found'; t.click(); return 'clicked';
    })()`, returnByValue: true,
  }).then((r) => r.result.value));
  await sleep(2500);

  // 展开「相关」「世界观」；角色默认收起，避免把世界观挤出可视区
  const steps = (process.env.OPEN_STEPS || '相关,世界观').split(',');
  for (const text of steps) {
    const r = await send('Runtime.evaluate', { expression: clickBySpan(text), returnByValue: true });
    console.log(`展开${text}:`, r.result.value);
    await sleep(1800);
  }

  // 注意：表达式必须是 IIFE —— 直接写 { ... } 会被当成语句块，求值为 undefined
  const state = await send('Runtime.evaluate', {
    expression: `(() => ({
      角色行: !!document.querySelector('[data-role="character-header"]'),
      新建按钮: !!document.querySelector('[data-role="new-character"]'),
      角色标题行文本: (document.querySelector('[data-role="character-header"]')?.textContent||'').trim(),
      页面含熊图标: (document.body.innerText||'').includes('\u{1F464}'),
      角色行数: document.querySelectorAll('[data-char-row="character"]').length,
    }))()`, returnByValue: true,
  });
  console.log('窗口状态:', JSON.stringify(state.result.value));
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
