// Vite 配置 — Electron + React + Tailwind
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            // Preload 必须编译成 CommonJS 并命名为 .cjs：
            // 本包 package.json 是 "type": "module"，vite-plugin-electron 会据此
            // 默认把入口编译成 ESM；但 Electron 的 sandbox preload 只支持 CJS，
            // 加载 ESM preload 会报「Cannot use import statement outside a module」，
            // 于是 contextBridge 从未执行、渲染进程里 window.electronAPI 一直是 undefined。
            // 用 .cjs 扩展名是因为 "type": "module" 会把同目录的 .js 视作 ESM。
            lib: {
              entry: 'electron/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.cjs',
            },
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
