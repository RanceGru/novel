// Electron 主进程入口
import { app, BrowserWindow, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM 环境下兼容 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.disableHardwareAcceleration();

// 显式设置应用名，否则 app.getVersion() / app.getName() 在未打包时会退回 Electron 默认值
app.setName('AI 智能小说生成助手');
app.setAppUserModelId('com.novel.assistant');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'AI 智能小说生成助手',
    webPreferences: {
      // 与 vite.config.ts 的 preload 构建产物一致（CommonJS，扩展名 .cjs）
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // 开发模式加载 Vite dev server，生产模式加载打包文件
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// IPC：preload 通过 contextBridge 暴露给渲染进程的能力，必须在主进程有对应实现，
// 否则渲染进程调用时会以「No handler registered」被 reject。
// 注意：read-file / save-file 属于文件系统能力，正式版本需按套餐（Lite+）做权限校验，
// 目前仅在主进程侧限定了必须为绝对路径，避免渲染进程误传相对路径写到意外位置。
// ---------------------------------------------------------------------------
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('read-file', async (_event, filePath: string) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    throw new Error('read-file 需要绝对路径');
  }
  return fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('save-file', async (_event, filePath: string, content: string) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    throw new Error('save-file 需要绝对路径');
  }
  await fs.writeFile(filePath, String(content ?? ''), 'utf-8');
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
