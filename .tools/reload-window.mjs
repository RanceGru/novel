// 重载常驻窗口，使其重新连上 Vite；随后报告页面与 electronAPI 状态
const PORT = Number(process.env.PORT || 9260);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const t = list.find((x) => x.type === 'page' && x.url.includes('5173'));
  if (!t) throw new Error('未找到窗口（调试端口 ' + PORT + '）');

  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  console.log('已发出重载请求，等待页面就绪...');
  await sleep(9000);

  const r = await send('Runtime.evaluate', {
    expression: `(async () => {
      const auth = JSON.parse(localStorage.getItem('novel-auth') || '{}').state || {};
      const a = window.electronAPI;
      return {
        url: location.href,
        登录用户: auth.user ? auth.user.email : null,
        页面已渲染: (document.body.innerText || '').includes('功能区'),
        作品: [...document.querySelectorAll('button')].filter(b => b.querySelector('img') && /字/.test(b.textContent||'')).map(b => b.textContent.replace(/\\s+/g,' ').trim()),
        electronAPI: a ? { platform: a.getPlatform(), version: await a.getAppVersion() } : null,
      };
    })()`,
    awaitPromise: true, returnByValue: true,
  });
  console.log(JSON.stringify(r.result.value, null, 1));
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
