// 决策依据：Electron 28 的 preload 能不能用 ESM？
//
// 这是当初决定「preload 必须编译成 CommonJS」时做的隔离实验，保留下来作为依据。
// 做法是生成 4 个最小 Electron 应用，正交组合 sandbox 与 preload 格式，
// 用 CDP 检查渲染进程里 contextBridge 暴露的对象是否真的存在。
//
// 实测结论（Electron 28.3.3，Windows）：
//   sandbox=true  + .mjs → ❌ 报错「Cannot use import statement outside a module」
//   sandbox=false + .mjs → ❌ 不报错，但 window.probeAPI 不存在（contextBridge 未生效）
//   sandbox=true  + .cjs → ✅ ping 正常
//   sandbox=false + .cjs → ✅ ping 正常
// 即：preload 必须用 CommonJS，且与 sandbox 开关无关——
// 曾以为「关掉 sandbox 就能用 ESM」是错的，不要再走这条路。
//
// 注意两个踩过的坑：
//  ① 页面必须用 loadFile 加载真实文件；用 data: URL 时 preload 根本不执行，
//     会让所有用例都「无报错但取不到 API」，误判成失败。
//  ② preload 文件内容必须与扩展名匹配；否则 .cjs 里装 ESM 语法是脚手架造成的假失败。
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const ELECTRON = 'E:/project/novel/client/node_modules/electron/dist/electron.exe';
const BASE = 'E:/project/novel/.tools/preload-probe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 生成一个最小 Electron 应用；preload 内容与扩展名保持一致 */
function makeApp(name, { sandbox, preloadExt }) {
  const dir = path.join(BASE, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  // package.json 声明 type: module（复现本项目的情况）
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, type: 'module', main: 'main.js' }, null, 2));

  // 注意：内容必须与扩展名匹配——之前写成「扩展名变、内容不变」，
  // 于是 .cjs 文件里装的是 ESM 语法，那个用例的失败是脚手架造成的假失败。
  const preloadBody = preloadExt === '.cjs'
    ? `const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('probeAPI', { ping: () => 'pong', platform: process.platform });`
    : `import { contextBridge } from 'electron';
contextBridge.exposeInMainWorld('probeAPI', { ping: () => 'pong', platform: process.platform });`;
  writeFileSync(path.join(dir, 'preload' + preloadExt), preloadBody + '\n');

  writeFileSync(path.join(dir, 'main.js'), `
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.disableHardwareAcceleration();
ipcMain.handle('get-app-version', () => app.getVersion());

// 官方事件：preload 加载失败会在这里报出来，比翻 stderr 可靠
app.on('web-contents-created', (_e, wc) => {
  wc.on('preload-error', (_ev, preloadPath, error) => {
    console.log('[PRELOAD-ERROR] ' + preloadPath + ' :: ' + (error && error.message));
  });
  wc.on('console-message', (_ev, level, message) => {
    console.log('[RENDERER] ' + message);
  });
});

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload${preloadExt}'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: ${sandbox},
    },
  });
  // 必须 loadFile 真实文件：data: URL 不会执行 preload（首次实验就栽在这里）
  win.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
`);

  writeFileSync(path.join(dir, 'index.html'), '<html><body>probe</body></html>');
  return dir;
}

async function runCase(name, opts, port) {
  const dir = makeApp(name, opts);
  const out = [];
  const child = spawn(ELECTRON, ['.', `--remote-debugging-port=${port}`], {
    cwd: dir, env: { ...process.env, VITE_DEV_SERVER_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => out.push(d.toString()));
  child.stderr.on('data', (d) => out.push(d.toString()));

  let target = null;
  for (let i = 0; i < 30 && !target; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((x) => x.type === 'page');
    } catch { /* 等待 */ }
  }
  let apiOk = null;
  if (target) {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 0; const pending = new Map();
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    await send('Runtime.enable', {});
    const r = await send('Runtime.evaluate', {
      expression: `JSON.stringify({
        probeAPI: typeof window.probeAPI,
        cjsAPI: typeof window.cjsAPI,
        ping: window.probeAPI ? window.probeAPI.ping() : null,
        hasRequire: typeof window.require,
      })`,
      returnByValue: true, awaitPromise: true,
    });
    apiOk = r.result.value;
    ws.close();
  }
  child.kill();
  await sleep(800);

  const log = out.join('');
  const preloadErr = /PRELOAD-ERROR|Unable to load preload|Cannot use import statement|SyntaxError/i.test(log);
  console.log(`\n${name}`);
  console.log(`  sandbox=${opts.sandbox}  preload 扩展名=${opts.preloadExt}`);
  console.log(`  renderer 探针: ${apiOk}`);
  console.log(`  preload 报错: ${preloadErr ? '有 ❌' : '无'}`);
  const errLines = log.split('\n').filter((l) => /PRELOAD-ERROR|SyntaxError|import statement|preload/i.test(l));
  if (errLines.length) console.log('    日志:', errLines.slice(0, 3).join(' | ').slice(0, 400));
  return { name, apiOk, preloadErr };
}

mkdirSync(BASE, { recursive: true });
const results = [];
results.push(await runCase('sandbox-true-mjs', { sandbox: true, preloadExt: '.mjs' }, 9251));
results.push(await runCase('sandbox-false-mjs', { sandbox: false, preloadExt: '.mjs' }, 9252));
results.push(await runCase('sandbox-true-cjs', { sandbox: true, preloadExt: '.cjs' }, 9253));
results.push(await runCase('sandbox-false-cjs', { sandbox: false, preloadExt: '.cjs' }, 9254));

console.log('\n================ 结论 ================');
for (const r of results) {
  let probe = {};
  try { probe = JSON.parse(r.apiOk || '{}'); } catch { /* ignore */ }
  const ok = probe.ping === 'pong';
  console.log(`${ok ? '✅' : '❌'} ${r.name.padEnd(18)} probeAPI=${probe.probeAPI} ping=${JSON.stringify(probe.ping)} preload报错=${r.preloadErr ? '有' : '无'}`);
}
rmSync(BASE, { recursive: true, force: true });
process.exit(0);
