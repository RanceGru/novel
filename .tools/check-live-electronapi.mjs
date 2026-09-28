// 检查常驻窗口（调试端口 9260）里的 window.electronAPI 是否真的可用
const PORT = 9260;

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
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');

  const r = await send('Runtime.evaluate', {
    expression: `(async () => {
      const a = window.electronAPI;
      if (!a) return { has: false };
      return { has: true, keys: Object.keys(a), platform: a.getPlatform(), version: await a.getAppVersion() };
    })()`,
    awaitPromise: true, returnByValue: true,
  });
  const v = r.result.value;
  console.log('常驻窗口 electronAPI:', JSON.stringify(v));
  console.log(v.has && v.version ? '  ✅ 可用（preload 已生效）' : '  ❌ 不可用');
  ws.close();
  process.exit(v.has && v.version ? 0 : 1);
}
main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
