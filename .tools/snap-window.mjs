// 对当前窗口截图（仅留档用）
import { writeFileSync } from 'node:fs';
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
const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 75 });
if (shot && shot.data) {
  writeFileSync(`E:/project/novel/.tools/shots/${process.argv[2] || 'window'}.jpg`, Buffer.from(shot.data, 'base64'));
  console.log('截图已保存');
} else {
  console.log('截图未返回数据');
}
ws.close();
